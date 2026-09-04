//! String encoding: every string literal's characters are rewritten as
//! `\xHH`/`\uHHHH` escapes (per UTF-16 code unit -- `\x` only when the unit
//! fits in one byte, `\u` otherwise, including both halves of a surrogate
//! pair), and every non-computed identifier-name member/property/method
//! key becomes an equivalent computed string literal first, so its name
//! gets the same treatment -- `console.log` becomes
//! `console["\u006c\u006f\u0067"]`. Port of js-confuser's `stringEncoding`
//! option.
//!
//! Confirmed against the real, installed package (`bun add js-confuser` in
//! the comparison scratchpad, then a one-off script with only
//! `stringEncoding: true` set), not assumed: neither `order.ts` nor its own
//! `Order` enum has an entry for this one -- it isn't a standalone Plugin
//! the way every *other* ported transform here is -- and the codegen-level
//! `jsescOption.escapeEverything` hook that would otherwise explain it is
//! dead, commented-out code in the version installed here. So its real
//! mechanism had to be reverse-engineered from actual output, not read off
//! a Plugin file the way every other port in this directory was.
//!
//! Two pieces, run at very different points:
//!
//! - `KeyifyVisitor`, an ordinary AST pass, placed right before
//!   rename_variables at the very end of the pipeline (after
//!   array_extraction/string_splitting/duplicate_literals_removal
//!   deliberately -- running keyify earlier would just hand those
//!   transforms a fresh batch of ordinary string literals to extract or
//!   split instead of leaving them for the encoding pass below to reach,
//!   which isn't wrong exactly but isn't the point here). Two real
//!   semantic traps excluded, not style choices:
//!   - `constructor` as a class method's own key: a *computed* key named
//!     "constructor" is just a regular method, not the special
//!     constructor -- the class silently loses its real one.
//!   - `__proto__` as a plain (non-method, non-computed) object-literal
//!     property: `{__proto__: x}`/shorthand `{__proto__}` sets the
//!     prototype; the same name in computed form, `{["__proto__"]: x}`,
//!     creates an ordinary own property instead -- different runtime
//!     behavior. A `__proto__` *member-expression access* (`obj.__proto__`)
//!     has no such trap -- reading/writing through the prototype chain is
//!     identical either way -- so only the object-literal-key position
//!     needs the guard.
//!
//! - `encodeStrings`, a post-*codegen* pass over the final generated text,
//!   not the tree -- the only way to actually produce `\xHH`/`\uHHHH`
//!   output. Confirmed by reading `codegen/printer.zig`'s
//!   `emit_string_literal` directly: `StringLiteral.raw` is read only to
//!   pick a quote character, the actual escaping is always re-derived from
//!   `.value` with no per-node override, so there's no way to ask codegen
//!   itself to emit a custom escaped form. Re-parses the already-generated
//!   text (real spans this time, unlike the `no_span` placeholders every
//!   transform above uses) and splices an encoded replacement over every
//!   `string_literal` node's own span. Catches every string in the final
//!   output uniformly, including ones no earlier transform in this
//!   pipeline created directly -- array_extraction's own basE91 buffer,
//!   global_concealing's per-global keys, opaque_predicates' fake
//!   `"unreachable"` return value -- matching real js-confuser's own
//!   observed behavior (it doesn't distinguish "was this string in the
//!   original source" either; confirmed by testing a class method, an
//!   object key, and a re-encoded `console.log` all in one pass).
//!
//!   One exclusion: a *directive prologue* string (`"use strict"` and
//!   friends) is left alone -- yuku's own parser already tags a genuine
//!   directive as `.directive`, distinct from an ordinary
//!   `.expression_statement` that just happens to hold a bare string, so
//!   this trusts that judgment rather than re-deriving the "leading run of
//!   bare string-literal statements" rule by hand (an earlier version of
//!   this file tried exactly that and missed every real directive, since
//!   none of them are ever tagged `.expression_statement` to begin with).
//!   Real ECMAScript rule behind the exclusion itself, not a guess: a
//!   directive containing any escape sequence is no longer recognized as a
//!   directive at all, just an ordinary, inert expression statement -- so
//!   encoding "use strict" would silently turn strict mode off for
//!   whatever's scoped under it.
//!
//!   Template literals aren't touched. Real js-confuser converts one into
//!   a `+`-concatenation of its static parts before encoding those
//!   (confirmed against real output too) -- a genuinely structural rewrite
//!   of its own, not just an encoding-style choice like everything else
//!   here. Left as a documented gap, same bar as controlFlowFlattening.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const transform = parser.traverser.transform;
const basic = parser.traverser.basic;
const Action = parser.traverser.Action;

