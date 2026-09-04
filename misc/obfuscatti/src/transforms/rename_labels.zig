//! Rename labels: every `label:` gets a sequential opaque name (`_L0`,
//! `_L1`, ...), every `break`/`continue label;` that targets it is updated
//! to match — and, matching js-confuser's `transforms/renameLabels.ts` in
//! full now, a label that no `break`/`continue` actually *needs* (a bare,
//! unlabeled `break;`/`continue;` at that point would already reach the
//! same place) is dropped entirely, replacing `label: for (...) {...}`
//! with just `for (...) {...}`.
//!
//! Two passes, matching the original's own structure — a label's fate
//! (kept-and-renamed vs. removed) depends on *every* `break`/`continue`
//! that targets it, not just the first one found, so it can't be decided
//! during the same walk that discovers them:
//!
//! - `Collector` walks the tree tracking a stack of "reachable break/
//!   continue targets" — every loop, `switch`, and labeled bare block —
//!   in the order a bare, unlabeled `break;`/`continue;` would search
//!   them. For each labeled `break`/`continue` it finds, it walks that
//!   stack (filtered to `continue`-valid targets — loops only — or
//!   break-valid ones — loops, `switch`, and labeled blocks) to find the
//!   *nearest* one carrying a matching label. If that's also the
//!   *nearest reachable target of any kind* — a bare `break;`/
//!   `continue;` right there would already reach it — the label isn't
//!   needed for *this* statement specifically (recorded per node, not
//!   per label: two `continue outer;`s under the same label can differ,
//!   one nested past an inner loop the other isn't). A labeled bare
//!   block is a special case even when it *is* nearest: unlike a loop or
//!   `switch`, there's no implicit unlabeled way to `break` out of a
//!   block at all, so it always counts as needing its label if it's
//!   reachable by a break there.
//! - `Applier` re-walks the tree applying what `Collector` decided: a
//!   label needed by at least one `break`/`continue` gets renamed (same
//!   stack-of-active-renames shape as before this existed); a label
//!   nothing needs gets removed, splicing the `LabeledStatement` out in
//!   favor of its own body. Each individual `break`/`continue` that
//!   didn't specifically need its label gets it cleared even if the
//!   label itself survives for some *other* statement's sake.
//!
//! Doesn't need real scope/binding resolution the way variableMasking/
//! objectExtraction/globalConcealing do (see this directory's README):
//! labels don't cross function boundaries in JS, so a plain traversal-
//! order stack is enough — including for the "which break/continue
//! target is nearest" question this version adds, since that's exactly
//! what a stack already captures.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const transform = parser.traverser.transform;
const Action = parser.traverser.Action;

const no_span: ast.Span = .{ .start = 0, .end = 0 };

const Frame = struct {
    /// Borrowed from `Collector.label_names`/`Applier.rename_stack` —
    /// never freed through this field.
    label: ?[]const u8 = null,
    /// Valid *implicit* (unlabeled) `continue` target — `for`/`while`/
    /// `do-while` only; never `switch` or a bare block.
    is_loop: bool,
    /// Valid `break` target *at all*, labeled or not — loop, `switch`,
    /// or a labeled bare block.
    is_breakable: bool,
    /// Valid *implicit* (unlabeled) `break` target — loop or `switch`;
    /// false for a labeled bare block, which has no unlabeled form.
    is_implicit_breakable: bool,
};

fn nearestMatch(stack: []const Frame, name: []const u8, want_continue: bool) ?struct { frame: Frame, is_nearest_reachable: bool } {
    var first_reachable = true;
    var i = stack.len;
    while (i > 0) {
        i -= 1;
        const f = stack[i];
        const eligible = if (want_continue) f.is_loop else f.is_breakable;
        if (!eligible) continue;
        if (f.label) |l| {
            if (std.mem.eql(u8, l, name)) {
                return .{ .frame = f, .is_nearest_reachable = first_reachable };
            }
        }
        first_reachable = false;
    }
    return null;
}

