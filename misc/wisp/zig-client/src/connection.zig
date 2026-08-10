const std = @import("std");
const packet = @import("packet.zig");
const extensions = @import("extensions.zig");
const logging = @import("logging.zig");

extern fn js_ws_send(conn_id: u32, ptr: [*]const u8, len: usize) void;
extern fn js_on_stream_message(conn_id: u32, stream_id: u32, ptr: [*]const u8, len: usize) void;
extern fn js_on_stream_close(conn_id: u32, stream_id: u32, reason: u8) void;
extern fn js_on_connection_open(conn_id: u32) void;
extern fn js_on_connection_close(conn_id: u32) void;
extern fn js_on_connection_error(conn_id: u32) void;

const Stream = struct {
    id: u32,
    hostname: []u8,
    port: u16,
    stream_type: u8,
    buffer_size: i32,
    open: bool,
    send_buffer: std.ArrayListUnmanaged([]u8),

    fn deinit(self: *Stream, alloc: std.mem.Allocator) void {
        alloc.free(self.hostname);
        for (self.send_buffer.items) |item| alloc.free(item);
        self.send_buffer.deinit(alloc);
    }
};

const HandshakePhase = enum {
    waiting_server_info,
    waiting_continue,
    done,
};

const Connection = struct {
    id: u32,
    wisp_version: u8,
    phase: HandshakePhase,
    max_buffer_size: u32,
    next_stream_id: u32,
    streams: std.AutoHashMapUnmanaged(u32, *Stream),
    udp_enabled: bool,
    motd: ?[]u8,

    fn deinit(self: *Connection, alloc: std.mem.Allocator) void {
        var it = self.streams.valueIterator();
        while (it.next()) |stream_ptr| {
            stream_ptr.*.deinit(alloc);
            alloc.destroy(stream_ptr.*);
        }
        self.streams.deinit(alloc);
        if (self.motd) |m| alloc.free(m);
    }
};

const MAX_CONNECTIONS: usize = 256;
var conn_table: [MAX_CONNECTIONS]?*Connection = [_]?*Connection{null} ** MAX_CONNECTIONS;

fn find_free_slot() ?usize {
    for (conn_table, 0..) |entry, i| {
        if (entry == null) return i;
    }
    return null;
}

fn get_conn(conn_id: u32) ?*Connection {
    if (conn_id == 0 or conn_id > MAX_CONNECTIONS) return null;
    return conn_table[conn_id - 1];
}

fn ws_send_buf(conn_id: u32, buf: *const std.ArrayList(u8)) void {
    if (buf.items.len > 0) {
        js_ws_send(conn_id, buf.items.ptr, buf.items.len);
    }
}

pub fn create(alloc: std.mem.Allocator, wisp_version: u8) !u32 {
    const slot = find_free_slot() orelse return error.TooManyConnections;
    const conn = try alloc.create(Connection);
    const conn_id: u32 = @intCast(slot + 1);
    conn.* = .{
        .id = conn_id,
        .wisp_version = wisp_version,
        .phase = if (wisp_version == 2) .waiting_server_info else .waiting_continue,
        .max_buffer_size = 0,
        .next_stream_id = 1,
        .streams = .{},
        .udp_enabled = false,
        .motd = null,
    };
    conn_table[slot] = conn;
    return conn_id;
}

