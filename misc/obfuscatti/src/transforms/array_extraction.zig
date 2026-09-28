//! Array extraction: every string literal in the program is moved into one
//! injected buffer string, basE91-encoded, and replaced with a call to a
//! decoder function that slices and decodes its span.
//!
//! `"hello"` becomes `__obf_arr_get(3, 7)`, with `var __obf_arr = "...";`
//! (one shared, basE91-encoded buffer -- every string's encoded bytes
//! concatenated together, referenced by byte span rather than each getting
//! its own array slot) and the decoder function itself prepended to the
//! program. Port of js-confuser's "string concealing" transform
//! (github.com/MichaelXF/js-confuser, src/transforms/string/
//! stringConcealing.ts + string/encoding.ts's `createDefaultStringEncoding`)
//! — matches its default encoding (basE91 over a 91-character table) and
//! its buffer/span retrieval shape. Two things it does that this doesn't:
//! per-block encoder selection (multiple independently-keyed buffers
//! chosen at random as traversal proceeds, rather than one program-wide
//! buffer) and leading/trailing decoy padding around each embedded span.
//! Neither changes what a string decodes to, only how many candidate
//! buffers/offsets a static analysis would need to try — real gains for a
//! determined deobfuscator, but a second, independent layer of complexity
//! on top of "is this string encoded at all", which is the gap that
//! actually mattered here (see misc/obfuscatti's own comparison against
//! real js-confuser that found this one).
//!
//! Also matches the original's minimum-length gate (strings under 3
//! characters aren't worth encoding — the call-site overhead exceeds any
//! disguise value) and its module-source/import-attribute/non-computed-key
//! protections (`protected_keys.zig`, shared with duplicate_literals_removal
//! and string_splitting).
//!
//! `array_name` must be unique in the program; this transform does not check
//! for collisions with existing bindings (js-confuser's `me.getPlaceholder()`
//! is the real answer here — a later increment, not attempted yet).

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const transform = parser.traverser.transform;
const Action = parser.traverser.Action;
const ProtectedKeys = @import("protected_keys.zig").ProtectedKeys;
const embed_snippet = @import("embed_snippet.zig");
const base91 = @import("base91.zig");

// yuku's own `Span.none` is declared `pub const none = .{...}` with no type
// annotation, so it infers its own anonymous struct type rather than `Span`
// itself — Zig 0.16 does not coerce that to `Span` at a call site expecting
// one. An explicitly-typed local constant coerces fine; confirmed by
// building, not assumed.
const no_span: ast.Span = .{ .start = 0, .end = 0 };

const Span = struct { start: u32, len: u32 };

