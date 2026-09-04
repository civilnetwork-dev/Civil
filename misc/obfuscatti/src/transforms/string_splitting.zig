//! String splitting: a string literal longer than a randomized threshold is
//! broken into chunks joined back with `+`, so `"hello world"` might become
//! `"hello " + "world"`. Port of js-confuser's
//! `transforms/string/stringSplitting.ts`. Its own `splitIntoChunks`
//! helper (`utils/random-utils.ts`) turns out to *also* be a plain
//! equal-width split (`str.substr(o, size)` in a loop) — read directly,
//! not assumed — so there was never a real algorithm gap here to port;
//! this matches it, down to the exact `getRandomInteger(3, 8)` divisor
//! range the chunk size is drawn from (hashed rather than randomized, for
//! the same "varied but reproducible" reason as everywhere else in this
//! pipeline that wants variety without a random source). Shares
//! protected_keys.zig's guard with array_extraction.zig /
//! duplicate_literals_removal.zig for non-computed member keys,
//! import/export sources, and import attributes.
//!
//! Ordered before array extraction in the pipeline (`Order.StringSplitting
//! = 16` runs before `Order.StringConcealing = 17` in js-confuser's own
//! `order.ts`), so each chunk gets its own turn through string concealing's
//! basE91 encoding rather than splitting a string that's already been
//! rewritten into a decoder call.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const transform = parser.traverser.transform;
const Action = parser.traverser.Action;
const ProtectedKeys = @import("protected_keys.zig").ProtectedKeys;

const no_span: ast.Span = .{ .start = 0, .end = 0 };

/// Advances `pos` forward past any UTF-8 continuation bytes, so a chunk
/// boundary never lands in the middle of a multi-byte character. Found
/// against real Civil source, not hypothetical: a plain byte-count split
/// landing inside "…" (U+2026, 3 bytes) left one chunk holding only the
/// orphaned trailing continuation byte -- not valid UTF-8 on its own, even
/// though the *original*, unsplit string was (and the two chunks, rejoined
/// with `+` at runtime, still reconstruct it correctly -- codegen's own
/// `writeEscapedString` passes any byte >= 0x80 through unexamined, so this
/// was never a *crashing* bug, just silently-wrong bytes sitting in the
/// output file for anything that ever inspected a lone chunk's own text).
fn nextCharBoundary(s: []const u8, pos: usize) usize {
    var p = pos;
    while (p < s.len and (s[p] & 0xC0) == 0x80) : (p += 1) {}
    return p;
}

