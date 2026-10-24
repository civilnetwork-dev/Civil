//! JSDefender's internal statement maps (module 7015), including its
//! absolute source indices and postorder mapping sequence.

const std = @import("std");
const parser = @import("parser");
const render = @import("render.zig");
const ast = parser.ast;
const A = std.mem.Allocator;
const Point = struct {
    line: i64 = 0,
    column: i64 = 0,
    index: i64 = 0,
};
const Location = struct {
    start: Point = .{},
    end: Point = .{},
    filename: []const u8 = "",
    identifierName: ?[]const u8 = "",
};
const Pair = struct { original: Location = .{}, generated: Location = .{} };
pub const Record = struct { present: bool = false, original: Location = .{} };
pub const Origin = struct {
    source: []const u8,
    body_only: bool = false,
};
const Key = struct {
    tree: *const ast.Tree,
    node: ast.NodeIndex,
};

pub const Registry = struct {
    allocator: A,
    values: std.AutoHashMapUnmanaged(Key, Record) = .empty,

    pub fn init(allocator: A) Registry {
        return .{ .allocator = allocator };
    }

    pub fn deinit(self: *Registry) void {
        self.values.deinit(self.allocator);
    }
};

threadlocal var active: ?*Registry = null;

pub fn activate(registry: ?*Registry) ?*Registry {
    const previous = active;
    active = registry;
    return previous;
}

fn clearTree(tree: *const ast.Tree) !void {
    const registry = active orelse return;
    var keys: std.ArrayList(Key) = .empty;
    defer keys.deinit(registry.allocator);
    var iterator = registry.values.keyIterator();
    while (iterator.next()) |key| if (key.tree == tree) {
        try keys.append(registry.allocator, key.*);
    };
    for (keys.items) |key| _ = registry.values.remove(key);
}

fn put(tree: *const ast.Tree, node: ast.NodeIndex, record: Record) !void {
    if (active) |registry| try registry.values.put(registry.allocator, .{ .tree = tree, .node = node }, record);
}

pub fn registerBuilder(tree: *const ast.Tree, node: ast.NodeIndex) A.Error!void {
    try put(tree, node, .{});
}

pub fn registerSynthetic(tree: *const ast.Tree, node: ast.NodeIndex) A.Error!void {
    try put(tree, node, .{ .present = true });
}

fn parsedLocation(tree: *const ast.Tree, node: ast.NodeIndex) Record {
    const span = tree.span(node);
    if (span.end <= span.start or span.end > tree.source.len) return .{};
    var location = Location{
        .start = point(tree.source, span.start),
        .end = point(tree.source, span.end),
        .identifierName = null,
    };
    location.start.line -= 1;
    return .{ .present = true, .original = location };
}

fn lookup(tree: *const ast.Tree, node: ast.NodeIndex) Record {
    if (active) |registry| if (registry.values.get(.{ .tree = tree, .node = node })) |record| return record;
    return parsedLocation(tree, node);
}

pub fn copyNode(
    source: *const ast.Tree,
    target: *const ast.Tree,
    from: ast.NodeIndex,
    to: ast.NodeIndex,
) A.Error!void {
    if (active == null) return;
    const mapped = switch (source.data(from)) {
        .expression_statement, .variable_declaration => true,
        .function => |v| v.type == .function_declaration,
        else => false,
    };
    // Babel cloneDeep retains `loc`, but drops the custom `location` field
    // used by the statement-map printer. SourceTree refresh registers input
    // clones separately; transform clones therefore start without a mapping.
    if (mapped) try put(target, to, .{});
}

pub fn registerRefreshed(allocator: A, tree: *const ast.Tree, minimum: usize) !void {
    const registry = active orelse return;
    const nodes = try collect(allocator, tree, minimum);
    defer allocator.free(nodes);
    for (nodes) |node| {
        const key = Key{ .tree = tree, .node = node };
        if (!registry.values.contains(key)) try put(tree, node, .{ .present = true });
    }
}

fn collect(allocator: A, tree: *const ast.Tree, minimum: usize) ![]ast.NodeIndex {
    var collector = Collector{ .allocator = allocator, .minimum = minimum };
    try parser.traverser.basic.traverse(Collector, @constCast(tree), &collector);
    if (collector.allocation_failed) return error.OutOfMemory;
    return collector.nodes.toOwnedSlice(allocator);
}

pub fn registerSource(allocator: A, tree: *const ast.Tree) !void {
    if (active == null) return;
    try clearTree(tree);
    const nodes = try collect(allocator, tree, 0);
    defer allocator.free(nodes);
    for (nodes) |node| try put(tree, node, parsedLocation(tree, node));
}