const no_span: ast.Span = .{ .start = 0, .end = 0 };

pub const KeyifyVisitor = struct {
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator) KeyifyVisitor {
        return .{ .allocator = allocator };
    }

    pub fn deinit(self: *KeyifyVisitor) void {
        _ = self;
    }

    /// `null` when `key` isn't a plain identifier-name key -- a string or
    /// numeric key is already exactly what this is trying to produce, and
    /// a private-name key (class members only) has no computed form to
    /// convert to at all.
    fn keyify(self: *KeyifyVisitor, ctx: *transform.Ctx, key: ast.NodeIndex) !?ast.NodeIndex {
        const name = switch (ctx.tree.data(key)) {
            .identifier_name => |n| ctx.tree.string(n.name),
            else => return null,
        };
        // `tree.string()` -- see obfuscate.zig's own top comment -- is
        // only valid until the very next `addString()`, which `addNode`
        // below reaches by way of the tree's shared pool.
        const owned = try self.allocator.dupe(u8, name);
        defer self.allocator.free(owned);
        return try ctx.tree.addNode(
            .{ .string_literal = .{ .value = try ctx.tree.addString(owned) } },
            no_span,
        );
    }

    pub fn enter_member_expression(
        self: *KeyifyVisitor,
        expr: ast.MemberExpression,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        if (expr.computed) return .proceed;
        var new_expr = expr;
        new_expr.property = try self.keyify(ctx, expr.property) orelse return .proceed;
        new_expr.computed = true;
        ctx.tree.setData(index, .{ .member_expression = new_expr });
        return .proceed;
    }

    pub fn enter_method_definition(
        self: *KeyifyVisitor,
        def: ast.MethodDefinition,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        if (def.computed or def.kind == .constructor) return .proceed;
        var new_def = def;
        new_def.key = try self.keyify(ctx, def.key) orelse return .proceed;
        new_def.computed = true;
        ctx.tree.setData(index, .{ .method_definition = new_def });
        return .proceed;
    }

    pub fn enter_property_definition(
        self: *KeyifyVisitor,
        def: ast.PropertyDefinition,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        if (def.computed) return .proceed;
        var new_def = def;
        new_def.key = try self.keyify(ctx, def.key) orelse return .proceed;
        new_def.computed = true;
        ctx.tree.setData(index, .{ .property_definition = new_def });
        return .proceed;
    }

    pub fn enter_object_property(
        self: *KeyifyVisitor,
        prop: ast.ObjectProperty,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        if (prop.computed) return .proceed;
        const name = switch (ctx.tree.data(prop.key)) {
            .identifier_name => |n| ctx.tree.string(n.name),
            else => return .proceed,
        };
        if (!prop.method and prop.kind == .init and std.mem.eql(u8, name, "__proto__")) {
            return .proceed;
        }

        var new_prop = prop;
        if (prop.shorthand) {
            // `{foo}` means `{foo: foo}` -- there's no shorthand computed
            // form (`{[key]}` alone isn't valid syntax), so make the value
            // reference explicit before converting the key.
            const owned = try self.allocator.dupe(u8, name);
            defer self.allocator.free(owned);
            new_prop.value = try ctx.tree.addNode(
                .{ .identifier_reference = .{ .name = try ctx.tree.addString(owned) } },
                no_span,
            );
            new_prop.shorthand = false;
        }
        new_prop.key = try self.keyify(ctx, prop.key) orelse return .proceed;
        new_prop.computed = true;
        ctx.tree.setData(index, .{ .object_property = new_prop });
        return .proceed;
    }
};

fn hexDigit(n: u4) u8 {
    return "0123456789abcdef"[n];
}

/// Appends the `\xHH` or `\uHHHH` escape for one UTF-16 code unit.
fn appendEscapedUnit(allocator: std.mem.Allocator, out: *std.ArrayList(u8), unit: u16, use_x: bool) !void {
    if (unit <= 0xFF and use_x) {
        try out.appendSlice(allocator, &[_]u8{ '\\', 'x', hexDigit(@intCast(unit >> 4)), hexDigit(@intCast(unit & 0xF)) });
    } else {
        try out.appendSlice(allocator, &[_]u8{
            '\\',                                  'u',
            hexDigit(@intCast((unit >> 12) & 0xF)), hexDigit(@intCast((unit >> 8) & 0xF)),
            hexDigit(@intCast((unit >> 4) & 0xF)),  hexDigit(@intCast(unit & 0xF)),
        });
    }
}

