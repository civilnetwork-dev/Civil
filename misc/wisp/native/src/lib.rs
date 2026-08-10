#![deny(clippy::all)]

use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use papaya::HashMap as PapayaMap;
use std::sync::LazyLock;
use std::sync::atomic::{AtomicU32, Ordering};
use tokio::runtime::Runtime;
use tokio::sync::mpsc;

#[cfg(unix)]
use socket2::Socket;
#[cfg(unix)]
use std::os::unix::io::{FromRawFd, IntoRawFd};
#[cfg(unix)]
use std::os::unix::net::UnixStream as StdUnixStream;

mod dns;
mod filter;
mod options;
mod packet;
#[cfg(unix)]
mod server;

static RUNTIME: LazyLock<Runtime> = LazyLock::new(|| {
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .thread_name("wisp-server-fast")
        .build()
        .expect("failed to build tokio runtime")
});

static SESSIONS: LazyLock<PapayaMap<u32, mpsc::Sender<bytes::Bytes>>> =
    LazyLock::new(PapayaMap::new);
static SESSION_ID: AtomicU32 = AtomicU32::new(1);

#[napi]
pub fn route_upgrade_native(
    fd: i32,
    head: Buffer,
    remote_ip: String,
    remote_port: u32,
    url: String,
    wisp_version: u32,
    options_json: String,
) -> napi::Result<()> {
    #[cfg(not(unix))]
    {
        let _ = (fd, head, remote_ip, remote_port, url, wisp_version, options_json);
        return Err(Error::from_reason(
            "routeUpgradeNative is not supported on Windows",
        ));
    }

    #[cfg(unix)]
    {

        let _guard = RUNTIME.enter();

        let dup_fd = unsafe { libc::dup(fd) };
        if dup_fd < 0 {
            return Err(Error::from_reason(format!(
                "dup() failed: {}",
                std::io::Error::last_os_error()
            )));
        }

        unsafe { libc::close(fd); }

        let head_bytes = head.to_vec();
        let opts = options::parse_options(&options_json);

        let tcp = {
            let sock2 = unsafe { Socket::from_raw_fd(dup_fd) };
            let _ = sock2.set_tcp_nodelay(true);
            let _ = sock2.set_nonblocking(true);
            let raw = sock2.into_raw_fd();
            let std_tcp = unsafe { std::net::TcpStream::from_raw_fd(raw) };
            match tokio::net::TcpStream::from_std(std_tcp) {
                Ok(t) => t,
                Err(e) => {
                    return Err(Error::from_reason(format!("TcpStream::from_std: {e}")));
                }
            }
        };

        RUNTIME.spawn(async move {
            server::handle_connection(tcp, head_bytes, remote_ip, remote_port as u16, url, wisp_version as u8, opts, None).await;
        });

        Ok(())
    }
}

#[napi]
pub fn route_upgrade_pipe(
    head: Buffer,
    remote_ip: String,
    remote_port: u32,
    url: String,
    wisp_version: u32,
    options_json: String,
) -> napi::Result<i32> {
    route_upgrade_pipe_impl(head.to_vec(), remote_ip, remote_port, url, wisp_version, options_json)
}

#[cfg(unix)]
fn route_upgrade_pipe_impl(
    head_bytes: Vec<u8>,
    remote_ip: String,
    remote_port: u32,
    url: String,
    wisp_version: u32,
    options_json: String,
) -> napi::Result<i32> {
    let mut fds = [-1i32; 2];
    let ret = unsafe { libc::socketpair(libc::AF_UNIX, libc::SOCK_STREAM, 0, fds.as_mut_ptr()) };
    if ret < 0 {
        return Err(Error::from_reason(format!(
            "socketpair() failed: {}",
            std::io::Error::last_os_error()
        )));
    }
    let [fd_rust, fd_js] = fds;

    let opts = options::parse_options(&options_json);

    let _guard = RUNTIME.enter();

    let std_unix = unsafe { StdUnixStream::from_raw_fd(fd_rust) };
    let unix = match tokio::net::UnixStream::from_std(std_unix) {
        Ok(u) => u,
        Err(e) => {
            unsafe { libc::close(fd_rust); libc::close(fd_js); }
            return Err(Error::from_reason(format!("UnixStream::from_std: {e}")));
        }
    };

    RUNTIME.spawn(async move {
        server::handle_connection(unix, head_bytes, remote_ip, remote_port as u16, url, wisp_version as u8, opts, None).await;
    });
    Ok(fd_js)
}

#[cfg(not(unix))]
fn route_upgrade_pipe_impl(
    _head_bytes: Vec<u8>,
    _remote_ip: String,
    _remote_port: u32,
    _url: String,
    _wisp_version: u32,
    _options_json: String,
) -> napi::Result<i32> {
    Err(Error::from_reason("routeUpgradePipe is not supported on this platform"))
}

#[napi]
pub fn route_upgrade_tcp_pipe(
    head: Buffer,
    remote_ip: String,
    remote_port: u32,
    url: String,
    wisp_version: u32,
    options_json: String,
) -> napi::Result<u32> {
    route_upgrade_tcp_pipe_impl(head.to_vec(), remote_ip, remote_port, url, wisp_version, options_json)
}

