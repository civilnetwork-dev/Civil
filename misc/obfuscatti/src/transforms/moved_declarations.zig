//! Moved declarations: `var x = 5;` becomes a bare `var x;` prepended to
//! the nearest enclosing block, with a plain `x = 5;` assignment left where
//! the declaration used to be — hiding *where a variable is really first
//! used* behind the same hoisting JS already does implicitly. Port of
//! js-confuser's `transforms/identifier/movedDeclarations.ts`, minus its
//! "pack into an unused function parameter" mode entirely: that mode is
//! only safe for a function verified "predictable" (every call site passes
//! exactly the declared argument shape, so an extra parameter slot can't
//! collide with a real argument) — a property js-confuser computes in a
//! preparation pass this port doesn't have. Guessing predictability would
//! risk a real caller's extra argument silently becoming this variable's
//! initial value instead of what it should be. The block-hoisting mode
//! doesn't have that risk (`var` already hoists past any block, so
//! prepending into *some* enclosing block, not necessarily the exact
//! original's target, is still correct) and is the one implemented here.
//!
//! Also skips: declarators with no initializer (already just `var x;` —
//! nothing to move), a `for (var x in/of ...)` loop's own declaration (its
//! `left` position takes a pattern, not a statement to hoist out of), a
//! C-style `for (var x = 0; ...; ...)` loop's own declaration (its `init`
//! position takes a `variable_declaration` or a bare expression --
//! rewriting it to an `expression_statement` in place, as this transform
//! does for an ordinary statement-list declaration, produces `for (x = 0;;
//! ...; ...)`, an extra statement-terminating `;` stray inside the
//! for-header, since `expression_statement` always prints one -- caught by
//! running obfuscatti's own output through a real browser, not a
//! hand-written test case), and anything already the sole declarator plus
//! one obvious optimization the original has — merging into an existing
//! leading `var` statement instead of always prepending a fresh one. Both
//! are cosmetic; neither changes what the code does.
//!
//! No scope/binding analysis needed — this only needs "what's the nearest
//! enclosing block", tracked with a plain stack over the structural
//! traversal, the same shape as rename_labels.zig's label stack.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const transform = parser.traverser.transform;
const Action = parser.traverser.Action;

const no_span: ast.Span = .{ .start = 0, .end = 0 };

const BlockFrame = struct {
    pending: std.ArrayList(ast.NodeIndex) = .empty,
};

