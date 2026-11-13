# LanSchool native message producers, 10 November 2026

The selected LanSchool Student 8.0.2.15 producers execute after translation from
retained PNaCl LLVM IR to WebAssembly. Fifteen producer cases pass. Twelve
messages reach the expected handlers in the shipped Student JavaScript. This
extends the earlier static and JavaScript expiry findings.
[PNaCl provenance](filter-audit-2026-11-01-history-native.md)
and [expiry audit](filter-audit-2026-11-03-lanschool.md).

The original LLVM IR SHA-256 is
`41ac9a12f46ffff25dd2820f71b27d44199e99f7d627dee325a0c50a18d4fabf`.
The build renames numeric global symbols outside strings and comments, adds
entry wrappers, and imports six boundary functions for allocation and Pepper
messages or values. An early attempt renamed text inside a constant and failed
the compiler's size check. The corrected build preserves those bytes and
retains selected source body hashes and the compiler identity in `build.json`.
The translated module SHA-256 is
`fd253ba5802e03f10dce16f4c79c7c14ee7db22661b9d3613666628243479cd7`.

| Original body | Observed contract |
|---|---|
| `@7877` | Four flag cases produce `WEB_LIMITING` with a signed integer flags field and an indicator of whether the owner field is zero. |
| `@7878` | Five list cases emit the signed list type as a string and preserve order and UTF-8 text for the valid fixture entries. Type zero emits an empty array when the input container is empty. |
| `@7879` | Three alerting cases cover the disabled state and both screen-capture flag outcomes. The disabled message omits the capture field. |
| Common guard | Each producer emits zero messages before the synthetic Pepper instance is set. |

The harness supplies a bounded allocator, thread-local `errno` storage and
recording Pepper imports. Unexpected imports throw. The JavaScript replay
extracts the exact `StudentNACL.handleMessage` function and checks the handler
name and payload slice for every emitted message. Downstream handlers record
calls. A list-serialization edge case exposed a missing escaping guarantee, so
the successful list cases establish behavior for their valid fixture inputs.

WABT 1.0.42 and REA 6.7 validate the translated Wasm. REA rejects the original
PNaCl format in its native provider. Its Wasm MCP provider lacked the configured
WABT path. The local REA CLI succeeded with the existing WABT directory after
the sandbox denied artifact access. Evidence ID
`ev_94a7fa9ad4ab56ca0bc01f74e057cab4f4e400d0c8e9f81e8513b2af3702f518`.

Reproduce with the retained inputs and Zig installation:

```powershell
node extensions/filter-audit-2026-11-10/lanschool-native-contract/build.cjs
node extensions/filter-audit-2026-11-10/lanschool-native-contract/replay-producers.cjs
```

`build.json`, `producer-replay.json` and `rea-wasm-cli-external.json` are in the
ignored `extensions/filter-audit-2026-11-10/lanschool-native-contract/` directory.
The authored functions stay within 60 lines. The packet dispatcher, clock
callbacks, Pepper runtime, installed Student behavior and teacher policy remain
outside this replay. The translated producer tests use local synthetic state.
