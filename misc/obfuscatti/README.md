# obfuscatti

A Zig port of [js-confuser](https://github.com/MichaelXF/js-confuser) onto
[yuku](https://github.com/yuku-toolchain/yuku) (a Zig JS/TS parser, codegen,
and semantic analyzer), aimed at replacing `obscura-rs` in
`misc/vite/obfuscateAssets.ts` once it's far enough along to trust with that.

**Status: wired into `obfuscateAssets.ts`, opt-in.** 15 transforms ported
(13 active in the pipeline; 2 — Flatten and String encoding — ported and
unit-tested but currently disabled, both for the same reason: a real bug
that only shows up against the actual running app, not yet isolated to a
root cause; see their checklist entries below), each with a real test and
most with a real-execution round-trip proof, covering every transform from
js-confuser's own pipeline judged both safely portable and actually useful
for Civil's purpose here — see the checklist below, and "Deliberately not
ported" for the five that aren't, with reasoning for each. Verified against
real, non-synthetic JS (not just this project's own hand-written test
cases) before wiring — see "Tested against real code" below, including two
real bugs that testing found and this synthetic test suite alone hadn't:
neither is hypothetical. A later pass went through every ported transform
again against js-confuser's actual source line by line — not just "does it
work" but "is it as complete as the original" — closing real gaps (numeric
object keys, switch-case statement coalescing, probability-gated partial
application for dead code and opaque predicates, a broader global-concealing
ignore-list) and confirming several places where yuku's real semantic
analyzer already does better than js-confuser's own more ad-hoc checks.

## What's here

- `src/transforms/` — every ported transform, one file each; see the
  checklist below for the full list and what each one does.
  `array_extraction.zig` (the first one written) is now also the string-
  *encoding* half of js-confuser's `stringConcealing`, not just extraction:
  every string literal is basE91-encoded (`base91.zig`) into one shared
  buffer, deduplicated by encoded span, and replaced with a call through an
  injected decoder function — `"hello"` becomes `__obf_arr_get(0, 5)`
  against `var __obf_arr = "<encoded buffer>"`.
- `src/transforms/embed_snippet.zig` — clones a standalone-parsed snippet's
  AST into an existing tree (yuku's own parser always builds a fresh, owned
  tree, so this is what lets `dead_code.zig` embed real filler templates and
  `array_extraction.zig` embed a real decoder function's source text, rather
  than hand-building every node).
