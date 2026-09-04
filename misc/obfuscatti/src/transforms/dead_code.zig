//! Dead code: every block gets a never-called function full of
//! plausible-looking filler, guarded by an opaque-predicate `if` that's
//! always false — `if (PREDICATE()) { __obf_deadN(); }` sitting right
//! above `function __obf_deadN() { ...filler... }`. Pure noise for a
//! filter or a human reader to wade through; never executes. Port of
//! js-confuser's `transforms/deadCode.ts`.
//!
//! The original draws its filler from a curated template library
//! (`templates/deadCodeTemplates.ts`) of ~24 real, recognizable snippets
//! (a linked-list algorithm, a character-frequency map, a cookie
//! getter/setter pair, ...) rather than one fixed body — this now does
//! the same, via `embed_snippet.zig` (parse each snippet once as its own
//! throwaway tree, clone it into this one). A curated subset here, not
//! all 24: the original's full list includes multi-hundred-line entries
//! (a complete SHA-256 implementation, an RSA toy implementation) that
//! would balloon output size at this pass's "every block, not just some"
//! application rate (see below) far more than the disguise value from
//! having *that specific* template in rotation is worth — the ones kept
//! are enough to vary real, LeetCode/utility-shaped structure (loops,
//! recursion, a linked list, bit-packing) rather than reading as
//! templated filler themselves.
//!
//! One template is chosen per injection site by cycling `self.counter`
//! (see `buildFillerBody`) rather than the original's own
//! `choice(deadCodeTemplates)` random pick — deterministic for the same
//! "varied but reproducible, no RNG source available" reason as everywhere
//! else in this pipeline. A template's own nested blocks (a `for` body, an
//! `if` branch) are real, ordinary blocks once spliced in, so this pass can
//! find and inject dead code into *them* too on this same traversal, same
//! as any other block in the program — not infinite (each level's own
//! guard block is tracked in `already_injected` same as everywhere else),
//! just deeper nesting than the old single-flat-statement filler could
//! ever produce.
//!
//! Gated the same way as the original's own `Block` visitor (which, via
//! Babel's own alias system, covers `Program` too — not a separate
//! always-applies Program-level injection the way this used to): a 25%
//! chance per block, matching the real `high` preset's `deadCode: 0.25`
//! (this pipeline has no user-facing per-transform options to read a real
//! value from, so `high` is the fixed target), and a hard cap of 20 total
//! injections per program, matching the original's own default
//! `suggestedMax`. The per-block roll hashes the block's own node index
//! rather than drawing from a random source, same reasoning as the
//! template choice above — see `shouldInject`.
//!
//! No scope/binding analysis needed.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const transform = parser.traverser.transform;
const Action = parser.traverser.Action;
const PredicateGen = @import("predicate_gen.zig").PredicateGen;
const embed_snippet = @import("embed_snippet.zig");

const no_span: ast.Span = .{ .start = 0, .end = 0 };

/// Real `high` preset's `deadCode: 0.25`.
const dead_code_probability_pct: u64 = 25;
/// Matches the original's own default `suggestedMax` (`transforms/deadCode.ts`).
const dead_code_max: u32 = 20;

const Injection = struct { dead_fn: ast.NodeIndex, guard: ast.NodeIndex };

