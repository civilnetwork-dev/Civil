//! Embeds a real JS source snippet into a transform's own tree, parsed and
//! cloned rather than hand-built node by node.
//!
//! js-confuser leans on this constantly — its `Template` class parses a
//! plain JS string (via the same Babel parser it obfuscates user code
//! with) and splices the result into the AST being built, wherever a
//! transform needs to emit real code shaped like something a human wrote
//! rather than synthesized expression-by-expression. Its dead-code
//! template library (`templates/deadCodeTemplates.ts`) is ~24 real,
//! substantial snippets — a full SHA-256 implementation, a UTF-8
//! codec, an RSA toy implementation, LeetCode-style algorithm solutions —
//! embedded exactly this way. Its string-concealing transform generates a
//! decoder function the same way (`encoding.ts`'s `code: new
//! Template(...)`).
//!
//! yuku's `Parser` has no equivalent: `Parser.init`/`Parser.parse` always
//! build a fresh, owned `Tree` (confirmed by reading `parser/parser.zig`
//! directly, not assumed) — there's no "parse this snippet into the tree
//! I already have" entry point. Every transform in this project instead
//! builds every node it emits by hand, one `tree.addNode` call at a time
//! — fine for a handful of nodes (a getter, a guard `if`), completely
//! impractical for something the size of a real SHA-256 implementation.
//!
//! This closes that gap generically instead of one hand-written clone per
//! snippet: `parser.parse` the snippet into its own throwaway `Tree`, then
//! walk it copying every node's data into the target tree, remapping
//! every `NodeIndex`/`IndexRange`/`String` field it finds along the way to
//! the copy's own equivalents. The remap logic is written once, over
//! `NodeData`'s fields via comptime reflection (`inline for
//! (std.meta.fields(...))`) — not one branch per node variant — so it
//! doesn't need updating every time yuku's grammar grows a new node type.
//! A field of any other type (bool, an enum like `VariableKind`, a plain
//! `u32`) needs no remapping at all: it's already tree-independent, so the
//! struct-level `var out = payload;` copy handles it for free.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;

const no_span: ast.Span = .{ .start = 0, .end = 0 };

/// Parses `source` as a standalone program and clones its top-level
/// statements into `target`, returning them as a fresh `IndexRange`
/// (via `target.addExtra`) ready to splice into `target`'s own body —
/// same shape every other transform here already builds by hand for
/// `prependProgram`-style insertion.
pub fn embedProgram(allocator: std.mem.Allocator, target: *ast.Tree, source: []const u8) !ast.IndexRange {
    var snippet = parser.parse(allocator, source, .{}) catch |err| switch (err) {
        error.OutOfMemory => return error.OutOfMemory,
        else => unreachable, // every embedded snippet here is a fixed, known-valid literal
    };
    defer snippet.deinit();

    const prog = switch (snippet.data(snippet.root)) {
        .program => |p| p,
        else => unreachable, // parser.parse always produces a program root
    };
    const stmts = snippet.extra(prog.body);

    var cloned: std.ArrayList(ast.NodeIndex) = .empty;
    defer cloned.deinit(allocator);
    try cloned.ensureTotalCapacityPrecise(allocator, stmts.len);
    for (stmts) |stmt| cloned.appendAssumeCapacity(try cloneNode(allocator, &snippet, target, stmt));
    return target.addExtra(cloned.items);
}

/// Same as `embedProgram`, but for a single expression (`source` is
/// parsed as `source;`, and the wrapping expression-statement's own
/// expression is what gets cloned and returned) — for a snippet that
/// needs to sit in an expression position rather than a statement list.
pub fn embedExpression(allocator: std.mem.Allocator, target: *ast.Tree, source: []const u8) !ast.NodeIndex {
    var buf = try allocator.alloc(u8, source.len + 1);
    defer allocator.free(buf);
    @memcpy(buf[0..source.len], source);
    buf[source.len] = ';';

    var snippet = parser.parse(allocator, buf, .{}) catch |err| switch (err) {
        error.OutOfMemory => return error.OutOfMemory,
        else => unreachable,
    };
    defer snippet.deinit();

    const prog = switch (snippet.data(snippet.root)) {
        .program => |p| p,
        else => unreachable,
    };
    const stmts = snippet.extra(prog.body);
    std.debug.assert(stmts.len == 1);
    const expr = switch (snippet.data(stmts[0])) {
        .expression_statement => |s| s.expression,
        else => unreachable,
    };
    return cloneNode(allocator, &snippet, target, expr);
}

