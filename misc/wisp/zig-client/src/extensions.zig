const std = @import("std");

pub const EXT_UDP: u8 = 0x01;
pub const EXT_PASSWORD_AUTH: u8 = 0x02;
pub const EXT_MOTD: u8 = 0x04;

pub const ParsedServerExtensions = struct {
    udp_enabled: bool,
    motd: ?[]const u8,
};

pub fn parse_server_extensions(payload: []const u8) ParsedServerExtensions {
    var result = ParsedServerExtensions{
        .udp_enabled = false,
        .motd = null,
    };

    if (payload.len < 2) return result;

    var i: usize = 2;
    while (i + 5 <= payload.len) {
        const ext_id = payload[i];
        const ext_len = std.mem.readInt(u32, payload[i + 1 ..][0..4], .little);
        i += 5;
        const end = @min(i + ext_len, payload.len);
        const ext_payload = payload[i..end];

        switch (ext_id) {
            EXT_UDP => result.udp_enabled = true,
            EXT_MOTD => result.motd = ext_payload,
            else => {},
        }
        i = end;
    }

    return result;
}

pub fn write_client_extensions(buf: *std.ArrayList(u8), alloc: std.mem.Allocator) !void {
    try buf.append(alloc, EXT_UDP);
    try buf.appendSlice(alloc, &[4]u8{ 0, 0, 0, 0 });
    try buf.append(alloc, EXT_MOTD);
    try buf.appendSlice(alloc, &[4]u8{ 0, 0, 0, 0 });
}