- `src/transforms/predicate_gen.zig` / `protected_keys.zig` — shared
  infrastructure: always-true/false opaque predicate expressions (used by
  `dead_code.zig` and `opaque_predicates.zig`), and the non-computed-key/
  import-source guard (used by `array_extraction.zig`,
  `duplicate_literals_removal.zig`, and `string_splitting.zig` — see "Tested
  against real code" below for the real bug this closes).
- `src/obfuscate.zig` — `parse → transform → codegen`, one function. Every
  caller (CLI, NAPI, eventually the Vite plugin) goes through this.
- `src/main.zig` — `zig build run`: obfuscates a small sample and prints it.
- `src/ffi.zig` — a Node.js binding written against
  [napi-zig](https://github.com/yuku-toolchain/napi-zig) (the same library
  yuku itself uses for `yuku-parser`/`yuku-codegen`/`yuku-analyzer`). Wired
  into `build.zig` and verified: `require("./zig-out/lib/obfuscatti.node")`
  from plain Node exposes a working `.obfuscate(source)`.

## Tested against real code

Every test in this repo up to this point was written by hand — small,
synthetic, deliberately shaped to exercise one thing. Before wiring into
`obfuscateAssets.ts`, three real, unmodified files already in this repo
(none written for this purpose) were run through the full pipeline:
`misc/wisp/native/index.js` (17KB, real control flow — nested if/else
chains, try/catch, platform-detection logic; verified *behaviorally*
identical, not just syntactically — the original and obfuscated versions
throw the exact same error, byte-for-byte, when the native binary is
missing), `dist-config/sw.js` (34KB, a real service worker — checked for
valid syntax and no corruption, not full behavior, since it needs browser
APIs this repo can't run standalone), and `config/encoder/xor_encoder.js`
(27KB, dense, already-minified Emscripten output — async/await, dynamic
`import()`, optional chaining; syntax and timing only, same reason).
Timing stayed well under half a second per file throughout.

This surfaced two real, non-hypothetical bugs neither the hand-written
test suite nor the earlier development testing had caught:

- **A dangling-slice bug in `string_splitting.zig` itself** — the exact
  class of bug documented in obfuscate.zig's top doc comment, missed
  there originally: the chunk-building loop held slices into
  `tree.string()`'s result while calling `tree.addString()` once per
  chunk, which can reallocate the pool mid-loop. Silent, non-crashing
  corruption, invisible in small test inputs that never happened to force
  a reallocation at the wrong moment — visible immediately at real-file
  scale. Fixed by duping the source string before chunking, same pattern
  as everywhere else.
- **Non-computed object/class member keys and import/export sources
  getting corrupted** — a real MIME-type lookup table
  (`{"content-type": [...]}`-shaped code, an extremely common pattern)
  came out as `{j[12]+j[13]:[...]}`, a syntax error. `array_extraction`,
  `duplicate_literals_removal`, and `string_splitting` all touch *every*
  string literal they see, including one sitting in a position that
  syntactically requires a static string — the getter/setter/method key
  problem `flatten.zig` hit and fixed for its own generated nodes (see
  "Scope resolution" below) turned out to be the same underlying issue
  for *existing*, real code's own object keys too, which none of this
  project's own hand-written test fixtures happened to contain. Fixed
  with a new shared guard, `protected_keys.zig`, used by all three
  transforms — see that file's own doc comment. This was the known
  "import/export source" gap mentioned in earlier revisions of this
  README, generalized once real code showed the gap was bigger than that
  one case.

Also found, separately: `string_splitting.zig`'s own chunks are
`string_literal` nodes, so once the original literal's data is replaced
with the chunk chain, the traverser descends into and re-visits each
chunk — a chunk long enough to clear the size threshold on its own was
getting split *again*. Concatenation is associative, so this wasn't
observed to produce wrong output by itself, but it's needless repeated
work this pass never intended, not a risk worth carrying, and step one in
tracking down the object-key bug above. Fixed with a per-pass
already-processed set, same shape as the fix in
`opaque_predicates.zig`/`dead_code.zig`.

None of this means the remaining 13 transforms are now proven bug-free —
it means three specific real files are. Treat `engine: "obfuscatti"` as
still less battle-tested than `obscura-rs`'s years of real-world use, not
as equivalent to it; see `obfuscateAssets.ts`'s own comments for how this
is gated.

## Transform checklist

Ported so far (see `src/transforms/`), each with a real test:

- [x] Array extraction — the structural half of `stringConcealing`
- [x] Calculator — numeric arithmetic → switch-based calculator calls
- [x] String splitting — long string literals broken into a `+`-joined
      concatenation chain, ordered before array extraction so each chunk
      goes through the shared basE91 buffer/decoder in its own right.
      Found and fixed a real bug against real Civil source: chunk
      boundaries were plain byte offsets with no UTF-8 awareness, so a
      multi-byte character straddling one came out split mid-character —
      silently wrong bytes in the output at best, a hard crash once
      `string_encoding.zig` (below) tried to decode a chunk's own text.
- [x] Duplicate literals removal — repeated string/number/boolean/null
      literals hoisted into one shared array, indexed by every occurrence
- [x] Rename labels — every `label:` gets a sequential opaque name, every
      `break`/`continue label;` updated to match (rename only, no attempt at
      the original's redundant-label-removal optimization — see the file's
      own doc comment for why that's a deliberate cut, not a gap)
- [x] Global concealing — every genuinely free identifier (`console`,
      `Math`, ...) becomes a call through one shared opaque lookup function.
      First transform to use yuku's real semantic analyzer instead of being
      blocked by the lack of one — see "Scope resolution" below.
- [x] Object extraction — `var obj = { a, b }` becomes separate bindings
      (`let __obf_obj_a = a, __obf_obj_b = b;`), only when every use and the
      binding itself are provably safe to split. Second semantic-analyzer
      consumer.
- [x] Variable masking — a function's parameters collapse into one rest
      parameter, every reference (including from a nested closure) becomes
      an indexed access into it. Scoped to parameters only, and skips
      anything nested under a method/property — see the file's own doc
      comment for why. Third semantic-analyzer consumer.
- [x] AST scrambler — consecutive plain expression-statements in a block
      collapse into one call (`a(); b();` → `__obf_ast(a(), b());`). No
      scope analysis needed — runs alongside the structural transforms.
- [ ] Flatten — **ported, but disabled in the pipeline** (`if (false)` in
      `obfuscate.zig`, `Order.Flatten`). A function's body moves to a new,
      decoupled top-level function; the original becomes a thin wrapper
      building a proxy object that intercepts every captured (closed-over)
      variable through a getter/setter, or a `this`-safe call-shim for one
      that's invoked as a function. The most structurally complex
      transform ported so far — four real bugs found and fixed against it
      (a shared-node aliasing bug that caused runtime infinite recursion, a
      non-computed property key corrupted by a later string-rewriting
      transform, a forgotten parameter, a param-simplicity bail-out that
      used to run after captures were already rewritten), plus the fix
      described below in "Scope resolution" that came directly out of
      debugging it. Passes every synthetic test and the full 112-file
      real-source comparison — but breaks Civil's actual live app (a
      Solid `<For>`/`mapArray` runtime error), and that second bug hasn't
      been isolated yet. See `obfuscate.zig`'s own `Order.Flatten` comment
      for the full story before touching this stage.
- [x] Moved declarations — `var x = 5;` becomes `var x;` prepended to the
      nearest enclosing block plus `x = 5;` left in place, matching what
      `var` hoisting already does implicitly. Scoped to that one mode —
      see the file's own doc comment for the "pack into a function
      parameter" mode it deliberately doesn't attempt.
- [x] Dead code — every block gets a never-called function full of filler,
      guarded by an always-false opaque predicate. Shares `predicate_gen.zig`
      with opaque predicates below. Found and fixed a real infinite-recursion
      bug (the injected guard block looked like a fresh injection target to
      the pass's own hook) and a missing declaration (referenced the dummy
      function without ever emitting it).
- [x] Opaque predicates — `if`/ternary/`case` tests get an always-true
      predicate ANDed in; `return expr;` becomes an if/else between the
      real value and an unreachable fake one. Found and fixed a genuine
      infinite-recursion bug here too: the fake branch's own new return
      statement wasn't marked as already-handled, so the pass kept
      rewrapping its own output forever.
- [x] Rename variables — every renameable binding, including every other
      transform's own helper names, becomes a short minifier-style name
      (`a`, `b`, ..., `aa`, ...). Runs last, over a fresh post-mutation
      `Semantic` snapshot, so nothing in the final output still looks like
      it came out of an obfuscator.
- [ ] String encoding — **ported, but disabled in the pipeline** (`if (false)`
      in `obfuscate.zig`, same as Flatten below), same real-app-only bug
      class as that one. Every string literal's characters become
      `\xHH`/`\uHHHH` escapes; every non-computed identifier-name member/
      property/method key becomes a computed string literal first so its
      own name gets encoded too (`console.log` → `console["log"]`).
      Isn't a standalone Plugin in the original at all — its real mechanism
      had to be reverse-engineered from the installed package's actual
      output, not read off a Plugin file. Two pieces: an ordinary AST pass
      for the key conversion, and a *post-codegen* pass over the generated
      text for the actual escaping (the only way to get custom escaping out
      of yuku's codegen — see `string_encoding.zig`'s own doc comment).
      Found and fixed a real, pre-existing bug in `string_splitting.zig`
      along the way (see that file's own entry above and "What's next").
      Passes every unit test and the full 112-file real-source comparison —
      but breaks Solid.js's own internal Owner/scheduler machinery in the
      actual running app (`TypeError: Class constructor <X> cannot be
      invoked without 'new'`, reproducible on every page load, confirmed on
      two independent builds), and that hasn't been isolated to a root
      cause yet — never reproduced with a small hand-written repro, only
      against the real, much larger bundle. See `obfuscate.zig`'s own
      comment at this stage for the full diagnostic writeup before touching
      it.

That's every transform in js-confuser's `src/transforms/` except five,
deliberately not ported — see "Deliberately not ported" below for why each
one specifically — plus `minify`, covered (differently) under "What's
next", and the plumbing files (`dispatcher`/`finalizer`/`plugin`/
`preparation`) that don't need porting at all — yuku's own traverser
replaces that role.

## Deliberately not ported

Five of js-confuser's transforms aren't here, not because they're hard to
port (though some are) but because implementing them faithfully would work
*against* what this proxy actually needs from obfuscation, or because the
risk of shipping a subtly-broken version outweighs the value right now.

- **`controlFlowFlattening`** — genuinely valuable, no counterproductive
  baggage, and the one of these five I'd actually want. Also the single
  most structurally complex transform in js-confuser: splitting a
  function into basic-block "chunks", building a dependency graph between
  them, then driving them through a shuffled `while`/`switch` state
  machine, with `break`/`continue`/`return` all needing to cross chunk
  boundaries correctly. `flatten.zig` alone — a simpler transform — turned
  up three real, non-obvious correctness bugs before it worked (a
  shared-node aliasing bug causing runtime infinite recursion, a
  non-computed key corrupted by a later transform, a forgotten parameter);
  `dead_code`/`opaque_predicates` turned up two more (both genuine
  infinite-recursion bugs). Control flow flattening has substantially more
  surface area for exactly that class of mistake, and a wrong dependency
  ordering or a mishandled `break` silently produces incorrect control
  flow, not a crash — the worst kind of bug to ship under time pressure at
  the end of a long session. Worth doing, but as its own dedicated,
  unhurried effort with room for the same read-verify-test discipline
  every other transform here got.
- **`rgf`** ("Runtime-Generated-Function") — reconstructs a function at
  runtime from a string via `eval()`, wrapped in a hand-rolled "eval
  integrity" tamper check, and requires recursively re-running the entire
  obfuscator on an embedded sub-program to produce that string in the
  first place. Beyond the real implementation cost, `eval()` is exactly
  the kind of pattern a strict Content-Security-Policy blocks outright and
  filters specifically watch for — shipping it would cut against this
  project's own purpose, not just be extra unused code.
- **`lock`** — a bundle of opt-in countermeasures (domain lock, date lock,
  self-defending/anti-formatter code, `debugger;` anti-debug statements,
  "tamper protection" that forces non-strict mode). None of them fit this
  project: domain-locking would break Civil running across its many proxy
  deployment domains, date-locking has no purpose here, and
  self-defending/anti-debug code is precisely the kind of behavioral
  signature that trips anti-malware heuristics — the opposite of evading a
  school filter. Forced non-strict mode also conflicts with the implicit
  strict mode of real ES module output.
- **`integrity`** — a self-checksumming mechanism (hash a function's own
  source, compare at runtime) that's tightly coupled to `lock`'s hash/
  native-function-check infrastructure. Not independently useful without
  `lock`, which isn't ported.
- **`pack`** — wraps the whole program's top-level scope into one object,
  primarily to support embedding code as a string for `rgf`. Explicitly
  doesn't support `export` statements at all (`me.error(...)` in the
  original) — a real risk for actual bundled ESM output, for a feature
  whose main consumer isn't ported either.

## Building

```sh
zig build test   # transform correctness + a real-execution round-trip test
zig build run    # CLI playground
zig build        # also builds zig-out/lib/obfuscatti.node
```

Needs **Zig 0.16.0** specifically, not whatever `zig` resolves to on PATH in
this environment — see "Known blocker".

## Known blocker: napi-zig vs. this environment's Zig dev snapshot

The `zig` on PATH in this environment is a dev snapshot
(`0.17.0-dev.1756+613c03321`). napi-zig's `build.zig`, pinned to the commit
yuku itself depends on, references `std.Build.*.Optimize.Debug`, which that
snapshot's std library no longer has (likely renamed/restructured since
napi-zig's pinned commit was tested). This isn't just about *this* package's
own NAPI binding — **yuku's own `build.zig` unconditionally calls
`napi_zig.addLib` for its own npm packages**, so depending on yuku at all
under that Zig version hits the same error, regardless of which yuku module
you actually import. Confirmed by testing, including that gating the import
behind a `b.option` bool does not help: Zig type-checks every reachable
branch of `build.zig` regardless of runtime conditions, so only physically
not calling `b.dependency(...)` for the offending package avoids evaluating
its `build.zig` at all.

**The fix used here:** build with the Zig 0.16.0 toolchain already present
on this machine (`C:\Users\Jasper Quartarolo\Downloads\zig-x86_64-windows-0.16.0\zig.exe`)
instead of the dev snapshot on PATH — 0.16.0 is yuku's own stated
`minimum_zig_version`, and building against it hits none of this. `src/ffi.zig`
is written but not wired into `build.zig` yet purely because that work hasn't
been done, not because of the compiler mismatch — it doesn't block NAPI specifically
now that a working toolchain is identified, it's just the next piece to wire up.

Zig 0.16.0 itself also changed a fair amount of `std.fs`/`std.process` API
shape from whatever `js-confuser`-adjacent examples assumed (every file/dir
operation now takes an explicit `std.Io` instance; `std.process.Child.init`
became `std.process.run`/`std.process.spawn`) — all fixed already in
`obfuscate.zig`'s own test, which is a real example of the current API shape
if writing more Zig against this toolchain.

## What's next (in rough order)

1. ~~Wire up `src/ffi.zig`~~ — done, verified working (see above).
2. **Transform coverage is done, modulo two edge cases and one dedicated
   future effort.** Every transform judged both safely portable and
   actually useful for this proxy is ported (13, see the checklist above);
   the five that aren't have their reasoning under "Deliberately not
   ported". What's left in this area:
   - `controlFlowFlattening` specifically — the one deliberately-skipped
     transform that's worth coming back to (see its own entry above) as
     dedicated future work, not a quick add-on to whatever else is
     happening.
   - ~~`stringEncoding`~~ — done (`src/transforms/string_encoding.zig`): every
     string literal's characters become `\xHH`/`\uHHHH` escapes, and every
     non-computed identifier-name member/property/method key becomes a
     computed string literal first so its name gets the same treatment.
     `StringLiteral.raw` genuinely isn't used verbatim by codegen (confirmed
     by reading `emit_string_literal`, not assumed), so this runs as a
     second pass over the *already-generated text*, not another tree
     transform — the only real way to get custom escaping out of yuku's
     codegen. Surfaced a real, pre-existing bug in `string_splitting.zig`
     along the way: it split a string at a raw byte offset with no
     awareness of UTF-8 character boundaries, and against real Civil source
     (a `…` straddling a chunk boundary) that left one chunk holding an
     orphaned continuation byte — silently-wrong output bytes before this,
     a hard crash once something finally tried to decode a chunk's own text
     as UTF-8. Fixed at the source, not worked around.
   - ~~Known gap shared by `array_extraction.zig` and
     `duplicate_literals_removal.zig`~~ — fixed, and turned out bigger than
     first scoped: see "Tested against real code" above and
     `protected_keys.zig`.
