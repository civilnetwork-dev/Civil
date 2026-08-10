const std = @import("std");

pub const PACKET_CONNECT: u8 = 0x01;
pub const PACKET_DATA: u8 = 0x02;
pub const PACKET_CONTINUE: u8 = 0x03;
pub const PACKET_CLOSE: u8 = 0x04;
pub const PACKET_INFO: u8 = 0x05;

pub const STREAM_TCP: u8 = 0x01;
pub const STREAM_UDP: u8 = 0x02;

pub const Packet = struct {
    packet_type: u8,
    stream_id: u32,
    payload: []const u8,
};

pub fn parse(data: []const u8) ?Packet {
    if (data.len < 5) return null;
    return .{
        .packet_type = data[0],
        .stream_id = std.mem.readInt(u32, data[1..5][0..4], .little),
        .payload = if (data.len > 5) data[5..] else &.{},
    };
}

fn write_header(buf: *std.ArrayList(u8), alloc: std.mem.Allocator, packet_type: u8, stream_id: u32) !void {
    try buf.append(alloc, packet_type);
    var id_bytes: [4]u8 = undefined;
    std.mem.writeInt(u32, &id_bytes, stream_id, .little);
    try buf.appendSlice(alloc, &id_bytes);
}

pub fn write_connect_packet(
    buf: *std.ArrayList(u8),
    alloc: std.mem.Allocator,
    stream_id: u32,
    stream_type: u8,
    port: u16,
    hostname: []const u8,
) !void {
    try write_header(buf, alloc, PACKET_CONNECT, stream_id);
    try buf.append(alloc, stream_type);
    var port_bytes: [2]u8 = undefined;
    std.mem.writeInt(u16, &port_bytes, port, .little);
    try buf.appendSlice(alloc, &port_bytes);
    try buf.appendSlice(alloc, hostname);
}

pub fn write_data_packet(
    buf: *std.ArrayList(u8),
    alloc: std.mem.Allocator,
    stream_id: u32,
    data: []const u8,
) !void {
    try write_header(buf, alloc, PACKET_DATA, stream_id);
    try buf.appendSlice(alloc, data);
}

pub fn write_continue_packet(
    buf: *std.ArrayList(u8),
    alloc: std.mem.Allocator,
    stream_id: u32,
    buffer_remaining: u32,
) !void {
    try write_header(buf, alloc, PACKET_CONTINUE, stream_id);
    var rem_bytes: [4]u8 = undefined;
    std.mem.writeInt(u32, &rem_bytes, buffer_remaining, .little);
    try buf.appendSlice(alloc, &rem_bytes);
}

pub fn write_close_packet(
    buf: *std.ArrayList(u8),
    alloc: std.mem.Allocator,
    stream_id: u32,
    reason: u8,
) !void {
    try write_header(buf, alloc, PACKET_CLOSE, stream_id);
    try buf.append(alloc, reason);
}

pub fn write_info_packet(
    buf: *std.ArrayList(u8),
    alloc: std.mem.Allocator,
    major_ver: u8,
    minor_ver: u8,
    ext_data: []const u8,
) !void {
    try write_header(buf, alloc, PACKET_INFO, 0);
    try buf.append(alloc, major_ver);
    try buf.append(alloc, minor_ver);
    try buf.appendSlice(alloc, ext_data);
}
