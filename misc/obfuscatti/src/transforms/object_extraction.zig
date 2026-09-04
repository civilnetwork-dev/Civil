//! Object extraction: `var obj = { a: 1, b: 2 }` becomes
//! `let __obf_obj_a = 1, __obf_obj_b = 2;`, with every `obj.a`/`obj.b`
//! access rewritten to the new bare identifier — so there's no object left
//! carrying both properties together for a filter to pattern-match against.
//! Port of js-confuser's `transforms/extraction/objectExtraction.ts`.
//!
//! One structural difference: the original replaces the declaration with N
//! sibling statements; this keeps one `VariableDeclaration` and gives it N
//! declarators (`let a = 1, b = 2;` instead of `let a = 1; let b = 2;`) —
//! identical scoping, hoisting, and evaluation order, and a 1-to-1 node
//! replacement instead of needing to splice an arbitrary parent's statement
//! list (Program, a block, a function body, ...), which yuku's node-index
//! model doesn't otherwise support directly.
//!
//! Only extracted when every use is provably safe, matching the original's
//! own conservative bar: single declarator, no destructuring, an object
//! literal initializer with no spread/getter/setter/duplicate/dynamically-
//! computed keys (a string or numeric literal key counts as static whether
//! or not it's written in computed `[...]` form — only a *non-literal*
//! computed key like `[x]` disqualifies it), the binding is never reassigned
//! (`Reference.flags.write` across `Semantic.uses`), no property's function
//! value references `this` (would break its binding once detached from the
//! object), every use is a plain, string-computed, or numeric-computed
//! member access naming one of the known properties, and none of those
//! accesses sits under a `delete`. Any one failure aborts the whole
//! declaration, not just the offending part.
//!
//! An object literal with zero properties is left alone even when every use
//! would otherwise check out: the original can replace the declaration with
//! nothing when there's nothing to extract, but this port's one-slot-in-
//! place rewrite (see below) has no valid zero-declarator form to fall back
//! to.
//!
//! Needs the pre-mutation `Semantic` snapshot — see obfuscate.zig's
//! pipeline comment.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const transform = parser.traverser.transform;
const basic = parser.traverser.basic;
const Action = parser.traverser.Action;
const Semantic = parser.semantic.Semantic;

const no_span: ast.Span = .{ .start = 0, .end = 0 };

/// `numeric_buf` only backs the numeric-literal case (`{0: 1}` and
/// `{[0]: 1}` produce the same NumericLiteral key node either way, and JS
/// itself coerces a numeric key to its string form for property access, so
/// `obj[0]` and `obj["0"]` must resolve to the same static key here too).
/// Out-parameter instead of a function-local buffer because a slice into a
/// callee's own stack frame is dangling the moment the function returns —
/// every call site below owns its buffer for exactly as long as it needs
/// the result.
fn staticKey(tree: *const ast.Tree, node: ast.NodeIndex, numeric_buf: *[512]u8) ?[]const u8 {
    return switch (tree.data(node)) {
        .identifier_name => |n| tree.string(n.name),
        .string_literal => |s| tree.string(s.value),
        .numeric_literal => |n| std.fmt.bufPrint(numeric_buf, "{d}", .{n.value(tree)}) catch null,
        else => null,
    };
}

fn isSafeIdentifierSuffix(s: []const u8) bool {
    if (s.len == 0) return false;
    for (s, 0..) |c, i| {
        const alpha = (c >= 'a' and c <= 'z') or (c >= 'A' and c <= 'Z') or c == '_' or c == '$';
        const digit = c >= '0' and c <= '9';
        if (!(alpha or (i > 0 and digit))) return false;
    }
    return true;
}

/// Every node with a `this_expression` anywhere in its subtree, including
/// the this_expression itself and all ancestors up to the root. yuku's
/// traversers always start from the tree root, so there's no direct way to
/// ask "does this one subtree contain `this`" — this answers it in O(1)
/// per query instead, at the cost of one full-tree pass up front.
const ThisTaint = struct {
    tainted: std.AutoHashMapUnmanaged(ast.NodeIndex, void) = .empty,

    const Collector = struct {
        semantic: *const Semantic,
        tainted: *std.AutoHashMapUnmanaged(ast.NodeIndex, void),
        allocator: std.mem.Allocator,
        err: ?std.mem.Allocator.Error = null,

        pub fn enter_this_expression(
            self: *Collector,
            expr: ast.ThisExpression,
            index: ast.NodeIndex,
            ctx: *basic.Ctx,
        ) !Action {
            _ = expr;
            _ = ctx;
            var current: ?ast.NodeIndex = index;
            while (current) |node| {
                const gop = self.tainted.getOrPut(self.allocator, node) catch |err| {
                    self.err = err;
                    return .proceed;
                };
                if (gop.found_existing) break;
                current = self.semantic.parentOf(node);
            }
            return .proceed;
        }
    };

    fn build(allocator: std.mem.Allocator, tree: *const ast.Tree, semantic: Semantic) !ThisTaint {
        var tainted: std.AutoHashMapUnmanaged(ast.NodeIndex, void) = .empty;
        var collector = Collector{ .semantic = &semantic, .tainted = &tainted, .allocator = allocator };
        try basic.traverse(Collector, tree, &collector);
        if (collector.err) |err| return err;
        return .{ .tainted = tainted };
    }

    fn deinit(self: *ThisTaint, allocator: std.mem.Allocator) void {
        self.tainted.deinit(allocator);
    }

    fn contains(self: ThisTaint, node: ast.NodeIndex) bool {
        return self.tainted.contains(node);
    }
};

