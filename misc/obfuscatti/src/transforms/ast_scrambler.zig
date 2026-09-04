//! AST scrambler: consecutive plain expression-statements inside one block
//! collapse into a single call — `a(); b(); c();` becomes
//! `__obf_ast(a(), b(), c());` — so a filter has fewer statement
//! boundaries to pattern-match against. Port of js-confuser's
//! `transforms/astScrambler.ts`.
//!
//! `__obf_ast` itself does nothing observable: its body replaces itself
//! with a no-op on first call. That's safe *because* it's always used in
//! statement position — its return value is never read, and JS evaluates
//! every call argument (so `a()`/`b()`/`c()`'s own side effects still
//! happen) regardless of what the outer call's own body does or doesn't
//! do. Ported as-is: it's a real (if minor) anti-instrumentation touch —
//! a reverse engineer hooking `__obf_ast` to log its arguments only gets
//! one call's worth before it silently stops calling through.
//!
//! Runs on `Program`, block statements, AND `switch` case bodies — matching
//! the original's own `"Block|SwitchCase"` visitor selector (`Program`
//! itself carries Babel's "Block" alias, which is why one selector covers
//! both). A pre-existing comma-expression statement (`a(), b();`) has its
//! individual pieces joined into the coalesced call as separate arguments
//! too, rather than kept as one opaque argument — same as the original
//! decomposing `SequenceExpression`s before collecting them, down to
//! coalescing a *lone* comma-expression statement on its own (2+ exploded
//! pieces is still "2+", even from just one original statement).
//!
//! No scope/binding analysis needed — this only restructures statement
//! *lists*, so it runs alongside the other structural transforms rather
//! than in the semantic-analyzer group.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const transform = parser.traverser.transform;
const Action = parser.traverser.Action;

const no_span: ast.Span = .{ .start = 0, .end = 0 };