pub const Visitor = struct {
    allocator: std.mem.Allocator,
    array_name: []const u8,
    decoder_name: []const u8,
    /// basE91-encoded bytes for every kept string, concatenated in
    /// discovery order — this *is* the buffer the decoder function slices
    /// at runtime, built up here as encoding happens so the final
    /// `finishProgram` just needs to hand it to `tree.addString` once.
    buffer: std.ArrayList(u8) = .empty,
    /// Encoded-value -> already-embedded span, keyed by the *encoded*
    /// bytes (not the original string) since that's what's actually
    /// deduplicated in the buffer — two different original strings could
    /// coincidentally encode to the same bytes only if they *were* the
    /// same string to begin with (basE91 is a deterministic, lossless
    /// encoding here), so this is equivalent to deduping on the original
    /// value, just avoids decoding to check.
    spans: std.StringHashMapUnmanaged(Span) = .empty,
    protected: ProtectedKeys = .{},
    any_kept: bool = false,
    /// Set if a mutation failed. `exit_program` can't return `!void` — the
    /// walker's dispatcher calls exit hooks unwrapped (confirmed by
    /// building: `try`ing an `!Action` enter hook compiles, but the
    /// generated call site for `exit_*` hooks does not `try` their result at
    /// all) — so an allocation failure inside it is recorded here instead
    /// and checked by the caller after `traverse()` returns.
    err: ?std.mem.Allocator.Error = null,

    pub fn init(allocator: std.mem.Allocator, array_name: []const u8) !Visitor {
        const decoder_name = try std.fmt.allocPrint(allocator, "{s}_get", .{array_name});
        return .{ .allocator = allocator, .array_name = array_name, .decoder_name = decoder_name };
    }

    pub fn deinit(self: *Visitor) void {
        self.buffer.deinit(self.allocator);
        var it = self.spans.keyIterator();
        while (it.next()) |k| self.allocator.free(k.*);
        self.spans.deinit(self.allocator);
        self.protected.deinit(self.allocator);
        self.allocator.free(self.decoder_name);
    }

    // A non-computed object/class member key or an import/export module
    // source must stay a literal string syntactically -- see
    // protected_keys.zig for why. These four hook pairs just forward into
    // it; the actual guard is the `self.protected.contains(index)` check
    // at the top of `enter_string_literal` below.
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
        const original = ctx.tree.string(lit.value);
        // Matches the original's own minimum length: the call-site
        // overhead (`__obf_arr_get(N, M)` vs the bare literal) isn't worth
        // it below this, and it keeps single-character property-access
        // keys and the like out of the buffer entirely.
        if (original.len < 3) return .proceed;

        const encoded = try base91.encode(self.allocator, base91_table, original);
        defer self.allocator.free(encoded);

        const span = blk: {
            if (self.spans.get(encoded)) |existing| break :blk existing;
            const start: u32 = @intCast(self.buffer.items.len);
            try self.buffer.appendSlice(self.allocator, encoded);
            const new_span = Span{ .start = start, .len = @intCast(encoded.len) };
            const owned_key = try self.allocator.dupe(u8, encoded);
            try self.spans.put(self.allocator, owned_key, new_span);
            break :blk new_span;
        };
        self.any_kept = true;

        var buf: [10]u8 = undefined;
        var buf2: [10]u8 = undefined;
        const start_text = std.fmt.bufPrint(&buf, "{d}", .{span.start}) catch unreachable;
        const len_text = std.fmt.bufPrint(&buf2, "{d}", .{span.len}) catch unreachable;

        const callee = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString(self.decoder_name) } },
            no_span,
        );
        const start_arg = try ctx.tree.addNode(
            .{ .numeric_literal = .{ .kind = .decimal, .raw = try ctx.tree.addString(start_text) } },
            no_span,
        );
        const len_arg = try ctx.tree.addNode(
            .{ .numeric_literal = .{ .kind = .decimal, .raw = try ctx.tree.addString(len_text) } },
            no_span,
        );
        const call = try ctx.tree.addNode(.{ .call_expression = .{
            .callee = callee,
            .type_arguments = .null,
            .arguments = try ctx.tree.addExtra(&.{ start_arg, len_arg }),
            .optional = false,
        } }, no_span);

        // Replacing `index`'s own data (rather than returning a new node) is
        // what makes every existing reference to this string literal — its
        // parent's child slot — resolve to the replacement automatically.
        ctx.tree.setData(index, ctx.tree.data(call));

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
        if (!self.any_kept) return;

        const buffer_binding = try ctx.tree.addNode(
            .{ .binding_identifier = .{ .name = try ctx.tree.addString(self.array_name) } },
            no_span,
        );
        const buffer_lit = try ctx.tree.addNode(
            .{ .string_literal = .{ .value = try ctx.tree.addString(self.buffer.items) } },
            no_span,
        );
        const buffer_decl = try ctx.tree.addNode(.{ .variable_declaration = .{
            .kind = .@"var",
            .declarators = try ctx.tree.addExtra(&.{try ctx.tree.addNode(
                .{ .variable_declarator = .{ .id = buffer_binding, .init = buffer_lit } },
                no_span,
            )}),
            .declare = false,
        } }, no_span);

        const decoder_source = try std.fmt.allocPrint(self.allocator,
            \\function {[decoder_fn]s}(start, length) {{
            \\  var table = '{[table]s}';
            \\  var raw = {[buf]s}.slice(start, start + length);
            \\  var len = raw.length;
            \\  var ret = [];
            \\  var b = 0;
            \\  var n = 0;
            \\  var v = -1;
            \\  for (var i = 0; i < len; i++) {{
            \\    var p = table.indexOf(raw[i]);
            \\    if (p === -1) continue;
            \\    if (v < 0) {{
            \\      v = p;
            \\    }} else {{
            \\      v += p * 91;
            \\      b |= v << n;
            \\      n += (v & 8191) > 88 ? 13 : 14;
            \\      do {{
            \\        ret.push(b & 0xff);
            \\        b >>= 8;
            \\        n -= 8;
            \\      }} while (n > 7);
            \\      v = -1;
            \\    }}
            \\  }}
            \\  if (v > -1) {{
            \\    ret.push((b | (v << n)) & 0xff);
            \\  }}
            \\  return new TextDecoder().decode(new Uint8Array(ret));
            \\}}
        , .{ .decoder_fn = self.decoder_name, .table = base91_table, .buf = self.array_name });
        defer self.allocator.free(decoder_source);
        const decoder_body = try embed_snippet.embedProgram(self.allocator, ctx.tree, decoder_source);
        std.debug.assert(decoder_body.len == 1);
        const decoder_fn = ctx.tree.extra(decoder_body)[0];

        const original_body = ctx.tree.extra(prog.body);
        var new_body: std.ArrayList(ast.NodeIndex) = .empty;
        defer new_body.deinit(self.allocator);
        try new_body.ensureTotalCapacityPrecise(self.allocator, original_body.len + 2);
        new_body.appendAssumeCapacity(buffer_decl);
        new_body.appendAssumeCapacity(decoder_fn);
        new_body.appendSliceAssumeCapacity(original_body);

        ctx.tree.setData(index, .{ .program = .{
            .source_type = prog.source_type,
            .body = try ctx.tree.addExtra(new_body.items),
            .hashbang = prog.hashbang,
        } });
    }
};

