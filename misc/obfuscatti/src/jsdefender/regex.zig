//! Standalone ECMAScript regexp matcher; no JavaScript execution engine.
//! Vendored QuickJS libregexp is used only for JSDefender's r: exclusions.

const std = @import("std");
const A = std.mem.Allocator;
pub const Error = A.Error || error{ InvalidPattern, InvalidUtf8, RegexExecutionFailed };
extern "c" fn lre_compile(*c_int, [*]u8, c_int, [*]const u8, usize, c_int, ?*anyopaque) ?[*]u8;
extern "c" fn lre_get_capture_count([*]const u8) c_int;
extern "c" fn lre_exec([*]?[*]u8, [*]const u8, [*]const u8, c_int, c_int, c_int, ?*anyopaque) c_int;
extern "c" fn realloc(?*anyopaque, usize) ?*anyopaque;
extern "c" fn free(?*anyopaque) void;

const Context = struct {
    stack_base: usize,
};
pub export fn lre_realloc(_: ?*anyopaque, pointer: ?*anyopaque, size: usize) ?*anyopaque {
    if (size == 0) {
        free(pointer);
        return null;
    }
    return realloc(pointer, size);
}
pub export fn lre_check_stack_overflow(opaque_context: ?*anyopaque, size: usize) c_int {
    const context: *Context = @ptrCast(@alignCast(opaque_context.?));
    var marker: u8 = 0;
    const current = @intFromPtr(&marker);
    const distance = if (current > context.stack_base) current - context.stack_base else context.stack_base - current;
    return @intFromBool(distance +| size > 1024 * 1024);
}
pub export fn lre_check_timeout(_: ?*anyopaque) c_int {
    return 0;
}

pub const Regex = struct {
    bytecode: [*]u8,

    pub fn compile(pattern: []const u8) Error!Regex {
        // libregexp accepts a length but its parser also reads the trailing
        // NUL sentinel. Config strings are slices and need their own sentinel.
        const terminated = try std.heap.smp_allocator.allocSentinel(u8, pattern.len, 0);
        @memcpy(terminated, pattern);
        defer std.heap.smp_allocator.free(terminated);
        var context = Context{ .stack_base = 0 };
        context.stack_base = @intFromPtr(&context);
        var length: c_int = 0;
        var message: [128]u8 = @splat(0);
        const code = lre_compile(&length, &message, message.len, terminated.ptr, pattern.len, 0, &context) orelse {
            const text = std.mem.sliceTo(&message, 0);
            return if (std.mem.indexOf(u8, text, "memory") != null) error.OutOfMemory else error.InvalidPattern;
        };
        return .{ .bytecode = code };
    }

    pub fn deinit(self: Regex) void {
        free(self.bytecode);
    }

    pub fn matches(self: Regex, allocator: A, value: []const u8) Error!bool {
        const units = std.unicode.utf8ToUtf16LeAlloc(allocator, value) catch |err| switch (err) {
            error.OutOfMemory => return error.OutOfMemory,
            else => return error.InvalidUtf8,
        };
        defer allocator.free(units);
        const captures = try allocator.alloc(?[*]u8, @as(usize, @intCast(lre_get_capture_count(self.bytecode))) * 2);
        defer allocator.free(captures);
        var context = Context{ .stack_base = 0 };
        context.stack_base = @intFromPtr(&context);
        const result = lre_exec(captures.ptr, self.bytecode, @ptrCast(units.ptr), 0, @intCast(units.len), 1, &context);
        return switch (result) {
            0 => false,
            1 => true,
            -1 => error.OutOfMemory,
            else => error.RegexExecutionFailed,
        };
    }
};

test "ECMAScript exclusions support lookaround backreferences and UTF16" {
    const allocator = std.testing.allocator;
    const cases = [_]struct {
        pattern: []const u8,
        yes: []const u8,
        no: []const u8,
    }{
        .{ .pattern = "^(foo|bar)_(\\d+)\\2$", .yes = "foo_1212", .no = "foo_123" },
        .{ .pattern = "(?<=prefix)name(?!Suffix)", .yes = "prefixname", .no = "prefixnameSuffix" },
        .{ .pattern = "^..$", .yes = "😀", .no = "a" },
        .{ .pattern = "^(?<part>a+)b\\k<part>$", .yes = "aabaa", .no = "aabaaa" },
    };
    for (cases) |case| {
        const regex = try Regex.compile(case.pattern);
        defer regex.deinit();
        try std.testing.expect(try regex.matches(allocator, case.yes));
        try std.testing.expect(!try regex.matches(allocator, case.no));
    }
    try std.testing.expectError(error.InvalidPattern, Regex.compile("["));
    const backing = "^xTHIS_IS_NOT_PART_OF_THE_PATTERN";
    const sliced = try Regex.compile(backing[0..2]);
    defer sliced.deinit();
    try std.testing.expect(try sliced.matches(allocator, "x"));
}
