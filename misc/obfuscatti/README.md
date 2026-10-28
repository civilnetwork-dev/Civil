# Obfuscatti

Obfuscatti implements the 18 transformation stages recovered from **JSDefender
Core 2.12.0** in Zig, using yuku 0.24.1 for parsing, scope analysis and code
generation. Its pipeline is `src/jsdefender/engine.zig`.

The shared runtime is emitted as JavaScript for the protected program. The
protection algorithms run natively: the addon does not load the vendor bundle or
invoke a JavaScript obfuscation engine. This is a port of the recovered core
pipeline with the limits below. Byte-for-byte output parity is the acceptance
target. Local differential checks establish equality for their fixtures;
universal parity has not been proved.

The reference artifact is JSDefender Core 2.12.0 `package/index.js`, SHA-256
`ea91b5dba74b59be90ad211e4509b9ad524d9648ef2f1aff9eb466e10f15fc07`.

## Build

Build with Zig 0.17.0. `zig build` fetches the pinned yuku and napi-zig
packages into `zig-pkg/` on first run. From this directory:

```sh
zig build test
zig build test-jsdefender
zig build -Doptimize=ReleaseFast
```

The addon is installed at `zig-out/lib/obfuscatti.node`. `zig build run` prints
protected JavaScript for the CLI sample.

## Node API

The addon exports `obfuscate`, `protectSource` and `getVersion`.

```javascript
const { obfuscate, getVersion } = require("./zig-out/lib/obfuscatti.node");

const protectedCode = obfuscate('console.log("hello", 42, true);', {
    minify: true,
    randomSeed: 42,
    settings: {
        booleanLiterals: { randomize: true },
        constantArgument: true,
        integerLiterals: { randomize: true, lower: 0, upper: 255 },
        localDeclarations: { nameMangling: "base62" },
        propertyIndirection: true,
        stringLiterals: true,
    },
});

console.log(getVersion()); // "2.12.0", the recovered core version
console.log(protectedCode);
```

`obfuscate(source, options?)` is synchronous and returns an owned JavaScript
string. It accepts protection configuration plus the compatibility helper's
`minify` flag. Omitted options, `{}` and an options object containing only
`minify` use default protection, including `minify: undefined`. This helper
places its runtime in the returned source, including ES modules. A separately
emitted runtime requires `protectSource` instead.

`protectSource(sourceSet, configuration?)` always returns a Promise. Each source
must contain a string `sourceCode` and optional boolean `isModule`:

```javascript
const { protectSource } = require("./zig-out/lib/obfuscatti.node");

protectSource(
    [
        { sourceCode: 'globalThis.message = "hello";' },
        { sourceCode: 'console.log(message + " world");' },
    ],
    {
        randomSeed: 42,
        runtimeInjection: "separateSource",
        runtimeFile: "jsd-runtime.js",
        settings: {
            stringLiterals: true,
            localDeclarations: { nameMangling: "base62" },
        },
    },
).then(result => {
    // Save or load this runtime before the protected scripts.
    console.log(result.jsdRuntime);
    console.log(result.protectedSources);
}).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
```

The result contains `success`, `protectedSources`, nullable `jsdRuntime`,
`protectionSummary`, `maps`, `sourceMaps` and `metroBundleInfo`. The summary
includes initial syntax statistics, output lengths, transform entries, logs,
elapsed milliseconds and the seed. Counts retain the SDK's quirks: its global
hiding and self-defending counters stay zero, and transform entries are empty
objects. Validation and protection failures resolve with `success: false` and
the available progress and diagnostics.

`protectSource(sources, configuration, caller, logger)` accepts the SDK's fourth
argument as a log callback. Entries arrive on the caller thread, in order;
callback exceptions are swallowed. The third argument is unused by SDK 2.12.0.
Licensing, telemetry and update services are not implemented. Configuration
currently passes through JSON serialization; source AST objects are not accepted.

`sourceMaps` retains the SDK's shared, mutable array across calls, including
stale higher indices after a smaller source set. Use `structuredClone(result)`
when retaining a snapshot.