pub const Visitor = struct {
    allocator: std.mem.Allocator,
    fn_name: []const u8,
    /// Set the first time a run actually needs the placeholder call, so
    /// the trailing `function <fn_name>() {...}` is skipped entirely when
    /// nothing in the program was coalesced.
    used: bool = false,
    err: ?std.mem.Allocator.Error = null,

    pub fn init(allocator: std.mem.Allocator, fn_name: []const u8) Visitor {
        return .{ .allocator = allocator, .fn_name = fn_name };
    }

    pub fn deinit(self: *Visitor) void {
        _ = self;
    }

    /// `run` holds bare *expressions*, not statements -- a run's own
    /// contribution is already exploded (see `scramble`) so a run of length
    /// 2+ can come from as little as one original comma-expression
    /// statement, same as the original.
    fn flushRun(
        self: *Visitor,
        ctx: *transform.Ctx,
        run: *std.ArrayList(ast.NodeIndex),
        out: *std.ArrayList(ast.NodeIndex),
    ) !void {
        if (run.items.len == 0) return;
        if (run.items.len == 1) {
            try out.append(self.allocator, try ctx.tree.addNode(
                .{ .expression_statement = .{ .expression = run.items[0] } },
                no_span,
            ));
            run.clearRetainingCapacity();
            return;
        }

        self.used = true;
        const callee = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString(self.fn_name) } },
            no_span,
        );
        const call = try ctx.tree.addNode(.{ .call_expression = .{
            .callee = callee,
            .type_arguments = .null,
            .arguments = try ctx.tree.addExtra(run.items),
            .optional = false,
        } }, no_span);
        try out.append(self.allocator, try ctx.tree.addNode(
            .{ .expression_statement = .{ .expression = call } },
            no_span,
        ));
        run.clearRetainingCapacity();
    }

    /// Coalesces consecutive plain expression-statement runs (2+ resulting
    /// expressions) in `statements`. `preserve_last` keeps the final
    /// statement bare — Program's own completion-value carve-out in the
    /// original.
    fn scramble(
        self: *Visitor,
        ctx: *transform.Ctx,
        statements: []const ast.NodeIndex,
        preserve_last: bool,
    ) !std.ArrayList(ast.NodeIndex) {
        // `statements` is a slice into the tree's `extra` pool. `flushRun`
        // below calls `addExtra` (coalescing a run into one call's argument
        // list) whenever it flushes a 2+ run, which can grow that same pool
        // past capacity and reallocate -- silently invalidating
        // `statements` mid-loop, not just once at the boundary (same hazard
        // as `tree.string()`, documented at the top of obfuscate.zig; see
        // also moved_declarations.zig/dead_code.zig for the same fix). Own
        // a copy before the loop starts.
        const owned_statements = try self.allocator.dupe(ast.NodeIndex, statements);
        defer self.allocator.free(owned_statements);

        var out: std.ArrayList(ast.NodeIndex) = .empty;
        errdefer out.deinit(self.allocator);
        var run: std.ArrayList(ast.NodeIndex) = .empty;
        defer run.deinit(self.allocator);

        for (owned_statements, 0..) |stmt_idx, i| {
            const keep_bare = preserve_last and i == owned_statements.len - 1;
            const is_plain_expr = ctx.tree.data(stmt_idx) == .expression_statement;
            if (is_plain_expr and !keep_bare) {
                const expr = ctx.tree.data(stmt_idx).expression_statement.expression;
                switch (ctx.tree.data(expr)) {
                    .sequence_expression => |seq| try run.appendSlice(self.allocator, ctx.tree.extra(seq.expressions)),
                    else => try run.append(self.allocator, expr),
                }
            } else {
                try self.flushRun(ctx, &run, &out);
                try out.append(self.allocator, stmt_idx);
            }
        }
        try self.flushRun(ctx, &run, &out);
        return out;
    }

    pub fn exit_block_statement(
        self: *Visitor,
        block: ast.BlockStatement,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) void {
        self.rewriteBlock(block, index, ctx) catch |err| {
            self.err = err;
        };
    }

    fn rewriteBlock(self: *Visitor, block: ast.BlockStatement, index: ast.NodeIndex, ctx: *transform.Ctx) !void {
        var new_body = try self.scramble(ctx, ctx.tree.extra(block.body), false);
        defer new_body.deinit(self.allocator);
        ctx.tree.setData(index, .{ .block_statement = .{ .body = try ctx.tree.addExtra(new_body.items) } });
    }

    pub fn exit_switch_case(
        self: *Visitor,
        case: ast.SwitchCase,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) void {
        self.rewriteSwitchCase(case, index, ctx) catch |err| {
            self.err = err;
        };
    }

    fn rewriteSwitchCase(self: *Visitor, case: ast.SwitchCase, index: ast.NodeIndex, ctx: *transform.Ctx) !void {
        var new_body = try self.scramble(ctx, ctx.tree.extra(case.consequent), false);
        defer new_body.deinit(self.allocator);
        ctx.tree.setData(index, .{ .switch_case = .{
            .@"test" = case.@"test",
            .consequent = try ctx.tree.addExtra(new_body.items),
        } });
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

    fn emptyParams(ctx: *transform.Ctx) !ast.NodeIndex {
        return ctx.tree.addNode(.{ .formal_parameters = .{
            .items = try ctx.tree.addExtra(&.{}),
            .rest = .null,
            .kind = .formal_parameters,
        } }, no_span);
    }

    fn finishProgram(
        self: *Visitor,
        prog: ast.Program,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !void {
        var new_body = try self.scramble(ctx, ctx.tree.extra(prog.body), true);
        defer new_body.deinit(self.allocator);

        if (self.used) {
            // function <fn_name>() { <fn_name> = function(){}; }
            const noop_body = try ctx.tree.addNode(.{ .function_body = .{ .body = try ctx.tree.addExtra(&.{}) } }, no_span);
            const noop_fn = try ctx.tree.addNode(.{ .function = .{
                .type = .function_expression,
                .id = .null,
                .params = try emptyParams(ctx),
                .body = noop_body,
                .generator = false,
                .async = false,
            } }, no_span);
            const self_ref = try ctx.tree.addNode(
                .{ .identifier_reference = .{ .name = try ctx.tree.addString(self.fn_name) } },
                no_span,
            );
            const self_assign = try ctx.tree.addNode(.{ .assignment_expression = .{
                .left = self_ref,
                .right = noop_fn,
                .operator = .assign,
            } }, no_span);
            const assign_stmt = try ctx.tree.addNode(
                .{ .expression_statement = .{ .expression = self_assign } },
                no_span,
            );
            const outer_body = try ctx.tree.addNode(.{ .function_body = .{ .body = try ctx.tree.addExtra(&.{assign_stmt}) } }, no_span);
            const fn_id = try ctx.tree.addNode(
                .{ .binding_identifier = .{ .name = try ctx.tree.addString(self.fn_name) } },
                no_span,
            );
            const fn_decl = try ctx.tree.addNode(.{ .function = .{
                .type = .function_declaration,
                .id = fn_id,
                .params = try emptyParams(ctx),
                .body = outer_body,
                .generator = false,
                .async = false,
            } }, no_span);
            try new_body.append(self.allocator, fn_decl);
        }

        ctx.tree.setData(index, .{ .program = .{
            .source_type = prog.source_type,
            .body = try ctx.tree.addExtra(new_body.items),
            .hashbang = prog.hashbang,
        } });
    }
};

test "coalesces consecutive expression statements and runs identically" {
    const allocator = std.testing.allocator;
    const source =
        \\let log = [];
        \\function push(x) { log.push(x); }
        \\push(1);
        \\push(2);
        \\push(3);
        \\console.log(log.join(","));
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();

    var visitor = Visitor.init(allocator, "__obf_ast");
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_ast(push(1), push(2), push(3))") != null);

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

    const obfuscated_run = try std.process.run(allocator, io, .{ .argv = &.{ "bun", path } });
    defer allocator.free(obfuscated_run.stdout);
    defer allocator.free(obfuscated_run.stderr);

    try std.testing.expectEqualStrings("1,2,3\n", obfuscated_run.stdout);
}

test "explodes a pre-existing comma expression into the coalesced call's own arguments" {
    const allocator = std.testing.allocator;
    const source =
        \\let log = [];
        \\function push(x) { log.push(x); }
        \\push(1), push(2);
        \\push(3);
        \\console.log(log.join(","));
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();

    var visitor = Visitor.init(allocator, "__obf_ast");
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);
    // Flattened into 3 sibling arguments, not `(push(1), push(2)), push(3)`.
    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_ast(push(1), push(2), push(3))") != null);

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

    try std.testing.expectEqualStrings("1,2,3\n", run.stdout);
}

test "coalesces a switch case's own statement run, unlike a plain block" {
    const allocator = std.testing.allocator;
    const source =
        \\let log = [];
        \\function push(x) { log.push(x); }
        \\switch (1) {
        \\  case 1:
        \\    push(1);
        \\    push(2);
        \\    push(3);
        \\    break;
        \\}
        \\console.log(log.join(","));
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();

    var visitor = Visitor.init(allocator, "__obf_ast");
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_ast(push(1), push(2), push(3))") != null);

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

    try std.testing.expectEqualStrings("1,2,3\n", run.stdout);
}