pub const Visitor = struct {
    allocator: std.mem.Allocator,
    stack: std.ArrayList(BlockFrame) = .empty,
    /// The `init`/`left` of the most recently entered `for`/`for-in`/
    /// `for-of` statement — compared by exact node index, so a stale value
    /// from an earlier loop can never accidentally match a different
    /// declaration (traversal always visits that field immediately after
    /// setting this, before any nested loop could overwrite it).
    for_header_skip: ast.NodeIndex = .null,
    err: ?std.mem.Allocator.Error = null,

    pub fn init(allocator: std.mem.Allocator) Visitor {
        return .{ .allocator = allocator };
    }

    pub fn deinit(self: *Visitor) void {
        for (self.stack.items) |*frame| frame.pending.deinit(self.allocator);
        self.stack.deinit(self.allocator);
    }

    pub fn enter_program(self: *Visitor, prog: ast.Program, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = prog;
        _ = index;
        _ = ctx;
        try self.stack.append(self.allocator, .{});
        return .proceed;
    }

    pub fn enter_block_statement(self: *Visitor, block: ast.BlockStatement, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = block;
        _ = index;
        _ = ctx;
        try self.stack.append(self.allocator, .{});
        return .proceed;
    }

    /// A function's own body is *not* a `block_statement` in yuku's grammar
    /// (`ast.FunctionBody` is its own node type -- see dead_code.zig's own
    /// doc comment for the same distinction) -- without this, a `var`
    /// declared directly in a function's top-level body (no nested block
    /// around it) fell through to whatever frame was most recently pushed,
    /// which could be an unrelated outer scope: `finishProgram` would then
    /// hoist that function-local variable's bare `var` all the way to
    /// Program's own top level, where it can collide with a same-named
    /// top-level binding (a real one: `import { X as e } from "..."` plus
    /// some function-local `var e` elsewhere both landing at module scope
    /// is a genuine `SyntaxError: Identifier 'e' has already been
    /// declared`, not just a cosmetic scoping mismatch) -- caught by
    /// running real output through a browser, not a hand-written test.
    pub fn enter_function_body(self: *Visitor, body: ast.FunctionBody, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = body;
        _ = index;
        _ = ctx;
        try self.stack.append(self.allocator, .{});
        return .proceed;
    }

    pub fn enter_for_statement(self: *Visitor, stmt: ast.ForStatement, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = index;
        _ = ctx;
        self.for_header_skip = stmt.init;
        return .proceed;
    }

    pub fn enter_for_in_statement(self: *Visitor, stmt: ast.ForInStatement, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = index;
        _ = ctx;
        self.for_header_skip = stmt.left;
        return .proceed;
    }

    pub fn enter_for_of_statement(self: *Visitor, stmt: ast.ForOfStatement, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = index;
        _ = ctx;
        self.for_header_skip = stmt.left;
        return .proceed;
    }

    pub fn enter_variable_declaration(
        self: *Visitor,
        decl: ast.VariableDeclaration,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        if (decl.kind != .@"var") return .proceed;
        if (index == self.for_header_skip) return .proceed;

        const declarator_range = ctx.tree.extra(decl.declarators);
        if (declarator_range.len != 1) return .proceed;
        const declarator = switch (ctx.tree.data(declarator_range[0])) {
            .variable_declarator => |d| d,
            else => return .proceed,
        };
        if (ctx.tree.data(declarator.id) != .binding_identifier) return .proceed; // no destructuring
        if (declarator.init == .null) return .proceed; // nothing to move

        // `tree.string()` aliases the tree's own string pool -- duped
        // immediately since it's used across two `addString` calls below
        // (see obfuscate.zig's top doc comment).
        const name_slice = ctx.tree.string(ctx.tree.data(declarator.id).binding_identifier.name);
        const name = try self.allocator.dupe(u8, name_slice);
        defer self.allocator.free(name);

        const lhs = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString(name) } },
            no_span,
        );
        const assign = try ctx.tree.addNode(.{ .assignment_expression = .{
            .left = lhs,
            .right = declarator.init,
            .operator = .assign,
        } }, no_span);
        ctx.tree.setData(index, .{ .expression_statement = .{ .expression = assign } });

        const pending_binding = try ctx.tree.addNode(
            .{ .binding_identifier = .{ .name = try ctx.tree.addString(name) } },
            no_span,
        );
        try self.stack.items[self.stack.items.len - 1].pending.append(self.allocator, pending_binding);

        return .proceed;
    }

    fn buildNewBody(
        self: *Visitor,
        ctx: *transform.Ctx,
        original: []const ast.NodeIndex,
        pending: []const ast.NodeIndex,
    ) !std.ArrayList(ast.NodeIndex) {
        // `original` is a slice straight into the tree's `extra` pool (see
        // ast.zig's `extra()`/`addExtra()`) -- the `addNode`/`addExtra`
        // calls below, building the new `var` declaration, can grow that
        // pool past its capacity and reallocate, silently invalidating
        // `original` out from under us. Same hazard as `tree.string()`
        // (documented at the top of obfuscate.zig), just for the extra
        // pool instead of the string pool -- own a copy immediately,
        // same fix.
        const owned_original = try self.allocator.dupe(ast.NodeIndex, original);
        defer self.allocator.free(owned_original);

        var new_body: std.ArrayList(ast.NodeIndex) = .empty;
        errdefer new_body.deinit(self.allocator);

        if (pending.len == 0) {
            try new_body.ensureTotalCapacityPrecise(self.allocator, owned_original.len);
            new_body.appendSliceAssumeCapacity(owned_original);
            return new_body;
        }

        var declarators: std.ArrayList(ast.NodeIndex) = .empty;
        defer declarators.deinit(self.allocator);
        try declarators.ensureTotalCapacityPrecise(self.allocator, pending.len);
        for (pending) |binding_id| {
            declarators.appendAssumeCapacity(try ctx.tree.addNode(
                .{ .variable_declarator = .{ .id = binding_id, .init = .null } },
                no_span,
            ));
        }
        const var_decl = try ctx.tree.addNode(.{ .variable_declaration = .{
            .kind = .@"var",
            .declarators = try ctx.tree.addExtra(declarators.items),
            .declare = false,
        } }, no_span);

        try new_body.ensureTotalCapacityPrecise(self.allocator, owned_original.len + 1);
        new_body.appendAssumeCapacity(var_decl);
        new_body.appendSliceAssumeCapacity(owned_original);
        return new_body;
    }

    pub fn exit_block_statement(
        self: *Visitor,
        block: ast.BlockStatement,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) void {
        self.finishBlock(block, index, ctx) catch |err| {
            self.err = err;
        };
    }

    fn finishBlock(self: *Visitor, block: ast.BlockStatement, index: ast.NodeIndex, ctx: *transform.Ctx) !void {
        var frame = self.stack.pop().?;
        defer frame.pending.deinit(self.allocator);
        var new_body = try self.buildNewBody(ctx, ctx.tree.extra(block.body), frame.pending.items);
        defer new_body.deinit(self.allocator);
        ctx.tree.setData(index, .{ .block_statement = .{ .body = try ctx.tree.addExtra(new_body.items) } });
    }

    pub fn exit_function_body(
        self: *Visitor,
        body: ast.FunctionBody,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) void {
        self.finishFunctionBody(body, index, ctx) catch |err| {
            self.err = err;
        };
    }

    fn finishFunctionBody(self: *Visitor, body: ast.FunctionBody, index: ast.NodeIndex, ctx: *transform.Ctx) !void {
        var frame = self.stack.pop().?;
        defer frame.pending.deinit(self.allocator);
        var new_body = try self.buildNewBody(ctx, ctx.tree.extra(body.body), frame.pending.items);
        defer new_body.deinit(self.allocator);
        ctx.tree.setData(index, .{ .function_body = .{ .body = try ctx.tree.addExtra(new_body.items) } });
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
        var frame = self.stack.pop().?;
        defer frame.pending.deinit(self.allocator);
        var new_body = try self.buildNewBody(ctx, ctx.tree.extra(prog.body), frame.pending.items);
        defer new_body.deinit(self.allocator);
        ctx.tree.setData(index, .{ .program = .{
            .source_type = prog.source_type,
            .body = try ctx.tree.addExtra(new_body.items),
            .hashbang = prog.hashbang,
        } });
    }
};