/// Every UTF-16 code unit of `value` becomes `\xHH` (only possible when it
/// fits in one byte) or `\uHHHH`. Quote choice doesn't matter for safety
/// the way it does in ordinary codegen: every character in the result is
/// an escape sequence, so none of them can ever literally contain the
/// quote character being used -- always `"`, for simplicity. `seed` (the
/// re-parsed string literal's own node index) keeps the \x/\u choice
/// varied across different strings without a random source, same
/// reasoning as dead_code.zig / opaque_predicates.zig.
///
/// Decodes `value` by hand rather than via `std.unicode.utf8ToUtf16LeAlloc`
/// -- found the hard way, against real Civil source, not assumed: JS
/// strings are UTF-16 and can legally contain a *lone* surrogate (nothing
/// requires `"\ud800"` alone to pair with a low surrogate), so yuku's own
/// string pool is WTF-8, not strict UTF-8 -- confirmed by
/// `codegen/printer.zig` needing its own `loneSurrogateAt` special case for
/// exactly this. Strict decoding rejects a lone surrogate's 3-byte
/// sequence outright (`error.InvalidUtf8`, a real panic against real
/// output, not a hypothetical). `std.unicode.utf8Decode3AllowSurrogateHalf`
/// is the same tolerant decode yuku's own codegen relies on, already
/// public in Zig's own standard library.
fn encodeStringValue(allocator: std.mem.Allocator, value: []const u8, seed: u32) std.mem.Allocator.Error![]u8 {
    var out: std.ArrayList(u8) = .empty;
    errdefer out.deinit(allocator);
    try out.append(allocator, '"');

    var i: usize = 0;
    var unit_index: u32 = 0;
    while (i < value.len) {
        // Sequence lengths are structurally sound -- this is yuku's own
        // already-tokenized string content, not untrusted external bytes --
        // only the surrogate-range *value* rejection needed tolerating.
        // Genuinely relies on every other transform respecting character
        // boundaries, not just "shouldn't happen": string_splitting.zig
        // used to slice a string at a raw byte offset with no such
        // awareness, and against real Civil source (a "…" straddling a
        // chunk boundary) that left an orphaned continuation byte as its
        // own "string value" here -- a real crash, not a hypothetical one.
        // Fixed at the source (string_splitting.zig's own `nextCharBoundary`),
        // not papered over here.
        const len = std.unicode.utf8ByteSequenceLength(value[i]) catch unreachable;
        const cp: u21 = switch (len) {
            1 => value[i],
            2 => std.unicode.utf8Decode2(value[i..][0..2].*) catch unreachable,
            3 => std.unicode.utf8Decode3AllowSurrogateHalf(value[i..][0..3].*) catch unreachable,
            4 => std.unicode.utf8Decode4(value[i..][0..4].*) catch unreachable,
            else => unreachable,
        };
        i += len;

        const hash = std.hash.Wyhash.hash(seed, std.mem.asBytes(&unit_index));
        const use_x = hash % 2 == 0;
        if (cp > 0xFFFF) {
            // Astral codepoint -- never a lone surrogate (those are always
            // <= 0xFFFF by definition) -- split into a real surrogate pair.
            const adjusted = cp - 0x10000;
            const high: u16 = 0xD800 + @as(u16, @intCast(adjusted >> 10));
            const low: u16 = 0xDC00 + @as(u16, @intCast(adjusted & 0x3FF));
            try appendEscapedUnit(allocator, &out, high, use_x);
            try appendEscapedUnit(allocator, &out, low, use_x);
            unit_index += 2;
        } else {
            // Ordinary BMP codepoint or a lone surrogate passed straight
            // through -- both are already exactly one UTF-16 code unit.
            try appendEscapedUnit(allocator, &out, @intCast(cp), use_x);
            unit_index += 1;
        }
    }

    try out.append(allocator, '"');
    return out.toOwnedSlice(allocator);
}

const Replacement = struct { span: ast.Span, text: []const u8 };

const Collector = struct {
    allocator: std.mem.Allocator,
    tree: *const ast.Tree,
    replacements: *std.ArrayList(Replacement),
    protected: std.AutoHashMapUnmanaged(ast.NodeIndex, void) = .empty,

    /// yuku's own parser already tags a genuine directive-prologue entry
    /// as `.directive` (distinct from an ordinary `.expression_statement`
    /// that just happens to hold a bare string) -- confirmed by testing,
    /// not assumed: an earlier version of this file re-derived the "leading
    /// run of bare string-literal statements" rule by hand and missed this
    /// entirely, since a directive is never tagged `.expression_statement`
    /// to begin with. Trusting the parser's own judgment here instead of
    /// re-implementing the same spec rule a second, less reliable way.
    pub fn enter_directive(self: *Collector, d: ast.Directive, index: ast.NodeIndex, ctx: *basic.Ctx) !Action {
        _ = index;
        _ = ctx;
        try self.protected.put(self.allocator, d.expression, {});
        return .proceed;
    }

    pub fn enter_string_literal(
        self: *Collector,
        lit: ast.StringLiteral,
        index: ast.NodeIndex,
        ctx: *basic.Ctx,
    ) !Action {
        _ = ctx;
        if (self.protected.contains(index)) return .proceed;
        const value = self.tree.string(lit.value);
        const text = try encodeStringValue(self.allocator, value, @intFromEnum(index));
        errdefer self.allocator.free(text);
        try self.replacements.append(self.allocator, .{ .span = self.tree.span(index), .text = text });
        return .proceed;
    }
};

