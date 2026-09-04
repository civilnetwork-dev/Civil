//! Shared opaque-predicate builder for dead_code.zig and
//! opaque_predicates.zig. Port of js-confuser's `utils/PredicateGen.ts`.
//!
//! The trick: create one empty dummy function (`function __obf_dummyfn()
//! {}`), then `"someRandomName" in __obf_dummyfn` is always `false` (a
//! plain function has no own or inherited property by a name nobody
//! chose), and `!(...)` of that is always `true`. Simple to state, harder
//! to defeat by pattern-matching than an obvious `1 === 1` or `true` —
//! proving it statically needs actually reasoning about `in` and the
//! dummy function's shape, not just recognizing a literal.
//!
//! Each transform that uses this owns its own `PredicateGen` instance
//! (matching the original — it constructs a fresh `new PredicateGen(me)`
//! per transform, not one shared across transforms), so each gets its own
//! dummy function.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const transform = parser.traverser.transform;

const no_span: ast.Span = .{ .start = 0, .end = 0 };

pub const PredicateGen = struct {
    allocator: std.mem.Allocator,
    dummy_fn_name: []const u8,
    used: bool = false,
    counter: u32 = 0,

    pub fn init(allocator: std.mem.Allocator, dummy_fn_name: []const u8) PredicateGen {
        return .{ .allocator = allocator, .dummy_fn_name = dummy_fn_name };
    }

    /// `"propN" in dummyFn` -- always false.
    pub fn buildFalseExpression(self: *PredicateGen, ctx: *transform.Ctx) !ast.NodeIndex {
        self.used = true;
        var buf: [16]u8 = undefined;
        const prop = std.fmt.bufPrint(&buf, "rp{d}", .{self.counter}) catch unreachable;
        self.counter += 1;

        const prop_lit = try ctx.tree.addNode(
            .{ .string_literal = .{ .value = try ctx.tree.addString(prop) } },
            no_span,
        );
        const dummy_ref = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString(self.dummy_fn_name) } },
            no_span,
        );
        return ctx.tree.addNode(.{ .binary_expression = .{
            .left = prop_lit,
            .right = dummy_ref,
            .operator = .in,
        } }, no_span);
    }

    /// `!("propN" in dummyFn)` -- always true.
    pub fn buildTrueExpression(self: *PredicateGen, ctx: *transform.Ctx) !ast.NodeIndex {
        const false_expr = try self.buildFalseExpression(ctx);
        return ctx.tree.addNode(.{ .unary_expression = .{
            .argument = false_expr,
            .operator = .logical_not,
        } }, no_span);
    }

    /// `function dummyFn() {}`, once, only if actually used. Caller
    /// prepends this to whatever body it's inserting the predicate into.
    pub fn buildDummyDeclIfUsed(self: *PredicateGen, ctx: *transform.Ctx) !?ast.NodeIndex {
        if (!self.used) return null;
        const params = try ctx.tree.addNode(.{ .formal_parameters = .{
            .items = try ctx.tree.addExtra(&.{}),
            .rest = .null,
            .kind = .formal_parameters,
        } }, no_span);
        const body = try ctx.tree.addNode(.{ .function_body = .{ .body = try ctx.tree.addExtra(&.{}) } }, no_span);
        const id = try ctx.tree.addNode(
            .{ .binding_identifier = .{ .name = try ctx.tree.addString(self.dummy_fn_name) } },
            no_span,
        );
        const decl = try ctx.tree.addNode(.{ .function = .{
            .type = .function_declaration,
            .id = id,
            .params = params,
            .body = body,
            .generator = false,
            .async = false,
        } }, no_span);
        return decl;
    }
};
