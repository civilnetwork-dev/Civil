# Native and runtime closure, 9 November 2026

This continues the [native](filter-audit-2026-11-01-native.md),
[PNaCl](filter-audit-2026-11-01-history-native.md),
[Filter Agent WASM](filter-audit-2026-11-01-lightspeed-wasm.md),
[Insight WASM](filter-audit-2026-11-01-insight-wasm.md),
[reporting](filter-audit-2026-11-02-provenance.md), and
[LanSchool expiry](filter-audit-2026-11-03-lanschool.md) investigations.
It closes selected calling-contract and codec gaps with new executions. It does
not establish complete native equivalence or a managed-device unblock verdict.
No production source changed; no new production mismatch was found.

All new scripts and receipts are retained under ignored
[`extensions/filter-audit-2026-11-09/native-closure/`](../../extensions/filter-audit-2026-11-09/native-closure/).
[The receipt](../../extensions/filter-audit-2026-11-09/native-closure/receipt.json)
records input hashes, evidence hashes and checks. Replays execute shipped WASM or
selected JavaScript functions with explicit synthetic inputs and mocked Chrome,
storage, clock or Fetch dependencies. No external vendor request is sent. Node
VM is not an operating-system security boundary.

## Closure table

| Prior gap | New evidence and result | Residual limit or required access |
|---|---|---|
| Filter Agent `GetIdent` calling contract | **24 fresh-process cases** across current 4.4.10.1792039522 and cached 4.4.6.1785883975. Every tested pre-Setup call exits with code 2. After synthetic Setup, zero arguments works: native returns `null` and emits one `LSFilter.WASM.SendIdentCB` identity object. Strings, objects and callback arguments do not replace the supplied Chrome identity. No identity callback precedes the tested call. [Cases](../../extensions/filter-audit-2026-11-09/native-closure/ident-contract.json), [representative receipt](../../extensions/filter-audit-2026-11-09/native-closure/current-after-setup-no-args.json). | Closed for these calling shapes and this Setup fixture. Real profile/licensing behavior requires an installed extension and authorized tenant configuration. Callback `license: "licensed"` and `report: true` are fixture-run outputs, not evidence of real license validity. |
| Native response verification and encoding | Revalidated the previous **42 Ed25519/canonicalization cases**, added **28** signature/key/JSON/correlation boundaries, and compared all **70** with Civil's actual `verifyRelayReply`; all match. CR/LF in Base64 is accepted. Missing padding, URL-safe encoding, inserted spaces, wrong key/signature lengths, invalid/trailing JSON, changed nonce, added metadata and changed nested data reject. [New native cases](../../extensions/filter-audit-2026-11-09/native-closure/current/verifier-boundaries.json), [Civil comparison](../../extensions/filter-audit-2026-11-09/native-closure/civil-verifier-comparison.json). | Closed for the finite fixtures; no vendor private key, production signature, relay session or key rotation tested. A real reply and its configured public key are required for live acceptance. |
| Native report signing/data encoding | Revalidated the previous **ten signing cases**. Added **32 report-signing calls**: missing, null and empty string `data` all produce JWTs; numeric `data` rejects. String ciphertext length is **63 plus UTF-8 data bytes** for these samples. Repeated inputs produce different ciphertext hashes. Added unknown metadata does not increase observed ciphertext length. JWTs advertise HS256 and expire 432,000 seconds after issue. [Current](../../extensions/filter-audit-2026-11-09/native-closure/current/signing-boundaries.json), [cached](../../extensions/filter-audit-2026-11-09/native-closure/cached/signing-boundaries.json). | Cipher and signing-key internals remain unresolved; ciphertext length alone cannot identify an algorithm or prove which fields are encrypted. These gaps require further bounded native data-flow analysis, not tenant secrets. Credentials acquisition and server acceptance separately require authorized service access. |
| ContentKeeper alternate native wrappers | Newly decompiled `0x21f80` and `0x22160`; authenticated unstripped symbols identify them as `ckZipCompress` and `ckZipDeCompress`. Their calls resolve to `deflateInit_`/`deflate`/`deflateEnd` and `inflateInit_`/`inflate`/`inflateEnd`. Compression uses level 9. Thus `ckCommEncode` compresses before Blowfish/Base64; `ckCommDecode` inflates after Base64/Blowfish. They differ from `ckCommHide`/`ckCommShow`. [Decompilation including warnings](../../extensions/filter-audit-2026-11-09/native-closure/ghidra-compression-wrappers.json), [symbols and section equality](../../extensions/filter-audit-2026-11-09/native-closure/ck-native-symbols.json). | Selected static closure only. NaCl indirect-return/type warnings remain. Native nexe execution, error semantics, all architectures and gateway interoperability require a compatible NaCl runtime or further verified translation. |
| G3 codec/native agreement | Actual shipped G3 glue/WASM executed on **14 inputs plus eight malformed ciphertexts**. Nine inputs, including UTF-8, block boundaries, a repeated block, NUL and ordinary comma tokens, match an OpenSSL Blowfish-ECB model using the native `0x211e0` key/zero padding. Empty comma tokens are dropped; NUL terminates the C string. This is finite agreement with the `ckCommHide` model, not nexe execution. [Receipt](../../extensions/filter-audit-2026-11-09/native-closure/ck-boundaries.json). | Empty tokens distinguish the G3 token API from applying the native single-string model independently to every token. Malformed Base64 can return garbled text; a successful call is not authenticated plaintext. Whole-worker/gateway behavior remains untested. |
| LanSchool native-message/policy path | PNaCl and complete LLVM IR hashes revalidated. **18 new JavaScript boundary checks** cover exact sender allowlisting, banned-word/alerting policy toggles, list disable with retained entries, expiry, ring wrap, backspace, modifiers and the 10 ms content-script throttle. Type-zero list processing disables browsing restrictions yet still rebuilds supplied entries. [Receipt](../../extensions/filter-audit-2026-11-09/native-closure/lanschool-boundaries.json). | Native packet parsing/execution remains open. Static native producers plus selected receiver execution do not establish teacher authorization, runtime wire values or actual classroom policy. Requires compatible PNaCl runtime/translation or an authorized installed Student environment. |
| Helper model and self-test gates | Replayed the actual signed worker/model/WASM in SIMD and forced scalar modes: both load, classify synthetic 224/384 px inputs and reject 256 px. Missing manifest self-test fails. A deliberately wrong expected vector produces `selfTestError` **0.8412874341011047**; the worker reports that value with `loaded`, while the separately executed offscreen predicate rejects it. Its threshold is inclusive **0.02**. [SIMD](../../extensions/filter-audit-2026-11-09/native-closure/model-selftest.json), [scalar](../../extensions/filter-audit-2026-11-09/native-closure/model-selftest-scalar.json), [mutation](../../extensions/filter-audit-2026-11-09/native-closure/model-tampered-selftest.json), [offscreen gate](../../extensions/filter-audit-2026-11-09/native-closure/helper-selftest-gate.json). | Closed for model loading, these inputs and the selected gate. Model scores are not policy decisions. Complete offscreen scheduling, browser image acquisition, installed-helper orchestration and cloud enforcement remain untested. |
| Insight native success/error paths | The earlier 22-case native runtime receipt already covers required-field checks, POST construction, adaptive sizing, metric headers and errors. No new Insight behavior is claimed here. [Owning report](filter-audit-2026-11-01-insight-wasm.md). | Unexecuted branches and actual measurement endpoints remain open. These speed-test outputs cannot be promoted to a Filter Agent classification result. |