/// Adapted from js-confuser's own `templates/deadCodeTemplates.ts` --
/// trimmed to a variety of self-contained, moderately-sized entries
/// rather than porting the full list (see this file's own top comment).
/// Never executed (guarded by an always-false predicate), so an entry
/// referencing an environment global it assumes exists (`document`,
/// `window`) is fine here in a way it wouldn't be anywhere else in this
/// pipeline -- it can't throw a `ReferenceError` at runtime if it never
/// runs.
const dead_code_templates = [_][]const u8{
    \\function setCookie(cname, cvalue, exdays) {
    \\  var d = new Date();
    \\  d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    \\  var expires = "expires=" + d.toUTCString();
    \\  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    \\}
    \\function getCookie(cname) {
    \\  var name = cname + "=";
    \\  var decodedCookie = decodeURIComponent(document.cookie);
    \\  var ca = decodedCookie.split(";");
    \\  for (var i = 0; i < ca.length; i++) {
    \\    var c = ca[i];
    \\    while (c.charAt(0) == " ") {
    \\      c = c.substring(1);
    \\    }
    \\    if (c.indexOf(name) == 0) {
    \\      return c.substring(name.length, c.length);
    \\    }
    \\  }
    \\  return "";
    \\}
    ,
    \\function vec_pack(vec) {
    \\  return vec[1] * 67108864 + (vec[0] < 0 ? 33554432 | vec[0] : vec[0]);
    \\}
    \\function vec_unpack(number) {
    \\  switch (((number & 33554432) !== 0) * 1 + (number < 0) * 2) {
    \\    case 0:
    \\      return [number % 33554432, Math.trunc(number / 67108864)];
    \\    case 1:
    \\      return [(number % 33554432) - 33554432, Math.trunc(number / 67108864) + 1];
    \\    case 2:
    \\      return [(((number + 33554432) % 33554432) + 33554432) % 33554432, Math.round(number / 67108864)];
    \\    default:
    \\      return [number % 33554432, Math.trunc(number / 67108864)];
    \\  }
    \\}
    \\var vec_a = vec_pack([2, 4]);
    \\var vec_b = vec_pack([1, 2]);
    \\var vec_c = vec_a + vec_b;
    ,
    \\function getLocalStorageValue(key, cb) {
    \\  if (typeof key !== "string") {
    \\    throw new Error("Invalid data key provided (not type string)");
    \\  }
    \\  if (!key) {
    \\    throw new Error("Invalid data key provided (empty string)");
    \\  }
    \\  var value = window.localStorage.getItem(key);
    \\  try {
    \\    value = JSON.parse(value);
    \\  } catch (e) {
    \\    cb(new Error("Serialization error for data '" + key + "': " + e.message));
    \\  }
    \\  cb(null, value);
    \\}
    ,
    \\function buildCharacterMap(str) {
    \\  var characterMap = {};
    \\  for (var char of str.replace(/[^\w]/g, "").toLowerCase()) {
    \\    characterMap[char] = characterMap[char] + 1 || 1;
    \\  }
    \\  return characterMap;
    \\}
    \\function isAnagrams(stringA, stringB) {
    \\  var stringAMap = buildCharacterMap(stringA);
    \\  var stringBMap = buildCharacterMap(stringB);
    \\  for (var char in stringAMap) {
    \\    if (stringAMap[char] !== stringBMap[char]) {
    \\      return false;
    \\    }
    \\  }
    \\  return Object.keys(stringAMap).length === Object.keys(stringBMap).length;
    \\}
    ,
    \\function ListNode(val) {
    \\  this.val = val;
    \\  this.next = null;
    \\}
    \\function addTwoNumbers(l1, l2) {
    \\  var carry = 0;
    \\  var sum = 0;
    \\  var head = new ListNode(0);
    \\  var now = head;
    \\  var a = l1;
    \\  var b = l2;
    \\  while (a !== null || b !== null) {
    \\    sum = (a ? a.val : 0) + (b ? b.val : 0) + carry;
    \\    carry = Math.floor(sum / 10);
    \\    now.next = new ListNode(sum % 10);
    \\    now = now.next;
    \\    a = a ? a.next : null;
    \\    b = b ? b.next : null;
    \\  }
    \\  if (carry) now.next = new ListNode(carry);
    \\  return head.next;
    \\}
    ,
};

