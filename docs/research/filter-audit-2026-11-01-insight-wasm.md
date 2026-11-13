# Insight WASM: recovered application paths and actual native replay

Audit date: 1 November 2026, America/Los_Angeles. This extends the
[signed historical comparison](filter-audit-2026-11-01-signed-history.md).
The signed Insight **3.8.4** and **3.11.0** binaries now have selected native
success/error execution evidence, in addition to the earlier static inventory.
The separate Lightspeed Filter Agent classifier remains a different target.

Evidence root: ignored
`extensions/filter-audit-2026-11-01/lightspeedInsightAgent/wasm-functions/`.
No production source changes follow from this analysis alone.

## Artifact and tool identity

Both `client.wasm` files and the actually imported `js/wasm_exec.js` pass the
Web Store-signed file-root checks before execution. The historical mirror's
changed manifest, icons and environment configuration remain excluded.

| Insight | WASM bytes | WASM SHA-256 |
|---|---:|---|
| 3.8.4 | 10,508,842 | `76b83bf75abdec330ff3b625e2f69ce3dd4d9b8e0e7d3dd563c64cc9ca88d530` |
| 3.11.0 | 11,043,978 | `78b1150e2d950d7640f90d862971c94ca20afd1bf7de6c29c9a067442b95b0f3` |

The imported Go runtime glue is byte-identical across these versions:
SHA-256 `2c161c00edef66cb620ae9a300870a1e3615581e7847c847046b6c75b10bbef2`.
This is `js/wasm_exec.js`, which the speed-test module imports; the separately
packaged root-level file is not substituted for it.

