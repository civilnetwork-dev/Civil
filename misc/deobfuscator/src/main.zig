//! `deobfuscate [-o OUT] [--module] [--stats] FILE`
//!
//! Reads one JavaScript file — extension is ignored, so the `.tmp` files the
//! vendors ship are fed in directly — and writes the normalised source to OUT
//! or stdout.

const std = @import("std");
const deobfuscator = @import("deobfuscator");

const usage =
    \\usage: deobfuscate [options] FILE
    \\
    \\  -o, --out PATH   write to PATH instead of stdout
    \\      --module     parse as an ES module (default: commonjs)
    \\      --stats      print a per-pass count to stderr
    \\  -h, --help       show this message
    \\
;

/// Files this is pointed at are whole extension bundles; a few megabytes is
/// normal and the largest seen in the vendor set is well under this.
const max_input_bytes: std.Io.Limit = .limited(64 * 1024 * 1024);

pub fn main(init: std.process.Init) !u8 {
    const io = init.io;
    const gpa = init.gpa;

    var args = try std.process.Args.Iterator.initAllocator(init.minimal.args, gpa);
    defer args.deinit();
    _ = args.skip(); // argv[0]

    var input: ?[]const u8 = null;
    var output: ?[]const u8 = null;
    var source_type: @TypeOf((deobfuscator.Options{}).source_type) = .commonjs;
    var show_stats = false;

    while (args.next()) |arg| {
        if (std.mem.eql(u8, arg, "-h") or std.mem.eql(u8, arg, "--help")) {
            try std.Io.File.stdout().writeStreamingAll(io, usage);
            return 0;
        } else if (std.mem.eql(u8, arg, "--module")) {
            source_type = .module;
        } else if (std.mem.eql(u8, arg, "--stats")) {
            show_stats = true;
        } else if (std.mem.eql(u8, arg, "-o") or std.mem.eql(u8, arg, "--out")) {
            output = args.next() orelse return fail(io, "missing path after {s}\n", .{arg});
        } else if (arg.len > 0 and arg[0] == '-') {
            return fail(io, "unknown option {s}\n", .{arg});
        } else if (input != null) {
            return fail(io, "only one input file at a time\n", .{});
        } else {
            input = arg;
        }
    }

    const path = input orelse {
        try std.Io.File.stderr().writeStreamingAll(io, usage);
        return 2;
    };

    const source = std.Io.Dir.cwd().readFileAlloc(io, path, gpa, max_input_bytes) catch |err| {
        return fail(io, "cannot read {s}: {t}\n", .{ path, err });
    };
    defer gpa.free(source);

    const result = deobfuscator.deobfuscate(gpa, source, .{
        .source_type = source_type,
    }) catch |err| switch (err) {
        // Not fatal to the caller's batch: an unparseable file is worth naming
        // and skipping, not worth aborting a whole extension over.
        error.ParseFailed => return fail(io, "{s}: not valid JavaScript\n", .{path}),
        else => return err,
    };
    defer result.deinit(gpa);

    if (output) |out_path| {
        try std.Io.Dir.cwd().writeFile(io, .{ .sub_path = out_path, .data = result.code });
    } else {
        try std.Io.File.stdout().writeStreamingAll(io, result.code);
    }

    if (show_stats) {
        var buffer: [256]u8 = undefined;
        const line = try std.fmt.bufPrint(
            &buffer,
            "{s}: {d} strings, {d} members, {d} folds, {d} branches, {d} sequences\n",
            .{
                path,
                result.stats.strings_inlined,
                result.stats.members_normalized,
                result.stats.expressions_folded,
                result.stats.branches_pruned,
                result.stats.sequences_split,
            },
        );
        try std.Io.File.stderr().writeStreamingAll(io, line);
    }

    return 0;
}

fn fail(io: std.Io, comptime format: []const u8, args: anytype) u8 {
    var buffer: [512]u8 = undefined;
    const message = std.fmt.bufPrint(&buffer, format, args) catch "error\n";
    std.Io.File.stderr().writeStreamingAll(io, message) catch {};
    return 1;
}