/// Pass 1: for every label, is it ever actually needed; for every
/// labeled `break`/`continue`, does *that specific statement* need it.
const Collector = struct {
    allocator: std.mem.Allocator,
    stack: std.ArrayList(Frame) = .empty,
    pending_label: ?[]const u8 = null,
    /// Owns every label name string collected — both `stack` entries and
    /// `label_required`'s keys borrow from here, never duplicated.
    label_names: std.ArrayList([]const u8) = .empty,
    label_required: std.StringHashMapUnmanaged(bool) = .empty,
    stmt_needs_label: std.AutoHashMapUnmanaged(ast.NodeIndex, bool) = .empty,
    err: ?std.mem.Allocator.Error = null,

    fn deinit(self: *Collector) void {
        self.stack.deinit(self.allocator);
        self.label_required.deinit(self.allocator);
        self.stmt_needs_label.deinit(self.allocator);
        for (self.label_names.items) |n| self.allocator.free(n);
        self.label_names.deinit(self.allocator);
    }

    fn pushFrame(self: *Collector, is_loop: bool, is_breakable: bool, is_implicit_breakable: bool) !void {
        const label = self.pending_label;
        self.pending_label = null;
        try self.stack.append(self.allocator, .{
            .label = label,
            .is_loop = is_loop,
            .is_breakable = is_breakable,
            .is_implicit_breakable = is_implicit_breakable,
        });
    }
    fn popFrame(self: *Collector) void {
        _ = self.stack.pop();
    }

    pub fn enter_labeled_statement(self: *Collector, stmt: ast.LabeledStatement, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = index;
        const slice = ctx.tree.string(ctx.tree.data(stmt.label).label_identifier.name);
        const owned = try self.allocator.dupe(u8, slice);
        try self.label_names.append(self.allocator, owned);
        try self.label_required.put(self.allocator, owned, false);
        self.pending_label = owned;
        return .proceed;
    }

    pub fn enter_for_statement(self: *Collector, s: ast.ForStatement, i: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = s;
        _ = i;
        _ = ctx;
        try self.pushFrame(true, true, true);
        return .proceed;
    }
    pub fn exit_for_statement(self: *Collector, s: ast.ForStatement, i: ast.NodeIndex, ctx: *transform.Ctx) void {
        _ = s;
        _ = i;
        _ = ctx;
        self.popFrame();
    }
    pub fn enter_for_in_statement(self: *Collector, s: ast.ForInStatement, i: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = s;
        _ = i;
        _ = ctx;
        try self.pushFrame(true, true, true);
        return .proceed;
    }
    pub fn exit_for_in_statement(self: *Collector, s: ast.ForInStatement, i: ast.NodeIndex, ctx: *transform.Ctx) void {
        _ = s;
        _ = i;
        _ = ctx;
        self.popFrame();
    }
    pub fn enter_for_of_statement(self: *Collector, s: ast.ForOfStatement, i: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = s;
        _ = i;
        _ = ctx;
        try self.pushFrame(true, true, true);
        return .proceed;
    }
    pub fn exit_for_of_statement(self: *Collector, s: ast.ForOfStatement, i: ast.NodeIndex, ctx: *transform.Ctx) void {
        _ = s;
        _ = i;
        _ = ctx;
        self.popFrame();
    }
    pub fn enter_while_statement(self: *Collector, s: ast.WhileStatement, i: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = s;
        _ = i;
        _ = ctx;
        try self.pushFrame(true, true, true);
        return .proceed;
    }
    pub fn exit_while_statement(self: *Collector, s: ast.WhileStatement, i: ast.NodeIndex, ctx: *transform.Ctx) void {
        _ = s;
        _ = i;
        _ = ctx;
        self.popFrame();
    }
    pub fn enter_do_while_statement(self: *Collector, s: ast.DoWhileStatement, i: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = s;
        _ = i;
        _ = ctx;
        try self.pushFrame(true, true, true);
        return .proceed;
    }
    pub fn exit_do_while_statement(self: *Collector, s: ast.DoWhileStatement, i: ast.NodeIndex, ctx: *transform.Ctx) void {
        _ = s;
        _ = i;
        _ = ctx;
        self.popFrame();
    }
    pub fn enter_switch_statement(self: *Collector, s: ast.SwitchStatement, i: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = s;
        _ = i;
        _ = ctx;
        try self.pushFrame(false, true, true);
        return .proceed;
    }
    pub fn exit_switch_statement(self: *Collector, s: ast.SwitchStatement, i: ast.NodeIndex, ctx: *transform.Ctx) void {
        _ = s;
        _ = i;
        _ = ctx;
        self.popFrame();
    }
    pub fn enter_block_statement(self: *Collector, s: ast.BlockStatement, i: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = s;
        _ = i;
        _ = ctx;
        // Only a genuinely labeled block is breakable at all -- an
        // ordinary `{}` (an if-body, a bare nested block, ...) is never a
        // valid break/continue target, labeled or not.
        try self.pushFrame(false, self.pending_label != null, false);
        return .proceed;
    }
    pub fn exit_block_statement(self: *Collector, s: ast.BlockStatement, i: ast.NodeIndex, ctx: *transform.Ctx) void {
        _ = s;
        _ = i;
        _ = ctx;
        self.popFrame();
    }

    fn record(self: *Collector, name: []const u8, want_continue: bool, stmt_index: ast.NodeIndex) !void {
        const found = nearestMatch(self.stack.items, name, want_continue) orelse return;
        const needs_label = !found.is_nearest_reachable or !found.frame.is_implicit_breakable;
        try self.stmt_needs_label.put(self.allocator, stmt_index, needs_label);
        if (needs_label) try self.label_required.put(self.allocator, name, true);
    }

    pub fn enter_break_statement(self: *Collector, stmt: ast.BreakStatement, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        if (stmt.label == .null) return .proceed;
        const name = ctx.tree.string(ctx.tree.data(stmt.label).label_identifier.name);
        try self.record(name, false, index);
        return .proceed;
    }
    pub fn enter_continue_statement(self: *Collector, stmt: ast.ContinueStatement, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        if (stmt.label == .null) return .proceed;
        const name = ctx.tree.string(ctx.tree.data(stmt.label).label_identifier.name);
        try self.record(name, true, index);
        return .proceed;
    }
};