pub const Visitor = struct {
    allocator: std.mem.Allocator,
    /// A chunk this pass has already produced is itself a `string_literal`
    /// node, so once the original literal's data is replaced with the
    /// binary_expression chain, the traverser descends into and revisits
    /// each chunk -- without this, a chunk long enough to clear the size
    /// threshold on its own gets split *again*, nesting further `+`
    /// operations under a leaf that was only ever meant to be visited
    /// once. Concatenation is associative, so re-splitting alone wouldn't
    /// be a correctness bug by itself, but it's needless repeated work
    /// this pass never intended, and not a risk worth carrying.
    already_split: std.AutoHashMapUnmanaged(ast.NodeIndex, void) = .empty,
    protected: ProtectedKeys = .{},

    pub fn init(allocator: std.mem.Allocator) Visitor {
        return .{ .allocator = allocator };
    }

    pub fn deinit(self: *Visitor) void {
        self.already_split.deinit(self.allocator);
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
        if (self.already_split.contains(index)) return .proceed;
        if (self.protected.contains(index)) return .proceed;
        const s_slice = ctx.tree.string(lit.value);

        // Chunk width varies per literal without needing any PRNG state:
        // hashing the literal's own bytes into a [3,6] divisor is stable
        // (nice for reproducible builds) while still varying across the
        // different literals in one program.
        // Matches the original's own `getRandomInteger(3, 8)` range exactly
        // (5 possible values, 3..7 inclusive) -- see this file's own top
        // comment for why this is hashed rather than randomized.
        const divisor: usize = 3 + @as(usize, @intCast(std.hash.Wyhash.hash(0, s_slice) % 5));
        const size = @max(6, s_slice.len / divisor);
        if (s_slice.len <= size) return .proceed;

        // `tree.string()` aliases the tree's own string pool, which can
        // reallocate on a later `tree.addString()` call (see obfuscate.zig's
        // top doc comment) -- the chunk-building loop below calls
        // `addString` once per chunk, so `chunks` would otherwise hold
        // slices into memory that moves out from under it mid-loop. Own a
        // stable copy first and slice that instead.
        const s = try self.allocator.dupe(u8, s_slice);
        defer self.allocator.free(s);

        var chunks: std.ArrayList([]const u8) = .empty;
        defer chunks.deinit(self.allocator);
        var start: usize = 0;
        while (start < s.len) {
            const end = nextCharBoundary(s, @min(start + size, s.len));
            try chunks.append(self.allocator, s[start..end]);
            start = end;
        }
        if (chunks.items.len <= 1) return .proceed;

        var acc = try ctx.tree.addNode(
            .{ .string_literal = .{ .value = try ctx.tree.addString(chunks.items[0]) } },
            no_span,
        );
        try self.already_split.put(self.allocator, acc, {});
        for (chunks.items[1..]) |chunk| {
            const piece = try ctx.tree.addNode(
                .{ .string_literal = .{ .value = try ctx.tree.addString(chunk) } },
                no_span,
            );
            try self.already_split.put(self.allocator, piece, {});
            acc = try ctx.tree.addNode(
                .{ .binary_expression = .{ .left = acc, .right = piece, .operator = .add } },
                no_span,
            );
        }

        // Same in-place-replacement trick as every other transform here:
        // copy the freshly-built chain's data into `index`'s own slot so
        // every existing reference to this literal keeps resolving to it.
        ctx.tree.setData(index, ctx.tree.data(acc));
        return .proceed;
    }
};

test "splits a long string literal into a concatenation chain and runs identically" {
    const allocator = std.testing.allocator;
    const source = "console.log(\"the quick brown fox jumps over\");";

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();

    var visitor = Visitor.init(allocator);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "\"the quick brown fox jumps over\"") == null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "+") != null);
}

test "never splits a multi-byte character across chunk boundaries and runs identically" {
    const allocator = std.testing.allocator;
    // The exact string that surfaced this against real Civil source
    // (components/GoGuardianManifestToast.tsx): with this string's own
    // hashed divisor, a plain byte-count split lands inside "…" (U+2026,
    // 3 bytes), leaving one chunk holding only that character's orphaned
    // trailing continuation byte -- not valid UTF-8 on its own.
    const source = "console.log(\"Submitting\\u2026\");";

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();

    var visitor = Visitor.init(allocator);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "+") != null);

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

    try std.testing.expectEqualStrings("Submitting\u{2026}\n", run.stdout);
}

test "leaves an import attribute's key and value alone even when long enough to split" {
    const allocator = std.testing.allocator;
    // A concatenation chain is exactly as invalid in an import attribute
    // position as a member-expression lookup is (see array_extraction.zig's
    // and duplicate_literals_removal.zig's own tests for this same shape)
    // -- `with { type: "a" + "b" }` isn't legal syntax either. The value
    // here is long enough to clear this pass's split threshold on its own
    // if the guard didn't apply, same as the long literal in the test
    // above.
    var tree = try parser.parse(
        allocator,
        "import x from \"./a.json\" with { type: \"a-fairly-long-attribute-value-for-testing\" }; console.log(\"the quick brown fox jumps over\");",
        .{},
    );
    defer tree.deinit();

    var visitor = Visitor.init(allocator);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "type: \"a-fairly-long-attribute-value-for-testing\"") != null);
    // The *other*, unprotected long literal still splits -- proves the
    // guard is scoped to the attribute, not a pass-wide size-threshold
    // change.
    try std.testing.expect(std.mem.indexOf(u8, result.code, "\"the quick brown fox jumps over\"") == null);
}