3. **Scope resolution: solved — yuku ships a real analyzer.**
   `variableMasking`/`objectExtraction`/`globalConcealing` were all
   initially parked as needing scope/binding analysis yuku's `transform`
   traverser deliberately doesn't carry. That's still true of the
   traverser — but yuku separately ships a *complete* semantic analyzer
   (`parser/semantic/`, published standalone as `yuku-analyzer`) that this
   project wasn't using yet. One call, `parser.semantic.analyze(&tree)`,
   returns a `Semantic` model with real scopes, symbols, and references —
   `Semantic.lookup` (is a name bound anywhere in the enclosing scope
   chain), `.symbolOf`/`.uses`/`Reference.flags.write` (does an identifier
   resolve locally, and is a given use a read or a write), `Symbol.scope`
   (which scope a binding — including a hoisting `var` — actually lands
   in). All three parked transforms are ported now, all built on this. On
   `globalConcealing` specifically, real scope resolution turned out
   *better* than the original: js-confuser checks a free name against a
   hardcoded known-globals list, so a name outside that list is left alone;
   real resolution doesn't need the list at all — "nothing in this program
   declares it" already means it resolves via the environment at runtime,
   known name or not (see the file's own doc comment).

   **The one hard constraint this surfaced:** `tree.string(id)` returns a
   slice into yuku's string pool, which is backed by a plain growable
   `ArrayList(u8)` — it can reallocate (move) on any later
   `tree.addString()` call, silently invalidating every slice handed out
   before. Any transform holding a `tree.string()` result across a later
   `addString()` call — including its own — needs to `allocator.dupe()` it
   first. Found as real, silent corruption (not a crash) in four files
   before being fixed; see obfuscate.zig's own top doc comment for the full
   writeup. Worth internalizing before writing another transform that reads
   names off the tree.

   **Revised again, after `flatten` found a real bug in this design:**
   the original plan was one `Semantic` snapshot, taken once, shared by
   every semantic-consuming transform in the group (each guarding against
   its *own* newly-created nodes with
   `if (@intFromEnum(index) >= semantic.node_references.len) return;`).
   That guard isn't enough — it only protects a transform from its own
   mutations, not from an *earlier* transform's. `flatten` builds a
   wrapper that forwards the original function's parameters by name into
   the new flattened function — brand new `identifier_reference` nodes
   naming an existing parameter. `variable_masking`, working off the
   snapshot taken *before* `flatten` ran, correctly masked the original
   parameter but had no idea flatten's new reference to the same name
   existed, leaving a bare identifier with nothing left to bind to.
   `obfuscate.zig` now calls `parser.semantic.analyze(&tree)` fresh,
   immediately before *each* semantic-consuming transform, not once for
   the whole group — more `analyze` calls, but every transform sees
   exactly what every prior one actually did, which the shared-snapshot
   version couldn't guarantee. The per-node bounds guard is still needed
   *within* a single transform's own pass (a transform can still visit
   nodes it just created itself, mid-traversal), just no longer across
   transforms.

   Also surfaced by `flatten`, worth generalizing: a `string_literal` used
   as a **non-computed** key/name (an object property key written
   `{ get x() {} }`, not `{ get [x]() {} }`) will get corrupted if
   `array_extraction`/`duplicate_literals_removal` later rewrite that same
   literal into an array-lookup expression — a non-computed slot can't
   hold an expression. Fixed in `flatten.zig` by marking its own generated
   getter/setter/method keys `computed = true` (valid ES6+, and accepts
   whatever ends up there); worth checking for in any future transform
   that writes a property/method name as a literal.

   Four transforms now use this pattern (`objectExtraction`, `flatten`,
   `globalConcealing`, `variableMasking`); `renameVariables` uses a
   variant of it (one fresh snapshot at the very end, over the fully
   mutated tree — see its own file). `astScrambler`, `deadCode`, and
   `opaquePredicates` are proof a structural, scope-free transform can
   just run alongside the others without touching any of this at all. If
   `controlFlowFlattening` is ever attempted (see "Deliberately not
   ported"), it would need this same fresh-snapshot pattern too.
4. **Filter-evasion tuning.** This session's `misc/filterProbe` work found
   real, concrete signatures filters key on — most notably GoGuardian's
   downloaded proxy-keyword model containing literal Ultraviolet artifact
   names (`uv.bundle.js`, `uv.config.js`, `uv.handler.js`) and phrases like
   `"bypass goguardian"`/`"evade school censorship"`. Once more transforms
   exist, that's the concrete list to design against — not generic
   obfuscation strength, but *this proxy's* actual exposure.
5. **Cross-platform NAPI builds.** Still explicitly out of scope until the
   above is solid: `build.zig` targets the host only by design (`b.standardTargetOptions`
   with no `-Dtarget` override) — the ask was "at build time only generate
   one, for the builder's platform," which cross-compiling the full matrix
   isn't.
6. **Only then:** wire into `misc/vite/obfuscateAssets.ts` as an
   `obscura-rs` alternative — and even then, likely alongside it behind a
   flag first, not as a hard replacement, given obfuscation is part of
   Civil's actual anti-detection posture and a partially-broken swap would
   be worse than what's there today.
