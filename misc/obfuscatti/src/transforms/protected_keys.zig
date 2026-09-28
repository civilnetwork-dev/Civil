//! Tracks string_literal node indices that must never be treated as a
//! plain, replaceable expression by array_extraction.zig,
//! duplicate_literals_removal.zig, or string_splitting.zig — a
//! non-computed object/class member key (`{ "content-type": x }`,
//! `get "x"() {}`), an import/export module source
//! (`import x from "./y.js"`), or an import attribute's key/value
//! (`with { type: "json" }`). All three positions syntactically require a
//! static string literal: rewriting a non-computed key into a
//! member-expression or concatenation produces invalid JS (a bare key
//! position can't hold an expression, only a *computed* one can — see
//! flatten.zig's own doc comment for the getter/setter/method version of
//! this same fact), rewriting a module source breaks module resolution
//! outright, and an import attribute has no computed form to fall back
//! on at all — `with { [x]: "json" }` isn't legal syntax for *either*
//! side of the colon, unlike an object property key, so `markAttribute`
//! marks both unconditionally, with no `computed` parameter to check.
//!
//! A shared, mix-in-style tracker rather than four copies of the same
//! enter-hook logic: each of the three transforms calls
//! `markKey`/`markSource`/`markAttribute` from its own
//! `enter_object_property` / `enter_method_definition` /
//! `enter_property_definition` / `enter_import_declaration` /
//! `enter_export_named_declaration` / `enter_export_all_declaration` /
//! `enter_import_attribute` hooks, and checks `contains(index)` before
//! touching a string_literal. Found the hard way: a real MIME-type lookup
//! table (`{"content-type": [...]}`-shaped code, an extremely common
//! pattern) came out as `{j[12]+j[13]:[...]}`, a syntax error, before
//! this existed — and a real `import results from "./x.json" with {
//! type: "json" }` (this project's former benchmarks route) came out as
//! `with { type: b[8] }`, the same failure shape, before `markAttribute`
//! did.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;

pub const ProtectedKeys = struct {
    set: std.AutoHashMapUnmanaged(ast.NodeIndex, void) = .empty,

    pub fn deinit(self: *ProtectedKeys, allocator: std.mem.Allocator) void {
        self.set.deinit(allocator);
    }

    /// For `object_property`/`method_definition`/`property_definition`:
    /// only a *non-computed* key is a protected static position.
    pub fn markKey(self: *ProtectedKeys, allocator: std.mem.Allocator, key: ast.NodeIndex, computed: bool) !void {
        if (!computed) try self.set.put(allocator, key, {});
    }

    /// For an import/export `source` field: always protected when present
    /// (`.null` is a no-op — `set.put` on `.null` would be harmless
    /// anyway since `.null` never matches a real string_literal's index,
    /// but skip it for clarity).
    pub fn markSource(self: *ProtectedKeys, allocator: std.mem.Allocator, source: ast.NodeIndex) !void {
        if (source == .null) return;
        try self.set.put(allocator, source, {});
    }

    /// For an `import_attribute`'s `key`/`value` (`with { type: "json" }`):
    /// both always protected, unconditionally — unlike an object property
    /// key, there's no `computed` form to check, since neither side of an
    /// import attribute can ever be an expression.
    pub fn markAttribute(self: *ProtectedKeys, allocator: std.mem.Allocator, key: ast.NodeIndex, value: ast.NodeIndex) !void {
        try self.set.put(allocator, key, {});
        try self.set.put(allocator, value, {});
    }

    pub fn contains(self: *const ProtectedKeys, node: ast.NodeIndex) bool {
        return self.set.contains(node);
    }
};