pub fn capture(allocator: A, tree: *const ast.Tree) !?[]Record {
    if (active == null) return null;
    const nodes = try collect(allocator, tree, 0);
    defer allocator.free(nodes);
    const records = try allocator.alloc(Record, nodes.len);
    for (nodes, records) |node, *record| record.* = lookup(tree, node);
    return records;
}

pub fn assign(allocator: A, tree: *const ast.Tree, minimum: usize, records: ?[]const Record) !void {
    const values = records orelse return;
    const nodes = try collect(allocator, tree, minimum);
    defer allocator.free(nodes);
    if (nodes.len != values.len) return error.SourceMapShapeMismatch;
    for (nodes, values) |node, record| try put(tree, node, record);
}

pub fn registerEmbedded(
    allocator: A,
    tree: *const ast.Tree,
    minimum: usize,
    origin: ?Origin,
    default_present: bool,
) !void {
    if (active == null) return;
    const nodes = try collect(allocator, tree, minimum);
    defer allocator.free(nodes);
    if (origin) |source| {
        var original = try parser.parse(allocator, source.source, .{});
        defer original.deinit();
        const parsed = try collect(allocator, &original, 0);
        defer allocator.free(parsed);
        if (parsed.len != nodes.len) return error.SourceMapShapeMismatch;
        for (nodes, parsed, 0..) |node, from, i| try put(tree, node, if (source.body_only and i + 1 == nodes.len) .{} else parsedLocation(&original, from));
    } else for (nodes) |node| try put(tree, node, .{ .present = default_present });
}

pub fn registerRuntime(
    allocator: A,
    tree: *const ast.Tree,
    entries: []const []const u8,
    origins: []const ?Origin,
) !void {
    if (active == null) return;
    try clearTree(tree);
    const nodes = try collect(allocator, tree, 0);
    defer allocator.free(nodes);
    // The protector declaration and setup expression are builder nodes.
    for (nodes) |node| try put(tree, node, .{ .present = true });
    var cursor: usize = 1;
    for (entries, origins) |entry, origin| {
        var snippet = try parser.parse(allocator, if (origin) |value| value.source else entry, .{});
        defer snippet.deinit();
        const parsed = try collect(allocator, &snippet, 0);
        defer allocator.free(parsed);
        if (cursor + parsed.len > nodes.len) return error.SourceMapShapeMismatch;
        for (nodes[cursor..][0..parsed.len], parsed, 0..) |node, from, i| try put(
            tree,
            node,
            if (origin) |value|
                if (value.body_only and i + 1 == parsed.len) .{ .present = true } else parsedLocation(&snippet, from)
            else
                .{ .present = true },
        );
        cursor += parsed.len;
    }
    if (cursor + 1 != nodes.len) return error.SourceMapShapeMismatch;
}
const Map = struct {
    lastRelativeLocations: Pair = .{},
    lastAbsoluteLocations: Pair = .{},
    source: usize,
    longestSegment: u8 = 0,
    names: []const []const u8 = &.{},
    mappings: []const u8 = "",
};
const Collector = struct {
    allocator: A,
    nodes: std.ArrayList(ast.NodeIndex) = .empty,
    allocation_failed: bool = false,
    minimum: usize = 0,

    pub fn enter_node(
        _: *@This(),
        data: ast.NodeData,
        _: ast.NodeIndex,
        ctx: *parser.traverser.basic.Ctx,
    ) parser.traverser.Action {
        return if (data == .static_block or data == .property_definition or data == .meta_property or @import("policy.zig").privateMember(ctx.tree, data))
            .skip
        else
            .proceed;
    }

    pub fn exit_node(
        self: *@This(),
        data: ast.NodeData,
        index: ast.NodeIndex,
        _: *parser.traverser.basic.Ctx,
    ) void {
        const mapped = switch (data) {
            .expression_statement, .variable_declaration => true,
            .function => |value| value.type == .function_declaration,
            else => false,
        };
        if (mapped and @backingInt(index) >= self.minimum) self.nodes.append(self.allocator, index) catch {
            self.allocation_failed = true;
        };
    }
};
// The mapped renderer intentionally omits syntax unknown to the SDK's
// source-map printer, so its output can be unparseable (for example `.url`).
// Locate statements within their rendered owners when reparsing loses shape.
const RenderedPositions = struct {
    allocator: A,
    code: []const u8,
    tokens: []const ast.Token,
    cursor: usize = 0,
    stack: std.ArrayList(Frame) = .empty,
    positions: std.ArrayList(usize) = .empty,
    failed: bool = false,
    const Frame = struct {
        start: usize,
        end: usize,
        cursor: usize,
    };

    fn mapped(data: ast.NodeData) bool {
        return switch (data) {
            .expression_statement, .variable_declaration => true,
            .function => |value| value.type == .function_declaration,
            else => false,
        };
    }

    pub fn enter_node(
        self: *@This(),
        data: ast.NodeData,
        node: ast.NodeIndex,
        ctx: *parser.traverser.basic.Ctx,
    ) parser.traverser.Action {
        if (data == .static_block or data == .property_definition or data == .meta_property or @import("policy.zig").privateMember(ctx.tree, data))
            return .skip;
        if (self.failed or !mapped(data)) return .proceed;
        const text = render.renderNodeMapped(self.allocator, ctx.tree, node) catch {
            self.failed = true;
            return .skip;
        };
        defer self.allocator.free(text);
        const start = if (self.stack.items.len == 0) self.cursor else self.stack.items[self.stack.items.len - 1].cursor;
        const end = if (self.stack.items.len == 0) self.code.len else self.stack.items[self.stack.items.len - 1].end;
        const found = search: {
            var cursor = start;
            candidates: while (true) {
                const offset = std.mem.indexOfPos(u8, self.code[0..end], cursor, text) orelse {
                    self.failed = true;
                    return .skip;
                };
                // Statement text inside a literal is not an emitted statement.
                for (self.tokens) |token| switch (token.tag) {
                    .string_literal, .regex_literal, .no_substitution_template, .template_head, .template_middle, .template_tail => if (offset > token.span.start and offset < token.span.end) {
                        cursor = token.span.end;
                        continue :candidates;
                    },
                    else => {},
                };
                break :search offset;
            }
        };
        if (self.stack.items.len == 0)
            self.cursor = found + text.len
        else
            self.stack.items[self.stack.items.len - 1].cursor = found + text.len;
        self.stack.append(self.allocator, .{ .start = found, .end = found + text.len, .cursor = found }) catch {
            self.failed = true;
            return .skip;
        };
        return .proceed;
    }

    pub fn exit_node(
        self: *@This(),
        data: ast.NodeData,
        _: ast.NodeIndex,
        _: *parser.traverser.basic.Ctx,
    ) void {
        if (self.failed or !mapped(data)) return;
        const frame = self.stack.pop().?;
        self.positions.append(self.allocator, frame.start) catch {
            self.failed = true;
        };
    }
};