const CloneError = std.mem.Allocator.Error;

fn cloneNode(allocator: std.mem.Allocator, src: *ast.Tree, dst: *ast.Tree, index: ast.NodeIndex) CloneError!ast.NodeIndex {
    if (index == .null) return .null;
    const cloned_data = try cloneData(allocator, src, dst, src.data(index));
    return dst.addNode(cloned_data, no_span);
}

fn cloneRange(allocator: std.mem.Allocator, src: *ast.Tree, dst: *ast.Tree, range: ast.IndexRange) CloneError!ast.IndexRange {
    const items = src.extra(range);
    var out: std.ArrayList(ast.NodeIndex) = .empty;
    defer out.deinit(allocator);
    try out.ensureTotalCapacityPrecise(allocator, items.len);
    for (items) |item| out.appendAssumeCapacity(try cloneNode(allocator, src, dst, item));
    return dst.addExtra(out.items);
}

fn cloneData(allocator: std.mem.Allocator, src: *ast.Tree, dst: *ast.Tree, data: ast.NodeData) CloneError!ast.NodeData {
    switch (data) {
        inline else => |payload, tag| {
            const T = @TypeOf(payload);
            if (@typeInfo(T) != .@"struct") return data;

            var out: T = payload;
            inline for (std.meta.fields(T)) |field| {
                if (field.type == ast.NodeIndex) {
                    @field(out, field.name) = try cloneNode(allocator, src, dst, @field(payload, field.name));
                } else if (field.type == ?ast.NodeIndex) {
                    @field(out, field.name) = if (@field(payload, field.name)) |idx|
                        try cloneNode(allocator, src, dst, idx)
                    else
                        null;
                } else if (field.type == ast.IndexRange) {
                    @field(out, field.name) = try cloneRange(allocator, src, dst, @field(payload, field.name));
                } else if (field.type == ast.String) {
                    @field(out, field.name) = try dst.addString(src.string(@field(payload, field.name)));
                } else if (field.type == ?ast.String) {
                    @field(out, field.name) = if (@field(payload, field.name)) |s|
                        try dst.addString(src.string(s))
                    else
                        null;
                }
                // else: plain value (bool, enum, u32, ...) -- tree-independent,
                // already correct from `var out = payload;` above.
            }
            return @unionInit(ast.NodeData, @tagName(tag), out);
        },
    }
}

test "embeds a real multi-statement snippet with control flow and runs identically" {
    const allocator = std.testing.allocator;
    var tree = try parser.parse(allocator, "console.log(\"before\");", .{});
    defer tree.deinit();

    const prog = switch (tree.data(tree.root)) {
        .program => |p| p,
        else => unreachable,
    };
    const original_body = tree.extra(prog.body);

    // Deliberately not trivial: a loop, a conditional, string
    // concatenation, a function declaration -- exercises far more of
    // NodeData's field shapes than any single hand-built node would.
    const snippet_body = try embedProgram(allocator, &tree,
        \\function sumEven(n) {
        \\  var total = 0;
        \\  for (var i = 0; i <= n; i++) {
        \\    if (i % 2 === 0) {
        \\      total = total + i;
        \\    }
        \\  }
        \\  return total;
        \\}
        \\console.log("sum:" + " " + sumEven(10));
    );

    var new_body: std.ArrayList(ast.NodeIndex) = .empty;
    defer new_body.deinit(allocator);
    try new_body.ensureTotalCapacityPrecise(allocator, original_body.len + tree.extra(snippet_body).len);
    new_body.appendSliceAssumeCapacity(original_body);
    new_body.appendSliceAssumeCapacity(tree.extra(snippet_body));
    tree.setData(tree.root, .{ .program = .{
        .source_type = prog.source_type,
        .body = try tree.addExtra(new_body.items),
        .hashbang = prog.hashbang,
    } });

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();

    var tmp_dir = std.testing.tmpDir(.{});
    defer tmp_dir.cleanup();
    {
        var file = try tmp_dir.dir.createFile(io, "out.js", .{});
        defer file.close(io);
        try file.writeStreamingAll(io, result.code);
    }
    const path = try tmp_dir.dir.realPathFileAlloc(io, "out.js", allocator);
    defer allocator.free(path);

    const run = try std.process.run(allocator, io, .{ .argv = &.{ "bun", path } });
    defer allocator.free(run.stdout);
    defer allocator.free(run.stderr);

    try std.testing.expectEqualStrings("before\nsum: 30\n", run.stdout);
}
