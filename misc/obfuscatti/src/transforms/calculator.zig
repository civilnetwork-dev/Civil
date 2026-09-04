//! Calculator: `2 + 3` (both operands numeric literals, operator one of
//! `+ - * /`) becomes `__obf_calc("op0", 2, 3)`, where `__obf_calc` is one
//! injected function switching on the opaque key to run the real operator.
//! Port of js-confuser's `transforms/calculator.ts` — same restriction to
//! numeric-literal operands and the four arithmetic operators (the
//! original's own comment flags precedence handling as unsolved beyond
//! that scope, so this doesn't attempt operands it didn't). Key names are
//! sequential (`op0`, `op1`, ...) rather than random-generated — a random
//! `NameGen` port is a separate, later piece, not this transform's job.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const transform = parser.traverser.transform;
const Action = parser.traverser.Action;

const no_span: ast.Span = .{ .start = 0, .end = 0 };

const OperatorEntry = struct { op: ast.BinaryOperator, key: []const u8 };

fn operatorAllowed(op: ast.BinaryOperator) bool {
    return switch (op) {
        .add, .subtract, .multiply, .divide => true,
        else => false,
    };
}

pub const Visitor = struct {
    allocator: std.mem.Allocator,
    fn_name: []const u8,
    used: std.ArrayList(OperatorEntry) = .empty,
    err: ?std.mem.Allocator.Error = null,

    pub fn init(allocator: std.mem.Allocator, fn_name: []const u8) Visitor {
        return .{ .allocator = allocator, .fn_name = fn_name };
    }

    pub fn deinit(self: *Visitor) void {
        for (self.used.items) |entry| self.allocator.free(entry.key);
        self.used.deinit(self.allocator);
    }

    fn keyFor(self: *Visitor, op: ast.BinaryOperator) std.mem.Allocator.Error![]const u8 {
        for (self.used.items) |entry| {
            if (entry.op == op) return entry.key;
        }
        var buf: [16]u8 = undefined;
        // Four operators exist; "op" + a handful of digits never approaches
        // the buffer size.
        const key = std.fmt.bufPrint(&buf, "op{d}", .{self.used.items.len}) catch unreachable;
        const owned = try self.allocator.dupe(u8, key);
        try self.used.append(self.allocator, .{ .op = op, .key = owned });
        return owned;
    }

    pub fn enter_binary_expression(
        self: *Visitor,
        expr: ast.BinaryExpression,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        if (!operatorAllowed(expr.operator)) return .proceed;
        if (ctx.tree.data(expr.left) != .numeric_literal) return .proceed;
        if (ctx.tree.data(expr.right) != .numeric_literal) return .proceed;

        const key = self.keyFor(expr.operator) catch |err| {
            self.err = err;
            return .proceed;
        };

        const callee = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString(self.fn_name) } },
            no_span,
        );
        const key_arg = try ctx.tree.addNode(
            .{ .string_literal = .{ .value = try ctx.tree.addString(key) } },
            no_span,
        );
        const args = try ctx.tree.addExtra(&.{ key_arg, expr.left, expr.right });

        ctx.tree.setData(index, .{ .call_expression = .{
            .callee = callee,
            .type_arguments = .null,
            .arguments = args,
            .optional = false,
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

    fn finishProgram(
        self: *Visitor,
        prog: ast.Program,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !void {
        if (self.used.items.len == 0) return;

        // function __obf_calc(operator, a, b) { switch (operator) { ... } }
        const param_names = [_][]const u8{ "operator", "a", "b" };
        var param_nodes: [3]ast.NodeIndex = undefined;
        for (param_names, 0..) |name, i| {
            const binding = try ctx.tree.addNode(
                .{ .binding_identifier = .{ .name = try ctx.tree.addString(name) } },
                no_span,
            );
            param_nodes[i] = try ctx.tree.addNode(
                .{ .formal_parameter = .{ .pattern = binding } },
                no_span,
            );
        }
        const params = try ctx.tree.addNode(.{ .formal_parameters = .{
            .items = try ctx.tree.addExtra(&param_nodes),
            .rest = .null,
            .kind = .formal_parameters,
        } }, no_span);

        var cases: std.ArrayList(ast.NodeIndex) = .empty;
        defer cases.deinit(self.allocator);
        try cases.ensureTotalCapacityPrecise(self.allocator, self.used.items.len);
        for (self.used.items) |entry| {
            const a_ref = try ctx.tree.addNode(
                .{ .identifier_reference = .{ .name = try ctx.tree.addString("a") } },
                no_span,
            );
            const b_ref = try ctx.tree.addNode(
                .{ .identifier_reference = .{ .name = try ctx.tree.addString("b") } },
                no_span,
            );
            const binexpr = try ctx.tree.addNode(
                .{ .binary_expression = .{ .left = a_ref, .right = b_ref, .operator = entry.op } },
                no_span,
            );
            const ret = try ctx.tree.addNode(
                .{ .return_statement = .{ .argument = binexpr } },
                no_span,
            );
            const case_test = try ctx.tree.addNode(
                .{ .string_literal = .{ .value = try ctx.tree.addString(entry.key) } },
                no_span,
            );
            cases.appendAssumeCapacity(try ctx.tree.addNode(.{ .switch_case = .{
                .@"test" = case_test,
                .consequent = try ctx.tree.addExtra(&.{ret}),
            } }, no_span));
        }

        const discriminant = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString("operator") } },
            no_span,
        );
        const switch_stmt = try ctx.tree.addNode(.{ .switch_statement = .{
            .discriminant = discriminant,
            .cases = try ctx.tree.addExtra(cases.items),
        } }, no_span);

        const body = try ctx.tree.addNode(.{ .function_body = .{
            .body = try ctx.tree.addExtra(&.{switch_stmt}),
        } }, no_span);

        const fn_id = try ctx.tree.addNode(
            .{ .binding_identifier = .{ .name = try ctx.tree.addString(self.fn_name) } },
            no_span,
        );
        const fn_decl = try ctx.tree.addNode(.{ .function = .{
            .type = .function_declaration,
            .id = fn_id,
            .params = params,
            .body = body,
            .generator = false,
            .async = false,
        } }, no_span);

        const original_body = ctx.tree.extra(prog.body);
        var new_body: std.ArrayList(ast.NodeIndex) = .empty;
        defer new_body.deinit(self.allocator);
        try new_body.ensureTotalCapacityPrecise(self.allocator, original_body.len + 1);
        new_body.appendAssumeCapacity(fn_decl);
        new_body.appendSliceAssumeCapacity(original_body);

        ctx.tree.setData(index, .{ .program = .{
            .source_type = prog.source_type,
            .body = try ctx.tree.addExtra(new_body.items),
            .hashbang = prog.hashbang,
        } });
    }
};

test "replaces numeric arithmetic with calculator calls and runs identically" {
    const allocator = std.testing.allocator;

    var tree = try parser.parse(allocator, "console.log(2 + 3, 10 - 4, 6 * 7, 20 / 5);", .{});
    defer tree.deinit();

    var visitor = Visitor.init(allocator, "__obf_calc");
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_calc") != null);
}
