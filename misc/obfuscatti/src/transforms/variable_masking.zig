//! Variable masking: a function's parameters are collapsed into one rest
//! parameter, and every reference to them (read or write, including from a
//! closure nested inside) becomes an indexed access into it —
//! `function f(a, b) { return a + b; }` becomes
//! `function f(...__obf_stack0) { return __obf_stack0[0] +
//! __obf_stack0[1]; }`. Port of js-confuser's
//! `transforms/variableMasking.ts`, scoped down to parameters only — the
//! original also masks a function's own local `var`/`let` declarations,
//! which needs converting each masked declarator into a plain assignment
//! (dropping `var`/`let` entirely, since the "variable" is now just a
//! property on the stack array) and handling declarators with no
//! initializer. Real value, but a structurally different rewrite from
//! "replace this reference" — a separate piece, not attempted here.
//!
//! That narrower scope also sidesteps the original's `checkBinding`
//! this-capture guard: it exists because a masked *local*'s own
//! initializer can be an author-written function expression closing over
//! `this`, and detaching that expression from a normal variable changes
//! nothing about `this` by itself — the risk is specific to values with
//! complex initializers, which a bare parameter identifier never has.
//!
//! Skips a getter or setter specifically (`object_property`/
//! `method_definition` with `.kind == .get` or `.set`): a getter/setter
//! has a fixed arity the engine itself enforces — a setter *must* have
//! exactly one parameter — and a rest parameter there is a SyntaxError.
//! An ordinary method, `init` property, or constructor has no such
//! constraint (masking just rewrites how the body reads its own already-
//! bound parameters — `(...__obf_stackN)` still accepts the same
//! arguments positionally — it doesn't touch how the function is called
//! or declared beyond that), so those are masked same as any plain
//! function now, via yuku's own `Semantic.parentOf` to check the
//! immediate parent's `.kind` directly.
//!
//! Needs the pre-mutation `Semantic` snapshot — see obfuscate.zig's
//! pipeline comment.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const transform = parser.traverser.transform;
const Action = parser.traverser.Action;
const Semantic = parser.semantic.Semantic;

const no_span: ast.Span = .{ .start = 0, .end = 0 };

