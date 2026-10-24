//! Boolean and integer AST passes backed by the recovered scalar algorithms.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const scalars = @import("scalars.zig");
const embed = @import("embed_snippet.zig");
const Policy = @import("policy.zig").Policy;
const nodes = @import("nodes.zig");

const BooleanVisitor = struct {
    allocator: std.mem.Allocator,
    random: *scalars.Random,
    randomize: bool,
    policy: ?*const Policy = null,

    pub fn enter_boolean_literal(
        self: *BooleanVisitor,
        value: ast.BooleanLiteral,
        index: ast.NodeIndex,
        ctx: *parser.traverser.transform.Ctx,
    ) !parser.traverser.Action {
        if (nodes.isDetached(ctx.tree, index)) return .skip;
        const randomize = if (self.policy) |rules|
            (rules.settingsFor(index).boolean_literals.get() orelse return .skip).isRandomized()
        else
            self.randomize;
        const source = scalars.booleanExpression(value.value, randomize, self.random);
        const first = ctx.tree.nodes.len;
        const replacement = try embed.embedExpression(self.allocator, ctx.tree, source);
        try @import("lexical_location.zig").registerExpression(self.allocator, ctx.tree, replacement, source);
        for (first..ctx.tree.nodes.len) |i| ctx.tree.setSpan(@fromBackingInt(@intCast(i)), nodes.detached_span);
        ctx.tree.setData(index, ctx.tree.data(replacement));
        try @import("lexical_location.zig").copyNode(ctx.tree, ctx.tree, replacement, index);
        @import("summary.zig").count(8, 1);
        return .skip;
    }
};

pub fn applyBooleans(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    random: *scalars.Random,
    randomize: bool,
) !void {
    var visitor = BooleanVisitor{ .allocator = allocator, .random = random, .randomize = randomize };
    try parser.traverser.transform.traverse(BooleanVisitor, tree, &visitor);
}

const IntegerVisitor = struct {
    allocator: std.mem.Allocator,
    random: *scalars.Random,
    options: scalars.IntegerOptions,
    policy: ?*const Policy = null,

    pub fn enter_numeric_literal(
        self: *IntegerVisitor,
        value: ast.NumericLiteral,
        index: ast.NodeIndex,
        ctx: *parser.traverser.transform.Ctx,
    ) !parser.traverser.Action {
        if (nodes.isDetached(ctx.tree, index)) return .skip;
        const parent = ctx.path.parent() orelse return .proceed;
        switch (ctx.tree.data(parent)) {
            .object_property, .method_definition => return .proceed,
            .property_definition => |v| if (v.key == index and !v.computed) return .proceed,
            else => {},
        }
        var options = if (self.policy) |rules| rules.settingsFor(index).integer_literals.get() orelse return .proceed else self.options;
        const n = value.value(ctx.tree);
        if (!std.math.isFinite(n) or @floor(n) != n or n < 0) return .proceed;
        options.randomize = options.isRandomized();
        options = options.resolve();
        options.live_object = null;
        if (n >= 9223372036854775808.0 and n >= options.lower and n <= (if (options.upper == 0) @as(f64, 8) else options.upper))
            return .proceed;
        const source = (if (n >= 9223372036854775808.0)
            try scalars.largeIntegerExpression(self.allocator, n, options, self.random)
        else
            try scalars.integerExpression(self.allocator, @intFromFloat(n), options, self.random)) orelse return .proceed;
        defer self.allocator.free(source);
        // Upstream emits CustomLiteral verbatim, including its parentheses.
        // Parsing it would turn those into Babel-style optional parentheses.
        ctx.tree.setData(index, .{ .numeric_literal = .{ .kind = .decimal, .raw = try ctx.tree.addString(source) } });
        @import("summary.zig").count(13, 1);
        return .skip;
    }
};

pub fn applyIntegers(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    random: *scalars.Random,
    options: scalars.IntegerOptions,
) !void {
    var visitor = IntegerVisitor{ .allocator = allocator, .random = random, .options = options };
    try parser.traverser.transform.traverse(IntegerVisitor, tree, &visitor);
}

pub fn applyBooleansWithPolicy(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    random: *scalars.Random,
    policy: *const Policy,
) !void {
    var visitor = BooleanVisitor{ .allocator = allocator, .random = random, .randomize = false, .policy = policy };
    try parser.traverser.transform.traverse(BooleanVisitor, tree, &visitor);
}

pub fn applyIntegersWithPolicy(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    random: *scalars.Random,
    policy: *const Policy,
) !void {
    var visitor = IntegerVisitor{ .allocator = allocator, .random = random, .options = .{}, .policy = policy };
    try parser.traverser.transform.traverse(IntegerVisitor, tree, &visitor);
}

test "integer pass preserves static keys and numeric values" {
    const allocator = std.testing.allocator;
    var tree = try parser.parse(allocator, "const object={5:7}; console.log(object[5],42,true,false);", .{});
    defer tree.deinit();
    var random = scalars.Random.init(1);
    try applyBooleans(allocator, &tree, &random, false);
    try applyIntegers(allocator, &tree, &random, .{ .lower = 0, .upper = 65535 });
    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);
    var parsed = try parser.parse(allocator, generated.code, .{});
    defer parsed.deinit();
    try std.testing.expect(!parsed.hasErrors());
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "true") == null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "NaN === NaN") != null);
}
