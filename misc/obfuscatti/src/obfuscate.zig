//! Top-level pipeline: parse → run transforms → generate.
//!
//! One function, deliberately: `misc/obfuscatti` is proving that a
//! js-confuser port onto yuku's parser/codegen works end to end before any
//! more of js-confuser's ~20 transforms are ported (see this directory's
//! README for the roadmap). Callers — the CLI in main.zig today, the NAPI
//! binding in ffi.zig, eventually misc/vite/obfuscateAssets.ts — all go
//! through this one entry point.
//!
//! ## `tree.string()` is only valid until the next `tree.addString()`
//!
//! yuku's string pool (`ASTStringPool`, in its `parser/strings.zig`) backs
//! anything not a direct slice of the original source with a plain
//! `std.ArrayList(u8)`, and `tree.string(id)` returns a slice computed from
//! that list's *current* backing buffer. Appending to a growable ArrayList
//! past its capacity reallocates — moves — that buffer, silently
//! invalidating every slice `tree.string()` handed out before. A transform
//! that reads a name via `tree.string()` and holds onto it (in a visitor
//! field, a collected list, a hash map key) across any later
//! `tree.addString()` call — including its own, in a later loop iteration
//! or a different hook — is holding a dangling slice, not a bug that
//! crashes loudly: it reads back as silently corrupted bytes once the pool
//! has grown enough to relocate. Found the hard way in
//! duplicate_literals_removal.zig, rename_labels.zig, global_concealing.zig
//! and object_extraction.zig, all fixed the same way: `allocator.dupe()`
//! the text immediately after reading it, own that copy for as long as the
//! transform needs the value, free it when done.

const std = @import("std");
const parser = @import("parser");
const flatten = @import("transforms/flatten.zig");
const object_extraction = @import("transforms/object_extraction.zig");
const global_concealing = @import("transforms/global_concealing.zig");
const variable_masking = @import("transforms/variable_masking.zig");
const dead_code = @import("transforms/dead_code.zig");
const opaque_predicates = @import("transforms/opaque_predicates.zig");
const calculator = @import("transforms/calculator.zig");
const string_splitting = @import("transforms/string_splitting.zig");
const array_extraction = @import("transforms/array_extraction.zig");
const duplicate_literals_removal = @import("transforms/duplicate_literals_removal.zig");
const moved_declarations = @import("transforms/moved_declarations.zig");
const rename_labels = @import("transforms/rename_labels.zig");
const ast_scrambler = @import("transforms/ast_scrambler.zig");
const rename_variables = @import("transforms/rename_variables.zig");
const embed_snippet = @import("transforms/embed_snippet.zig");
const base91 = @import("transforms/base91.zig");
const string_encoding = @import("transforms/string_encoding.zig");

// Referenced only so `zig build test` discovers their `test` blocks too —
// see yuku's own root.zig for the same pattern.
test {
    _ = flatten;
    _ = object_extraction;
    _ = global_concealing;
    _ = variable_masking;
    _ = dead_code;
    _ = opaque_predicates;
    _ = calculator;
    _ = string_splitting;
    _ = array_extraction;
    _ = duplicate_literals_removal;
    _ = moved_declarations;
    _ = rename_labels;
    _ = ast_scrambler;
    _ = rename_variables;
    _ = embed_snippet;
    _ = base91;
    _ = string_encoding;
}

pub const ObfuscateError = error{ ParseFailed, AnalysisFailed } || std.mem.Allocator.Error;

/// `minify` covers js-confuser's `Order.Minify = 28` in the sense that
/// matters most for output size — yuku's codegen already does size-reducing
/// syntax rewrites and whitespace stripping natively (`Options.minify` +
/// `.format = .compact`), which is most of what that transform is for.
/// js-confuser's own `minify.ts` additionally does a handful of specific AST
/// simplifications (destructuring collapse, `undefined`/`Infinity` masking)
/// that aren't ported — lower priority than the identifier/string/control-flow
/// hiding transforms for what this proxy actually needs from obfuscation.
pub const Options = struct {
    minify: bool = false,
};