#[cfg(unix)]
fn route_upgrade_tcp_pipe_impl(
    head_bytes: Vec<u8>,
    remote_ip: String,
    remote_port: u32,
    url: String,
    wisp_version: u32,
    options_json: String,
) -> napi::Result<u32> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0")
        .map_err(|e| Error::from_reason(format!("TcpListener::bind: {e}")))?;
    let port = listener
        .local_addr()
        .map_err(|e| Error::from_reason(format!("local_addr: {e}")))?
        .port() as u32;

    let opts = options::parse_options(&options_json);
    let _guard = RUNTIME.enter();

    let tokio_listener = tokio::net::TcpListener::from_std(listener)
        .map_err(|e| Error::from_reason(format!("TcpListener::from_std: {e}")))?;

    RUNTIME.spawn(async move {
        match tokio_listener.accept().await {
            Ok((stream, _)) => {
                server::handle_connection(stream, head_bytes, remote_ip, remote_port as u16, url, wisp_version as u8, opts, None).await;
            }
            Err(e) => {
                eprintln!("[wisp] tcpPipe accept error: {e}");
            }
        }
    });

    Ok(port)
}

#[cfg(not(unix))]
fn route_upgrade_tcp_pipe_impl(
    _head_bytes: Vec<u8>,
    _remote_ip: String,
    _remote_port: u32,
    _url: String,
    _wisp_version: u32,
    _options_json: String,
) -> napi::Result<u32> {
    Err(Error::from_reason("routeUpgradeTcpPipe is not supported on this platform"))
}

#[napi]
pub fn route_upgrade_callbacks(
    head: Buffer,
    remote_ip: String,
    remote_port: u32,
    url: String,
    wisp_version: u32,
    options_json: String,
    on_send: Function<'_, Buffer, ()>,
    on_close: Function<'_, (), ()>,
    on_blocked: Option<Function<'_, String, ()>>,
) -> napi::Result<u32> {

    let tsfn_send: ThreadsafeFunction<Buffer, (), Buffer, napi::Status, false, false, 0> =
        on_send.build_threadsafe_function::<Buffer>().build()?;
    let tsfn_close: ThreadsafeFunction<(), (), (), napi::Status, false, false, 0> =
        on_close.build_threadsafe_function::<()>().build()?;
    let tsfn_blocked: Option<
        ThreadsafeFunction<String, (), String, napi::Status, false, false, 0>,
    > = match on_blocked {
        Some(f) => Some(f.build_threadsafe_function::<String>().build()?),
        None => None,
    };

    route_upgrade_callbacks_impl(
        head.to_vec(), remote_ip, remote_port, url, wisp_version, options_json,
        tsfn_send, tsfn_close, tsfn_blocked,
    )
}

#[cfg(unix)]
fn route_upgrade_callbacks_impl(
    _head_bytes: Vec<u8>,
    remote_ip: String,
    remote_port: u32,
    url: String,
    wisp_version: u32,
    options_json: String,
    tsfn_send: ThreadsafeFunction<Buffer, (), Buffer, napi::Status, false, false, 0>,
    tsfn_close: ThreadsafeFunction<(), (), (), napi::Status, false, false, 0>,
    tsfn_blocked: Option<
        ThreadsafeFunction<String, (), String, napi::Status, false, false, 0>,
    >,
) -> napi::Result<u32> {

    let (incoming_tx, incoming_rx) = mpsc::channel::<bytes::Bytes>(256);
    let (outgoing_tx, mut outgoing_rx) = mpsc::channel::<bytes::Bytes>(512);

    let session_id = SESSION_ID.fetch_add(1, Ordering::Relaxed);
    SESSIONS.pin().insert(session_id, incoming_tx);

    let opts = options::parse_options(&options_json);
    let _guard = RUNTIME.enter();

    let on_blocked: Option<server::BlockedCb> = tsfn_blocked.map(|tsfn| {
        std::sync::Arc::new(move |host: String| {
            tsfn.call(host, ThreadsafeFunctionCallMode::NonBlocking);
        }) as server::BlockedCb
    });

    RUNTIME.spawn(async move {
        while let Some(data) = outgoing_rx.recv().await {
            tsfn_send.call(Buffer::from(data.to_vec()), ThreadsafeFunctionCallMode::NonBlocking);
        }
        tsfn_close.call((), ThreadsafeFunctionCallMode::NonBlocking);
    });

    RUNTIME.spawn(async move {
        server::handle_messages(
            incoming_rx, outgoing_tx,
            remote_ip, remote_port as u16, url, wisp_version as u8, opts, on_blocked,
        )
        .await;
        let _ = SESSIONS.pin().remove(&session_id);
    });

    Ok(session_id)
}

#[cfg(not(unix))]
fn route_upgrade_callbacks_impl(
    _head_bytes: Vec<u8>,
    _remote_ip: String,
    _remote_port: u32,
    _url: String,
    _wisp_version: u32,
    _options_json: String,
    _tsfn_send: ThreadsafeFunction<Buffer, (), Buffer, napi::Status, false, false, 0>,
    _tsfn_close: ThreadsafeFunction<(), (), (), napi::Status, false, false, 0>,
    _tsfn_blocked: Option<
        ThreadsafeFunction<String, (), String, napi::Status, false, false, 0>,
    >,
) -> napi::Result<u32> {
    Err(Error::from_reason(
        "routeUpgradeCallbacks is not supported on this platform",
    ))
}

#[napi]
pub fn feed_wisp_data(session_id: u32, data: Buffer) -> napi::Result<()> {
    let bytes = bytes::Bytes::copy_from_slice(&data);
    if let Some(tx) = SESSIONS.pin().get(&session_id).cloned() {
        let _ = tx.try_send(bytes);
    }
    Ok(())
}

#[napi]
pub fn close_wisp_session(session_id: u32) -> napi::Result<()> {
    let _ = SESSIONS.pin().remove(&session_id);
    Ok(())
}

#[napi]
pub fn set_global_options(options_json: String) -> napi::Result<()> {
    options::set_global_options(&options_json);
    Ok(())
}