/// js-confuser's own default table, `createDefaultStringEncoding` in
/// `string/encoding.ts` — that one shuffles it per obfuscation run; this
/// keeps it fixed, matching every other transform's determinism here
/// (see e.g. dead_code.zig's template selection for the same choice, made
/// for the same reason).
const base91_table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~\"";

test "extracts strings into a basE91-encoded buffer and runs identically" {
    const allocator = std.testing.allocator;

    var tree = try parser.parse(allocator, "const a = \"hello\"; const b = \"world\"; console.log(a, b);", .{});
    defer tree.deinit();

    var visitor = try Visitor.init(allocator, "__obf_arr");
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_arr") != null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "\"hello\"") == null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "\"world\"") == null);

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

    try std.testing.expectEqualStrings("hello world\n", run.stdout);
}

test "deduplicates identical strings to the same buffer span" {
    const allocator = std.testing.allocator;

    var tree = try parser.parse(allocator, "console.log(\"repeat-me\", \"repeat-me\", \"repeat-me\");", .{});
    defer tree.deinit();

    var visitor = try Visitor.init(allocator, "__obf_arr");
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    // One encoded copy in the buffer, not three -- proves the span map
    // actually dedupes rather than appending on every occurrence.
    const encoded = try base91.encode(allocator, base91_table, "repeat-me");
    defer allocator.free(encoded);
    var occurrences: usize = 0;
    var search_from: usize = 0;
    while (std.mem.indexOfPos(u8, visitor.buffer.items, search_from, encoded)) |found| {
        occurrences += 1;
        search_from = found + 1;
    }
    try std.testing.expectEqual(@as(usize, 1), occurrences);

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

    try std.testing.expectEqualStrings("repeat-me repeat-me repeat-me\n", run.stdout);
}

test "leaves an import attribute's key and value alone, real code hit this" {
    const allocator = std.testing.allocator;
    // `with { type: "json" }` has no computed form for either side of the
    // colon -- rewriting "json" into a decoder call produces
    // `with { type: __obf_arr_get(0, 2) }`, a syntax error. This exact
    // shape (`import results from "$tests/bench_results.json" with {
    // type: "json" }`) was real code in this repo's former benchmarks route,
    // found by comparing this transform's output against real
    // js-confuser running on all of src/.
    var tree = try parser.parse(
        allocator,
        "import results from \"./x.json\" with { type: \"json\" }; console.log(\"a-longer-json-string\", results);",
        .{},
    );
    defer tree.deinit();

    var visitor = try Visitor.init(allocator, "__obf_arr");
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "type: \"json\"") != null);
    // The *other*, unprotected, longer string still gets pulled into the
    // buffer -- proves the guard is scoped to the attribute, not a
    // blanket skip.
    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_arr_get") != null);
}
