//! Metadata absent from yuku's AST: parsed semicolons and detached parents
//! on cloned Babel template children. Reserved empty spans carry these bits;
//! they never refer to user source and source maps treat them as synthetic.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const A = std.mem.Allocator;
pub const detached_span: ast.Span = .{ .start = 0xfffffffe, .end = 0xfffffffe };
pub const orphan_span: ast.Span = .{ .start = 0xfffffff9, .end = 0xfffffff9 };
pub const orphan_semicolon_span: ast.Span = .{ .start = 0xfffffff8, .end = 0xfffffff8 };

pub fn isOrphan(tree: *const ast.Tree, index: ast.NodeIndex) bool {
    return tree.span(index).start == orphan_span.start or tree.span(index).start == orphan_semicolon_span.start;
}

pub const explicit_parentheses_span: ast.Span = .{ .start = 0xfffffffb, .end = 0xfffffffb };
const semicolon_span: ast.Span = .{ .start = 0xfffffffd, .end = 0xfffffffd };
const detached_semicolon_span: ast.Span = .{ .start = 0xfffffffc, .end = 0xfffffffc };

pub fn isDetached(tree: *const ast.Tree, index: ast.NodeIndex) bool {
    return isOrphan(tree, index) or tree.span(index).start == detached_span.start or tree.span(index).start == detached_semicolon_span.start;
}

pub fn hasSemicolon(tree: *const ast.Tree, index: ast.NodeIndex) bool {
    const span = tree.span(index);
    return span.start == semicolon_span.start or span.start == detached_semicolon_span.start or span.start == orphan_semicolon_span.start or (span.end > span.start and span.end <= tree.source.len and tree.source[span.end - 1] == ';');
}

pub fn markDetached(tree: *ast.Tree, index: ast.NodeIndex) void {
    tree.setSpan(index, if (hasSemicolon(tree, index)) detached_semicolon_span else detached_span);
}

pub fn embedProgram(allocator: A, target: *ast.Tree, source: []const u8) !ast.IndexRange {
    return embed(allocator, target, source, false);
}

pub fn embedRenderedProgram(allocator: A, target: *ast.Tree, source: []const u8) !ast.IndexRange {
    return embed(allocator, target, source, true);
}

fn embed(allocator: A, target: *ast.Tree, source: []const u8, preserve_parentheses: bool) !ast.IndexRange {
    var snippet = try parser.parse(allocator, source, .{ .source_type = .script });
    defer snippet.deinit();
    if (snippet.hasErrors()) return error.RuntimeUnavailable;
    const statements = snippet.extra(snippet.data(snippet.root).program.body);
    const cloned = try allocator.alloc(ast.NodeIndex, statements.len);
    defer allocator.free(cloned);
    for (statements, cloned) |statement, *destination| destination.* = try clone(&snippet, target, statement, preserve_parentheses, false);
    return target.addExtra(cloned);
}

pub fn cloneSource(source: *const ast.Tree, target: *ast.Tree, index: ast.NodeIndex) A.Error!ast.NodeIndex {
    return clone(source, target, index, false, true);
}

fn clone(
    source: *const ast.Tree,
    target: *ast.Tree,
    index: ast.NodeIndex,
    preserve_parentheses: bool,
    preserve_source: bool,
) A.Error!ast.NodeIndex {
    if (index == .null) return .null;
    const data = source.data(index);
    const copied: ast.NodeData = switch (data) {
        inline else => |payload, tag| blk: {
            const T = @TypeOf(payload);
            if (@typeInfo(T) != .@"struct") break :blk data;
            var value = payload;
            inline for (@typeInfo(T).@"struct".field_names, @typeInfo(T).@"struct".field_types) |name, Field| {
                if (Field == ast.NodeIndex) {
                    @field(value, name) = try clone(source, target, @field(payload, name), preserve_parentheses, preserve_source);
                } else if (Field == ?ast.NodeIndex) {
                    @field(value, name) = if (@field(payload, name)) |node|
                        try clone(source, target, node, preserve_parentheses, preserve_source)
                    else
                        null;
                } else if (Field == ast.IndexRange) {
                    const range = source.extra(@field(payload, name));
                    const result = try target.allocator().alloc(ast.NodeIndex, range.len);
                    defer target.allocator().free(result);
                    @memcpy(result, range);
                    for (result) |*node| node.* = try clone(source, target, node.*, preserve_parentheses, preserve_source);
                    @field(value, name) = try target.addExtra(result);
                } else if (Field == ast.String) {
                    @field(value, name) = try target.addString(source.string(@field(payload, name)));
                } else if (Field == ?ast.String) {
                    @field(value, name) = if (@field(payload, name)) |text|
                        try target.addString(source.string(text))
                    else
                        null;
                }
            }
            break :blk @unionInit(ast.NodeData, @tagName(tag), value);
        },
    };
    const result = try target.addNode(
        copied,
        if (preserve_source)
            source.span(index)
        else if (preserve_parentheses and copied == .parenthesized_expression)
            explicit_parentheses_span
        else if (hasSemicolon(source, index))
            semicolon_span
        else
            .{ .start = 0, .end = 0 },
    );
    if (preserve_source) {
        try @import("source_map.zig").copyNode(source, target, index, result);
        try @import("lexical_location.zig").copyNode(source, target, index, result);
    }
    return result;
}
