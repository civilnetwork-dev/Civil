//! A JavaScript deobfuscator, in Zig, on the Yuku toolchain.
//!
//! ## Why this exists
//!
//! Every school filter vendor ships its extension minified, and several ship it
//! obfuscated on top of that. The `Filter-Sources` workflow diffs each new
//! release against the last one to see whether the vendor has started patching
//! something Civil relies on. A diff of obfuscated output is worthless: a single
//! upstream edit reshuffles the string table and every line changes. Running
//! both sides through the same normalising passes first is what makes the diff
//! mean something.
//!
//! ## What it does, and what it does not
//!
//! The passes are the ones that carry most of the readability in webcrack and
//! restringer, chosen because they are decidable from the syntax alone:
//!
//!   1. **String-array inlining.** The obfuscator.io family hoists every string
//!      literal into one array and replaces each use with `_0x4f2(0x1a3)`. The
//!      pass finds the array, finds the accessor and its index offset, and puts
//!      the strings back where they were used.
//!   2. **Computed-member normalisation.** `a["push"]` becomes `a.push`.
//!   3. **Constant folding.** Literal arithmetic and concatenation, `!0` / `!1`,
//!      `void 0`.
//!   4. **Dead-branch pruning.** `if (!0) x else y`, and the same for `?:`.
//!   5. **Sequence splitting.** `a(), b(), c();` becomes three statements.
//!
//! Passes 1–4 run to a fixed point, because inlining a string exposes folds and
//! folding exposes branches.
//!
//! ponytail: the accessor forms understood are the two canonical ones —
//! `return T[i - N]` and `i = i - N; return T[i]`. The rotation IIFE and the
//! RC4/base64 accessor variants need an evaluator, not a syntax pass; when one
//! is present the strings stay as calls and the rest of the passes still run.
//! Add an interpreter here if a vendor ships that variant.

const std = @import("std");
const parser = @import("parser");

const ast = parser.ast;
const codegen = parser.codegen;
const transform = parser.traverser.transform;

pub const Stats = struct {
    strings_inlined: u32 = 0,
    members_normalized: u32 = 0,
    expressions_folded: u32 = 0,
    branches_pruned: u32 = 0,
    sequences_split: u32 = 0,

    pub fn total(self: Stats) u32 {
        return self.strings_inlined + self.members_normalized +
            self.expressions_folded + self.branches_pruned + self.sequences_split;
    }
};

pub const Options = struct {
    /// `.commonjs` for extension background/content scripts, `.module` for ESM.
    source_type: ast.SourceType = .commonjs,
    /// Cap on fixed-point rounds. Each round is a full pass over the tree.
    max_rounds: u8 = 8,
};

pub const Output = struct {
    code: []const u8,
    stats: Stats,

    pub fn deinit(self: Output, gpa: std.mem.Allocator) void {
        gpa.free(self.code);
    }
};

pub const Error = error{ ParseFailed, OutOfMemory } || codegen.Error;

/// Parses `source`, runs the passes to a fixed point, and prints the result.
/// The returned code is owned by the caller.
pub fn deobfuscate(
    gpa: std.mem.Allocator,
    source: []const u8,
    options: Options,
) Error!Output {
    var tree = parser.parse(gpa, source, .{
        .source_type = options.source_type,
        .lang = .js,
        // Parens carry no information once the tree is reprinted, and keeping
        // them blocks folding through `(0x1 + 0x2)`.
        .preserve_parens = false,
        .comments = .flat,
    }) catch return error.ParseFailed;
    defer tree.deinit();

    if (tree.hasErrors()) return error.ParseFailed;

    var stats: Stats = .{};
    var round: u8 = 0;
    while (round < options.max_rounds) : (round += 1) {
        const before = stats.total();
        try inlineStringArrays(&tree, &stats);
        try foldAndPrune(&tree, &stats);
        if (stats.total() == before) break;
    }
    // Once, at the end: splitting changes statement lists, and nothing above
    // reads statement structure, so there is nothing to iterate for.
    try splitSequences(gpa, &tree, &stats);

    // Fixed quote style, not `.preserve`: the point of this tool is diffing two
    // versions of the same bundle, and quote style is exactly the kind of
    // cosmetic noise obfuscators reshuffle between releases for free. Folded
    // strings (see `quote()` below) always emit double quotes already: this
    // makes literals carried over unchanged match them instead of keeping
    // whatever the minifier originally picked.
    const result = try codegen.generate(gpa, &tree, .{
        .format = .pretty,
        .indent = 2,
        .quotes = .double,
    });
    gpa.free(result.errors);
    return .{ .code = result.code, .stats = stats };
}

