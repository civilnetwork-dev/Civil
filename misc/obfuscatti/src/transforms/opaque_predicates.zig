//! Opaque predicates: an `if`/ternary/`case` test gets `PREDICATE() &&`
//! prepended, and a `return expr;` becomes
//! `if (PREDICATE()) { return expr; } else { return "..."; }` — where
//! `PREDICATE()` (see predicate_gen.zig) always evaluates true but isn't
//! obviously so from the text alone. Port of js-confuser's
//! `transforms/opaquePredicates.ts`.
//!
//! Gated the same two-layer way as the original's own `shouldTransform`:
//! a flat 75% chance per candidate (matching the real `high` preset's
//! `opaquePredicates: 0.75` — this pipeline has no user-facing per-
//! transform options to read a real value from, so `high` is the fixed
//! target, same as dead_code.zig), then a second roll biased toward "yes"
//! for early candidates at shallow nesting but a near-certain "no" past
//! ~4 levels of AST ancestry (`depth*100` alone reaches the original's
//! `500` cutoff at depth 5) — real code's own count-and-depth decay,
//! ported as-is since it's cheap here: `ctx.path.depth()` is already
//! exactly the traverser's own live ancestor-stack length, no new
//! Semantic dependency needed to get it. Both rolls hash the candidate's
//! own node index (two different seeds, so they're not perfectly
//! correlated) rather than drawing from a random source, same reasoning
//! as dead_code.zig's gate.
//!
//! No scope/binding analysis needed.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const transform = parser.traverser.transform;
const Action = parser.traverser.Action;
const PredicateGen = @import("predicate_gen.zig").PredicateGen;

const no_span: ast.Span = .{ .start = 0, .end = 0 };

/// Real `high` preset's `opaquePredicates: 0.75`.
const base_probability_pct: i64 = 75;
/// Real code's own `chance(500 - transformCount - depth * 100)`.
const decay_base: i64 = 500;
const decay_per_depth: i64 = 100;

/// `percent` on the same 0-100+ scale as the original's `chance()` --
/// values at or above 100 always succeed, at or below 0 always fail
/// (mirrors `Math.random() < percent/100` without a random source).
fn rollPercent(seed: u64, index: ast.NodeIndex, percent: i64) bool {
    if (percent >= 100) return true;
    if (percent <= 0) return false;
    const hash = std.hash.Wyhash.hash(seed, std.mem.asBytes(&@as(u32, @intFromEnum(index))));
    return hash % 100 < @as(u64, @intCast(percent));
}