Native work runs on a joined thread with a 16 MiB stack because parsing the
runtime exhausted ordinary Windows Node's smaller addon stack. N-API calls stay
on the caller. Both entry points finish native work before returning; the
Promise API currently blocks its caller during protection.

| `runtimeInjection` | Runtime placement |
| --- | --- |
| `firstNonModule` | One shared runtime in the first non-module source; the default. |
| `all` | An independent runtime in each source that requires one. |
| `separateSource` | One shared runtime returned as `jsdRuntime`; requires `runtimeFile` when used. |

The object form accepts `{ mode, options: "no-eval" }` or
`{ mode, options: "self-defending" }`. Source order remains the load order.
`runtimeFile` identifies the separate runtime; the addon returns its contents
without writing a file for the caller.

Recognized Metro bundles return protected factory strings and their original
UTF-16 ranges in `metroBundleInfo`. `protectUserModulesOnly` filters filenames
containing `node_modules`; `filenameMap` supplies unnamed factory paths. Metro
uses an independent encrypted runtime per factory, matching the SDK. The
`obfuscate` helper rebuilds the original bundle from those ranges.

## Settings and inline protection

All 18 recovered stages are present in the original pipeline order:

| Stage | Setting | Enabled form and option fields |
| --- | --- | --- |
| Debugger removal | `debuggerRemoval` | `true` |
| Domain lock | `domainLock` | Domain string or `{ domainPattern, errorScript? }` |
| Date lock | `dateLock` | `{ startDate?, endDate?, errorScript? }` |
| DevTools blocking | `devToolsBlocking` | `true` or `{ patience? }`; patience 0–1000, default 5 |
| Console cloaking | `consoleCloaking` | `true` or `{ exclude? }` |
| Function reordering | `functionReorder` | `true` or `{ randomize? }` |
| Control flow | `controlFlow` | `true` or `{ randomize?, injectFakeCode? }` |
| Expression sequences | `exprSequence` | `true` |
| Boolean literals | `booleanLiterals` | `true` or `{ randomize? }` |
| Constant arguments | `constantArgument` | `true` |
| Property sparsing | `propertySparsing` | `true` |
| Variable grouping | `variableGrouping` | `true` |
| Property indirection | `propertyIndirection` | `true` |
| Integer literals | `integerLiterals` | `true` or `{ randomize?, radix?, lower?, upper? }` |
| Global object hiding | `globalObjectHiding` | `true` or `{ usePredefined?, include?, exclude? }` |
| String literals | `stringLiterals` | `true` |
| Local declarations | `localDeclarations` | `true` or `{ nameMangling?, excludeIds? }` |
| Self defending | `selfDefending` | `true`, level number, or `{ level?, errorScript? }` |

Every stage accepts `false` or `null` to disable it. Randomize/fake-code options
default to false. `domainLock: true` and `dateLock: true` are invalid. Domain
patterns use semicolon-separated ASCII hostnames; a leading dot follows the
recovered matching rule rather than a general wildcard. The addon uses the
host's standard `Date.parse`, including legacy and local-time dates. `errorScript` contains
JavaScript statements.

Integer bounds accept 0–65535; the default inclusive range is 0–8 and an
explicit zero upper bound also selects 8. `radix` accepts one
value or an array of `none`, `binary`, `decimal`, `hexadecimal` and `octal`.
Name modes are `sequential`, `hexadecimal`, `base52`, `base62`, `runic`,
`glagolitic` and `tifinagh`. Include/exclude fields accept strings or string
arrays; global includes support the recovered `name:g` binding suffix.
Self-defending levels reach 4; object `{ level: 0 }` disables wrapping, while
the recovered scalar `0` means level 1. Unknown properties fail validation.

Root configuration accepts `settings`, `namedSets`, `sourceSets`, `randomSeed`,
`esTarget`, `runtimeInjection`, `runtimeFile`, `disableInline` and
`ignoreUnsafeConstructs`. `esTarget` accepts `es5` or `es2015` through `es2026`
and selects helper syntax; it does not transpile input language features.
`ignoreUnsafeConstructs` permits local renaming around `eval`/`with` where
ordinary validation rejects it. The accepted `license`, `email` and
`checkForUpdates` fields do not enable vendor services. Map and bundle-selection
fields are limited as described below.

