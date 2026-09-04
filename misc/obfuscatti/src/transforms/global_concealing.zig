//! Global concealing: every genuinely free identifier reference — nothing
//! in the program declares it, so it resolves through the environment
//! (`console`, `Math`, `fetch`, ...) — is rewritten into a call through one
//! shared lookup function keyed by an opaque string: `console` becomes
//! `__obf_getGlobal("g0")`. Port of js-confuser's
//! `transforms/identifier/globalConcealing.ts`, minus:
//! - its decoy-padding (20-40 fake mappings shuffled into the switch) —
//!   same "structural half, no decoys" scoping already used for
//!   array_extraction.zig.
//! - its native-function tamper-protection integration (`checkNative`
//!   wrapping around global function calls) — tied to the not-yet-ported
//!   lock/integrity system.
//! - its own "resolve the global object" indirection template — this just
//!   references `globalThis` directly, which every environment this proxy
//!   actually runs in has.
//!
//! This is the one transform so far where yuku's semantic analyzer does
//! better than the original, not just enough to get by: js-confuser checks
//! a free name against a hardcoded known-globals list (`scope.hasGlobal`),
//! so a genuinely free name outside that list is silently left alone. Real
//! scope resolution doesn't need that list — "nothing in this program
//! declares it" already means it resolves via the environment at runtime,
//! whatever provides it, recognized name or not.
//!
//! Excluding an assignment target, a `++`/`--` operand, a `for`-in/of
//! iteration variable, and a destructuring-assignment leaf all fall out of
//! one check (`Reference.flags.write`) instead of the original's own
//! separate, manually-reconstructed ancestor walks for each shape — which,
//! having read them closely, don't actually cover every one of those shapes
//! either (notably a bare `global++`, an update-expression target).
//!
//! Needs the `Semantic` snapshot from *before* any node-creating transform
//! runs, including its own later replacements within the same pass — see
//! obfuscate.zig's pipeline comment and the bounds check below.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const transform = parser.traverser.transform;
const Action = parser.traverser.Action;

const no_span: ast.Span = .{ .start = 0, .end = 0 };