const LabelFrame = struct { original: []const u8, renamed: ?[]const u8 };

/// Pass 2: apply `Collector`'s decisions -- rename a label everything
/// still needs, or splice a label nothing needs out of the tree
/// entirely; clear an individual break/continue's own label reference
/// when *that statement* didn't specifically need it, even if the label
/// itself survives for some other statement's sake.
const Applier = struct {
    allocator: std.mem.Allocator,
    label_required: *const std.StringHashMapUnmanaged(bool),
    stmt_needs_label: *const std.AutoHashMapUnmanaged(ast.NodeIndex, bool),
    stack: std.ArrayList(LabelFrame) = .empty,
    counter: u32 = 0,
    err: ?std.mem.Allocator.Error = null,

    fn deinit(self: *Applier) void {
        for (self.stack.items) |frame| {
            self.allocator.free(frame.original);
            if (frame.renamed) |r| self.allocator.free(r);
        }
        self.stack.deinit(self.allocator);
    }

    pub fn enter_labeled_statement(self: *Applier, stmt: ast.LabeledStatement, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        _ = index;
        const original_slice = ctx.tree.string(ctx.tree.data(stmt.label).label_identifier.name);
        const original = try self.allocator.dupe(u8, original_slice);
        errdefer self.allocator.free(original);

        const required = self.label_required.get(original) orelse true;
        var renamed: ?[]const u8 = null;
        if (required) {
            var buf: [16]u8 = undefined;
            const text = std.fmt.bufPrint(&buf, "_L{d}", .{self.counter}) catch unreachable;
            self.counter += 1;
            renamed = try self.allocator.dupe(u8, text);
            ctx.tree.setData(stmt.label, .{ .label_identifier = .{
                .name = try ctx.tree.addString(renamed.?),
            } });
        }
        try self.stack.append(self.allocator, .{ .original = original, .renamed = renamed });
        return .proceed;
    }

    pub fn exit_labeled_statement(self: *Applier, stmt: ast.LabeledStatement, index: ast.NodeIndex, ctx: *transform.Ctx) void {
        const frame = self.stack.pop().?;
        defer {
            self.allocator.free(frame.original);
            if (frame.renamed) |r| self.allocator.free(r);
        }
        if (frame.renamed == null) {
            // Nothing needs this label -- splice the LabeledStatement
            // out in favor of its own body, same in-place-replacement
            // trick as every other transform here (see e.g.
            // moved_declarations.zig): every existing reference to this
            // node -- its parent's child slot -- now resolves straight
            // to what used to be the body.
            ctx.tree.setData(index, ctx.tree.data(stmt.body));
        }
    }

    fn findRename(self: *Applier, name: []const u8) ??[]const u8 {
        var i = self.stack.items.len;
        while (i > 0) {
            i -= 1;
            if (std.mem.eql(u8, self.stack.items[i].original, name)) return self.stack.items[i].renamed;
        }
        return null;
    }

    pub fn enter_break_statement(self: *Applier, stmt: ast.BreakStatement, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        if (stmt.label == .null) return .proceed;
        const needs_label = self.stmt_needs_label.get(index) orelse true;
        if (!needs_label) {
            ctx.tree.setData(index, .{ .break_statement = .{ .label = .null } });
            return .proceed;
        }
        const original = ctx.tree.string(ctx.tree.data(stmt.label).label_identifier.name);
        const renamed = (self.findRename(original) orelse return .proceed) orelse return .proceed;
        const new_label = try ctx.tree.addNode(
            .{ .label_identifier = .{ .name = try ctx.tree.addString(renamed) } },
            no_span,
        );
        ctx.tree.setData(index, .{ .break_statement = .{ .label = new_label } });
        return .proceed;
    }

    pub fn enter_continue_statement(self: *Applier, stmt: ast.ContinueStatement, index: ast.NodeIndex, ctx: *transform.Ctx) !Action {
        if (stmt.label == .null) return .proceed;
        const needs_label = self.stmt_needs_label.get(index) orelse true;
        if (!needs_label) {
            ctx.tree.setData(index, .{ .continue_statement = .{ .label = .null } });
            return .proceed;
        }
        const original = ctx.tree.string(ctx.tree.data(stmt.label).label_identifier.name);
        const renamed = (self.findRename(original) orelse return .proceed) orelse return .proceed;
        const new_label = try ctx.tree.addNode(
            .{ .label_identifier = .{ .name = try ctx.tree.addString(renamed) } },
            no_span,
        );
        ctx.tree.setData(index, .{ .continue_statement = .{ .label = new_label } });
        return .proceed;
    }
};