/// Runs after `codegen.generate` -- see this file's own top comment for
/// why this has to be a text pass rather than another tree transform.
/// Returns a fresh allocation the caller owns, same convention as
/// `codegen.generate`'s own result.
pub fn encodeStrings(allocator: std.mem.Allocator, source: []const u8) (std.mem.Allocator.Error || error{ParseFailed})![]u8 {
    var tree = parser.parse(allocator, source, .{}) catch return error.ParseFailed;
    defer tree.deinit();

    var replacements: std.ArrayList(Replacement) = .empty;
    defer {
        for (replacements.items) |r| allocator.free(r.text);
        replacements.deinit(allocator);
    }

    var collector = Collector{ .allocator = allocator, .tree = &tree, .replacements = &replacements };
    defer collector.protected.deinit(allocator);
    try basic.traverse(Collector, &tree, &collector);

    var out: std.ArrayList(u8) = .empty;
    errdefer out.deinit(allocator);
    var prev_end: u32 = 0;
    for (replacements.items) |r| {
        try out.appendSlice(allocator, source[prev_end..r.span.start]);
        try out.appendSlice(allocator, r.text);
        prev_end = r.span.end;
    }
    try out.appendSlice(allocator, source[prev_end..]);

    return out.toOwnedSlice(allocator);
}

test "converts a non-computed member access into an encoded computed one and runs identically" {
    const allocator = std.testing.allocator;
    const source = "console.log(\"hi\");";

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();

    var visitor = KeyifyVisitor.init(allocator);
    defer visitor.deinit();
    try transform.traverse(KeyifyVisitor, &tree, &visitor);

    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, generated.code, "console.log") == null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "console[\"log\"]") != null);

    const encoded = try encodeStrings(allocator, generated.code);
    defer allocator.free(encoded);

    try std.testing.expect(std.mem.indexOf(u8, encoded, "log") == null);
    try std.testing.expect(std.mem.indexOf(u8, encoded, "hi") == null);
    try std.testing.expect(std.mem.indexOf(u8, encoded, "\\x") != null or std.mem.indexOf(u8, encoded, "\\u") != null);

    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();

    var tmp_dir = std.testing.tmpDir(.{});
    defer tmp_dir.cleanup();
    {
        var file = try tmp_dir.dir.createFile(io, "out.js", .{});
        defer file.close(io);
        try file.writeStreamingAll(io, encoded);
    }
    const path = try tmp_dir.dir.realPathFileAlloc(io, "out.js", allocator);
    defer allocator.free(path);

    const run = try std.process.run(allocator, io, .{ .argv = &.{ "bun", path } });
    defer allocator.free(run.stdout);
    defer allocator.free(run.stderr);

    try std.testing.expectEqualStrings("hi\n", run.stdout);
}

test "expands a shorthand property and encodes an object/class/method key without breaking constructor" {
    const allocator = std.testing.allocator;
    const source =
        \\const greeting = "hi";
        \\const obj = { greeting };
        \\class Box {
        \\  constructor(value) {
        \\    this.value = value;
        \\  }
        \\  reveal() {
        \\    return this.value;
        \\  }
        \\}
        \\const b = new Box(42);
        \\console.log(obj.greeting, b.reveal());
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();

    var visitor = KeyifyVisitor.init(allocator);
    defer visitor.deinit();
    try transform.traverse(KeyifyVisitor, &tree, &visitor);

    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);

    // Constructor's own key stays a plain, non-computed "constructor".
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "constructor(value)") != null);
    // The ordinary method's key does not.
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "reveal()") == null);

    const encoded = try encodeStrings(allocator, generated.code);
    defer allocator.free(encoded);

    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();

    var tmp_dir = std.testing.tmpDir(.{});
    defer tmp_dir.cleanup();
    {
        var file = try tmp_dir.dir.createFile(io, "out.js", .{});
        defer file.close(io);
        try file.writeStreamingAll(io, encoded);
    }
    const path = try tmp_dir.dir.realPathFileAlloc(io, "out.js", allocator);
    defer allocator.free(path);

    const run = try std.process.run(allocator, io, .{ .argv = &.{ "bun", path } });
    defer allocator.free(run.stdout);
    defer allocator.free(run.stderr);

    try std.testing.expectEqualStrings("hi 42\n", run.stdout);
}