fn units(text: []const u8) i64 {
    var count: i64 = 0;
    for (text) |byte| if (byte < 0x80 or byte >= 0xc0) {
        count += if (byte >= 0xf0) @as(i64, 2) else 1;
    };
    return count;
}

fn point(source: []const u8, offset: usize) Point {
    const prefix = source[0..@min(offset, source.len)];
    var line: i64 = 1;
    var start: usize = 0;
    for (prefix, 0..) |byte, i| {
        if (byte == '\n') {
            line += 1;
            start = i + 1;
        }
        if (byte == '\r' and (i + 1 >= prefix.len or prefix[i + 1] != '\n')) {
            line += 1;
            start = i + 1;
        }
        if (i >= 2 and byte >= 0xa8 and byte <= 0xa9 and prefix[i - 2] == 0xe2 and prefix[i - 1] == 0x80) {
            line += 1;
            start = i + 1;
        }
    }
    return .{ .line = line, .column = units(prefix[start..]), .index = units(prefix) };
}

fn relative(current: Location, previous: Location, generated: bool) Location {
    return .{
        .start = .{
            .line = if (generated) 0 else current.start.line - previous.start.line,
            .column = current.start.column - previous.start.column,
        },
        .end = .{
            .line = if (generated) 0 else current.end.line - previous.end.line,
            .column = current.end.column - previous.end.column,
        },
    };
}

fn vlq(allocator: A, out: *std.ArrayList(u8), value: i64) !void {
    var encoded: u64 = (@as(u64, @intCast(if (value < 0) -value else value)) << 1) | @intFromBool(value < 0);
    while (true) {
        var digit: u8 = @intCast(encoded & 31);
        encoded >>= 5;
        if (encoded != 0) digit |= 32;
        try out.append(allocator, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[digit]);
        if (encoded == 0) break;
    }
}