// ---------------------------------------------------------------------------
// Pass 1 — string-array inlining
// ---------------------------------------------------------------------------

const StringArray = struct {
    name: ast.String,
    elements: ast.IndexRange,
};

const Accessor = struct {
    name: ast.String,
    array: usize,
    offset: i64,
};

/// How many string tables and accessors one file may declare before the pass
/// gives up on the rest. Real obfuscated bundles use one of each; a handful of
/// concatenated bundles use one per bundle.
const max_tables = 16;

/// Stand-in for the `std.BoundedArray` that this Zig snapshot removed. Only
/// the handful of operations `inlineStringArrays` actually calls.
fn FixedList(comptime T: type, comptime capacity: usize) type {
    return struct {
        items: [capacity]T = undefined,
        len: usize = 0,

        fn append(self: *@This(), value: T) error{Overflow}!void {
            if (self.len >= capacity) return error.Overflow;
            self.items[self.len] = value;
            self.len += 1;
        }

        fn constSlice(self: *const @This()) []const T {
            return self.items[0..self.len];
        }
    };
}

fn inlineStringArrays(tree: *ast.Tree, stats: *Stats) error{OutOfMemory}!void {
    var arrays: FixedList(StringArray, max_tables) = .{};
    var accessors: FixedList(Accessor, max_tables) = .{};

    // Collect declared string tables: `var t = ["a", "b", ...]`.
    for (0..tree.nodes.len) |i| {
        const index: ast.NodeIndex = @enumFromInt(@as(u32, @intCast(i)));
        const declarator = switch (tree.data(index)) {
            .variable_declarator => |d| d,
            else => continue,
        };
        if (declarator.id == .null or declarator.init == .null) continue;
        const name = switch (tree.data(declarator.id)) {
            .binding_identifier => |b| b.name,
            else => continue,
        };
        const elements = switch (tree.data(declarator.init)) {
            .array_expression => |a| a.elements,
            else => continue,
        };
        if (elements.len == 0) continue;
        for (tree.extra(elements)) |element| {
            if (element == .null or tree.data(element) != .string_literal) break;
        } else {
            arrays.append(.{ .name = name, .elements = elements }) catch break;
        }
    }
    if (arrays.len == 0) return;

    // Collect accessors that index one of those tables.
    for (0..tree.nodes.len) |i| {
        const index: ast.NodeIndex = @enumFromInt(@as(u32, @intCast(i)));
        const function = switch (tree.data(index)) {
            .function => |f| f,
            else => continue,
        };
        if (function.id == .null or function.body == .null) continue;
        const name = switch (tree.data(function.id)) {
            .binding_identifier => |b| b.name,
            else => continue,
        };
        const body = switch (tree.data(function.body)) {
            .function_body => |b| b.body,
            else => continue,
        };
        if (findAccessor(tree, body, arrays.constSlice())) |found| {
            accessors.append(.{
                .name = name,
                .array = found.array,
                .offset = found.offset,
            }) catch break;
        }
    }
    if (accessors.len == 0) return;

    // Replace `accessor(0x1a3)` with the string it resolves to.
    for (0..tree.nodes.len) |i| {
        const index: ast.NodeIndex = @enumFromInt(@as(u32, @intCast(i)));
        const call = switch (tree.data(index)) {
            .call_expression => |c| c,
            else => continue,
        };
        if (call.callee == .null or call.arguments.len == 0) continue;
        const callee_name = switch (tree.data(call.callee)) {
            .identifier_reference => |r| r.name,
            else => continue,
        };
        const accessor = for (accessors.constSlice()) |a| {
            if (sameString(tree, a.name, callee_name)) break a;
        } else continue;

        const first = tree.extra(call.arguments)[0];
        if (first == .null) continue;
        const literal = switch (tree.data(first)) {
            .numeric_literal => |n| n,
            else => continue,
        };
        const raw = literal.value(tree);
        if (raw != @trunc(raw)) continue;

        const slot = @as(i64, @intFromFloat(raw)) - accessor.offset;
        const elements = tree.extra(arrays.constSlice()[accessor.array].elements);
        if (slot < 0 or slot >= elements.len) continue;

        tree.setData(index, tree.data(elements[@intCast(slot)]));
        stats.strings_inlined += 1;
    }
}

const AccessorShape = struct { array: usize, offset: i64 };

