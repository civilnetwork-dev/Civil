//! Cross-source script bindings are excluded from host-global hiding.

const std = @import("std");
const parser = @import("parser");
const declarations = @import("declarations.zig");
const ast = parser.ast;
const A = std.mem.Allocator;
pub const Error = A.Error || error{AnalysisFailed};
const Node = struct {
    source: usize,
    index: ast.NodeIndex,
};
const FreeReference = struct {
    name: []const u8,
    node: Node,
};

pub const Snapshot = struct {
    arena: std.heap.ArenaAllocator,
    references: std.AutoHashMapUnmanaged(Node, void) = .empty,

    pub fn deinit(self: *Snapshot) void {
        self.arena.deinit();
    }

    pub fn isScriptGlobalReference(self: *const Snapshot, source: usize, node: ast.NodeIndex) bool {
        return self.references.contains(.{ .source = source, .index = node });
    }

    pub fn capture(allocator: A, trees: []ast.Tree, module_flags: []const bool) Error!Snapshot {
        std.debug.assert(trees.len == module_flags.len);
        var self = Snapshot{ .arena = std.heap.ArenaAllocator.init(allocator) };
        errdefer self.deinit();
        const owned = self.arena.allocator();
        var globals: std.StringHashMapUnmanaged(void) = .empty;
        var free: std.ArrayList(FreeReference) = .empty;
        for (trees, module_flags, 0..) |*tree, module, source| {
            if (tree.hasErrors()) return error.AnalysisFailed;
            const semantic = try parser.semantic.analyze(tree);
            if (tree.hasErrors()) return error.AnalysisFailed;
            if (!module) for (semantic.symbols, 0..) |symbol, ordinal| {
                if (semantic.scope(symbol.scope).kind != .global or !symbol.flags.inValueSpace()) continue;
                const id: parser.traverser.semantic.SymbolId = @fromBackingInt(@intCast(ordinal));
                if (semantic.decls(id).len == 0) continue;
                try globals.put(owned, try owned.dupe(u8, tree.string(symbol.name)), {});
                for (semantic.decls(id)) |node| try self.references.put(owned, .{ .source = source, .index = node }, {});
                for (semantic.uses(id)) |reference| try self.references.put(owned, .{ .source = source, .index = semantic.reference(reference).node }, {});
            };
            for (semantic.references) |reference| {
                if (declarations.isIgnoredNamedExport(tree, semantic, reference.node)) continue;
                var unresolved = reference.symbol == .none;
                if (!unresolved) {
                    const bindings = semantic.decls(reference.symbol);
                    unresolved = bindings.len != 0 and declarations.isIgnoredNamedExport(tree, semantic, bindings[0]);
                }
                if (unresolved) try free.append(
                    owned,
                    .{
                        .name = try owned.dupe(u8, tree.string(reference.name)),
                        .node = .{ .source = source, .index = reference.node },
                    },
                );
            }
        }
        for (free.items) |reference| if (globals.contains(reference.name)) try self.references.put(owned, reference.node, {});
        return self;
    }
};

test "cross-source global filter includes forward script bindings and module captures" {
    const allocator = std.testing.allocator;
    const sources = [_][]const u8{
        "console.log(shared,Math);",
        "var shared=3;function f(shared){return shared;}",
        "export const local=7;console.log(shared,local);",
    };
    var trees: [sources.len]ast.Tree = undefined;
    const flags = [_]bool{ false, false, true };
    var initialized: usize = 0;
    defer for (trees[0..initialized]) |*tree| tree.deinit();
    for (sources, &trees, flags) |source, *tree, module| {
        tree.* = try parser.parse(allocator, source, .{ .source_type = if (module) .module else .script });
        initialized += 1;
    }
    var snapshot = try Snapshot.capture(allocator, &trees, &flags);
    defer snapshot.deinit();
    var seen: usize = 0;
    for (&trees, 0..) |*tree, source| for (0..tree.nodes.len) |i| {
        const index: ast.NodeIndex = @fromBackingInt(@intCast(i));
        if (tree.data(index) != .identifier_reference) continue;
        const name = tree.string(tree.data(index).identifier_reference.name);
        if (source == 1) continue;
        const expected = std.mem.eql(u8, name, "shared");
        try std.testing.expectEqual(expected, snapshot.isScriptGlobalReference(source, index));
        if (expected) seen += 1;
    };
    try std.testing.expectEqual(@as(usize, 2), seen);
}