pub const Visitor = struct {
    allocator: std.mem.Allocator,
    gen: PredicateGen,
    counter: u32 = 0,
    /// The guard `if`'s own consequent is a `block_statement` (`{
    /// deadName(); }`) -- if a later traversal step revisits a node whose
    /// children were just mutated by this same exit hook, that block would
    /// itself get dead-code injected into it, whose own guard block would
    /// too, forever. Every block this pass creates as part of an injection
    /// goes in here so it's never mistaken for a fresh injection target.
    already_injected: std.AutoHashMapUnmanaged(ast.NodeIndex, void) = .empty,
    err: ?std.mem.Allocator.Error = null,

    pub fn init(allocator: std.mem.Allocator) Visitor {
        return .{ .allocator = allocator, .gen = PredicateGen.init(allocator, "__obf_deadgen") };
    }

    pub fn deinit(self: *Visitor) void {
        self.already_injected.deinit(self.allocator);
    }

    /// `false` once `dead_code_max` total injections have already happened
    /// (this doesn't consume a "roll" the way `Math.random()` would, so
    /// there's no reason to check this after the probability check instead
    /// of before, unlike the original's own ordering) or when this
    /// particular block's own node index doesn't land in the bottom
    /// `dead_code_probability_pct`% of its hash's range.
    fn shouldInject(self: *Visitor, index: ast.NodeIndex) bool {
        if (self.counter >= dead_code_max) return false;
        const hash = std.hash.Wyhash.hash(0, std.mem.asBytes(&@as(u32, @intFromEnum(index))));
        return hash % 100 < dead_code_probability_pct;
    }

    /// Clones one real template's top-level statements in -- see this
    /// file's own top comment and `embed_snippet.zig`. Picked by cycling
    /// through `self.counter` (already incremented once per injection
    /// site, for `__obf_deadN`'s own name) rather than a true RNG: this
    /// pass already varies deterministically elsewhere in the pipeline
    /// (`string_splitting.zig`'s chunk-size divisor hashes the literal's
    /// own bytes for the same "varied but reproducible" reason), and a
    /// counter already sitting right here for a different purpose gets
    /// the same "different template most of the time" result without
    /// pulling in a random source.
    fn buildFillerBody(self: *Visitor, ctx: *transform.Ctx) !ast.IndexRange {
        const chosen = dead_code_templates[self.counter % dead_code_templates.len];
        return embed_snippet.embedProgram(self.allocator, ctx.tree, chosen);
    }

    /// Builds `function deadName() { filler }` and
    /// `if (PREDICATE()) { deadName(); }`, in that order (so prepending
    /// them in this order to a body puts the guard first, matching the
    /// original).
    fn buildInjection(self: *Visitor, ctx: *transform.Ctx) !Injection {
        var buf: [24]u8 = undefined;
        const dead_name = try self.allocator.dupe(
            u8,
            std.fmt.bufPrint(&buf, "__obf_dead{d}", .{self.counter}) catch unreachable,
        );
        defer self.allocator.free(dead_name);
        self.counter += 1;

        const params = try ctx.tree.addNode(.{ .formal_parameters = .{
            .items = try ctx.tree.addExtra(&.{}),
            .rest = .null,
            .kind = .formal_parameters,
        } }, no_span);
        const filler = try self.buildFillerBody(ctx);
        const body = try ctx.tree.addNode(.{ .function_body = .{ .body = filler } }, no_span);
        const id = try ctx.tree.addNode(
            .{ .binding_identifier = .{ .name = try ctx.tree.addString(dead_name) } },
            no_span,
        );
        const dead_fn = try ctx.tree.addNode(.{ .function = .{
            .type = .function_declaration,
            .id = id,
            .params = params,
            .body = body,
            .generator = false,
            .async = false,
        } }, no_span);

        const predicate = try self.gen.buildFalseExpression(ctx);
        const callee = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString(dead_name) } },
            no_span,
        );
        const call = try ctx.tree.addNode(.{ .call_expression = .{
            .callee = callee,
            .type_arguments = .null,
            .arguments = try ctx.tree.addExtra(&.{}),
            .optional = false,
        } }, no_span);
        const call_stmt = try ctx.tree.addNode(.{ .expression_statement = .{ .expression = call } }, no_span);
        const guard_body = try ctx.tree.addNode(
            .{ .block_statement = .{ .body = try ctx.tree.addExtra(&.{call_stmt}) } },
            no_span,
        );
        try self.already_injected.put(self.allocator, guard_body, {});
        const guard = try ctx.tree.addNode(.{ .if_statement = .{
            .@"test" = predicate,
            .consequent = guard_body,
            .alternate = .null,
        } }, no_span);

        return .{ .dead_fn = dead_fn, .guard = guard };
    }

    pub fn exit_block_statement(
        self: *Visitor,
        block: ast.BlockStatement,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) void {
        if (self.already_injected.contains(index)) return;
        if (!self.shouldInject(index)) return;
        self.inject(index, ctx, block.body) catch |err| {
            self.err = err;
            return;
        };
    }

    fn inject(self: *Visitor, index: ast.NodeIndex, ctx: *transform.Ctx, body: ast.IndexRange) !void {
        const injection = try self.buildInjection(ctx);
        // Resolved fresh, after `buildInjection`'s own addExtra calls above
        // -- a slice from `ctx.tree.extra()` points straight into the
        // tree's growable extra pool, which those calls can reallocate.
        // Taking `body` (a plain start/len pair, not a pointer) as the
        // parameter instead of a pre-resolved slice is what makes this
        // safe regardless of call-site order -- see obfuscate.zig's top
        // comment for the same hazard on the string pool.
        const original = ctx.tree.extra(body);
        var new_body: std.ArrayList(ast.NodeIndex) = .empty;
        defer new_body.deinit(self.allocator);
        try new_body.ensureTotalCapacityPrecise(self.allocator, original.len + 2);
        new_body.appendAssumeCapacity(injection.guard);
        new_body.appendAssumeCapacity(injection.dead_fn);
        new_body.appendSliceAssumeCapacity(original);
        ctx.tree.setData(index, .{ .block_statement = .{ .body = try ctx.tree.addExtra(new_body.items) } });
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

    fn finishProgram(self: *Visitor, prog: ast.Program, index: ast.NodeIndex, ctx: *transform.Ctx) !void {
        // Program is just another block to the original (its `Block`
        // visitor selector covers `Program` via Babel's own alias system)
        // -- same probability/cap gate as `exit_block_statement`, not a
        // separate always-applies injection.
        const injection: ?Injection = if (self.shouldInject(index)) try self.buildInjection(ctx) else null;

        // `buildInjection` -> `buildFalseExpression` marks the shared
        // dummy-function generator used, so this fires whenever *any*
        // injection happened, here or in a nested block -- but
        // `exit_program` is the one place guaranteed to run exactly once,
        // after every block-level injection elsewhere in the tree already
        // happened, so this is the only correct place to actually declare
        // `__obf_deadgen` once for all of them to share.
        const dummy_decl = try self.gen.buildDummyDeclIfUsed(ctx);

        const original = ctx.tree.extra(prog.body);
        var new_body: std.ArrayList(ast.NodeIndex) = .empty;
        defer new_body.deinit(self.allocator);
        try new_body.ensureTotalCapacityPrecise(self.allocator, original.len + 3);
        if (dummy_decl) |d| new_body.appendAssumeCapacity(d);
        if (injection) |inj| {
            new_body.appendAssumeCapacity(inj.guard);
            new_body.appendAssumeCapacity(inj.dead_fn);
        }
        new_body.appendSliceAssumeCapacity(original);
        ctx.tree.setData(index, .{ .program = .{
            .source_type = prog.source_type,
            .body = try ctx.tree.addExtra(new_body.items),
            .hashbang = prog.hashbang,
        } });
    }
};

