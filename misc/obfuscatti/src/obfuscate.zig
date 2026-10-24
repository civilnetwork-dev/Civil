//! Public native entry points for the recovered JSDefender protection engine.
//! All callers go through jsdefender/engine.zig.

const std = @import("std");
pub const engine = @import("jsdefender/engine.zig");
pub const config = engine.config;
pub const SourceInfo = engine.SourceInfo;
pub const Result = engine.Result;
pub const ProtectionOptions = engine.Options;
pub const protectSource = engine.protect;

pub const Options = struct {
    minify: bool = false,
    configuration: ?*const config.Config = null,
};

/// Returns an owned source string. A separately emitted runtime needs the
/// multi-source protectSource API, which returns that runtime explicitly.
pub fn obfuscate(allocator: std.mem.Allocator, source: []const u8, options: Options) ![]const u8 {
    var default_configuration: ?config.Config = if (options.configuration == null) config.defaults(allocator) else null;
    defer if (default_configuration) |*configuration| configuration.deinit();
    const configuration = options.configuration orelse &default_configuration.?;
    if (configuration.runtime_injection.mode == .separate_source) return error.UnsupportedRuntimeMode;
    // The compatibility helper emits one self-contained result for scripts
    // and auto-detected ES modules. protectSource retains strict mode rules.
    var single_configuration = configuration.*;
    if (single_configuration.runtime_injection.mode == .first_non_module)
        single_configuration.runtime_injection.mode = .all;
    const result = try engine.protect(allocator, &.{.{ .source_code = source }}, &single_configuration, .{ .minify = options.minify });
    defer result.deinit(allocator);
    if (result.protected_sources.len == 0) return allocator.dupe(u8, source);
    return allocator.dupe(u8, result.protected_sources[0]);
}

pub const ObfuscateError = @typeInfo(@typeInfo(@TypeOf(obfuscate)).@"fn".return_type.?).error_union.error_set;

test {
    _ = engine;
    _ = config;
    _ = ObfuscateError;
}

test "public obfuscate runs the recovered engine and returns owned JavaScript" {
    const allocator = std.testing.allocator;
    const output = try obfuscate(allocator, "console.log('hello'+' '+'world');", .{});
    defer allocator.free(output);
    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();
    var temporary = std.testing.tmpDir(.{});
    defer temporary.cleanup();
    {
        var file = try temporary.dir.createFile(io, "protected.js", .{});
        defer file.close(io);
        try file.writeStreamingAll(io, output);
    }
    const path = try temporary.dir.realPathFileAlloc(io, "protected.js", allocator);
    defer allocator.free(path);
    const result = try std.process.run(allocator, io, .{ .argv = &.{ "bun", path } });
    defer allocator.free(result.stdout);
    defer allocator.free(result.stderr);
    try std.testing.expectEqualStrings("", result.stderr);
    try std.testing.expectEqualStrings("hello world\n", result.stdout);
}

test "single-source compatibility API rejects a separately emitted runtime" {
    const allocator = std.testing.allocator;
    var configuration = config.defaults(allocator);
    defer configuration.deinit();
    configuration.runtime_injection.mode = .separate_source;
    try std.testing.expectError(
        error.UnsupportedRuntimeMode,
        obfuscate(allocator, "console.log('hello');", .{ .configuration = &configuration }),
    );
}
