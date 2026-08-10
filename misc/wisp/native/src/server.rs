use bytes::Bytes;
use papaya::HashMap as PapayaMap;
use socket2::{Domain, Protocol, SockAddr, Socket, Type};
use sockudo_ws::{Config, Message, WebSocketStream};
use std::io::Cursor;
use std::net::IpAddr;
use std::os::unix::io::{FromRawFd, IntoRawFd};
use std::pin::Pin;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncRead, AsyncWrite, AsyncReadExt, AsyncWriteExt, ReadBuf};
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use xxhash_rust::xxh3::xxh3_64;

use crate::filter;
use crate::options::Options;
use crate::packet;

pub type BlockedCb = Arc<dyn Fn(String) + Send + Sync>;

static CONN_COUNTER: AtomicU64 = AtomicU64::new(0);

fn new_conn_id() -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64;
    let n = CONN_COUNTER.fetch_add(1, Ordering::Relaxed);
    let hash = xxh3_64(&[ts.to_le_bytes(), n.to_le_bytes()].concat());
    format!("{hash:016x}")
}

#[derive(json_steroids::JsonSerialize)]
struct ConnLog<'a> {
    conn_id: &'a str,
    remote_ip: &'a str,
    remote_port: u16,
    url: &'a str,
}

struct PrefixedStream<S> {
    prefix: Cursor<Vec<u8>>,
    inner: S,
}

impl<S> PrefixedStream<S> {
    fn new(prefix: Vec<u8>, inner: S) -> Self {
        Self {
            prefix: Cursor::new(prefix),
            inner,
        }
    }
}

impl<S: AsyncRead + Unpin> AsyncRead for PrefixedStream<S> {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        let pos = self.prefix.position() as usize;
        let data = self.prefix.get_ref();
        if pos < data.len() {
            let remaining = &data[pos..];
            let n = remaining.len().min(buf.remaining());
            buf.put_slice(&remaining[..n]);
            self.prefix.set_position((pos + n) as u64);
            return Poll::Ready(Ok(()));
        }
        Pin::new(&mut self.inner).poll_read(cx, buf)
    }
}

impl<S: AsyncWrite + Unpin> AsyncWrite for PrefixedStream<S> {
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<std::io::Result<usize>> {
        Pin::new(&mut self.inner).poll_write(cx, buf)
    }
    fn poll_flush(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.inner).poll_flush(cx)
    }
    fn poll_shutdown(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.inner).poll_shutdown(cx)
    }
}

struct StreamHandle {
    data_tx: mpsc::Sender<Bytes>,
    hostname: String,
}

pub async fn handle_connection<S>(
    stream: S,
    head: Vec<u8>,
    remote_ip: String,
    remote_port: u16,
    url: String,
    wisp_version: u8,
    opts: Options,
    on_blocked: Option<BlockedCb>,
) where
    S: AsyncRead + AsyncWrite + Unpin + Send + 'static,
{
    let prefixed = PrefixedStream::new(head, stream);
    let ws = WebSocketStream::server(prefixed, Config::default());
    let (mut ws_reader, mut ws_writer) = ws.split();

    let (incoming_tx, incoming_rx) = mpsc::channel::<Bytes>(512);
    let (outgoing_tx, mut outgoing_rx) = mpsc::channel::<Bytes>(512);

    tokio::spawn(async move {
        loop {
            match ws_reader.next().await {
                Some(Ok(Message::Binary(data))) => {
                    if incoming_tx.send(data).await.is_err() {
                        break;
                    }
                }
                Some(Ok(Message::Close(_))) | Some(Err(_)) | None => break,
                _ => {}
            }
        }

    });

    tokio::spawn(async move {
        while let Some(data) = outgoing_rx.recv().await {
            if ws_writer.send(Message::Binary(data)).await.is_err() {
                break;
            }
        }
    });

    handle_messages(incoming_rx, outgoing_tx, remote_ip, remote_port, url, wisp_version, opts, on_blocked).await;
}