test "injects unreachable dead code and runs identically" {
    const allocator = std.testing.allocator;
    // Several independent candidate sites (Program itself, plus each of
    // these blocks) -- the 25% gate means no *specific* one of them is
    // guaranteed to land an injection, but this fixed source hashes the
    // same way every run, so "at least one of these several sites did"
    // is a deterministic, not flaky, thing to assert.
    const source =
        \\{ let a = 1; }
        \\{ let b = 2; }
        \\{ let c = 3; }
        \\{ let d = 4; }
        \\{ let e = 5; }
        \\{ let f = 6; }
        \\{ let g = 7; }
        \\{ let h = 8; }
        \\console.log("hi");
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();

    var visitor = Visitor.init(allocator);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_deadgen") != null);

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

    try std.testing.expectEqualStrings("hi\n", run.stdout);
}

test "caps total dead-code injections at 20 even with many eligible blocks" {
    const allocator = std.testing.allocator;

    var source: std.ArrayList(u8) = .empty;
    defer source.deinit(allocator);
    var i: u32 = 0;
    while (i < 200) : (i += 1) {
        const block = try std.fmt.allocPrint(allocator, "{{ let v{d} = {d}; }}\n", .{ i, i });
        defer allocator.free(block);
        try source.appendSlice(allocator, block);
    }
    try source.appendSlice(allocator, "console.log(\"done\");\n");

    var tree = try parser.parse(allocator, source.items, .{});
    defer tree.deinit();

    var visitor = Visitor.init(allocator);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    // Reaches the cap...
    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_dead19") != null);
    // ...and stops there, unlike the old unconditional-per-block behavior,
    // which would have injected into every one of the 200 blocks.
    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_dead20") == null);

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

    try std.testing.expectEqualStrings("done\n", run.stdout);
}