## Identity and tooling

The Filter Agent module hashes remain
`0b45f4e211ef5096e43249ea57a6b04c208be3b66cd21d7386a1bd5ecf3a523d`
(current) and
`975e3a27930349de8d235c8654556625fa739f226102f2b802de6e8ac4a7bc0a`
(cached). The current archive's requested-ID publisher proof is checked by the
Setup harness; the cache still lacks its own publisher proof. Native ContentKeeper
`.text` and `.rodata` match between the stripped and unstripped files. LanSchool
`student.pexe` remains
`6794203ca95da677bc5b5ca50a543ca710f6236d41f3a2dd2d670836feb264f3`.
These are artifact identities, not newly established release dates.
[Filter Agent receipt](../../extensions/filter-audit-2026-11-09/native-closure/current-after-setup-no-args.json),
[ContentKeeper receipt](../../extensions/filter-audit-2026-11-09/native-closure/ck-native-symbols.json),
[input receipt](../../extensions/filter-audit-2026-11-09/native-closure/receipt.json).

REA's connected WASM tool lacked `REA_WABT_BIN_DIRECTORY`. The retained **REA
6.7.0** CLI used the existing checksum-verified **WABT 1.0.42** through a
process-only environment variable; global configuration and PATH were untouched.
The command sandbox denied static file access, so the same authorized local
inspection ran outside it. G3 validates, with exact module SHA-256
`3148053fdd36cc956e1b5b60bbcc3699ce5d5bf15166c26b7098ba6e232d5033`
and REA Evidence ID
`ev_d77634a438351caf8a1c114c63e40d8fdcf91657146dc369dd8d928593ca6061`.
The receipt retains complete WAT, exact imports/exports, tool hashes and limits;
WAT decoding does not prove original source or runtime equivalence.
[REA Evidence](../../extensions/filter-audit-2026-11-09/native-closure/rea-g3.json),
[command](../../extensions/filter-audit-2026-11-09/native-closure/rea-command.json).