test "leaves __proto__ as an object-literal key alone but still encodes it as a member access" {
    const allocator = std.testing.allocator;
    const source =
        \\const proto = { greet() { return "hi from proto"; } };
        \\const obj = { __proto__: proto };
        \\console.log(obj.greet(), typeof obj.__proto__);
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();

    var visitor = KeyifyVisitor.init(allocator);
    defer visitor.deinit();
    try transform.traverse(KeyifyVisitor, &tree, &visitor);

    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);

    // Object-literal key: untouched (still sets the prototype).
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "{__proto__:") != null or
        std.mem.indexOf(u8, generated.code, "{ __proto__:") != null);
    // Member access to the same name: converted like any other property.
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "obj.__proto__") == null);

    const encoded = try encodeStrings(allocator, generated.code);
    defer allocator.free(encoded);

    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();

    var tmp_dir = std.testing.tmpDir(.{});
    defer tmp_dir.cleanup();
    {
        var file = try tmp_dir.dir.createFile(io, "out.js", .{});
        defer file.close(io);
        try file.writeStreamingAll(io, encoded);
    }
    const path = try tmp_dir.dir.realPathFileAlloc(io, "out.js", allocator);
    defer allocator.free(path);

    const run = try std.process.run(allocator, io, .{ .argv = &.{ "bun", path } });
    defer allocator.free(run.stdout);
    defer allocator.free(run.stderr);

    try std.testing.expectEqualStrings("hi from proto object\n", run.stdout);
}

test "leaves a directive prologue string alone so strict mode still applies" {
    const allocator = std.testing.allocator;
    const source =
        \\function f() {
        \\  "use strict";
        \\  undeclaredGlobal = 1;
        \\}
        \\try {
        \\  f();
        \\  console.log("no error");
        \\} catch (e) {
        \\  console.log(e.constructor.name);
        \\}
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();

    var visitor = KeyifyVisitor.init(allocator);
    defer visitor.deinit();
    try transform.traverse(KeyifyVisitor, &tree, &visitor);

    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);

    const encoded = try encodeStrings(allocator, generated.code);
    defer allocator.free(encoded);

    try std.testing.expect(std.mem.indexOf(u8, encoded, "\"use strict\"") != null);

    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();

    var tmp_dir = std.testing.tmpDir(.{});
    defer tmp_dir.cleanup();
    {
        var file = try tmp_dir.dir.createFile(io, "out.js", .{});
        defer file.close(io);
        try file.writeStreamingAll(io, encoded);
    }
    const path = try tmp_dir.dir.realPathFileAlloc(io, "out.js", allocator);
    defer allocator.free(path);

    const run = try std.process.run(allocator, io, .{ .argv = &.{ "bun", path } });
    defer allocator.free(run.stdout);
    defer allocator.free(run.stderr);

    // Strict mode still active -- the assignment to an undeclared global
    // throws a ReferenceError, proving "use strict" wasn't neutered by
    // encoding. Sloppy mode would have printed "no error" instead.
    try std.testing.expectEqualStrings("ReferenceError\n", run.stdout);
}

test "encodes a non-ASCII string via surrogate pairs and runs identically" {
    const allocator = std.testing.allocator;
    const source = "console.log(\"caf\\u00e9 \\u{1f600}\");";

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();

    var visitor = KeyifyVisitor.init(allocator);
    defer visitor.deinit();
    try transform.traverse(KeyifyVisitor, &tree, &visitor);

    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);

    const encoded = try encodeStrings(allocator, generated.code);
    defer allocator.free(encoded);

    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();

    var tmp_dir = std.testing.tmpDir(.{});
    defer tmp_dir.cleanup();
    {
        var file = try tmp_dir.dir.createFile(io, "out.js", .{});
        defer file.close(io);
        try file.writeStreamingAll(io, encoded);
    }
    const path = try tmp_dir.dir.realPathFileAlloc(io, "out.js", allocator);
    defer allocator.free(path);

    const run = try std.process.run(allocator, io, .{ .argv = &.{ "bun", path } });
    defer allocator.free(run.stdout);
    defer allocator.free(run.stderr);

    try std.testing.expectEqualStrings("caf\u{e9} \u{1f600}\n", run.stdout);
}
