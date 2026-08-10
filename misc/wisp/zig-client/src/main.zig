const std = @import("std");
const connection = @import("connection.zig");
const logging = @import("logging.zig");

const allocator = std.heap.wasm_allocator;

pub fn panic(msg: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn {
    logging.log_error(msg);
    @trap();
}

export fn alloc(len: usize) ?[*]u8 {
    if (len == 0) return null;
    const slice = allocator.alloc(u8, len) catch return null;
    return slice.ptr;
}

export fn dealloc(ptr: [*]u8, len: usize) void {
    allocator.free(ptr[0..len]);
}

export fn connection_create(wisp_version: u8) u32 {
    return connection.create(allocator, wisp_version) catch 0;
}

export fn connection_on_ws_data(conn_id: u32, data_ptr: [*]const u8, data_len: usize) void {
    connection.on_ws_data(allocator, conn_id, data_ptr[0..data_len]) catch {};
}

export fn connection_on_ws_close(conn_id: u32) void {
    connection.on_ws_close(conn_id);
}

export fn connection_on_ws_error(conn_id: u32) void {
    connection.on_ws_error(conn_id);
}

export fn connection_destroy(conn_id: u32) void {
    connection.destroy(allocator, conn_id);
}

export fn stream_create(
    conn_id: u32,
    host_ptr: [*]const u8,
    host_len: usize,
    port: u16,
    stream_type: u8,
) u32 {
    return connection.stream_create(allocator, conn_id, host_ptr[0..host_len], port, stream_type) catch 0;
}

export fn stream_send(
    conn_id: u32,
    stream_id: u32,
    data_ptr: [*]const u8,
    data_len: usize,
) void {
    connection.stream_send(allocator, conn_id, stream_id, data_ptr[0..data_len]) catch {};
}

export fn stream_close(conn_id: u32, stream_id: u32, reason: u8) void {
    connection.stream_close(allocator, conn_id, stream_id, reason) catch {};
}