const NewProperty = struct { key: []const u8, new_name: []const u8, value: ast.NodeIndex };

pub const Visitor = struct {
    allocator: std.mem.Allocator,
    semantic: Semantic,
    this_taint: ThisTaint,
    counter: u32 = 0,

    pub fn init(allocator: std.mem.Allocator, tree: *const ast.Tree, semantic: Semantic) !Visitor {
        return .{
            .allocator = allocator,
            .semantic = semantic,
            .this_taint = try ThisTaint.build(allocator, tree, semantic),
        };
    }

    pub fn deinit(self: *Visitor) void {
        self.this_taint.deinit(self.allocator);
    }

    /// `null` when the property list disqualifies the whole declaration
    /// (spread, getter/setter, shorthand method, computed/non-static key,
    /// duplicate key, or a function value that references `this`).
    fn collectProperties(
        self: *Visitor,
        ctx: *transform.Ctx,
        obj: ast.ObjectExpression,
        new_object_name: []const u8,
    ) !?std.ArrayList(NewProperty) {
        var props: std.ArrayList(NewProperty) = .empty;
        errdefer props.deinit(self.allocator);

        for (ctx.tree.extra(obj.properties)) |prop_idx| {
            const prop = switch (ctx.tree.data(prop_idx)) {
                .object_property => |p| p,
                else => return null, // spread_element, or anything else
            };
            if (prop.kind != .init or prop.method) return null;

            var numeric_buf: [512]u8 = undefined;
            const key_slice = staticKey(ctx.tree, prop.key, &numeric_buf) orelse return null;
            for (props.items) |existing| {
                if (std.mem.eql(u8, existing.key, key_slice)) return null; // duplicate
            }

            if (ctx.tree.data(prop.value) == .function and self.this_taint.contains(prop.value)) {
                return null;
            }

            const new_name = if (isSafeIdentifierSuffix(key_slice))
                try std.fmt.allocPrint(self.allocator, "{s}_{s}", .{ new_object_name, key_slice })
            else
                try std.fmt.allocPrint(self.allocator, "{s}_{d}", .{ new_object_name, props.items.len });
            errdefer self.allocator.free(new_name);

            // `tree.string()` (inside staticKey) aliases the tree's own
            // string pool, which can reallocate on a later
            // `tree.addString()` call -- `props` is read from well past
            // several of those (the declarator- and use-rewrite loops
            // below), so each key needs its own copy, not a pool slice.
            const key = try self.allocator.dupe(u8, key_slice);
            try props.append(self.allocator, .{ .key = key, .new_name = new_name, .value = prop.value });
        }

        return props;
    }

    /// `null` when any use of `sym_id` isn't a provably-safe static member
    /// access naming one of `props` — bare use, dynamic key, unknown
    /// property, or a `delete` target.
    fn validateUses(
        self: *Visitor,
        ctx: *transform.Ctx,
        sym_id: parser.traverser.semantic.SymbolId,
        props: []const NewProperty,
    ) bool {
        for (self.semantic.uses(sym_id)) |ref_id| {
            const ref = self.semantic.reference(ref_id);
            if (ref.flags.write) return false;

            const parent = self.semantic.parentOf(ref.node) orelse return false;
            const member = switch (ctx.tree.data(parent)) {
                .member_expression => |m| m,
                else => return false,
            };
            if (member.object != ref.node) return false;

            var numeric_buf: [512]u8 = undefined;
            const key = staticKey(ctx.tree, member.property, &numeric_buf) orelse return false;
            var known = false;
            for (props) |p| {
                if (std.mem.eql(u8, p.key, key)) {
                    known = true;
                    break;
                }
            }
            if (!known) return false;

            if (self.semantic.parentOf(parent)) |grandparent| {
                switch (ctx.tree.data(grandparent)) {
                    .unary_expression => |u| if (u.operator == .delete and u.argument == parent) return false,
                    else => {},
                }
            }
        }
        return true;
    }

    pub fn enter_variable_declaration(
        self: *Visitor,
        decl: ast.VariableDeclaration,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        // Nodes past what `Semantic` covers are this pass's own earlier
        // replacements (or a still-earlier transform's) -- never a real
        // candidate declaration to extract.
        if (@intFromEnum(index) >= self.semantic.node_references.len) return .proceed;

        const declarator_range = ctx.tree.extra(decl.declarators);
        if (declarator_range.len != 1) return .proceed;
        const declarator = switch (ctx.tree.data(declarator_range[0])) {
            .variable_declarator => |d| d,
            else => return .proceed,
        };

        if (ctx.tree.data(declarator.id) != .binding_identifier) return .proceed; // no destructuring
        if (declarator.init == .null) return .proceed;
        const obj = switch (ctx.tree.data(declarator.init)) {
            .object_expression => |o| o,
            else => return .proceed,
        };

        const sym_id = self.semantic.symbolOf(declarator.id) orelse return .proceed;
        for (self.semantic.uses(sym_id)) |ref_id| {
            if (self.semantic.reference(ref_id).flags.write) return .proceed;
        }

        const binding_name = ctx.tree.string(ctx.tree.data(declarator.id).binding_identifier.name);
        const new_object_name = try std.fmt.allocPrint(self.allocator, "__obf_{s}", .{binding_name});
        defer self.allocator.free(new_object_name);

        var props = try self.collectProperties(ctx, obj, new_object_name) orelse return .proceed;
        defer props.deinit(self.allocator);
        defer for (props.items) |p| {
            self.allocator.free(p.key);
            self.allocator.free(p.new_name);
        };

        // `{}` has nothing to extract -- and unlike the original, which can
        // just delete the declaration outright, this transform's one-slot-
        // in-place rewrite has no valid "N=0 declarators" form to fall back
        // to, so an empty object is left as-is rather than emitting broken
        // syntax.
        if (props.items.len == 0) return .proceed;

        if (!self.validateUses(ctx, sym_id, props.items)) return .proceed;

        // All checks passed -- safe to rewrite both the declaration and
        // every use.
        var new_declarators: std.ArrayList(ast.NodeIndex) = .empty;
        defer new_declarators.deinit(self.allocator);
        try new_declarators.ensureTotalCapacityPrecise(self.allocator, props.items.len);
        for (props.items) |p| {
            const id = try ctx.tree.addNode(
                .{ .binding_identifier = .{ .name = try ctx.tree.addString(p.new_name) } },
                no_span,
            );
            new_declarators.appendAssumeCapacity(try ctx.tree.addNode(
                .{ .variable_declarator = .{ .id = id, .init = p.value } },
                no_span,
            ));
        }

        const new_kind: ast.VariableKind = if (decl.kind == .@"const") .let else decl.kind;
        ctx.tree.setData(index, .{ .variable_declaration = .{
            .kind = new_kind,
            .declarators = try ctx.tree.addExtra(new_declarators.items),
            .declare = false,
        } });

        for (self.semantic.uses(sym_id)) |ref_id| {
            const ref = self.semantic.reference(ref_id);
            const parent = self.semantic.parentOf(ref.node).?;
            const member = ctx.tree.data(parent).member_expression;
            var numeric_buf: [512]u8 = undefined;
            const key = staticKey(ctx.tree, member.property, &numeric_buf).?;

            for (props.items) |p| {
                if (std.mem.eql(u8, p.key, key)) {
                    ctx.tree.setData(parent, .{ .identifier_reference = .{
                        .name = try ctx.tree.addString(p.new_name),
                    } });
                    break;
                }
            }
        }

        return .proceed;
    }
};