pub const Visitor = struct {
    allocator: std.mem.Allocator,
    gen: PredicateGen,
    /// `enter_return_statement` wraps a return in an if/else whose "real"
    /// branch is itself a *new* return statement with the same argument --
    /// without this, the traverser would visit that new node next and wrap
    /// it again, forever. Every node this pass creates that could
    /// otherwise be mistaken for a fresh candidate goes in here first.
    already_wrapped: std.AutoHashMapUnmanaged(ast.NodeIndex, void) = .empty,
    /// Mirrors the original's own `transformCount`: incremented once per
    /// candidate that clears the flat 75% gate (whether or not the second,
    /// decaying roll then also succeeds), feeding that second roll's own
    /// threshold.
    transform_count: u32 = 0,
    err: ?std.mem.Allocator.Error = null,

    pub fn init(allocator: std.mem.Allocator) Visitor {
        return .{ .allocator = allocator, .gen = PredicateGen.init(allocator, "__obf_dummyfn") };
    }

    pub fn deinit(self: *Visitor) void {
        self.already_wrapped.deinit(self.allocator);
    }

    fn shouldTransform(self: *Visitor, ctx: *transform.Ctx, index: ast.NodeIndex) bool {
        if (!rollPercent(0, index, base_probability_pct)) return false;
        self.transform_count += 1;
        const depth: i64 = @intCast(ctx.path.depth());
        const decay_pct = decay_base - @as(i64, @intCast(self.transform_count)) - depth * decay_per_depth;
        return rollPercent(1, index, decay_pct);
    }

    fn wrapTest(self: *Visitor, ctx: *transform.Ctx, original_test: ast.NodeIndex) !ast.NodeIndex {
        const predicate = try self.gen.buildTrueExpression(ctx);
        return ctx.tree.addNode(.{ .logical_expression = .{
            .left = predicate,
            .right = original_test,
            .operator = .@"and",
        } }, no_span);
    }

    pub fn enter_if_statement(
        self: *Visitor,
        stmt: ast.IfStatement,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        if (!self.shouldTransform(ctx, index)) return .proceed;
        const wrapped = try self.wrapTest(ctx, stmt.@"test");
        ctx.tree.setData(index, .{ .if_statement = .{
            .@"test" = wrapped,
            .consequent = stmt.consequent,
            .alternate = stmt.alternate,
        } });
        return .proceed;
    }

    pub fn enter_conditional_expression(
        self: *Visitor,
        expr: ast.ConditionalExpression,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        if (!self.shouldTransform(ctx, index)) return .proceed;
        const wrapped = try self.wrapTest(ctx, expr.@"test");
        ctx.tree.setData(index, .{ .conditional_expression = .{
            .@"test" = wrapped,
            .consequent = expr.consequent,
            .alternate = expr.alternate,
        } });
        return .proceed;
    }

    pub fn enter_switch_case(
        self: *Visitor,
        case: ast.SwitchCase,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        if (case.@"test" == .null) return .proceed; // `default:` has no test to wrap
        if (!self.shouldTransform(ctx, index)) return .proceed;
        const wrapped = try self.wrapTest(ctx, case.@"test");
        ctx.tree.setData(index, .{ .switch_case = .{
            .@"test" = wrapped,
            .consequent = case.consequent,
        } });
        return .proceed;
    }

    pub fn enter_return_statement(
        self: *Visitor,
        stmt: ast.ReturnStatement,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        if (stmt.argument == .null) return .proceed; // bare `return;` -- nothing to guard
        if (self.already_wrapped.contains(index)) return .proceed;
        if (!self.shouldTransform(ctx, index)) return .proceed;

        const predicate = try self.gen.buildTrueExpression(ctx);
        const real_return = try ctx.tree.addNode(
            .{ .return_statement = .{ .argument = stmt.argument } },
            no_span,
        );
        try self.already_wrapped.put(self.allocator, real_return, {});
        const real_block = try ctx.tree.addNode(
            .{ .block_statement = .{ .body = try ctx.tree.addExtra(&.{real_return}) } },
            no_span,
        );
        const fake_value = try ctx.tree.addNode(
            .{ .string_literal = .{ .value = try ctx.tree.addString("unreachable") } },
            no_span,
        );
        const fake_return = try ctx.tree.addNode(
            .{ .return_statement = .{ .argument = fake_value } },
            no_span,
        );
        try self.already_wrapped.put(self.allocator, fake_return, {});
        const fake_block = try ctx.tree.addNode(
            .{ .block_statement = .{ .body = try ctx.tree.addExtra(&.{fake_return}) } },
            no_span,
        );
        ctx.tree.setData(index, .{ .if_statement = .{
            .@"test" = predicate,
            .consequent = real_block,
            .alternate = fake_block,
        } });
        return .proceed;
    }

    pub fn exit_program(
        self: *Visitor,
        prog: ast.Program,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) void {
        self.finishProgram(prog, index, ctx) catch |err| {
            self.err = err;
        };
    }

    fn finishProgram(self: *Visitor, prog: ast.Program, index: ast.NodeIndex, ctx: *transform.Ctx) !void {
        const dummy_decl = try self.gen.buildDummyDeclIfUsed(ctx) orelse return;
        const original_body = ctx.tree.extra(prog.body);
        var new_body: std.ArrayList(ast.NodeIndex) = .empty;
        defer new_body.deinit(self.allocator);
        try new_body.ensureTotalCapacityPrecise(self.allocator, original_body.len + 1);
        new_body.appendAssumeCapacity(dummy_decl);
        new_body.appendSliceAssumeCapacity(original_body);
        ctx.tree.setData(index, .{ .program = .{
            .source_type = prog.source_type,
            .body = try ctx.tree.addExtra(new_body.items),
            .hashbang = prog.hashbang,
        } });
    }
};

test "wraps conditionals in an opaque predicate and runs identically" {
    const allocator = std.testing.allocator;
    const source =
        \\function classify(n) {
        \\  if (n > 0) {
        \\    return "positive";
        \\  }
        \\  return n === 0 ? "zero" : "negative";
        \\}
        \\console.log(classify(5), classify(0), classify(-5));
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();

    var visitor = Visitor.init(allocator);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_dummyfn") != null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, " in ") != null);

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

    try std.testing.expectEqualStrings("positive zero negative\n", run.stdout);
}

test "does not wrap every candidate, unlike unconditional application" {
    const allocator = std.testing.allocator;

    var source: std.ArrayList(u8) = .empty;
    defer source.deinit(allocator);
    try source.appendSlice(allocator, "let x = 5, y = 0;\n");
    var i: u32 = 0;
    while (i < 40) : (i += 1) {
        const stmt = try std.fmt.allocPrint(allocator, "if (x === {d}) {{ y = {d}; }}\n", .{ i, i });
        defer allocator.free(stmt);
        try source.appendSlice(allocator, stmt);
    }
    try source.appendSlice(allocator, "console.log(y);\n");

    var tree = try parser.parse(allocator, source.items, .{});
    defer tree.deinit();

    var visitor = Visitor.init(allocator);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    var wrapped_count: usize = 0;
    var pos: usize = 0;
    while (std.mem.indexOfPos(u8, result.code, pos, "__obf_dummyfn")) |found| {
        wrapped_count += 1;
        pos = found + 1;
    }
    // The flat 75% gate means *some*, not zero and not all 40, of these
    // independent same-shape candidates get wrapped -- the old unconditional
    // behavior would have hit exactly 40.
    try std.testing.expect(wrapped_count > 0);
    try std.testing.expect(wrapped_count < 40);

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

    // Only the `x === 5` branch's condition is ever true, wrapped or not
    // (the opaque predicate is always-true, so it never flips an outcome).
    try std.testing.expectEqualStrings("5\n", run.stdout);
}