/// Recognises the two canonical accessor bodies. Deliberately does not check
/// that the index expression names the function's own parameter: obfuscators
/// rename it freely, and requiring the match bought nothing against the shapes
/// seen in the vendor bundles under `C:\Users\...\extensions`.
fn findAccessor(
    tree: *const ast.Tree,
    body: ast.IndexRange,
    arrays: []const StringArray,
) ?AccessorShape {
    var offset: i64 = 0;

    for (tree.extra(body)) |statement| {
        if (statement == .null) continue;
        switch (tree.data(statement)) {
            // `i = i - 0x123;`
            .expression_statement => |expression| {
                if (expression.expression == .null) continue;
                const assignment = switch (tree.data(expression.expression)) {
                    .assignment_expression => |a| a,
                    else => continue,
                };
                if (assignment.operator != .assign) continue;
                offset += subtrahendOf(tree, assignment.right) orelse continue;
            },
            // `return t[i - 0x123];` or `return t[i];`
            .return_statement => |ret| {
                if (ret.argument == .null) continue;
                const member = switch (tree.data(ret.argument)) {
                    .member_expression => |m| m,
                    else => continue,
                };
                if (!member.computed or member.object == .null) continue;
                const object = switch (tree.data(member.object)) {
                    .identifier_reference => |r| r.name,
                    else => continue,
                };
                const array = for (arrays, 0..) |candidate, i| {
                    if (sameString(tree, candidate.name, object)) break i;
                } else continue;
                offset += subtrahendOf(tree, member.property) orelse 0;
                return .{ .array = array, .offset = offset };
            },
            else => {},
        }
    }
    return null;
}

/// The `N` in `<anything> - N`, or null when the expression is not that shape.
fn subtrahendOf(tree: *const ast.Tree, index: ast.NodeIndex) ?i64 {
    if (index == .null) return null;
    const binary = switch (tree.data(index)) {
        .binary_expression => |b| b,
        else => return null,
    };
    if (binary.operator != .subtract or binary.right == .null) return null;
    const literal = switch (tree.data(binary.right)) {
        .numeric_literal => |n| n,
        else => return null,
    };
    const raw = literal.value(tree);
    if (raw != @trunc(raw)) return null;
    return @intFromFloat(raw);
}

fn sameString(tree: *const ast.Tree, a: ast.String, b: ast.String) bool {
    return std.mem.eql(u8, tree.string(a), tree.string(b));
}

// ---------------------------------------------------------------------------
// Passes 2–4 — normalisation, folding, pruning
// ---------------------------------------------------------------------------