test "hoists var declarations to the top of their block and runs identically" {
    const allocator = std.testing.allocator;
    const source =
        \\function f() {
        \\  console.log("start");
        \\  var x = 1;
        \\  { var y = 2; }
        \\  for (var k in { a: 1 }) {}
        \\  var total = 0;
        \\  for (var i = 0; i < 3; i++) { total += i; }
        \\  return x + y + total;
        \\}
        \\console.log(f());
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();

    var visitor = Visitor.init(allocator);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "x = 1") != null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "var x") != null);

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

    try std.testing.expectEqualStrings("start\n6\n", run.stdout);
}

test "keeps a function-local declaration scoped to its own function, not hoisted past it" {
    const allocator = std.testing.allocator;
    // A var declared directly in a function's top-level body (no nested
    // block around it) -- the case a missing function_body stack frame
    // would misattribute to whatever frame was last pushed. If that
    // happens here, `x = "inner"` inside `f` loses its own `var x` and
    // falls through to the outer `x` by ordinary scope lookup: `f()`
    // mutates the outer variable instead of shadowing it, so calling `f()`
    // before reading the outer `x` observes the bug through output, not
    // just placement in the generated source.
    const source =
        \\var x = "outer";
        \\function f() {
        \\  var x = "inner";
        \\  return x;
        \\}
        \\console.log(f(), x);
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();

    var visitor = Visitor.init(allocator);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

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

    try std.testing.expectEqualStrings("inner outer\n", run.stdout);
}