pub const Visitor = struct {
    allocator: std.mem.Allocator,
    semantic: Semantic,
    counter: u32 = 0,

    pub fn init(allocator: std.mem.Allocator, semantic: Semantic) Visitor {
        return .{ .allocator = allocator, .semantic = semantic };
    }

    pub fn deinit(self: *Visitor) void {
        _ = self;
    }

    fn replaceWithStackAccess(
        self: *Visitor,
        ctx: *transform.Ctx,
        node: ast.NodeIndex,
        stack_name: []const u8,
        slot: usize,
    ) !void {
        _ = self;
        const stack_ident = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString(stack_name) } },
            no_span,
        );
        var buf: [10]u8 = undefined;
        const slot_text = std.fmt.bufPrint(&buf, "{d}", .{slot}) catch unreachable;
        const index_lit = try ctx.tree.addNode(
            .{ .numeric_literal = .{ .kind = .decimal, .raw = try ctx.tree.addString(slot_text) } },
            no_span,
        );
        ctx.tree.setData(node, .{ .member_expression = .{
            .object = stack_ident,
            .property = index_lit,
            .computed = true,
            .optional = false,
        } });
    }

    pub fn enter_function(
        self: *Visitor,
        func: ast.Function,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        // Nodes past what `Semantic` covers are this pass's own earlier
        // replacements -- never a real function to mask.
        if (@intFromEnum(index) >= self.semantic.node_references.len) return .proceed;
        if (func.generator or func.async) return .proceed;
        if (func.body == .null) return .proceed; // TS signature/overload, no body to rewrite

        if (self.semantic.parentOf(index)) |parent| {
            switch (ctx.tree.data(parent)) {
                .object_property => |p| if (p.kind == .get or p.kind == .set) return .proceed,
                .method_definition => |m| if (m.kind == .get or m.kind == .set) return .proceed,
                else => {},
            }
        }

        const params = ctx.tree.data(func.params).formal_parameters;
        if (params.rest != .null) return .proceed; // already has a rest param
        const param_nodes = ctx.tree.extra(params.items);
        if (param_nodes.len == 0) return .proceed; // nothing to mask

        var param_syms: std.ArrayList(parser.traverser.semantic.SymbolId) = .empty;
        defer param_syms.deinit(self.allocator);
        try param_syms.ensureTotalCapacityPrecise(self.allocator, param_nodes.len);
        for (param_nodes) |p_idx| {
            const pattern = switch (ctx.tree.data(p_idx)) {
                .formal_parameter => |p| p.pattern,
                else => return .proceed,
            };
            if (ctx.tree.data(pattern) != .binding_identifier) return .proceed; // no destructuring/defaults
            const sym_id = self.semantic.symbolOf(pattern) orelse return .proceed;
            param_syms.appendAssumeCapacity(sym_id);
        }

        var buf: [24]u8 = undefined;
        const stack_name_slice = std.fmt.bufPrint(&buf, "__obf_stack{d}", .{self.counter}) catch unreachable;
        self.counter += 1;
        const stack_name = try self.allocator.dupe(u8, stack_name_slice);
        defer self.allocator.free(stack_name);

        for (param_syms.items, 0..) |sym_id, i| {
            for (self.semantic.uses(sym_id)) |ref_id| {
                const ref = self.semantic.reference(ref_id);
                try self.replaceWithStackAccess(ctx, ref.node, stack_name, i);
            }
        }

        const rest_binding = try ctx.tree.addNode(
            .{ .binding_identifier = .{ .name = try ctx.tree.addString(stack_name) } },
            no_span,
        );
        const rest_element = try ctx.tree.addNode(
            .{ .binding_rest_element = .{ .argument = rest_binding } },
            no_span,
        );
        ctx.tree.setData(func.params, .{ .formal_parameters = .{
            .items = try ctx.tree.addExtra(&.{}),
            .rest = rest_element,
            .kind = params.kind,
        } });

        // No `fn.length` fixup: `fn.length` is a fixed, unwritable property
        // of the function's own syntax (a rest-only parameter list makes it
        // 0 no matter what runs in the body), not something a statement
        // inside the function can restore. `arguments.length` inside the
        // body is unaffected by this rewrite either way — it reflects the
        // real call-time argument count regardless of the declared
        // parameter list — so nothing downstream actually needs fixing up.

        return .proceed;
    }
};

test "masks parameters behind a rest array and runs identically" {
    const allocator = std.testing.allocator;
    const source =
        \\function add(a, b) {
        \\  return a + b;
        \\}
        \\console.log(add(2, 3));
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    const semantic = try parser.semantic.analyze(&tree);

    var visitor = Visitor.init(allocator, semantic);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_stack0") != null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "function add(a, b)") == null);

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

    try std.testing.expectEqualStrings("5\n", obfuscated_run.stdout);
}

test "leaves getters and setters alone" {
    const allocator = std.testing.allocator;
    const source =
        \\var obj = {
        \\  _x: 1,
        \\  get x() { return this._x; },
        \\  set x(value) { this._x = value; },
        \\};
        \\obj.x = 5;
        \\console.log(obj.x);
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    const semantic = try parser.semantic.analyze(&tree);

    var visitor = Visitor.init(allocator, semantic);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "...__obf_stack") == null);
}

test "masks an ordinary method's and a constructor's own parameters, unlike get/set" {
    const allocator = std.testing.allocator;
    const source =
        \\class Box {
        \\  constructor(value) {
        \\    this.value = value;
        \\  }
        \\  add(x, y) {
        \\    return x + y + this.value;
        \\  }
        \\}
        \\var b = new Box(10);
        \\console.log(b.add(2, 3));
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    const semantic = try parser.semantic.analyze(&tree);

    var visitor = Visitor.init(allocator, semantic);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    // Both the constructor and the ordinary method got masked -- getters/
    // setters are the only exclusion now, not every method.
    try std.testing.expect(std.mem.indexOf(u8, result.code, "...__obf_stack0") != null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "...__obf_stack1") != null);

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

    try std.testing.expectEqualStrings("15\n", run.stdout);
}