/// Runs on the exit phase so children are already folded when a parent is
/// visited — `0x1 + 0x2 + 0x3` collapses in one traversal rather than needing
/// one round per operator.
const Folder = struct {
    stats: *Stats,
    /// Exit hooks cannot return an error, so an allocation failure is parked
    /// here and raised by the caller once the traversal finishes.
    oom: bool = false,

    pub fn exit_member_expression(
        self: *Folder,
        node: ast.MemberExpression,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) void {
        if (!node.computed or node.property == .null) return;
        const literal = switch (ctx.tree.data(node.property)) {
            .string_literal => |s| s,
            else => return,
        };
        if (!isIdentifier(ctx.tree.string(literal.value))) return;

        ctx.tree.setData(node.property, .{ .identifier_name = .{ .name = literal.value } });
        var normalized = node;
        normalized.computed = false;
        ctx.tree.setData(index, .{ .member_expression = normalized });
        self.stats.members_normalized += 1;
    }

    pub fn exit_binary_expression(
        self: *Folder,
        node: ast.BinaryExpression,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) void {
        if (node.left == .null or node.right == .null) return;
        const left = ctx.tree.data(node.left);
        const right = ctx.tree.data(node.right);

        if (node.operator == .add and left == .string_literal and right == .string_literal) {
            const joined = std.mem.concat(ctx.tree.allocator(), u8, &.{
                ctx.tree.string(left.string_literal.value),
                ctx.tree.string(right.string_literal.value),
            }) catch {
                self.oom = true;
                return;
            };
            self.writeString(ctx, index, joined);
            return;
        }

        if (left != .numeric_literal or right != .numeric_literal) return;
        const a = left.numeric_literal.value(ctx.tree);
        const b = right.numeric_literal.value(ctx.tree);
        const folded: f64 = switch (node.operator) {
            .add => a + b,
            .subtract => a - b,
            .multiply => a * b,
            // Division is folded only when it stays exact. `1/3` would print as
            // a 17-digit decimal that no longer round-trips to the same value,
            // which is a worse diff than the division it replaced.
            .divide => if (b == 0 or @mod(a, b) != 0) return else a / b,
            else => return,
        };
        self.writeNumber(ctx, index, folded);
    }

    pub fn exit_unary_expression(
        self: *Folder,
        node: ast.UnaryExpression,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) void {
        if (node.argument == .null) return;
        switch (node.operator) {
            // `!0` / `!1` / `!""` — the obfuscator's stand-in for true/false.
            .logical_not => {
                const truth = truthiness(ctx.tree, node.argument) orelse return;
                ctx.tree.setData(index, .{ .boolean_literal = .{ .value = !truth } });
                self.stats.expressions_folded += 1;
            },
            // `void 0` is only ever `undefined`, and only when the operand has
            // no side effects to lose.
            .void => {
                if (ctx.tree.data(node.argument) != .numeric_literal) return;
                ctx.tree.setData(index, .{ .identifier_reference = .{
                    .name = ctx.tree.addString("undefined") catch {
                        self.oom = true;
                        return;
                    },
                } });
                self.stats.expressions_folded += 1;
            },
            else => {},
        }
    }

    pub fn exit_conditional_expression(
        self: *Folder,
        node: ast.ConditionalExpression,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) void {
        const truth = truthiness(ctx.tree, node.@"test") orelse return;
        const taken = if (truth) node.consequent else node.alternate;
        if (taken == .null) return;
        ctx.tree.setData(index, ctx.tree.data(taken));
        self.stats.branches_pruned += 1;
    }

    pub fn exit_if_statement(
        self: *Folder,
        node: ast.IfStatement,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) void {
        const truth = truthiness(ctx.tree, node.@"test") orelse return;
        const taken = if (truth) node.consequent else node.alternate;
        ctx.tree.setData(index, if (taken == .null)
            .{ .empty_statement = .{} }
        else
            ctx.tree.data(taken));
        self.stats.branches_pruned += 1;
    }

    fn writeString(
        self: *Folder,
        ctx: *transform.Ctx,
        index: ast.NodeIndex,
        value: []const u8,
    ) void {
        const value_handle = ctx.tree.addString(value) catch {
            self.oom = true;
            return;
        };
        const raw = quote(ctx.tree.allocator(), value) catch {
            self.oom = true;
            return;
        };
        const raw_handle = ctx.tree.addString(raw) catch {
            self.oom = true;
            return;
        };
        ctx.tree.setData(index, .{ .string_literal = .{
            .value = value_handle,
            .raw = raw_handle,
        } });
        self.stats.expressions_folded += 1;
    }

    fn writeNumber(
        self: *Folder,
        ctx: *transform.Ctx,
        index: ast.NodeIndex,
        value: f64,
    ) void {
        var buffer: [32]u8 = undefined;
        const text = if (value == @trunc(value) and @abs(value) < 1e15)
            std.fmt.bufPrint(&buffer, "{d}", .{@as(i64, @intFromFloat(value))}) catch return
        else
            std.fmt.bufPrint(&buffer, "{d}", .{value}) catch return;

        const raw = ctx.tree.addString(text) catch {
            self.oom = true;
            return;
        };
        // Always decimal: a folded result has no original notation to preserve,
        // and hex is what the obfuscator used to make it unreadable.
        ctx.tree.setData(index, .{ .numeric_literal = .{ .kind = .decimal, .raw = raw } });
        self.stats.expressions_folded += 1;
    }
};

fn foldAndPrune(tree: *ast.Tree, stats: *Stats) error{OutOfMemory}!void {
    var folder = Folder{ .stats = stats };
    try transform.traverse(Folder, tree, &folder);
    if (folder.oom) return error.OutOfMemory;
}

/// The literal truth value of an expression, or null when it is not a literal
/// whose value is decidable without running anything.
fn truthiness(tree: *const ast.Tree, index: ast.NodeIndex) ?bool {
    if (index == .null) return null;
    return switch (tree.data(index)) {
        .boolean_literal => |b| b.value,
        .numeric_literal => |n| n.value(tree) != 0,
        .string_literal => |s| tree.string(s.value).len != 0,
        .null_literal => false,
        else => null,
    };
}

fn isIdentifier(text: []const u8) bool {
    if (text.len == 0) return false;
    for (text, 0..) |c, i| {
        const ok = std.ascii.isAlphabetic(c) or c == '_' or c == '$' or
            (i > 0 and std.ascii.isDigit(c));
        if (!ok) return false;
    }
    return !isReservedWord(text);
}

