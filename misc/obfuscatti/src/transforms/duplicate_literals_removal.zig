//! Duplicate literals removal: any string/number/boolean/null/`undefined`
//! literal that appears 2+ times in the program is hoisted into one shared
//! array, and every occurrence (including the first) becomes an index
//! lookup — a literal like `"admin"` used five times only appears in
//! source once. Port of js-confuser's
//! `transforms/extraction/duplicateLiteralsRemoval.ts`, now including both
//! things an earlier version of this file skipped:
//! - Numeric equality now compares yuku's own parsed `f64` value
//!   (`NumericLiteral.value(tree)`, which already exists and already
//!   strips numeric separators — checked by reading `parser/ast.zig`
//!   directly, not assumed), not raw source text — `6` and `0x6` dedupe
//!   against each other now, matching Babel's own `NumericLiteral.value`
//!   the original compares.
//! - The free *identifier* `undefined` is treated as a literal too, same
//!   as the original — but only a genuinely free one: `enter_identifier_
//!   reference` below checks `Semantic.reference(...).symbol == .none`
//!   (the same "does this resolve to any local binding at all" check
//!   global_concealing.zig already uses for the same reason), matching
//!   the original's own `scope.hasBinding(name, {noGlobals: true})` guard
//!   — a function that locally shadows `undefined` (rare, legal in
//!   sloppy mode) is left alone, not silently folded into the shared
//!   array under a name that means something else there.
//!
//! Needs a `Semantic` snapshot for that last check now — see
//! obfuscate.zig's pipeline comment for why it's taken fresh, immediately
//! before this transform runs, not shared with the earlier semantic-
//! consuming group.
//!
//! Shares protected_keys.zig's guard with array_extraction.zig and
//! string_splitting.zig: a non-computed object/class member key or an
//! import/export module source is skipped entirely, never collected as a
//! dedup candidate — see that file for why those positions can't hold a
//! rewritten expression.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const transform = parser.traverser.transform;
const Action = parser.traverser.Action;
const ProtectedKeys = @import("protected_keys.zig").ProtectedKeys;

const no_span: ast.Span = .{ .start = 0, .end = 0 };

const LiteralValue = union(enum) {
    string: []const u8,
    /// yuku's own parsed IEEE-754 double, not raw source text -- see this
    /// file's own top comment. A real numeric literal never parses to
    /// NaN, and `-0`/`+0` colliding under bitwise equality is a
    /// correctness non-issue here (they dedupe to the same array slot,
    /// which is exactly what should happen: both re-emit as `0`, and
    /// `Object.is` distinguishing them is not a distinction this pass or
    /// its original ever tried to preserve).
    number: f64,
    boolean: bool,
    null_value,
    undefined_value,

    fn eql(a: LiteralValue, b: LiteralValue) bool {
        if (std.meta.activeTag(a) != std.meta.activeTag(b)) return false;
        return switch (a) {
            .string => |s| std.mem.eql(u8, s, b.string),
            .number => |v| @as(u64, @bitCast(v)) == @as(u64, @bitCast(b.number)),
            .boolean => |v| v == b.boolean,
            .null_value, .undefined_value => true,
        };
    }

    fn toNode(self: LiteralValue, ctx: *transform.Ctx) !ast.NodeIndex {
        return switch (self) {
            .string => |s| ctx.tree.addNode(
                .{ .string_literal = .{ .value = try ctx.tree.addString(s) } },
                no_span,
            ),
            .number => |v| blk: {
                // Real, not hypothetical: a minified production bundle can
                // fold an expression into an extreme literal (near f64's
                // ~1.8e308 max or ~5e-324 min-subnormal magnitude), and
                // `{d}` prints the full decimal expansion, not scientific
                // notation -- up to ~370 chars (309-digit integer part at
                // the large end, ~324 leading zeros past the decimal point
                // at the small end). 512 covers either extreme with room
                // to spare; 64 crashed on real Civil bundle output.
                var buf: [512]u8 = undefined;
                const text = std.fmt.bufPrint(&buf, "{d}", .{v}) catch unreachable;
                break :blk ctx.tree.addNode(
                    .{ .numeric_literal = .{ .kind = .decimal, .raw = try ctx.tree.addString(text) } },
                    no_span,
                );
            },
            .boolean => |v| ctx.tree.addNode(.{ .boolean_literal = .{ .value = v } }, no_span),
            .null_value => ctx.tree.addNode(.{ .null_literal = .{} }, no_span),
            .undefined_value => ctx.tree.addNode(
                .{ .identifier_reference = .{ .name = try ctx.tree.addString("undefined") } },
                no_span,
            ),
        };
    }
};

const Entry = struct { value: LiteralValue, node: ast.NodeIndex };