Portable **WABT 1.0.42** was acquired from the
[official release](https://github.com/WebAssembly/wabt/releases/tag/1.0.42).
Its Windows archive SHA-256 is
`62f1eb2b51aa57cf0f0b8ba333bf2c72a049930aa9c5de01dcad271c4fe48c88`,
matching both the release digest and downloaded checksum file.
`analysis-tools/wabt-receipt.json` retains tool hashes and archive inventory.
The archive provides `wasm2wat`, `wasm-objdump` and `wasm-validate`; it does not
provide `wasm-decompile.exe`. This pass decodes WAT, not original Go source.

REA's MCP WASM call reports an unconfigured absolute tool directory. A
task-local, version-pinned **rea-agents 6.7.0** CLI was then run with a
process-only `REA_WABT_BIN_DIRECTORY`. It rejects the current module because
its input limit is **8,388,608 bytes**. The full typed failure is retained as
`rea-insight.json`; no bytes were truncated to fit that limit. No REA Evidence
ID or successful REA WASM inspection is claimed. Direct WABT decoding and
controlled Node execution supply the evidence below. App configuration and
global PATH were not changed.

## Complete WAT generation and selected function map

Both complete decoded WAT files remain available locally. The indexer streams
them, records every function name/index and selects the named application
functions under `main` and the Insight speed-test module prefix. It retains
each selected body and direct call references separately.

| Insight | Imported / defined functions | WAT bytes | WAT SHA-256 |
|---|---:|---:|---|
| 3.8.4 | 22 / 5,797 | 333,789,640 | `a0fa3ce9929f0447014a8abeeffb776d46f6f8441086baee9224944d67a34287` |
| 3.11.0 | 22 / 6,215 | 331,928,415 | `22f5338fa1db3eae9efccc6bd5b2e1cfda77bf2b5b41c11529993c812320e686` |

These are WABT 1.0.42 representation digests. The older report used 1.0.41;
different WAT formatting/digests do not imply changed original WASM bytes.

There are **15 selected application functions per version**:

| Application path | 3.8.4 indices | 3.11.0 indices | Established role |
|---|---|---|---|
| `ChunkedRead` and `FiniteRandReader` methods | 5716–5719 | 6141–6144 | Chunk-reading and finite upload-body reader paths. |
| `SpeedClient.RunSpeedTest`, `runSpeedTest`, deferred helper | 5807–5809 | 6225–6227 | Coordinated test, HTTP exchange and response processing. |
| `defaultBodyFunc` | 5810 | 6228 | POST request construction and chunk headers. |
| `main.main`, `wrapSpeedtest` | 5811–5812 | 6229–6230 | Registers the JavaScript bridge and waits for events. |
| `definedCheck`, `jsonError`, `marshalResult` | 5813–5815 | 6231–6233 | Required-field checks, error serialization and result JSON. |
| Wrapper closure and spawned worker closure | 5816–5817 | 6234–6235 | Dispatches the supplied configuration into the test/client/callback path. |

The direct references include Go HTTP, header, IP, integer-parsing, JSON and
JavaScript bridge functions. Go indirect calls remain explicitly unresolved
in the static graph. Function names/prefix selection do not prove every
inlined or anonymous application branch was separately recovered.

`data-constants.cjs` also parses active data segments and maps candidate
instruction constants back to memory/file locations. Both binaries have
**100,000 data segments**, independently corroborated by `wasm-objdump -h`.
Mapped prefixes include configuration fields, `/speedtest`, chunk headers,
upload metric headers and error formats. They are candidate references:
adjacent Go strings share storage, so a printable preview is not an inferred
string length or complete argument-flow proof.

## Actual Go runtime and WASM execution

`replay-go.cjs` starts the unmodified signed Go glue and WASM in a fresh Node
child for each case. The real Go `main` registers `runSpeedtest`; the replay
then calls that bridge with a supplied configuration and callback. It does
not execute the extension's JavaScript background bootstrap or tenant setup.

Each child has a 15-second outer deadline, VM call timeouts and a 256 MiB
JavaScript heap setting. That heap setting is not a total WASM-memory limit.
The VM supplies console, clock, entropy, timers and browser response APIs.
Fetch either returns explicit synthetic data or throws; WebSocket/XHR attempts
throw. No native host filesystem, credentials or real network are supplied.
Node VM is not an OS security boundary.

The response fixture includes ordinary Fetch fields, including `redirected`.
Go 1.26 reads that boolean in its
[browser RoundTripper](https://github.com/golang/go/blob/go1.26.0/src/net/http/roundtrip_js.go).
An initial incomplete fixture omitted it and caused a Go `Value.Bool` panic;
that fixture defect was corrected rather than attributed to the extension.

All **22 native cases** pass, eleven per version:

| Supplied case | Observed native behavior in both versions |
|---|---|
| Each of the five required fields omitted individually | Delivers `config.<field> is undefined`; zero fetch calls. Fields: `server`, `chunkSize`, `chunkCount`, `maxPayloadSize`, `adaptiveThreshold`. |
| HTTP 503 | One mock POST; returns the native non-200 error with status 503. |
| Valid 1,024-byte fixture | One mock POST; native success callback reports 1,024 uploaded/downloaded bytes, chunk timings, transaction ID and supplied source IP. |
| Adaptive threshold 500, payload cap 2,048 | Two mock POSTs: 1,024 then 2,048 bytes. Native result describes the final attempt. |
| Three 1,024-byte chunks | One 3,072-byte mock POST and three upload/download chunk measurements. |
| Invalid upload-duration response header | One mock POST; native integer-parsing error. |
| Full URL supplied as `server` | URL construction fails before fetch; this field expects a host, not a scheme-bearing URL. |

The replay makes **12 mock fetch calls total** and zero external requests.
The observed request is:

```http
POST https://speedtest.invalid/speedtest
Chunk-Size: 1024
Chunk-Count: 1
Transfer-Method: chunked
```

Its body length equals chunk size times count. Adaptive mode changes chunk
size to 2,048 in its second request. The `.invalid` host is analyst-supplied.
Passing `https://speedtest.invalid/` instead produces an invalid constructed
host containing an encoded scheme; that is a configuration-format error,
not a proxy-classification result.

Synthetic success responses provide `Request-Source`, `Upload-Duration`,
`Upload-Size`, `Upload-Timings` and a fixed-size response body. Native output
contains `Results.TransactionId`, upload/download sizes and durations, method,
chunk arrays, `RanAt`, and `IP`. Upload values and IP reflect the supplied
headers; download durations measure the local controlled execution. These are
not school-network measurements or a performance comparison between releases.

## Implication and remaining scope

This closes the “only build strings/glue identify the speed-test role” gap for
the executed native paths. The actual binaries create the expected transport
request, process metric headers/body data, adapt payload size and deliver
success/error callbacks. The selected output is not itself a proxy verdict.
That does not establish the absence of every classifier in unexecuted code,
and it says nothing about the separate Filter Agent WASM's decisions.

Civil's existing resource/comment fixes and server checker changes are not
replaced by a workaround for this privileged measurement path. No further
production change is justified by these results alone.

Reproduction from the repository root:

```sh
bun extensions/filter-audit-2026-11-01/lightspeedInsightAgent/wasm-functions/index-wat.cjs 3.8.4 3.11.0
bun extensions/filter-audit-2026-11-01/lightspeedInsightAgent/wasm-functions/data-constants.cjs
node extensions/filter-audit-2026-11-01/lightspeedInsightAgent/wasm-functions/replay-go.cjs
```

The first command requires the retained WAT files; their generation command
and exact tool identity are recorded alongside the research. `go-replay.json`
retains all inputs, callbacks, mock requests, source hashes and runtime
identity. The per-version `index.json`, `data-constants.json` and selected
`function-*.wat` files preserve static source ranges and unresolved calls.
`receipt.json` verifies both complete WAT digests and every selected body,
and retains generation commands and the REA CLI package identity/integrity.
`git diff --check` passes. Production code did not change, so the unchanged
production suite was not repeated.

Remaining work includes unexecuted native branches, actual installed-extension
policy and endpoint behavior, Filter Agent classifier/crypto paths, helper
models, other vendor/native targets and missing historical packages. The full
original goal remains active.