pub async fn handle_messages(
    mut incoming: mpsc::Receiver<Bytes>,
    outgoing: mpsc::Sender<Bytes>,
    remote_ip: String,
    remote_port: u16,
    url: String,
    wisp_version: u8,
    opts: Options,
    on_blocked: Option<BlockedCb>,
) {
    let conn_id = new_conn_id();

    let log_entry = ConnLog {
        conn_id: &conn_id,
        remote_ip: &remote_ip,
        remote_port,
        url: &url,
    };
    log::info!(
        "new connection: {}",
        json_steroids::to_string(&log_entry)
    );

    let ws_tx = outgoing;
    let opts = Arc::new(opts);

    if wisp_version == 2 {
        let mut ext_buf: Vec<u8> = Vec::new();
        if opts.allow_udp_streams {
            ext_buf.extend_from_slice(&packet::make_udp_extension());
        }
        if let Some(ref motd) = opts.wisp_motd {
            ext_buf.extend_from_slice(&packet::make_motd_extension(motd));
        }

        let info = Bytes::from(packet::make_info_packet(2, &ext_buf));
        if ws_tx.send(info).await.is_err() {
            log::warn!("[{conn_id}] closed before INFO sent");
            return;
        }

        match incoming.recv().await {
            Some(_) => {}
            None => {
                log::warn!("[{conn_id}] closed during handshake");
                return;
            }
        }
    }

    if ws_tx
        .send(Bytes::from(packet::make_continue_packet(0, 128)))
        .await
        .is_err()
    {
        return;
    }

    let streams: Arc<PapayaMap<u32, StreamHandle>> = Arc::new(PapayaMap::new());

    while let Some(data) = incoming.recv().await {
        if let Err(e) = route_packet(&data, &ws_tx, &streams, &opts, &conn_id, &on_blocked).await {
            log::warn!("[{conn_id}] packet error: {e}");
        }
    }

    let guard = streams.pin();
    let ids: Vec<u32> = guard.iter().map(|(k, _)| *k).collect();
    drop(guard);
    for id in ids {
        streams.pin().remove(&id);
    }

    log::info!("[{conn_id}] connection closed");
}

async fn route_packet(
    data: &[u8],
    ws_tx: &mpsc::Sender<Bytes>,
    streams: &Arc<PapayaMap<u32, StreamHandle>>,
    opts: &Arc<Options>,
    conn_id: &str,
    on_blocked: &Option<BlockedCb>,
) -> Result<(), String> {
    let pkt = packet::WispPacket::parse(data).ok_or("packet too small")?;

    match pkt.packet_type {
        packet::PACKET_CONNECT => {
            let connect =
                packet::ConnectPayload::parse(pkt.payload).ok_or("invalid CONNECT payload")?;
            let kind = if connect.stream_type == packet::STREAM_TCP { "TCP" } else { "UDP" };
            log::info!(
                "[{conn_id}] opening {kind} stream {} → {}:{}",
                pkt.stream_id,
                connect.hostname,
                connect.port
            );

            let (data_tx, data_rx) = mpsc::channel::<Bytes>(128);
            streams.pin().insert(
                pkt.stream_id,
                StreamHandle {
                    data_tx,
                    hostname: connect.hostname.clone(),
                },
            );

            let ws_tx2 = ws_tx.clone();
            let streams2 = streams.clone();
            let opts2 = opts.clone();
            let cid = conn_id.to_string();
            let sid = pkt.stream_id;
            let on_blocked2 = on_blocked.clone();

            tokio::spawn(async move {
                proxy_stream(
                    sid,
                    connect.hostname,
                    connect.port,
                    connect.stream_type,
                    data_rx,
                    ws_tx2,
                    streams2,
                    cid,
                    opts2,
                    on_blocked2,
                )
                .await;
            });
        }

        packet::PACKET_DATA => {
            let guard = streams.pin();
            if let Some(handle) = guard.get(&pkt.stream_id) {
                let bytes = Bytes::copy_from_slice(pkt.payload);
                let _ = handle.data_tx.try_send(bytes);
            } else {
                log::warn!("[{conn_id}] DATA for unknown stream {}", pkt.stream_id);
            }
        }

        packet::PACKET_CLOSE => {
            log::info!("[{conn_id}] closing stream {}", pkt.stream_id);
            streams.pin().remove(&pkt.stream_id);
        }

        packet::PACKET_CONTINUE => {
            log::warn!("[{conn_id}] unexpected CONTINUE from client");
        }

        t => {
            log::warn!("[{conn_id}] unknown packet type {t:#04x}");
        }
    }

    Ok(())
}