/// Hashes/compares `LiteralValue` by content (tag + payload bytes), not by
/// the slice pointers `.string`/`.number` carry -- lets `LiteralValue` be a
/// `std.HashMapUnmanaged` key directly, grouping occurrences by value in one
/// pass instead of the all-pairs scan this replaced (see `finishProgram`).
const LiteralContext = struct {
    pub fn hash(_: @This(), key: LiteralValue) u64 {
        var hasher = std.hash.Wyhash.init(0);
        switch (key) {
            .string => |s| {
                hasher.update(&.{0});
                hasher.update(s);
            },
            .number => |v| {
                hasher.update(&.{1});
                hasher.update(std.mem.asBytes(&@as(u64, @bitCast(v))));
            },
            .boolean => |v| hasher.update(&.{ 2, @intFromBool(v) }),
            .null_value => hasher.update(&.{3}),
            .undefined_value => hasher.update(&.{4}),
        }
        return hasher.final();
    }

    pub fn eql(_: @This(), a: LiteralValue, b: LiteralValue) bool {
        return a.eql(b);
    }
};

const Group = struct {
    value: LiteralValue,
    nodes: std.ArrayList(ast.NodeIndex) = .empty,
};

pub const Visitor = struct {
    allocator: std.mem.Allocator,
    array_name: []const u8,
    semantic: parser.semantic.Semantic,
    entries: std.ArrayList(Entry) = .empty,
    protected: ProtectedKeys = .{},
    err: ?std.mem.Allocator.Error = null,

    pub fn init(allocator: std.mem.Allocator, array_name: []const u8, semantic: parser.semantic.Semantic) Visitor {
        return .{ .allocator = allocator, .array_name = array_name, .semantic = semantic };
    }

    pub fn deinit(self: *Visitor) void {
        for (self.entries.items) |entry| switch (entry.value) {
            .string => |s| self.allocator.free(s),
            .number, .boolean, .null_value, .undefined_value => {},
        };
        self.entries.deinit(self.allocator);
        self.protected.deinit(self.allocator);
    }

    pub fn enter_object_property(self: *Visitor, node: ast.ObjectProperty, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = ctx;
        _ = index;
        try self.protected.markKey(self.allocator, node.key, node.computed);
        return .proceed;
    }
    pub fn enter_method_definition(self: *Visitor, node: ast.MethodDefinition, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = ctx;
        _ = index;
        try self.protected.markKey(self.allocator, node.key, node.computed);
        return .proceed;
    }
    pub fn enter_property_definition(self: *Visitor, node: ast.PropertyDefinition, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = ctx;
        _ = index;
        try self.protected.markKey(self.allocator, node.key, node.computed);
        return .proceed;
    }
    pub fn enter_import_declaration(self: *Visitor, node: ast.ImportDeclaration, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = ctx;
        _ = index;
        try self.protected.markSource(self.allocator, node.source);
        return .proceed;
    }
    pub fn enter_export_named_declaration(self: *Visitor, node: ast.ExportNamedDeclaration, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = ctx;
        _ = index;
        try self.protected.markSource(self.allocator, node.source);
        return .proceed;
    }
    pub fn enter_export_all_declaration(self: *Visitor, node: ast.ExportAllDeclaration, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = ctx;
        _ = index;
        try self.protected.markSource(self.allocator, node.source);
        return .proceed;
    }
    pub fn enter_import_attribute(self: *Visitor, node: ast.ImportAttribute, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = ctx;
        _ = index;
        try self.protected.markAttribute(self.allocator, node.key, node.value);
        return .proceed;
    }

    pub fn enter_string_literal(
        self: *Visitor,
        lit: ast.StringLiteral,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        if (self.protected.contains(index)) return .proceed;
        const s = ctx.tree.string(lit.value);
        if (s.len == 0) return .proceed;
        // `tree.string()` slices alias the tree's own string pool, which can
        // reallocate on the next `tree.addString()` call (its backing store
        // is a plain growable ArrayList) -- this entry lives until
        // `finishProgram`, long past that, so it needs its own copy.
        const owned = try self.allocator.dupe(u8, s);
        try self.entries.append(self.allocator, .{ .value = .{ .string = owned }, .node = index });
        return .proceed;
    }

    pub fn enter_numeric_literal(
        self: *Visitor,
        lit: ast.NumericLiteral,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        // A numeric object/class member key (`{ 22: x }`) is just as
        // syntactically static as a string one -- missing this guard (see
        // enter_string_literal above, and protected_keys.zig) let a
        // duplicate numeric key get rewritten into a member-expression
        // without its parent ever becoming `computed: true`, producing
        // `{ aa[22]: x }`, a syntax error, same failure shape the guard
        // was built for.
        if (self.protected.contains(index)) return .proceed;
        try self.entries.append(self.allocator, .{ .value = .{ .number = lit.value(ctx.tree) }, .node = index });
        return .proceed;
    }

    pub fn enter_identifier_reference(
        self: *Visitor,
        ident: ast.IdentifierReference,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        _ = ident;
        // Nodes at or past this bound were created by this same pass or a
        // still-earlier one -- `Semantic`'s node tables only cover what
        // existed when `analyze` ran (see obfuscate.zig's pipeline
        // comment and global_concealing.zig's own version of this same
        // check).
        if (@intFromEnum(index) >= self.semantic.node_references.len) return .proceed;

        const ref_id = self.semantic.referenceOf(index) orelse return .proceed;
        const ref = self.semantic.reference(ref_id);
        if (ref.symbol != .none) return .proceed; // shadowed locally -- a real binding, not the global
        if (ref.flags.write) return .proceed; // assignment target (`undefined = x` -- rare, but not a value read)
        if (ref.flags.space != .value) return .proceed;
        if (!std.mem.eql(u8, ctx.tree.string(ref.name), "undefined")) return .proceed;

        try self.entries.append(self.allocator, .{ .value = .undefined_value, .node = index });
        return .proceed;
    }

    pub fn enter_boolean_literal(
        self: *Visitor,
        lit: ast.BooleanLiteral,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        _ = ctx;
        try self.entries.append(self.allocator, .{ .value = .{ .boolean = lit.value }, .node = index });
        return .proceed;
    }

    pub fn enter_null_literal(
        self: *Visitor,
        lit: ast.NullLiteral,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        _ = lit;
        _ = ctx;
        try self.entries.append(self.allocator, .{ .value = .null_value, .node = index });
        return .proceed;
    }

    fn replaceWithLookup(self: *Visitor, ctx: *transform.Ctx, node: ast.NodeIndex, slot: u32) !void {
        const array_ident = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString(self.array_name) } },
            no_span,
        );
        var buf: [10]u8 = undefined;
        const slot_text = std.fmt.bufPrint(&buf, "{d}", .{slot}) catch unreachable;
        const index_lit = try ctx.tree.addNode(
            .{ .numeric_literal = .{ .kind = .decimal, .raw = try ctx.tree.addString(slot_text) } },
            no_span,
        );
        ctx.tree.setData(node, .{ .member_expression = .{
            .object = array_ident,
            .property = index_lit,
            .computed = true,
            .optional = false,
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

    fn finishProgram(
        self: *Visitor,
        prog: ast.Program,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !void {
        var elements: std.ArrayList(ast.NodeIndex) = .empty;
        defer elements.deinit(self.allocator);

        // Groups occurrences by value in one hash-map pass (previously an
        // all-pairs scan -- O(entries^2) comparisons, which a real minified
        // bundle's thousands of literals turned into a multi-minute hang;
        // caught by testing against this project's own production build
        // output rather than small hand-written cases).
        var groups: std.HashMapUnmanaged(LiteralValue, Group, LiteralContext, std.hash_map.default_max_load_percentage) = .empty;
        defer {
            var it = groups.valueIterator();
            while (it.next()) |group| group.nodes.deinit(self.allocator);
            groups.deinit(self.allocator);
        }

        for (self.entries.items) |entry| {
            const gop = try groups.getOrPutContext(self.allocator, entry.value, .{});
            if (!gop.found_existing) gop.value_ptr.* = .{ .value = entry.value };
            try gop.value_ptr.nodes.append(self.allocator, entry.node);
        }

        var it = groups.valueIterator();
        while (it.next()) |group| {
            if (group.nodes.items.len < 2) continue;

            const slot: u32 = @intCast(elements.items.len);
            try elements.append(self.allocator, try group.value.toNode(ctx));

            for (group.nodes.items) |node| {
                try self.replaceWithLookup(ctx, node, slot);
            }
        }

        if (elements.items.len == 0) return;

        const array_expr = try ctx.tree.addNode(
            .{ .array_expression = .{ .elements = try ctx.tree.addExtra(elements.items) } },
            no_span,
        );
        const binding_id = try ctx.tree.addNode(
            .{ .binding_identifier = .{ .name = try ctx.tree.addString(self.array_name) } },
            no_span,
        );
        const declarator = try ctx.tree.addNode(
            .{ .variable_declarator = .{ .id = binding_id, .init = array_expr } },
            no_span,
        );
        const var_decl = try ctx.tree.addNode(.{ .variable_declaration = .{
            .kind = .@"var",
            .declarators = try ctx.tree.addExtra(&.{declarator}),
        } }, no_span);

        const original_body = ctx.tree.extra(prog.body);
        var new_body: std.ArrayList(ast.NodeIndex) = .empty;
        defer new_body.deinit(self.allocator);
        try new_body.ensureTotalCapacityPrecise(self.allocator, original_body.len + 1);
        new_body.appendAssumeCapacity(var_decl);
        new_body.appendSliceAssumeCapacity(original_body);

        ctx.tree.setData(index, .{ .program = .{
            .source_type = prog.source_type,
            .body = try ctx.tree.addExtra(new_body.items),
            .hashbang = prog.hashbang,
        } });
    }
};

test "hoists repeated literals into a shared array and leaves one-off literals alone" {
    const allocator = std.testing.allocator;

    var tree = try parser.parse(
        allocator,
        "console.log(\"dup\", \"dup\", \"dup\", 42, 42, \"solo\", true, true, null, null);",
        .{},
    );
    defer tree.deinit();
    const semantic = try parser.semantic.analyze(&tree);

    var visitor = Visitor.init(allocator, "__obf_dlr", semantic);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_dlr") != null);
    // Appears once in the source — must survive untouched, not hoisted.
    try std.testing.expect(std.mem.indexOf(u8, result.code, "\"solo\"") != null);
}

test "leaves an import attribute's key and value alone even when duplicated elsewhere" {
    const allocator = std.testing.allocator;
    // Same shape as this repo's own benchmarks route:
    // `import x from "./a.json" with { type: "json" }`. Duplicate-literals
    // removal only fires on a literal appearing 2+ times -- the two
    // "json" console.log args below are a genuine duplicate pair and
    // *should* get hoisted, proving the guard is scoped to the attribute
    // specifically, not a blanket skip of the string "json" everywhere it
    // appears in the program.
    var tree = try parser.parse(
        allocator,
        "import x from \"./a.json\" with { type: \"json\" }; console.log(\"json\", \"json\");",
        .{},
    );
    defer tree.deinit();
    const semantic = try parser.semantic.analyze(&tree);

    var visitor = Visitor.init(allocator, "__obf_dlr", semantic);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "type: \"json\"") != null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_dlr") != null);
}

test "leaves a duplicated numeric object key alone while still deduping the same number elsewhere" {
    const allocator = std.testing.allocator;
    // `22` appears four times: twice as a non-computed object key (must
    // stay a literal -- rewriting it into a member-expression without also
    // flipping its object_property to computed produces `{ a[0]: x }`, a
    // syntax error) and twice as an ordinary value (a legitimate dedup
    // target). enter_string_literal already checked `protected` for the
    // string-key version of this; enter_numeric_literal didn't.
    const source =
        \\const a = { 22: "x" };
        \\const b = { 22: "y" };
        \\const c = 22;
        \\const d = 22;
        \\console.log(a[22], b[22], c, d);
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    const semantic = try parser.semantic.analyze(&tree);

    var visitor = Visitor.init(allocator, "__obf_dlr", semantic);
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

    try std.testing.expectEqualStrings("x y 22 22\n", run.stdout);
}

test "dedupes across numeric notations and folds free `undefined` into the shared array" {
    const allocator = std.testing.allocator;
    // `6` and `0x6` are the same parsed value -- must dedupe against each
    // other now (they wouldn't have compared equal by raw source text).
    // `undefined` here is a genuinely free reference (nothing declares it)
    // and appears twice, so it should fold in too; `shadowed()`'s own
    // parameter named `undefined` must NOT be touched, since it's a real
    // local binding there, not the global value.
    const source =
        \\function shadowed(undefined) {
        \\  return undefined;
        \\}
        \\console.log(6, 0x6, undefined, undefined, shadowed("real value"));
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    const semantic = try parser.semantic.analyze(&tree);

    var visitor = Visitor.init(allocator, "__obf_dlr", semantic);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_dlr") != null);

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

    try std.testing.expectEqualStrings("6 6 undefined undefined real value\n", run.stdout);
}

test "dedupes an extreme-magnitude literal without overflowing the rebuild buffer" {
    const allocator = std.testing.allocator;
    // Regression test: `toNode`'s numeric case used to format the parsed
    // f64 back into source text through a 64-byte buffer, which panicked
    // (`error.NoSpaceLeft`, `catch unreachable`) on a value whose full
    // decimal expansion runs longer than that -- found against a real
    // Civil production bundle, not a synthetic case (a minifier can fold
    // an expression into a literal this extreme even when no hand-written
    // source ever would). Nearly f64's max finite magnitude, ~309 digits
    // fully expanded.
    const source = "console.log(1.7976931348623157e+308, 1.7976931348623157e+308);";

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    const semantic = try parser.semantic.analyze(&tree);

    var visitor = Visitor.init(allocator, "__obf_dlr", semantic);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_dlr") != null);

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

    try std.testing.expectEqualStrings("1.7976931348623157e+308 1.7976931348623157e+308\n", run.stdout);
}