pub fn apply(allocator: std.mem.Allocator, tree: *ast.Tree) !void {
    var collector = Collector{ .allocator = allocator };
    defer collector.deinit();
    try transform.traverse(Collector, tree, &collector);
    if (collector.err) |err| return err;

    var applier = Applier{
        .allocator = allocator,
        .label_required = &collector.label_required,
        .stmt_needs_label = &collector.stmt_needs_label,
    };
    defer applier.deinit();
    try transform.traverse(Applier, tree, &applier);
    if (applier.err) |err| return err;
}

test "renames a label still needed and keeps break/continue targeting it correct" {
    const allocator = std.testing.allocator;
    const source =
        \\outer: for (let i = 0; i < 3; i++) {
        \\  for (let j = 0; j < 3; j++) {
        \\    if (j === 1) continue outer;
        \\    console.log(i, j);
        \\  }
        \\}
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    try apply(allocator, &tree);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "outer") == null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "_L0") != null);

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

    const obfuscated_run = try std.process.run(allocator, io, .{ .argv = &.{ "bun", path } });
    defer allocator.free(obfuscated_run.stdout);
    defer allocator.free(obfuscated_run.stderr);

    const original_run = try std.process.run(allocator, io, .{ .argv = &.{ "bun", "-e", source } });
    defer allocator.free(original_run.stdout);
    defer allocator.free(original_run.stderr);

    try std.testing.expectEqualStrings(original_run.stdout, obfuscated_run.stdout);
}

test "removes a label nothing needs, and runs identically" {
    const allocator = std.testing.allocator;
    // `continue inner;` here would reach the very same place as a bare
    // `continue;` -- `inner` is the nearest loop already -- so nothing
    // ever needs this label, and it should be dropped entirely, not
    // just renamed.
    const source =
        \\let log = [];
        \\inner: for (let i = 0; i < 4; i++) {
        \\  if (i % 2 === 0) continue inner;
        \\  log.push(i);
        \\}
        \\console.log(log.join(","));
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    try apply(allocator, &tree);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "inner") == null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "_L") == null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "continue;") != null);

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

    try std.testing.expectEqualStrings("1,3\n", run.stdout);
}

test "keeps a label required only because of an outer, non-nearest break, runs identically" {
    const allocator = std.testing.allocator;
    // `break outer;` from inside the *inner* loop is not reaching the
    // nearest breakable target (that's the inner loop itself) -- outer's
    // label is genuinely required here, unlike the plain-removal case
    // above.
    const source =
        \\let found = -1;
        \\outer: for (let i = 0; i < 3; i++) {
        \\  for (let j = 0; j < 3; j++) {
        \\    if (i === 1 && j === 1) {
        \\      found = i * 10 + j;
        \\      break outer;
        \\    }
        \\  }
        \\}
        \\console.log(found);
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    try apply(allocator, &tree);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "outer") == null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "_L0") != null);

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

    try std.testing.expectEqualStrings("11\n", run.stdout);
}