LanSchool expiry retains a timing nuance: the receiver rounds milliseconds to
whole seconds before its strict greater-than comparison. A 100-second timestamp
expires at a sampled clock of 130.5 seconds, but not 130.499. Numeric zero list
type skips expiry; string `"0"` does not skip that initial strict comparison and
can re-run the disable operation. These outcomes describe the shipped receiver,
not exact native scheduling or a district's policy duration.
[Boundary cases](../../extensions/filter-audit-2026-11-09/native-closure/lanschool-boundaries.json).

## Archive leads and reproduction

Every new concrete URL lead has a
[URL ledger](../../extensions/filter-audit-2026-11-09/native-closure/url-ledger.json)
and [Wayback query receipt](../../extensions/filter-audit-2026-11-09/native-closure/wayback-searches.json).
The candidate Lightspeed GraphQL URL and Chromium compatibility-note URL have no
exact captures. The legacy Stoneware capture retrieved for the requested date
contains only a [captcha refresh](https://web.archive.org/web/20231210044131id_/http://www.stone-ware.com);
it supplies no native protocol evidence and was not followed. G3's gateway URL
is a runtime template; no tenant/private address was collected or queried.

Run from the repository root, using the retained input artifacts:

```sh
node extensions/filter-audit-2026-11-09/native-closure/ident-contract.cjs
node extensions/filter-audit-2026-11-09/native-closure/verifier-boundaries.cjs current
node extensions/filter-audit-2026-11-09/native-closure/verifier-boundaries.cjs cached
node extensions/filter-audit-2026-11-09/native-closure/signing-boundaries.cjs current
node extensions/filter-audit-2026-11-09/native-closure/signing-boundaries.cjs cached
node --openssl-legacy-provider extensions/filter-audit-2026-11-09/native-closure/ck-boundaries.cjs
node extensions/filter-audit-2026-11-09/native-closure/ck-native-symbols.cjs
node extensions/filter-audit-2026-11-09/native-closure/lanschool-boundaries.cjs
node extensions/filter-audit-2026-11-09/native-closure/model-gates.cjs
node extensions/filter-audit-2026-11-09/native-closure/model-gates.cjs --scalar
node extensions/filter-audit-2026-11-09/native-closure/model-gates.cjs --invalid-manifest
node extensions/filter-audit-2026-11-09/native-closure/model-gates.cjs --tamper-selftest
node extensions/filter-audit-2026-11-09/native-closure/helper-selftest-gate.cjs
bun extensions/filter-audit-2026-11-09/native-closure/compare-civil.ts
node extensions/filter-audit-2026-11-09/native-closure/verify-receipts.cjs
```

All listed checks passed. New and copied replay functions stay within 60 lines.
The unchanged production suite was not repeated for this documentation/evidence
change. Historical packages, installed enforcement, native execution where
explicitly excluded above, actual tenant services and hardware remain outside
the completed scope.

## Report-cipher follow-up, 10 November

The [later original-module investigation](filter-audit-2026-11-10-native-report-cipher.md)
closes the selected report-cipher and signing-key gaps above. Twenty-four
untouched current/cached WASM reports independently verify as HS256 and decrypt
as AES-256-GCM with a 12-byte nonce, 16-byte tag and no additional authenticated
data. The tested keys derive from a shipped byte pool and public `exp`/`nbf`
claims. A controlled clock step disproves a boot-lifetime constant-key inference.
The general observed length rule is 28 plus serialized plaintext bytes; the
earlier 63-plus-data relationship remains valid only for its simple samples.

The later report preserves failed early captures, identifies exact source and
tool hashes, and supplies independent derivation/encoding/integrity assertions.
Cached bytes still lack their own signed-archive proof. Cloud acceptance,
credential acquisition and other native API branches remain untested.