pub fn on_ws_data(alloc: std.mem.Allocator, conn_id: u32, data: []const u8) !void {
    const conn = get_conn(conn_id) orelse return;

    const pkt = packet.parse(data) orelse {
        logging.warn("packet too small");
        return;
    };

    if (pkt.stream_id == 0) {
        switch (pkt.packet_type) {
            packet.PACKET_INFO => {
                if (conn.wisp_version == 2 and conn.phase == .waiting_server_info) {
                    const exts = extensions.parse_server_extensions(pkt.payload);
                    conn.udp_enabled = exts.udp_enabled;
                    if (exts.motd) |motd| conn.motd = try alloc.dupe(u8, motd);

                    var ext_buf = std.ArrayList(u8){};
                    defer ext_buf.deinit(alloc);
                    try extensions.write_client_extensions(&ext_buf, alloc);

                    var buf = std.ArrayList(u8){};
                    defer buf.deinit(alloc);
                    try packet.write_info_packet(&buf, alloc, 2, 0, ext_buf.items);
                    ws_send_buf(conn_id, &buf);

                    conn.phase = .waiting_continue;
                }
                return;
            },
            packet.PACKET_CONTINUE => {
                if (conn.phase != .done) {
                    if (pkt.payload.len < 4) return;
                    conn.max_buffer_size = std.mem.readInt(u32, pkt.payload[0..4], .little);
                    conn.phase = .done;
                    js_on_connection_open(conn_id);
                }
                return;
            },
            else => return,
        }
    }

    switch (pkt.packet_type) {
        packet.PACKET_DATA => {
            if (conn.streams.get(pkt.stream_id)) |_| {
                js_on_stream_message(conn_id, pkt.stream_id, pkt.payload.ptr, pkt.payload.len);
            } else {
                logging.warn("DATA for unknown stream");
            }
        },
        packet.PACKET_CONTINUE => {
            if (pkt.payload.len < 4) return;
            const buf_remaining = std.mem.readInt(u32, pkt.payload[0..4], .little);
            if (conn.streams.get(pkt.stream_id)) |stream| {
                stream.buffer_size = @intCast(buf_remaining);
                while (stream.buffer_size > 0 and stream.send_buffer.items.len > 0) {
                    const queued = stream.send_buffer.orderedRemove(0);
                    defer alloc.free(queued);
                    var buf = std.ArrayList(u8){};
                    defer buf.deinit(alloc);
                    try packet.write_data_packet(&buf, alloc, pkt.stream_id, queued);
                    ws_send_buf(conn_id, &buf);
                    stream.buffer_size -= 1;
                }
            }
        },
        packet.PACKET_CLOSE => {
            const reason: u8 = if (pkt.payload.len > 0) pkt.payload[0] else 0x01;
            js_on_stream_close(conn_id, pkt.stream_id, reason);
            if (conn.streams.fetchRemove(pkt.stream_id)) |kv| {
                var s = kv.value;
                s.deinit(alloc);
                alloc.destroy(s);
            }
        },
        else => logging.warn("unknown packet type from server"),
    }
}

pub fn on_ws_close(conn_id: u32) void {
    const conn = get_conn(conn_id) orelse return;
    var it = conn.streams.keyIterator();
    while (it.next()) |sid| {
        js_on_stream_close(conn_id, sid.*, 0x03);
    }
    js_on_connection_close(conn_id);
}

pub fn on_ws_error(conn_id: u32) void {
    js_on_connection_error(conn_id);
}

pub fn destroy(alloc: std.mem.Allocator, conn_id: u32) void {
    const conn = get_conn(conn_id) orelse return;
    conn.deinit(alloc);
    alloc.destroy(conn);
    conn_table[conn_id - 1] = null;
}

pub fn stream_create(
    alloc: std.mem.Allocator,
    conn_id: u32,
    hostname: []const u8,
    port: u16,
    stream_type: u8,
) !u32 {
    const conn = get_conn(conn_id) orelse return error.NoConnection;

    const stream_id = conn.next_stream_id;
    conn.next_stream_id += 1;

    const stream = try alloc.create(Stream);
    stream.* = .{
        .id = stream_id,
        .hostname = try alloc.dupe(u8, hostname),
        .port = port,
        .stream_type = stream_type,
        .buffer_size = @intCast(conn.max_buffer_size),
        .open = conn.phase == .done,
        .send_buffer = .{},
    };
    try conn.streams.put(alloc, stream_id, stream);

    var buf = std.ArrayList(u8){};
    defer buf.deinit(alloc);
    try packet.write_connect_packet(&buf, alloc, stream_id, stream_type, port, hostname);
    ws_send_buf(conn_id, &buf);

    return stream_id;
}

pub fn stream_send(
    alloc: std.mem.Allocator,
    conn_id: u32,
    stream_id: u32,
    data: []const u8,
) !void {
    const conn = get_conn(conn_id) orelse return;
    const stream = conn.streams.get(stream_id) orelse return;

    if (stream.buffer_size > 0 or !stream.open or stream.stream_type == packet.STREAM_UDP) {
        var buf = std.ArrayList(u8){};
        defer buf.deinit(alloc);
        try packet.write_data_packet(&buf, alloc, stream_id, data);
        ws_send_buf(conn_id, &buf);
        if (stream.stream_type != packet.STREAM_UDP) stream.buffer_size -= 1;
    } else {
        try stream.send_buffer.append(alloc, try alloc.dupe(u8, data));
    }
}

pub fn stream_close(
    alloc: std.mem.Allocator,
    conn_id: u32,
    stream_id: u32,
    reason: u8,
) !void {
    const conn = get_conn(conn_id) orelse return;
    const stream = conn.streams.get(stream_id) orelse return;
    if (!stream.open) return;

    var buf = std.ArrayList(u8){};
    defer buf.deinit(alloc);
    try packet.write_close_packet(&buf, alloc, stream_id, reason);
    ws_send_buf(conn_id, &buf);

    stream.open = false;
    if (conn.streams.fetchRemove(stream_id)) |kv| {
        var s = kv.value;
        s.deinit(alloc);
        alloc.destroy(s);
    }
}
