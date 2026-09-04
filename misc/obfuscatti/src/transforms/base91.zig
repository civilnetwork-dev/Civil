//! basE91 encoding — port of js-confuser's own default string-concealing
//! encoder (`transforms/string/encoding.ts`'s `createDefaultStringEncoding`,
//! a JS adaptation of Joachim Henke's public-domain basE91 reference
//! implementation). Operates over a 91-character table (any table works;
//! `array_extraction.zig` supplies its own fixed one) rather than the
//! algorithm's usual hardcoded charset, matching the original.
//!
//! Only `encode` is ported — this runs at obfuscation time, over UTF-8
//! bytes, to build the buffer string a transform embeds. Decoding happens
//! at *runtime*, in the generated JS itself (a real decoder function
//! embedded via `embed_snippet.zig`, not this file) — there is
//! deliberately no Zig-side decode function, since nothing here ever
//! needs to decode a basE91 string back, only produce one.

const std = @import("std");

/// `raw` is encoded against `table` (must be exactly 91 bytes — the
/// caller's responsibility, not re-validated here since every caller in
/// this codebase supplies a fixed, known-91-byte table). Matches the
/// reference bit-packing exactly: 13 or 14 bits consumed per output pair,
/// chosen by whether the low 13 bits alone exceed 88.
pub fn encode(allocator: std.mem.Allocator, table: *const [91]u8, raw: []const u8) ![]u8 {
    var ret: std.ArrayList(u8) = .empty;
    defer ret.deinit(allocator);

    var n: u5 = 0;
    var b: u32 = 0;
    for (raw) |byte| {
        b |= @as(u32, byte) << n;
        n += 8;
        if (n > 13) {
            var v = b & 8191;
            if (v > 88) {
                b >>= 13;
                n -= 13;
            } else {
                v = b & 16383;
                b >>= 14;
                n -= 14;
            }
            try ret.append(allocator, table[v % 91]);
            try ret.append(allocator, table[v / 91]);
        }
    }
    if (n != 0) {
        try ret.append(allocator, table[b % 91]);
        if (n > 7 or b > 90) try ret.append(allocator, table[b / 91]);
    }
    return ret.toOwnedSlice(allocator);
}

test "round-trips through the reference algorithm's own decode shape" {
    // No Zig-side decode to compare against by design (see this file's
    // own top comment) -- this hand-transcribes the *reference* decode
    // loop once, here, as a test-only check that `encode`'s output is
    // actually decodable by it, not just "some bytes came out". Real
    // end-to-end proof (encode here, decode in a real JS engine via the
    // generated decoder function) lives in array_extraction.zig's own
    // tests.
    const allocator = std.testing.allocator;
    const table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~\"";

    const cases = [_][]const u8{ "a", "hello", "Hello, world!", "the quick brown fox jumps over the lazy dog", "" };
    for (cases) |original| {
        const encoded = try encode(allocator, table, original);
        defer allocator.free(encoded);

        var decoded: std.ArrayList(u8) = .empty;
        defer decoded.deinit(allocator);
        var b: u32 = 0;
        var n: u5 = 0;
        var v: i32 = -1;
        for (encoded) |c| {
            const p = std.mem.indexOfScalar(u8, table, c) orelse continue;
            if (v < 0) {
                v = @intCast(p);
            } else {
                v += @as(i32, @intCast(p)) * 91;
                b |= @as(u32, @intCast(v)) << n;
                n += if ((v & 8191) > 88) 13 else 14;
                while (true) {
                    try decoded.append(allocator, @intCast(b & 0xff));
                    b >>= 8;
                    n -= 8;
                    if (n <= 7) break;
                }
                v = -1;
            }
        }
        if (v > -1) {
            try decoded.append(allocator, @intCast((b | (@as(u32, @intCast(v)) << n)) & 0xff));
        }

        try std.testing.expectEqualStrings(original, decoded.items);
    }
}