Missing settings inherit. `false` and `null` disable a setting. Protection-set
inheritance replaces a whole option object rather than merging its individual
fields. The original defaults have a preserved distinction:

- Omitted configuration enables strings and Base52 local declarations.
- An explicit `settings: {}` enables strings and Base62 local declarations.
- An explicit empty `protectSource` configuration `{}` has no protection
  settings. The `obfuscate` compatibility helper uses defaults for `{}`.
- The special named set `default` enables strings and Base62 local declarations.

Use a nonzero `randomSeed` for repeatable output with the same inputs, settings
and port version. The recovered Park–Miller generator preserves fractional seed
normalization and exclusive upper bounds. A missing or zero seed selects a
time-derived seed, returned in `protectionSummary.randomSeed`.

Inline settings are string directives in a program or function prologue,
including arrow functions and object/class methods:

```javascript
"@jsdefender { booleanLiterals: true }";

function readable() {
    "@pjsd off";
    return "keep this section readable";
}

function selected() {
    "@pjsd strong";
    return "use the named protection set";
}
```

Provide `namedSets: { strong: { ... } }` in configuration. `sourceSets` selects
named sets for whole sources, and `disableInline` suppresses inline overrides.
Recognized protection directives are removed even when inline configuration is
disabled or malformed, matching the recovered core. Settings inherit through
nested functions; per-node policy follows transformed and cloned owners.
Domain/date locks, console cloaking, DevTools blocking and global object hiding
use whole-source settings. Function directives cannot make them local effects.

## Compatibility boundaries

Destructured `let` bindings in C-style `for` headers selected for control flow
fail with the SDK's diagnostic. Constant-argument guard IDs can exceed 65535.

Standalone Zig callers can supply `ProtectionOptions.date_parser` to reproduce
their host's date semantics. Without an adapter, the CLI/library accepts ISO
dates with explicit zones and UTC date-only strings.

Internal source maps (`sourceMaps`) and lexical maps (`generateMaps`) are
implemented and covered by local differential checks.
The core accepts `glob`; supplied source strings require no filesystem
expansion. Webpack, Browserify and Metro recognizers supply the recovered
self-defending module candidates, including malformed-form differential checks.

Property sparsing follows the upstream treatment of prototype setters, exported
declarations and object initializers in loop headers. It also drops async and
generator method flags. These cases can produce invalid or changed programs,
matching the recovered implementation. Static blocks remain unvisited by the
SDK's syntax walker, as do private member bodies. Inline directives using
global-only options resolve as failures with the SDK's diagnostics.
ES5 helper placeholders select `var`. Hardcoded lexical declarations in the
upstream templates remain, including string-decoder loop counters.

The recovered upstream transform itself changes some programs. A controlled
reference check of `for (let i = 0; i < 3; i++) callbacks.push(() => i)` produced
`[3,3,3]` after control-flow transformation; the original produces `[0,1,2]`.
Selected `for (const i = 0; i < 1;)` headers retain an upstream temporal-dead-zone
failure, and multiple labels with `continue` can produce an invalid upstream
target, reproduced by this port. Self-defending wrappers call
the recovered function with a null receiver and can evaluate parameter defaults
twice: a reference fixture using a receiver and `x = ++calls` changed
`[1,1,7]` to `[2,2,null]` in both implementations.
Passing execution fixtures does not establish equivalence for every JavaScript
construct. A new protection configuration still needs application-specific
behavior checks.

## Civil's Vite integration

`misc/vite/obfuscateAssets.ts` defaults to `obscura-rs`. Select Obfuscatti
explicitly with `engine: "obfuscatti"` or, in PowerShell:

```powershell
$env:OBFUSCATE_ENGINE = 'obfuscatti'
bun run build
```

The plugin requires a built native addon. It forwards the existing `minify`
option and uses native default protection; advanced configuration and the
multi-source API are available directly through the addon.