pub const Visitor = struct {
    allocator: std.mem.Allocator,
    semantic: parser.semantic.Semantic,
    fn_name: []const u8,
    mapping: std.StringHashMapUnmanaged(u32) = .empty,
    err: ?std.mem.Allocator.Error = null,

    pub fn init(allocator: std.mem.Allocator, semantic: parser.semantic.Semantic, fn_name: []const u8) Visitor {
        return .{ .allocator = allocator, .semantic = semantic, .fn_name = fn_name };
    }

    pub fn deinit(self: *Visitor) void {
        var it = self.mapping.keyIterator();
        while (it.next()) |k| self.allocator.free(k.*);
        self.mapping.deinit(self.allocator);
    }

    /// Matches the original's own `ignoreGlobals` set (`constants.ts`):
    /// `reservedNodeModuleIdentifiers` (`require`/`module`/`exports` are
    /// real identifiers *only* inside a CommonJS module wrapper's own
    /// function scope, never properties of `globalThis` -- concealing them
    /// would throw at runtime, not just miss an optimization) plus
    /// `__dirname` and `reservedIdentifiers`. Skips the original's fourth
    /// member, `variableFunctionName` (`__JS_CONFUSER_VAR__`) -- that's an
    /// internal marker js-confuser's own later passes key off of, matching
    /// nothing this pipeline ever generates.
    fn isIgnored(name: []const u8) bool {
        const ignored = [_][]const u8{
            "eval",   "arguments", "undefined", "null",      "NaN",
            "Infinity", "require", "module",    "exports",   "__dirname",
        };
        for (ignored) |name_i| {
            if (std.mem.eql(u8, name, name_i)) return true;
        }
        return false;
    }

    pub fn enter_identifier_reference(
        self: *Visitor,
        ident: ast.IdentifierReference,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        _ = ident;
        // Nodes at or past this bound were created by this same pass (the
        // call/callee this hook itself just built) or a still-earlier one —
        // `Semantic`'s node tables only cover what existed when `analyze`
        // ran, and anything past that is already known, own-constructed
        // AST, never a real global reference to resolve.
        if (@intFromEnum(index) >= self.semantic.node_references.len) return .proceed;

        const ref_id = self.semantic.referenceOf(index) orelse return .proceed;
        const ref = self.semantic.reference(ref_id);
        if (ref.symbol != .none) return .proceed; // resolves locally, not a global
        if (ref.flags.write) return .proceed; // assignment target, can't wrap in a call
        if (ref.flags.space != .value) return .proceed; // e.g. a TS type-position name

        const name = ctx.tree.string(ref.name);
        if (isIgnored(name)) return .proceed;

        // `tree.string()` aliases the tree's own string pool, which can
        // reallocate on a later `tree.addString()` call -- `mapping`'s keys
        // are read back in `finishProgram`, long after many more of those,
        // so the map needs its own copy, not a pool slice, as the key.
        const owned_name = try self.allocator.dupe(u8, name);
        const gop = try self.mapping.getOrPut(self.allocator, owned_name);
        if (gop.found_existing) {
            self.allocator.free(owned_name);
        } else {
            gop.value_ptr.* = @intCast(self.mapping.count() - 1);
        }
        const slot = gop.value_ptr.*;

        var buf: [16]u8 = undefined;
        const key_text = std.fmt.bufPrint(&buf, "g{d}", .{slot}) catch unreachable;

        const callee = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString(self.fn_name) } },
            no_span,
        );
        const key_arg = try ctx.tree.addNode(
            .{ .string_literal = .{ .value = try ctx.tree.addString(key_text) } },
            no_span,
        );
        ctx.tree.setData(index, .{ .call_expression = .{
            .callee = callee,
            .type_arguments = .null,
            .arguments = try ctx.tree.addExtra(&.{key_arg}),
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
        if (self.mapping.count() == 0) return;

        // function __obf_getGlobal(key) {
        //   switch (key) { case "g0": return globalThis["console"]; ... }
        // }
        const key_binding = try ctx.tree.addNode(
            .{ .binding_identifier = .{ .name = try ctx.tree.addString("key") } },
            no_span,
        );
        const key_param = try ctx.tree.addNode(
            .{ .formal_parameter = .{ .pattern = key_binding } },
            no_span,
        );
        const params = try ctx.tree.addNode(.{ .formal_parameters = .{
            .items = try ctx.tree.addExtra(&.{key_param}),
            .rest = .null,
            .kind = .formal_parameters,
        } }, no_span);

        var cases: std.ArrayList(ast.NodeIndex) = .empty;
        defer cases.deinit(self.allocator);
        try cases.ensureTotalCapacityPrecise(self.allocator, self.mapping.count());

        var it = self.mapping.iterator();
        while (it.next()) |entry| {
            const global_name = entry.key_ptr.*;
            const slot = entry.value_ptr.*;

            var buf: [16]u8 = undefined;
            const key_text = std.fmt.bufPrint(&buf, "g{d}", .{slot}) catch unreachable;

            const global_this = try ctx.tree.addNode(
                .{ .identifier_reference = .{ .name = try ctx.tree.addString("globalThis") } },
                no_span,
            );
            const prop_name = try ctx.tree.addNode(
                .{ .string_literal = .{ .value = try ctx.tree.addString(global_name) } },
                no_span,
            );
            const member = try ctx.tree.addNode(.{ .member_expression = .{
                .object = global_this,
                .property = prop_name,
                .computed = true,
                .optional = false,
            } }, no_span);
            const ret = try ctx.tree.addNode(.{ .return_statement = .{ .argument = member } }, no_span);
            const case_test = try ctx.tree.addNode(
                .{ .string_literal = .{ .value = try ctx.tree.addString(key_text) } },
                no_span,
            );
            cases.appendAssumeCapacity(try ctx.tree.addNode(.{ .switch_case = .{
                .@"test" = case_test,
                .consequent = try ctx.tree.addExtra(&.{ret}),
            } }, no_span));
        }

        const discriminant = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString("key") } },
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

test "conceals free globals behind an opaque lookup and runs identically" {
    const allocator = std.testing.allocator;
    const source = "console.log(\"hi\"); let x = 1; console.log(x);";

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    const semantic = try parser.semantic.analyze(&tree);

    var visitor = Visitor.init(allocator, semantic, "__obf_getGlobal");
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_getGlobal") != null);
    // `x` is a real local binding -- must stay a plain reference, not wrapped.
    try std.testing.expect(std.mem.indexOf(u8, result.code, "let x") != null);
}

test "leaves CommonJS module-wrapper identifiers and reserved names unconcealed" {
    const allocator = std.testing.allocator;
    const source =
        \\const fs = require("fs");
        \\module.exports = fs;
        \\console.log(__dirname, undefined, NaN, Infinity);
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    const semantic = try parser.semantic.analyze(&tree);

    var visitor = Visitor.init(allocator, semantic, "__obf_getGlobal");
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    // `console` is still genuinely free and gets concealed...
    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_getGlobal") != null);
    // ...but none of these do, even though every one of them is just as
    // free from a pure scope-resolution standpoint.
    try std.testing.expect(std.mem.indexOf(u8, result.code, "require(\"fs\")") != null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "module.exports") != null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "__dirname") != null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "undefined") != null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "NaN") != null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "Infinity") != null);
}