async fn proxy_stream(
    stream_id: u32,
    hostname: String,
    port: u16,
    stream_type: u8,
    data_rx: mpsc::Receiver<Bytes>,
    ws_tx: mpsc::Sender<Bytes>,
    streams: Arc<PapayaMap<u32, StreamHandle>>,
    conn_id: String,
    opts: Arc<Options>,
    on_blocked: Option<BlockedCb>,
) {
    let (stream_count, host_stream_count) = {
        let guard = streams.pin();
        let total = guard.len();
        let per_host = guard
            .iter()
            .filter(|(_, h)| h.hostname == hostname)
            .count();
        (total, per_host)
    };

    // Check the hostname blacklist before DNS so a banned host always records a
    // strike (matching the old JS behavior) and we skip a pointless lookup.
    if filter::hostname_blocked(&opts, &hostname) {
        log::warn!("[{conn_id}] blocked stream to {hostname}:{port}");
        if let Some(ref cb) = on_blocked {
            cb(hostname.clone());
        }
        send_close(&ws_tx, stream_id, packet::CLOSE_HOST_BLOCKED).await;
        streams.pin().remove(&stream_id);
        return;
    }

    let ip: IpAddr = match crate::dns::lookup(&hostname, opts.dns_ttl).await {
        Ok(ip) => ip,
        Err(e) => {
            log::warn!("[{conn_id}] DNS failed for {hostname}: {e}");
            send_close(&ws_tx, stream_id, packet::CLOSE_UNREACHABLE).await;
            streams.pin().remove(&stream_id);
            return;
        }
    };

    if let Some(reason) = filter::check_stream(
        &opts,
        stream_type,
        &hostname,
        port,
        stream_count,
        host_stream_count,
        Some(ip),
    )
    .await
    {
        log::warn!("[{conn_id}] blocked stream to {hostname}:{port}");
        send_close(&ws_tx, stream_id, reason).await;
        streams.pin().remove(&stream_id);
        return;
    }

    if stream_type == packet::STREAM_TCP {
        tcp_proxy(stream_id, ip, port, data_rx, ws_tx, streams, conn_id).await;
    } else {
        udp_proxy(stream_id, ip, port, data_rx, ws_tx, streams, conn_id).await;
    }
}

async fn tcp_proxy(
    stream_id: u32,
    ip: IpAddr,
    port: u16,
    mut data_rx: mpsc::Receiver<Bytes>,
    ws_tx: mpsc::Sender<Bytes>,
    streams: Arc<PapayaMap<u32, StreamHandle>>,
    conn_id: String,
) {
    let domain = if ip.is_ipv6() { Domain::IPV6 } else { Domain::IPV4 };
    let sock = match Socket::new(domain, Type::STREAM, Some(Protocol::TCP)) {
        Ok(s) => s,
        Err(e) => {
            log::warn!("[{conn_id}] socket() failed: {e}");
            send_close(&ws_tx, stream_id, packet::CLOSE_NETWORK_ERROR).await;
            streams.pin().remove(&stream_id);
            return;
        }
    };
    let _ = sock.set_tcp_nodelay(true);
    let _ = sock.set_nonblocking(true);

    let addr = SockAddr::from(std::net::SocketAddr::from((ip, port)));
    match sock.connect(&addr) {
        Ok(_) => {}
        Err(ref e) if e.raw_os_error() == Some(libc::EINPROGRESS) => {}
        Err(e) => {
            log::warn!("[{conn_id}] connect to {ip}:{port} failed: {e}");
            send_close(&ws_tx, stream_id, packet::CLOSE_CONN_REFUSED).await;
            streams.pin().remove(&stream_id);
            return;
        }
    }

    let raw = sock.into_raw_fd();
    let std_tcp = unsafe { std::net::TcpStream::from_raw_fd(raw) };
    let tcp = match TcpStream::from_std(std_tcp) {
        Ok(t) => t,
        Err(e) => {
            log::warn!("[{conn_id}] TcpStream::from_std: {e}");
            send_close(&ws_tx, stream_id, packet::CLOSE_NETWORK_ERROR).await;
            streams.pin().remove(&stream_id);
            return;
        }
    };

    if let Err(e) = tcp.writable().await {
        log::warn!("[{conn_id}] writable(): {e}");
        send_close(&ws_tx, stream_id, packet::CLOSE_CONN_REFUSED).await;
        streams.pin().remove(&stream_id);
        return;
    }
    if let Ok(Some(err)) = tcp.take_error() {
        log::warn!("[{conn_id}] connect to {ip}:{port} refused: {err}");
        send_close(&ws_tx, stream_id, packet::CLOSE_CONN_REFUSED).await;
        streams.pin().remove(&stream_id);
        return;
    }

    let (mut read_half, mut write_half) = tcp.into_split();

    const BUF_SIZE: u32 = 128;

    let ws_tx2 = ws_tx.clone();
    let streams2 = streams.clone();
    let cid2 = conn_id.clone();
    tokio::spawn(async move {
        let mut buf = vec![0u8; 65536];
        loop {
            match read_half.read(&mut buf).await {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let pkt = Bytes::from(packet::make_data_packet(stream_id, &buf[..n]));
                    if ws_tx2.send(pkt).await.is_err() {
                        break;
                    }
                }
            }
        }
        send_close(&ws_tx2, stream_id, packet::CLOSE_VOLUNTARY).await;
        streams2.pin().remove(&stream_id);
        log::debug!("[{cid2}] stream {stream_id} tcp→ws done");
    });

    let mut sent: u32 = 0;
    while let Some(data) = data_rx.recv().await {
        if write_half.write_all(&data).await.is_err() {
            break;
        }
        sent += 1;
        if sent % (BUF_SIZE / 2) == 0 {
            let pkt = Bytes::from(packet::make_continue_packet(stream_id, BUF_SIZE));
            if ws_tx.send(pkt).await.is_err() {
                break;
            }
        }
    }
    log::debug!("[{conn_id}] stream {stream_id} ws→tcp done");
}

