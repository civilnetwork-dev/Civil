//! Rename variables: every renameable binding in the whole program — user
//! code and every other transform's own helper names alike (`__obf_arr`,
//! `__obf_calc`, ...) — gets a short, minifier-style name (`a`, `b`, ...,
//! `z`, `aa`, ...), so nothing in the final output *looks* like it came out
//! of an obfuscator. Port of js-confuser's
//! `transforms/identifier/renameVariables.ts`.
//!
//! Not a `Visitor`/traverser like the other transforms: js-confuser's own
//! version manually rebuilds a scope tree (`definedMap`/`referencedMap`/
//! per-scope name-reuse bookkeeping) because Babel doesn't hand it exactly
//! this shape. yuku's `Semantic` model already has it — `Semantic.symbols`
//! lists every binding directly, and `decls`/`uses` give every site to
//! rename — so this is a plain pass over that list, no tree walk needed.
//!
//! Deliberately skips the original's "reuse a name from a sibling scope
//! that's out of range" optimization: that only shrinks output size, and
//! giving every renamed symbol in the *entire program* a name unique
//! program-wide (checked against every existing name, not just what's
//! locally visible) sidesteps the actual hard part — proving a reused name
//! can't collide with something a paired-down per-scope check would miss —
//! for a minification win yuku's own `codegen.Options.minify` mostly
//! covers anyway.
//!
//! Run this over a *fresh* `Semantic` snapshot taken after every other
//! transform, not the pre-mutation one the other semantic-consuming
//! transforms share (see obfuscate.zig's pipeline comment) — it's the one
//! pass that specifically wants to see every synthetic declaration those
//! other transforms already introduced, so they get hidden too instead of
//! being the only remaining readable names in the output.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const Semantic = parser.semantic.Semantic;
const Symbol = parser.traverser.semantic.Symbol;

const reserved_words = [_][]const u8{
    "break",  "case",     "catch",      "class",      "const",     "continue",
    "debugger", "default", "delete",    "do",         "else",      "export",
    "extends", "finally",  "for",       "function",   "if",        "import",
    "in",     "instanceof", "new",      "return",     "super",     "switch",
    "this",   "throw",    "try",        "typeof",     "var",       "void",
    "while",  "with",     "yield",      "let",        "static",    "enum",
    "await",  "implements", "package",  "protected",  "interface", "private",
    "public", "null",     "true",       "false",      "arguments", "eval",
    "as",     "of",       "get",        "set",        "async",     "from",
};

fn isReserved(name: []const u8) bool {
    for (reserved_words) |w| {
        if (std.mem.eql(u8, name, w)) return true;
    }
    return false;
}

/// The Nth name in minifier order: 0="a", 1="b", ..., 25="z", 26="aa", ...
fn nthName(allocator: std.mem.Allocator, n: u32) ![]u8 {
    var digits: [8]u8 = undefined;
    var count: usize = 0;
    var x = n;
    while (true) {
        digits[count] = @intCast('a' + (x % 26));
        count += 1;
        if (x < 26) break;
        x = x / 26 - 1;
    }
    const buf = try allocator.alloc(u8, count);
    for (0..count) |i| buf[i] = digits[count - 1 - i];
    return buf;
}

fn shouldRename(sym: Symbol) bool {
    if (sym.flags.exported) return false;
    if (sym.flags.import or sym.flags.type_import) return false;
    if (!sym.flags.inValueSpace()) return false;
    return true;
}

fn renameNode(tree: *ast.Tree, node: ast.NodeIndex, new_name: ast.String) void {
    switch (tree.data(node)) {
        .binding_identifier => tree.setData(node, .{ .binding_identifier = .{ .name = new_name } }),
        .identifier_reference => tree.setData(node, .{ .identifier_reference = .{ .name = new_name } }),
        else => {},
    }
}

pub fn apply(allocator: std.mem.Allocator, tree: *ast.Tree, semantic: Semantic) !void {
    // Every name already in the program is off-limits for a *generated*
    // name -- simplest way to guarantee a new short name can never
    // introduce accidental shadowing over some other, un-renamed binding
    // (an export, say) that a stray reference elsewhere still resolves to
    // by lexical scoping. `tree.string()` aliases the tree's own string
    // pool (see obfuscate.zig's top doc comment) -- this set is consulted
    // across many later `tree.addString()` calls, so every entry needs its
    // own copy.
    var avoid: std.StringHashMapUnmanaged(void) = .empty;
    defer {
        var it = avoid.keyIterator();
        while (it.next()) |k| allocator.free(k.*);
        avoid.deinit(allocator);
    }
    for (semantic.symbols) |sym| {
        const owned = try allocator.dupe(u8, tree.string(sym.name));
        const gop = try avoid.getOrPut(allocator, owned);
        if (gop.found_existing) allocator.free(owned);
    }

    var counter: u32 = 0;
    for (semantic.symbols, 0..) |sym, i| {
        if (!shouldRename(sym)) continue;
        const sym_id: parser.traverser.semantic.SymbolId = @enumFromInt(i);

        var candidate: []u8 = undefined;
        while (true) {
            candidate = try nthName(allocator, counter);
            counter += 1;
            if (!isReserved(candidate) and !avoid.contains(candidate)) break;
            allocator.free(candidate);
        }
        defer allocator.free(candidate);

        const new_name = try tree.addString(candidate);
        for (semantic.decls(sym_id)) |decl_node| renameNode(tree, decl_node, new_name);
        for (semantic.uses(sym_id)) |ref_id| renameNode(tree, semantic.reference(ref_id).node, new_name);
    }
}

test "renames a variable and its function name consistently, program-wide" {
    const allocator = std.testing.allocator;
    const source =
        \\function add(x, y) {
        \\  var total = x + y;
        \\  return total;
        \\}
        \\console.log(add(2, 3));
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    const semantic = try parser.semantic.analyze(&tree);

    try apply(allocator, &tree, semantic);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "add") == null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "total") == null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "console") != null); // a true global, untouched

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

    try std.testing.expectEqualStrings("5\n", run.stdout);
}
