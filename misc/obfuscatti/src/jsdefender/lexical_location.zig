//! Identifier locations survive template cloning independently of statement maps.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const A = std.mem.Allocator;
pub const Location = struct {
    line: usize,
    column: usize,
};

pub const Record = struct {
    location: ?Location = null,
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

pub fn lookup(tree: *const ast.Tree, node: ast.NodeIndex) ?Record {
    return if (active) |registry| registry.values.get(.{ .tree = tree, .node = node }) else null;
}

fn put(tree: *const ast.Tree, node: ast.NodeIndex, record: Record) !void {
    if (active) |registry| try registry.values.put(registry.allocator, .{ .tree = tree, .node = node }, record);
}

pub fn copyNode(
    source: *const ast.Tree,
    target: *const ast.Tree,
    from: ast.NodeIndex,
    to: ast.NodeIndex,
) A.Error!void {
    if (lookup(source, from)) |record| {
        try put(target, to, record);
    } else if (identifier(source.data(from))) {
        // cloneDeep retains identifier.loc even when later ownership repair
        // replaces its span with a synthetic/detached marker.
        try put(target, to, parsed(source, from));
    }
}

pub fn markAbsent(tree: *const ast.Tree, node: ast.NodeIndex) A.Error!void {
    try put(tree, node, .{});
}

pub fn parsed(tree: *const ast.Tree, node: ast.NodeIndex) Record {
    const span = tree.span(node);
    if (span.end <= span.start or span.end > tree.source.len) return .{};
    var line: usize = 1;
    var column: usize = 0;
    var i: usize = 0;
    while (i < span.start) : (i += 1) {
        const byte = tree.source[i];
        if (byte == '\n' or byte == '\r') {
            line += 1;
            column = 0;
            if (byte == '\r' and i + 1 < span.start and tree.source[i + 1] == '\n') i += 1;
        } else if (i + 2 < span.start and byte == 0xe2 and tree.source[i + 1] == 0x80 and (tree.source[i + 2] == 0xa8 or tree.source[i + 2] == 0xa9)) {
            line += 1;
            column = 0;
            i += 2;
        } else if (byte < 0x80 or byte >= 0xc0) column += if (byte >= 0xf0) @as(usize, 2) else 1;
    }
    return .{ .location = .{ .line = line, .column = column } };
}

fn identifier(data: ast.NodeData) bool {
    return switch (data) {
        .binding_identifier, .identifier_reference, .identifier_name, .label_identifier, .private_identifier => true,
        else => false,
    };
}
const Collector = struct {
    allocator: A,
    minimum: usize,
    nodes: std.ArrayList(ast.NodeIndex) = .empty,
    failed: bool = false,

    pub fn enter_node(
        self: *@This(),
        data: ast.NodeData,
        node: ast.NodeIndex,
        _: *parser.traverser.basic.Ctx,
    ) parser.traverser.Action {
        if (identifier(data) and @backingInt(node) >= self.minimum) self.nodes.append(self.allocator, node) catch {
            self.failed = true;
        };
        return .proceed;
    }
};

fn collect(allocator: A, tree: *const ast.Tree, root: ast.NodeIndex, minimum: usize) ![]ast.NodeIndex {
    const mutable = @constCast(tree);
    const previous = mutable.root;
    defer mutable.root = previous;
    mutable.root = root;
    var collector = Collector{ .allocator = allocator, .minimum = minimum };
    errdefer collector.nodes.deinit(allocator);
    try parser.traverser.basic.traverse(Collector, mutable, &collector);
    if (collector.failed) return error.OutOfMemory;
    return collector.nodes.toOwnedSlice(allocator);
}

pub fn capture(allocator: A, tree: *const ast.Tree) !?[]Record {
    if (active == null) return null;
    const nodes = try collect(allocator, tree, tree.root, 0);
    defer allocator.free(nodes);
    const records = try allocator.alloc(Record, nodes.len);
    for (nodes, records) |node, *record| record.* = lookup(tree, node) orelse parsed(tree, node);
    return records;
}

pub fn assign(allocator: A, tree: *const ast.Tree, minimum: usize, records: ?[]const Record) !void {
    const values = records orelse return;
    const nodes = try collect(allocator, tree, tree.root, minimum);
    defer allocator.free(nodes);
    if (nodes.len != values.len) return error.LexicalLocationShapeMismatch;
    for (nodes, values) |node, record| try put(tree, node, record);
}

fn registerPair(
    allocator: A,
    tree: *const ast.Tree,
    target: ast.NodeIndex,
    original: *const ast.Tree,
    from: ast.NodeIndex,
) !void {
    const nodes = try collect(allocator, tree, target, 0);
    defer allocator.free(nodes);
    const origins = try collect(allocator, original, from, 0);
    defer allocator.free(origins);
    if (nodes.len != origins.len) return error.LexicalLocationShapeMismatch;
    for (nodes, origins) |node, origin| try put(tree, node, parsed(original, origin));
}

pub fn registerExpression(
    allocator: A,
    tree: *const ast.Tree,
    target: ast.NodeIndex,
    source: []const u8,
) A.Error!void {
    if (active == null) return;
    var original = try parser.parse(allocator, source, .{});
    defer original.deinit();
    const statement = original.extra(original.data(original.root).program.body)[0];
    registerPair(allocator, tree, target, &original, original.data(statement).expression_statement.expression) catch |failure| switch (failure) {
        error.OutOfMemory => return error.OutOfMemory,
        else => unreachable,
    };
}

pub fn registerEmbedded(
    allocator: A,
    tree: *const ast.Tree,
    target: ast.NodeIndex,
    origin: ?@import("source_map.zig").Origin,
) !void {
    if (active == null) return;
    const nodes = try collect(allocator, tree, target, 0);
    defer allocator.free(nodes);
    for (nodes) |node| try put(tree, node, .{});
    const value = origin orelse return;
    var original = try parser.parse(allocator, value.source, .{});
    defer original.deinit();
    const statements = original.extra(original.data(original.root).program.body);
    if (statements.len == 0) return error.LexicalLocationShapeMismatch;
    var root = target;
    if (value.body_only) {
        const expression = tree.data(target).expression_statement.expression;
        root = tree.data(expression).assignment_expression.right;
        var from = statements[0];
        if (original.data(from) == .expression_statement) from = original.data(from).expression_statement.expression;
        var target_function = root;
        while (tree.data(target_function) == .parenthesized_expression) target_function = tree.data(target_function).parenthesized_expression.expression;
        var origin_function = from;
        while (original.data(origin_function) == .parenthesized_expression) origin_function = original.data(origin_function).parenthesized_expression.expression;
        // Protector helpers retain the parsed parameters/body, but replace
        // their named declaration with an anonymous function expression.
        if (tree.data(target_function) == .function and original.data(origin_function) == .function and tree.data(target_function).function.id == .null) {
            var function = original.data(origin_function).function;
            function.id = .null;
            original.setData(origin_function, .{ .function = function });
        }
        try registerPair(allocator, tree, root, &original, from);
    } else {
        if (statements.len != 1) return error.LexicalLocationShapeMismatch;
        try registerPair(allocator, tree, root, &original, statements[0]);
        // addBuiltinRuntimeHelper replaces the parsed function header ID.
        if (tree.data(root) == .function and original.data(statements[0]) == .function) {
            const id = tree.data(root).function.id;
            const from = original.data(statements[0]).function.id;
            if (id != .null and from != .null and !std.mem.eql(
                u8,
                tree.string(tree.data(id).binding_identifier.name),
                original.string(original.data(from).binding_identifier.name),
            )) try put(tree, id, .{});
        }
    }
}

pub fn registerRuntime(
    allocator: A,
    tree: *const ast.Tree,
    entries: []const []const u8,
    origins: []const ?@import("source_map.zig").Origin,
) !void {
    if (active == null) return;
    const all = try collect(allocator, tree, tree.root, 0);
    defer allocator.free(all);
    for (all) |node| try put(tree, node, .{});
    const statements = tree.extra(tree.data(tree.root).program.body);
    const call = tree.data(tree.data(statements[1]).expression_statement.expression).unary_expression.argument;
    const function = tree.data(call).call_expression.callee;
    const body = tree.extra(tree.data(tree.data(function).function.body).function_body.body);
    var cursor: usize = 0;
    for (entries, origins) |entry, origin| {
        var snippet = try parser.parse(allocator, entry, .{});
        defer snippet.deinit();
        const count = snippet.extra(snippet.data(snippet.root).program.body).len;
        if (cursor + count > body.len) return error.LexicalLocationShapeMismatch;
        if (origin) |value| {
            var original = try parser.parse(allocator, value.source, .{});
            defer original.deinit();
            const from = original.extra(original.data(original.root).program.body);
            if (value.body_only) {
                if (count != 1) return error.LexicalLocationShapeMismatch;
                try registerEmbedded(allocator, tree, body[cursor], value);
            } else {
                if (from.len != count) return error.LexicalLocationShapeMismatch;
                for (body[cursor..][0..count], from) |node, source_node| {
                    try registerPair(allocator, tree, node, &original, source_node);
                    if (tree.data(node) == .function and original.data(source_node) == .function) {
                        const id = tree.data(node).function.id;
                        const from_id = original.data(source_node).function.id;
                        if (id != .null and from_id != .null and !std.mem.eql(
                            u8,
                            tree.string(tree.data(id).binding_identifier.name),
                            original.string(original.data(from_id).binding_identifier.name),
                        )) try put(tree, id, .{});
                    }
                }
            }
        }
        cursor += count;
    }
    if (cursor != body.len) return error.LexicalLocationShapeMismatch;
}

test "identifier clone retains location after span ownership changes" {
    const allocator = std.testing.allocator;
    var registry = Registry.init(allocator);
    defer registry.deinit();
    const previous = activate(&registry);
    defer _ = activate(previous);
    var tree = try parser.parse(allocator, "var value=1;", .{});
    defer tree.deinit();
    const statement = tree.extra(tree.data(tree.root).program.body)[0];
    const declaration = tree.extra(tree.data(statement).variable_declaration.declarators)[0];
    const original = tree.data(declaration).variable_declarator.id;
    const cloned = try tree.addNode(tree.data(original), .{ .start = 0, .end = 0 });
    try copyNode(&tree, &tree, original, cloned);
    const location = lookup(&tree, cloned).?.location.?;
    try std.testing.expectEqual(@as(usize, 1), location.line);
    try std.testing.expectEqual(@as(usize, 4), location.column);
}

test "anonymous protector function inherits named template parameters and body only" {
    const allocator = std.testing.allocator;
    var registry = Registry.init(allocator);
    defer registry.deinit();
    const previous = activate(&registry);
    defer _ = activate(previous);
    var tree = try parser.parse(allocator, "R.key=(function(source){return source;});", .{});
    defer tree.deinit();
    const statement = tree.extra(tree.data(tree.root).program.body)[0];
    try registerEmbedded(
        allocator,
        &tree,
        statement,
        .{ .source = "function getKey(source){return source;}", .body_only = true },
    );
    const identifiers = try collect(allocator, &tree, tree.root, 0);
    defer allocator.free(identifiers);
    try std.testing.expectEqual(@as(usize, 4), identifiers.len);
    try std.testing.expect(lookup(&tree, identifiers[0]).?.location == null);
    try std.testing.expectEqual(@as(usize, 16), lookup(&tree, identifiers[2]).?.location.?.column);
    try std.testing.expectEqual(@as(usize, 31), lookup(&tree, identifiers[3]).?.location.?.column);
}