async fn udp_proxy(
    stream_id: u32,
    ip: IpAddr,
    port: u16,
    mut data_rx: mpsc::Receiver<Bytes>,
    ws_tx: mpsc::Sender<Bytes>,
    streams: Arc<PapayaMap<u32, StreamHandle>>,
    conn_id: String,
) {
    use tokio::net::UdpSocket;

    let bind: std::net::SocketAddr = if ip.is_ipv6() {
        ":::0".parse().unwrap()
    } else {
        "0.0.0.0:0".parse().unwrap()
    };

    let sock = match UdpSocket::bind(bind).await {
        Ok(s) => Arc::new(s),
        Err(e) => {
            log::warn!("[{conn_id}] UDP bind: {e}");
            send_close(&ws_tx, stream_id, packet::CLOSE_NETWORK_ERROR).await;
            streams.pin().remove(&stream_id);
            return;
        }
    };

    if sock.connect(std::net::SocketAddr::from((ip, port))).await.is_err() {
        send_close(&ws_tx, stream_id, packet::CLOSE_CONN_REFUSED).await;
        streams.pin().remove(&stream_id);
        return;
    }

    let sock2 = sock.clone();
    let ws_tx2 = ws_tx.clone();
    let streams2 = streams.clone();
    let cid2 = conn_id.clone();
    tokio::spawn(async move {
        let mut buf = vec![0u8; 65536];
        loop {
            match sock2.recv(&mut buf).await {
                Ok(n) => {
                    let pkt = Bytes::from(packet::make_data_packet(stream_id, &buf[..n]));
                    if ws_tx2.send(pkt).await.is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
        send_close(&ws_tx2, stream_id, packet::CLOSE_VOLUNTARY).await;
        streams2.pin().remove(&stream_id);
        log::debug!("[{cid2}] stream {stream_id} udp recv done");
    });

    const BUF_SIZE: u32 = 128;
    let mut sent: u32 = 0;
    while let Some(data) = data_rx.recv().await {
        if sock.send(&data).await.is_err() {
            break;
        }
        sent += 1;
        if sent % (BUF_SIZE / 2) == 0 {
            let pkt = Bytes::from(packet::make_continue_packet(stream_id, BUF_SIZE));
            if ws_tx.send(pkt).await.is_err() {
                break;
            }
        }
    }
}

async fn send_close(ws_tx: &mpsc::Sender<Bytes>, stream_id: u32, reason: u8) {
    let _ = ws_tx
        .send(Bytes::from(packet::make_close_packet(stream_id, reason)))
        .await;
}