pub fn generate(allocator: A, tree: *const ast.Tree, code: []const u8, source_index: usize) ![]u8 {
    var arena = std.heap.ArenaAllocator.init(allocator);
    defer arena.deinit();
    const scratch = arena.allocator();
    var generated = try parser.parse(scratch, code, .{ .source_type = tree.data(tree.root).program.source_type, .tokens = true });
    defer generated.deinit();
    var original_nodes = Collector{ .allocator = scratch };
    var generated_nodes = Collector{ .allocator = scratch };
    // The parser's traverser takes a mutable tree, though these visitors only
    // collect node indices. Protection and rendering are already complete.
    try parser.traverser.basic.traverse(Collector, @constCast(tree), &original_nodes);
    try parser.traverser.basic.traverse(Collector, &generated, &generated_nodes);
    if (original_nodes.allocation_failed or generated_nodes.allocation_failed) return error.OutOfMemory;
    const same_shape = !generated.hasErrors() and original_nodes.nodes.items.len == generated_nodes.nodes.items.len;
    var rendered_positions = RenderedPositions{ .allocator = scratch, .code = code, .tokens = generated.tokens };
    if (!same_shape) {
        try parser.traverser.basic.traverse(RenderedPositions, @constCast(tree), &rendered_positions);
        if (rendered_positions.failed or rendered_positions.positions.items.len != original_nodes.nodes.items.len)
            return error.SourceMapShapeMismatch;
    }
    var map = Map{ .source = source_index };
    var mappings: std.ArrayList(u8) = .empty;
    for (original_nodes.nodes.items, 0..) |original, ordinal| {
        var locations: Pair = .{};
        const record = lookup(tree, original);
        if (record.present) {
            locations.original = record.original;
            const rendered = try render.renderNodeMapped(scratch, tree, original);
            const offset = if (same_shape)
                generated.span(generated_nodes.nodes.items[ordinal]).start
            else
                rendered_positions.positions.items[ordinal];
            const column = units(code[0..offset]);
            locations.generated = .{ .start = .{ .line = 1, .column = column }, .end = .{ .line = 1, .column = column + units(rendered) } };
        }
        map.lastRelativeLocations = .{
            .original = relative(locations.original, map.lastAbsoluteLocations.original, false),
            .generated = relative(locations.generated, map.lastAbsoluteLocations.generated, true),
        };
        map.lastAbsoluteLocations = locations;
        map.longestSegment = 5;
        for ([_]i64{
            map.lastRelativeLocations.generated.start.column,
            @intCast(source_index),
            map.lastRelativeLocations.original.start.line,
            map.lastRelativeLocations.original.start.column,
        }) |value| try vlq(scratch, &mappings, value);
        try mappings.append(scratch, ',');
    }
    map.mappings = mappings.items;
    return std.json.Stringify.valueAlloc(allocator, map, .{ .emit_null_optional_fields = false });
}

test "internal source map matches recovered statement deltas" {
    const allocator = std.testing.allocator;
    var tree = try parser.parse(allocator, "var a=1;function f(x){let y=x+a;return y;}console.log(f(2));", .{});
    defer tree.deinit();
    const code = try render.render(allocator, &tree);
    defer allocator.free(code);
    const json = try generate(allocator, &tree, code, 0);
    defer allocator.free(json);
    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, json, .{});
    defer parsed.deinit();
    try std.testing.expectEqualStrings("AAAA,sBAAsB,dAAd,kCAAkC,", parsed.value.object.get("mappings").?.string);
}

test "statement clone drops custom mapping metadata while retaining its span" {
    const allocator = std.testing.allocator;
    var registry = Registry.init(allocator);
    defer registry.deinit();
    const previous = activate(&registry);
    defer _ = activate(previous);
    var tree = try parser.parse(allocator, "work();", .{});
    defer tree.deinit();
    try registerSource(allocator, &tree);
    const original = tree.extra(tree.data(tree.root).program.body)[0];
    const cloned = try tree.addNode(tree.data(original), tree.span(original));
    try copyNode(&tree, &tree, original, cloned);
    var program = tree.data(tree.root).program;
    program.body = try tree.addExtra(&.{cloned});
    tree.setData(tree.root, .{ .program = program });
    const json = try generate(allocator, &tree, "work();", 0);
    defer allocator.free(json);
    var parsed_json = try std.json.parseFromSlice(std.json.Value, allocator, json, .{});
    defer parsed_json.deinit();
    try std.testing.expectEqualStrings("AAAA,", parsed_json.value.object.get("mappings").?.string);
    const generated = parsed_json.value.object.get("lastAbsoluteLocations").?.object.get("generated").?;
    try std.testing.expectEqual(@as(i64, 0), generated.object.get("end").?.object.get("column").?.integer);
}