/// A reserved word is a valid property name but not a valid identifier after a
/// dot in every position — `a["new"]` must stay bracketed to keep parsing under
/// older engines the vendors still target.
fn isReservedWord(text: []const u8) bool {
    const reserved = [_][]const u8{
        "break",   "case",     "catch",  "class",  "const",      "continue",
        "debugger", "default", "delete", "do",     "else",       "enum",
        "export",  "extends",  "false",  "finally", "for",       "function",
        "if",      "import",   "in",     "instanceof", "new",    "null",
        "return",  "super",    "switch", "this",   "throw",      "true",
        "try",     "typeof",   "var",    "void",   "while",      "with",
    };
    for (reserved) |word| {
        if (std.mem.eql(u8, word, text)) return true;
    }
    return false;
}

/// Double-quoted JavaScript source for `value`. Only the escapes that are
/// mandatory inside a double-quoted literal; everything else stays literal so
/// folded strings read the way the original did.
fn quote(gpa: std.mem.Allocator, value: []const u8) error{OutOfMemory}![]const u8 {
    var out: std.ArrayList(u8) = .empty;
    try out.append(gpa, '"');
    for (value) |c| switch (c) {
        '"' => try out.appendSlice(gpa, "\\\""),
        '\\' => try out.appendSlice(gpa, "\\\\"),
        '\n' => try out.appendSlice(gpa, "\\n"),
        '\r' => try out.appendSlice(gpa, "\\r"),
        '\t' => try out.appendSlice(gpa, "\\t"),
        0x08 => try out.appendSlice(gpa, "\\b"),
        0x0c => try out.appendSlice(gpa, "\\f"),
        0x0b => try out.appendSlice(gpa, "\\v"),
        0 => try out.appendSlice(gpa, "\\0"),
        else => try out.append(gpa, c),
    };
    try out.append(gpa, '"');
    return out.toOwnedSlice(gpa);
}

// ---------------------------------------------------------------------------
// Pass 5 — sequence splitting
// ---------------------------------------------------------------------------

/// `a(), b(), c();` is one statement holding three calls. Split into three
/// statements so a diff can point at the call that changed instead of the line.
fn splitSequences(
    gpa: std.mem.Allocator,
    tree: *ast.Tree,
    stats: *Stats,
) error{OutOfMemory}!void {
    var rebuilt: std.ArrayList(ast.NodeIndex) = .empty;
    defer rebuilt.deinit(gpa);

    for (0..tree.nodes.len) |i| {
        const index: ast.NodeIndex = @enumFromInt(@as(u32, @intCast(i)));
        const body = switch (tree.data(index)) {
            .program => |p| p.body,
            .block_statement => |b| b.body,
            .function_body => |b| b.body,
            else => continue,
        };
        if (body.len == 0) continue;

        rebuilt.clearRetainingCapacity();
        var changed = false;
        for (tree.extra(body)) |statement| {
            const parts = sequenceParts(tree, statement) orelse {
                try rebuilt.append(gpa, statement);
                continue;
            };
            changed = true;
            for (tree.extra(parts)) |part| {
                try rebuilt.append(gpa, try tree.addNode(
                    .{ .expression_statement = .{ .expression = part } },
                    tree.span(part),
                ));
            }
            stats.sequences_split += 1;
        }
        if (!changed) continue;

        const range = try tree.addExtra(rebuilt.items);
        switch (tree.data(index)) {
            .program => |p| {
                var updated = p;
                updated.body = range;
                tree.setData(index, .{ .program = updated });
            },
            .block_statement => tree.setData(index, .{ .block_statement = .{ .body = range } }),
            .function_body => tree.setData(index, .{ .function_body = .{ .body = range } }),
            else => unreachable,
        }
    }
}