/// Runs every ported transform in js-confuser's own `Order` sequence
/// (src/order.ts in the js-confuser checkout — comments below cite the
/// numbers from there so a newly-ported transform's call slots into the
/// right place instead of just being appended) — with one deliberate
/// exception: every transform that consults `Semantic` (object extraction,
/// flatten, global concealing, variable masking) runs as a group first,
/// ahead of anything in Order's numbering that would normally sit between
/// them.
///
/// Each of those calls `parser.semantic.analyze(&tree)` fresh, immediately
/// before it runs — not once, shared across the group. A shared snapshot
/// looks like the obvious optimization (`analyze` is a full tree pass) but
/// is wrong: `Semantic`'s node-indexed tables only cover the tree as it
/// looked the moment `analyze` ran, so a snapshot taken before, say,
/// `flatten` has no idea a *later* transform's newly-created reference
/// (flatten builds a wrapper that forwards the original parameters by
/// name — new identifier_reference nodes) needs the same rewrite as the
/// original parameter it's now aliasing. Caught this the hard way:
/// `variable_masking`, working off a pre-`flatten` snapshot, masked the
/// original parameter correctly but had no way to know about flatten's new
/// reference to the same name, leaving a bare identifier with nothing left
/// to bind to. Re-analyzing before each transform means every one of them
/// sees exactly what every prior one actually did.
pub fn obfuscate(
    allocator: std.mem.Allocator,
    source: []const u8,
    options: Options,
) ObfuscateError![]const u8 {
    var tree = parser.parse(allocator, source, .{}) catch return error.ParseFailed;
    defer tree.deinit();

    // Order.ObjectExtraction = 1
    {
        const semantic = parser.semantic.analyze(&tree) catch return error.AnalysisFailed;
        var visitor = try object_extraction.Visitor.init(allocator, &tree, semantic);
        defer visitor.deinit();
        try parser.traverser.transform.traverse(object_extraction.Visitor, &tree, &visitor);
    }

    // Order.Flatten = 2 -- STILL DISABLED. Originally disabled because a
    // real app (Civil's own SolidStart build) broke: a reactive-storage
    // code path threw `TypeError: Cannot read properties of undefined
    // (reading 'p0')` during initial render, and the app never mounted.
    //
    // One real, confirmed bug in this transform *has* been found and
    // fixed since: flatten.zig's param-simplicity bail-out ("skip a
    // function with a destructured/defaulted parameter") used to run
    // *after* the capture-scanning loop had already rewritten every
    // captured reference in place, so a function with both a capture and
    // a non-simple param was left with references to a `flat_object_name`
    // no wrapper-building code ever ran to declare -- a bare
    // `ReferenceError` on every call. Found by comparing this port
    // against js-confuser's actual transforms/flatten.ts line by line,
    // fixed in flatten.zig (param check now runs before any mutation),
    // and confirmed against real code: obfuscatti's *full* pipeline now
    // produces syntactically valid output for every non-test file in
    // this repo's own src/ (112/112), matching real js-confuser
    // (flatten-only) run against the same corpus.
    //
    // Re-enabling this stage with only that fix, though, still broke the
    // live app -- a *different* runtime error this time (`Cannot read
    // properties of undefined (reading 'options')` inside Civil's own
    // entry bundle, called through Solid's `mapArray`/`<For>` machinery
    // in preload-helper.js), confirmed via bisection against the actual
    // running app (disabling only this stage, nothing else, fixes it;
    // every other transform stays on). So there is at least one more,
    // separate bug here, not yet isolated: extensive comparison against
    // js-confuser's own capture-detection and getter/setter/call-shim
    // logic didn't turn up a second discrepancy by reading alone, and a
    // standalone repro wasn't found in the time available (attempts to
    // reproduce it against solid-js's own dist/solid.js in isolation
    // turned out to be invalid -- that file requires setup this port
    // can't easily provide outside its real bundle, so isolated testing
    // against vendor internals is not a reliable way to chase this one;
    // it needs the real app, which needs a slow container rebuild per
    // iteration). Left disabled rather than shipped half-verified. The
    // fix above stays in flatten.zig -- it's real and independently
    // tested -- but this stage stays off until the second bug is found
    // too, ideally with a regression test the way every other fix in
    // this pipeline has one.
    if (false) {
        const semantic = parser.semantic.analyze(&tree) catch return error.AnalysisFailed;
        var visitor = flatten.Visitor.init(allocator, semantic);
        defer visitor.deinit();
        try parser.traverser.transform.traverse(flatten.Visitor, &tree, &visitor);
        if (visitor.err) |err| return err;
    }

    // Order.GlobalConcealing = 12 (moved ahead of its own numbering — see
    // this function's doc comment)
    {
        const semantic = parser.semantic.analyze(&tree) catch return error.AnalysisFailed;
        var visitor = global_concealing.Visitor.init(allocator, semantic, "__obf_getGlobal");
        defer visitor.deinit();
        try parser.traverser.transform.traverse(global_concealing.Visitor, &tree, &visitor);
        if (visitor.err) |err| return err;
    }

    // Order.VariableMasking = 20 (moved ahead of its own numbering — see
    // this function's doc comment)
    {
        const semantic = parser.semantic.analyze(&tree) catch return error.AnalysisFailed;
        var visitor = variable_masking.Visitor.init(allocator, semantic);
        defer visitor.deinit();
        try parser.traverser.transform.traverse(variable_masking.Visitor, &tree, &visitor);
    }

    // Order.DeadCode = 8
    {
        var visitor = dead_code.Visitor.init(allocator);
        defer visitor.deinit();
        try parser.traverser.transform.traverse(dead_code.Visitor, &tree, &visitor);
        if (visitor.err) |err| return err;
    }

    // Order.Calculator = 9
    {
        var visitor = calculator.Visitor.init(allocator, "__obf_calc");
        defer visitor.deinit();
        try parser.traverser.transform.traverse(calculator.Visitor, &tree, &visitor);
        if (visitor.err) |err| return err;
    }

    // Order.OpaquePredicates = 13
    {
        var visitor = opaque_predicates.Visitor.init(allocator);
        defer visitor.deinit();
        try parser.traverser.transform.traverse(opaque_predicates.Visitor, &tree, &visitor);
        if (visitor.err) |err| return err;
    }

    // Order.StringSplitting = 16
    {
        var visitor = string_splitting.Visitor.init(allocator);
        defer visitor.deinit();
        try parser.traverser.transform.traverse(string_splitting.Visitor, &tree, &visitor);
    }

    // Order.StringConcealing = 17 (array-extraction is its structural half —
    // see array_extraction.zig's own doc comment)
    {
        var visitor = try array_extraction.Visitor.init(allocator, "__obf_arr");
        defer visitor.deinit();
        try parser.traverser.transform.traverse(array_extraction.Visitor, &tree, &visitor);
        if (visitor.err) |err| return err;
    }

    // Order.DuplicateLiteralsRemoval = 22
    {
        const semantic = parser.semantic.analyze(&tree) catch return error.AnalysisFailed;
        var visitor = duplicate_literals_removal.Visitor.init(allocator, "__obf_dlr", semantic);
        defer visitor.deinit();
        try parser.traverser.transform.traverse(duplicate_literals_removal.Visitor, &tree, &visitor);
        if (visitor.err) |err| return err;
    }

    // Order.MovedDeclarations = 25
    {
        var visitor = moved_declarations.Visitor.init(allocator);
        defer visitor.deinit();
        try parser.traverser.transform.traverse(moved_declarations.Visitor, &tree, &visitor);
        if (visitor.err) |err| return err;
    }

    // Order.RenameLabels = 27
    try rename_labels.apply(allocator, &tree);

    // Order.AstScrambler = 29
    {
        var visitor = ast_scrambler.Visitor.init(allocator, "__obf_ast");
        defer visitor.deinit();
        try parser.traverser.transform.traverse(ast_scrambler.Visitor, &tree, &visitor);
        if (visitor.err) |err| return err;
    }

    // No Order position -- see string_encoding.zig's own top comment.
    // STILL DISABLED (both halves -- this AST pass and the post-codegen
    // encoding pass below). Passes every unit test (including real-execution
    // round-trips for the constructor/__proto__/directive-prologue traps),
    // and the full 112-file real-source comparison against Civil's own
    // src/ (112/112, syntactically valid both engines). But against the
    // actual running app it broke Solid.js's own internal Owner/scheduler
    // machinery -- confirmed on two independent builds (a from-scratch
    // Docker image and a local `bun run build`, so not an artifact of
    // either environment): `TypeError: Class constructor <X> cannot be
    // invoked without 'new'`, reproducible on every page load, not
    // intermittent. Isolated this far: the failing call site is
    // `preload-helper-*.js`'s own `agb` function, a `scheduler === default
    // ? runSync() : scheduler(cb)`-shaped dispatch reading a *static*
    // class field off Solid's `Owner` class (the field decodes to "It" in
    // the minified output) -- and at the point it's read, that field
    // holds a reference to an unrelated `class extends <concealed global>`
    // defined elsewhere in the same chunk, not whatever Solid actually
    // stores there. Never reproduced with a small hand-written repro
    // (a `class Foo extends Mixin(Base) {}` pattern alone runs fine) --
    // whatever triggers it depends on the *real*, much larger bundle
    // specifically, the same category of "needs the real app, not an
    // isolated snippet" difficulty flatten.zig's own still-open bug (see
    // Order.Flatten below) already ran into. Left disabled rather than
    // shipped half-verified, same standard as that one. The two halves in
    // string_encoding.zig stay as they are -- real, independently tested --
    // this stage just doesn't run yet.
    if (false) {
        var visitor = string_encoding.KeyifyVisitor.init(allocator);
        defer visitor.deinit();
        try parser.traverser.transform.traverse(string_encoding.KeyifyVisitor, &tree, &visitor);
    }

    // Order.RenameVariables = 30 (run last, over a fresh post-mutation
    // Semantic snapshot — see rename_variables.zig's own doc comment)
    {
        const final_semantic = parser.semantic.analyze(&tree) catch return error.AnalysisFailed;
        try rename_variables.apply(allocator, &tree, final_semantic);
    }

    const result = try parser.codegen.generate(allocator, &tree, .{
        .minify = options.minify,
        .format = if (options.minify) .compact else .pretty,
    });
    defer result.deinit(allocator);

    // String encoding's other half would run here -- a post-codegen text
    // pass, not another tree transform -- but the whole feature is
    // disabled for now; see the `if (false)` above for why.
    return allocator.dupe(u8, result.code);
}

test "obfuscated output runs and produces the same result as the original" {
    const allocator = std.testing.allocator;
    const source = "console.log(\"hello\" + \" \" + \"world\");";

    const output = try obfuscate(allocator, source, .{});
    defer allocator.free(output);

    // The real proof: not "does the output look obfuscated", but "does a
    // real JS engine still produce the original's exact result". Written to
    // a temp file and run with bun (already a dependency of this repo)
    // rather than embedding a JS engine in the test.
    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();

    var tmp_dir = std.testing.tmpDir(.{});
    defer tmp_dir.cleanup();
    {
        var file = try tmp_dir.dir.createFile(io, "out.js", .{});
        defer file.close(io);
        try file.writeStreamingAll(io, output);
    }

    const path = try tmp_dir.dir.realPathFileAlloc(io, "out.js", allocator);
    defer allocator.free(path);

    const result = try std.process.run(allocator, io, .{ .argv = &.{ "bun", path } });
    defer allocator.free(result.stdout);
    defer allocator.free(result.stderr);

    try std.testing.expectEqualStrings("hello world\n", result.stdout);
}