test "extracts an object's properties into separate bindings and runs identically" {
    const allocator = std.testing.allocator;
    const source =
        \\var obj = { a: 1, b: "two" };
        \\console.log(obj.a, obj.b);
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    const semantic = try parser.semantic.analyze(&tree);

    var visitor = try Visitor.init(allocator, &tree, semantic);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_obj_a") != null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_obj_b") != null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "obj.a") == null);
}

test "extracts a numeric key and resolves numeric/string access to the same property" {
    const allocator = std.testing.allocator;
    const source =
        \\var obj = { 0: "zero", name: "obj" };
        \\console.log(obj[0], obj["0"], obj.name);
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    const semantic = try parser.semantic.analyze(&tree);

    var visitor = try Visitor.init(allocator, &tree, semantic);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);

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

    try std.testing.expectEqualStrings("zero zero obj\n", run.stdout);
}

test "leaves an empty, unused object declaration alone instead of emitting a bare declaration" {
    const allocator = std.testing.allocator;
    const source =
        \\var obj = {};
        \\console.log("ok");
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    const semantic = try parser.semantic.analyze(&tree);

    var visitor = try Visitor.init(allocator, &tree, semantic);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_obj") == null);

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

    try std.testing.expectEqualStrings("ok\n", run.stdout);
}

test "leaves a reassigned object alone" {
    const allocator = std.testing.allocator;
    const source =
        \\var obj = { a: 1 };
        \\obj = { a: 2 };
        \\console.log(obj.a);
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    const semantic = try parser.semantic.analyze(&tree);

    var visitor = try Visitor.init(allocator, &tree, semantic);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_obj_a") == null);
}