fn sequenceParts(tree: *const ast.Tree, statement: ast.NodeIndex) ?ast.IndexRange {
    if (statement == .null) return null;
    const expression = switch (tree.data(statement)) {
        .expression_statement => |e| e.expression,
        else => return null,
    };
    if (expression == .null) return null;
    return switch (tree.data(expression)) {
        .sequence_expression => |s| if (s.expressions.len > 1) s.expressions else null,
        else => null,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

fn expectContains(haystack: []const u8, needle: []const u8) !void {
    if (std.mem.indexOf(u8, haystack, needle) == null) {
        std.debug.print("expected to find `{s}` in:\n{s}\n", .{ needle, haystack });
        return error.TestExpectedContains;
    }
}

fn expectMissing(haystack: []const u8, needle: []const u8) !void {
    if (std.mem.indexOf(u8, haystack, needle) != null) {
        std.debug.print("expected NOT to find `{s}` in:\n{s}\n", .{ needle, haystack });
        return error.TestUnexpectedContains;
    }
}

test "inlines an obfuscator.io string table through its accessor" {
    const source =
        \\var _0x39a1 = ['chrome', 'runtime', 'sendMessage'];
        \\function _0x21b(_0x1, _0x2) {
        \\  _0x1 = _0x1 - 0x64;
        \\  return _0x39a1[_0x1];
        \\}
        \\window[_0x21b(0x64)][_0x21b(0x65)][_0x21b(0x66)]();
    ;
    const out = try deobfuscate(std.testing.allocator, source, .{});
    defer out.deinit(std.testing.allocator);

    try std.testing.expectEqual(@as(u32, 3), out.stats.strings_inlined);
    try expectContains(out.code, "window.chrome.runtime.sendMessage()");
}

test "handles the offset living in the index expression" {
    const source =
        \\var t = ['alpha', 'beta'];
        \\function d(i) { return t[i - 0x10]; }
        \\d(0x11);
    ;
    const out = try deobfuscate(std.testing.allocator, source, .{});
    defer out.deinit(std.testing.allocator);
    try expectContains(out.code, "\"beta\"");
}

test "an out-of-range index is left alone rather than guessed at" {
    const source =
        \\var t = ['alpha'];
        \\function d(i) { return t[i]; }
        \\d(0x99);
    ;
    const out = try deobfuscate(std.testing.allocator, source, .{});
    defer out.deinit(std.testing.allocator);
    try std.testing.expectEqual(@as(u32, 0), out.stats.strings_inlined);
    try expectContains(out.code, "d(");
}

test "normalises computed members but keeps the ones that must stay bracketed" {
    const source =
        \\a["push"](1);
        \\b["new"] = 2;
        \\c["with space"] = 3;
        \\d["0"] = 4;
    ;
    const out = try deobfuscate(std.testing.allocator, source, .{});
    defer out.deinit(std.testing.allocator);

    try expectContains(out.code, "a.push(1)");
    try expectContains(out.code, "\"new\"");
    try expectContains(out.code, "\"with space\"");
    try expectContains(out.code, "\"0\"");
}

test "folds literal arithmetic and concatenation to a fixed point" {
    const source =
        \\var a = 0x1 + 0x2 + 0x3;
        \\var b = 'ab' + 'cd' + 'ef';
        \\var c = 10 / 4;
    ;
    const out = try deobfuscate(std.testing.allocator, source, .{});
    defer out.deinit(std.testing.allocator);

    try expectContains(out.code, "a = 6");
    try expectContains(out.code, "\"abcdef\"");
    // Inexact division stays put: a folded 2.5 is not a better diff than 10 / 4.
    try expectContains(out.code, "10 / 4");
}

test "folds the boolean stand-ins and prunes the branch they guard" {
    const source =
        \\if (!0) { good(); } else { bad(); }
        \\var x = !1 ? bad() : good();
        \\var y = void 0;
    ;
    const out = try deobfuscate(std.testing.allocator, source, .{});
    defer out.deinit(std.testing.allocator);

    try expectContains(out.code, "good()");
    try expectMissing(out.code, "bad()");
    try expectContains(out.code, "undefined");
}

test "splits a comma sequence into separate statements" {
    const source = "a(), b(), c();";
    const out = try deobfuscate(std.testing.allocator, source, .{});
    defer out.deinit(std.testing.allocator);

    try std.testing.expectEqual(@as(u32, 1), out.stats.sequences_split);
    try expectContains(out.code, "a();");
    try expectContains(out.code, "b();");
    try expectContains(out.code, "c();");
}

test "leaves ordinary source untouched" {
    const source =
        \\function greet(name) {
        \\  return "hello " + name;
        \\}
    ;
    const out = try deobfuscate(std.testing.allocator, source, .{});
    defer out.deinit(std.testing.allocator);

    try std.testing.expectEqual(@as(u32, 0), out.stats.total());
    try expectContains(out.code, "function greet(name)");
}

test "rejects source that does not parse instead of emitting half a file" {
    try std.testing.expectError(
        error.ParseFailed,
        deobfuscate(std.testing.allocator, "function (", .{}),
    );
}
