use smallvec::SmallVec;

pub const PACKET_CONNECT: u8 = 0x01;
pub const PACKET_DATA: u8 = 0x02;
pub const PACKET_CONTINUE: u8 = 0x03;
pub const PACKET_CLOSE: u8 = 0x04;
pub const PACKET_INFO: u8 = 0x05;

pub const STREAM_TCP: u8 = 0x01;
pub const STREAM_UDP: u8 = 0x02;

pub const CLOSE_VOLUNTARY: u8 = 0x02;
pub const CLOSE_NETWORK_ERROR: u8 = 0x03;
pub const CLOSE_UNREACHABLE: u8 = 0x42;
pub const CLOSE_CONN_REFUSED: u8 = 0x44;
pub const CLOSE_HOST_BLOCKED: u8 = 0x48;
pub const CLOSE_THROTTLED: u8 = 0x49;

pub const EXT_UDP: u8 = 0x01;
pub const EXT_MOTD: u8 = 0x04;

pub struct WispPacket<'a> {
    pub packet_type: u8,
    pub stream_id: u32,
    pub payload: &'a [u8],
}

impl<'a> WispPacket<'a> {
    pub fn parse(data: &'a [u8]) -> Option<Self> {
        if data.len() < 5 {
            return None;
        }
        Some(Self {
            packet_type: data[0],
            stream_id: u32::from_le_bytes([data[1], data[2], data[3], data[4]]),
            payload: &data[5..],
        })
    }
}

pub struct ConnectPayload {
    pub stream_type: u8,
    pub port: u16,
    pub hostname: String,
}

impl ConnectPayload {
    pub fn parse(payload: &[u8]) -> Option<Self> {
        if payload.len() < 3 {
            return None;
        }
        Some(Self {
            stream_type: payload[0],
            port: u16::from_le_bytes([payload[1], payload[2]]),
            hostname: String::from_utf8_lossy(&payload[3..]).trim().to_string(),
        })
    }
}

#[inline]
pub fn make_continue_packet(stream_id: u32, buffer_remaining: u32) -> Vec<u8> {
    let mut buf: SmallVec<[u8; 9]> = SmallVec::new();
    buf.push(PACKET_CONTINUE);
    buf.extend_from_slice(&stream_id.to_le_bytes());
    buf.extend_from_slice(&buffer_remaining.to_le_bytes());
    buf.into_vec()
}

#[inline]
pub fn make_close_packet(stream_id: u32, reason: u8) -> Vec<u8> {
    let mut buf: SmallVec<[u8; 6]> = SmallVec::new();
    buf.push(PACKET_CLOSE);
    buf.extend_from_slice(&stream_id.to_le_bytes());
    buf.push(reason);
    buf.into_vec()
}

#[inline]
pub fn make_data_packet(stream_id: u32, data: &[u8]) -> Vec<u8> {
    let mut buf = Vec::with_capacity(5 + data.len());
    buf.push(PACKET_DATA);
    buf.extend_from_slice(&stream_id.to_le_bytes());
    buf.extend_from_slice(data);
    buf
}

pub fn make_info_packet(wisp_version: u8, extensions: &[u8]) -> Vec<u8> {
    let mut buf: SmallVec<[u8; 32]> = SmallVec::new();
    buf.push(PACKET_INFO);
    buf.extend_from_slice(&0u32.to_le_bytes());
    buf.push(wisp_version);
    buf.push(0);
    buf.extend_from_slice(extensions);
    buf.into_vec()
}

pub fn make_udp_extension() -> Vec<u8> {
    let mut buf: SmallVec<[u8; 5]> = SmallVec::new();
    buf.push(EXT_UDP);
    buf.extend_from_slice(&0u32.to_le_bytes());
    buf.into_vec()
}

pub fn make_motd_extension(motd: &str) -> Vec<u8> {
    let msg = motd.as_bytes();
    let mut buf = Vec::with_capacity(5 + msg.len());
    buf.push(EXT_MOTD);
    buf.extend_from_slice(&(msg.len() as u32).to_le_bytes());
    buf.extend_from_slice(msg);
    buf
}
