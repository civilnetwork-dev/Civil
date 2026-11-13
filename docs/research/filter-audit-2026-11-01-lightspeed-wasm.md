# Lightspeed Filter Agent: native bridge and signed relay replies

Audit date: 1 November 2026, America/Los_Angeles. This extends the
[core continuation](filter-audit-2026-11-01-core.md) and closes its specific
gap around Civil's missing relay-response signature check. It does not close
the Filter Agent's complete native, policy or managed-browser coverage.

The 2 November follow-up maps the native host API integrity check and
replays report signing with synthetic Setup inputs in both versions.
[Native reporting follow-up](filter-audit-2026-11-02-provenance.md#lightspeed-native-reporting-and-validation)

Evidence roots, both ignored:

- `extensions/filter-audit-2026-11-01/lightspeedFilterAgent/native-current/`
- `extensions/filter-audit-2026-11-01/lightspeedFilterAgent/native-cached/`

## Artifact identity and complete decoding

| Filter Agent | Provenance | `filter.wasm` bytes | SHA-256 |
|---|---|---:|---|
| 4.4.10.1792039522 | Verified CRX3 publisher proof and exact extracted-file comparison | 5,308,498 | `0b45f4e211ef5096e43249ea57a6b04c208be3b66cd21d7386a1bd5ecf3a523d` |
| 4.4.6.1785883975 | Retained cache; no signed archive or file-root proof available | 5,309,662 | `975e3a27930349de8d235c8654556625fa739f226102f2b802de6e8ac4a7bc0a` |

The current package SHA-256 is
`db60e49b770b3c490e3d35285481453f6330c18c1578452c890ed347f6456b71`.
Its publisher proof derives requested extension ID
`ehnniokiiebpinnfegpkdlcamgdcaaje`. Both the worker and WASM bytes are compared
with the signed ZIP before extracting the current runtime.

WABT **1.0.42** validates and completely decodes the current binary. The WAT
contains **3,207 defined functions**, **21 imported functions**, and **61,575
data segments**. None of its defined functions has a recovered symbolic name.
The complete WAT is **179,112,512 bytes**, SHA-256
`ad55eeeec76e0a117f387553965123eff26c5ddfea4c47ba27ed3a6754bc1f98`.
Exports are the Go execution/memory bridge, not a named classifier API.
Complete disassembly does not mean complete semantic interpretation.

REA's task-local **6.7.0** CLI reached its WASM provider after an initial
sandbox read failure, but then returned `provider_timeout` at **30,000 ms**.
Its partial WAT stdout is retained separately and is not presented as a
complete decode or successful REA inspection. Direct WABT file output supplies
the complete representation. No REA Evidence ID is claimed for this binary.

## Recovered Go runtime and native bridge

Each worker contains its own Go runtime in module **430**. The extractor selects
the exact factory containing the `globalThis.Go` assignment, verifies the
decoded-worker hash, and records its source range and external bindings. The
only external binding is the original pool resolver; the extracted harness
supplies a throwing stub, which none of the exercised paths calls.

| Runtime | Decoded source range | Extracted runtime SHA-256 |
|---|---|---|
| Current | 927185–964090 | `c6300560364ec9e5d55e615864379ce6f8c969297b719e4a9d26e3af1b8ced0e` |
| Cached | 817958–855194 | `eab4f92522985dfc34d6bf70ca0409f9c7bc4df46c4d0f3b5390d538768ecbfd` |

Both actual binaries boot with their corresponding extracted runtime and
register six native functions: `GetIdent`, `Setup`, `ConfigureClass`,
`SetSerialNumber`, `PubKeyVerify`, and `Shutdown`. Four additional functions
(`Debug`, `SetIdentCB`, `SendIdentCB`, `LsReload`) are JavaScript callbacks from
the worker module, supplied explicitly by the harness.

The harness supplies real cryptographic entropy, a clock, bounded execution
and `chrome.runtime.id` metadata. Fetch, WebSocket and XMLHttpRequest throw.
No worker entry point, native `Setup`, real Chrome API, tenant configuration or
network service executes. The VM boundary is a controlled test environment,
not an operating-system sandbox.

The source consumers establish these roles; unexecuted native internals remain
unknown:

| Native method | Observed JavaScript use |
|---|---|
| `Setup` | Called after Go startup with five product/version/backend configuration arguments; return ignored. |
| `ConfigureClass` | Receives an empty class instance that later supplies `Sign` and `Creds`. |
| `PubKeyVerify` | Verifies policy and host/YouTube lookup envelopes; current version additionally verifies blur lookups. |
| `Shutdown` | No-argument call during reload/suspend cleanup; return ignored. |
| `GetIdent`, `SetSerialNumber` | Registered at native startup; no literal/member callsite found in either decoded worker. Dynamic/native use remains unresolved. |

Current/cached `ConfigureClass` consumers are at decoded worker lines
11688–11692 / 11157–11161. Native `Sign` is called with kinds `report` and
`story-mode`. Signed visit batches and browsing activity become SQS message
bodies. The shared `signReport` path also signs helper prompt reports; current
code adds blurred-image batches. `Creds()` takes no arguments and its return
is ignored; native code invokes the supplied `SetCredentials` callback, which
configures the JavaScript SQS client and flushes queued reports.

JavaScript still owns the report-enable, policy, allowed-URL and retry gates.
Its `Score` method contains category/allow-list/YouTube decisions and the
`tamper:policy` result for missing valid policy without cached policy. These
observed bridge consumers do not establish a native content-classification
API. Credential acquisition and report signatures were not executed.

## Actual native response verification

`pubkey-replay.cjs` and `canonical-replay.cjs` run **21 cases per version**
through the actual `LSFilter.WASM.PubKeyVerify` function: **42 native
observations**, all matching their expected outcomes, with **zero network
calls**. Each run uses analyst-generated ephemeral Ed25519 keys. No vendor
private key, production response signature or tenant credential is obtained.

The observations establish:

- Public keys are raw **32-byte Ed25519 keys** encoded in standard padded
  Base64; signatures are **64 bytes**, also Base64.
- A signature over recursively sorted JSON verifies even when the received
  JSON has another property order or whitespace. Signing the received
  unsorted byte sequence fails.
- Object keys sort by UTF-16 code units, recursively through arrays and
  nested objects. Numeric-looking keys require lexical ordering as well.
- Primitive serialization matches ECMAScript in the tested floating-point,
  HTML, control-character, Unicode and line-separator cases. Go-style HTML
  escaping and UTF-8 key sorting failed the native oracle.
- Lone surrogates in keys or values fail verification. Changed category,
  changed signature, wrong key and invalid Base64 also fail.

These results match the relevant behavior of
[RFC 8785's JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.html).
The RFC specifies recursive UTF-16 property sorting, ECMAScript primitive
serialization and rejection of invalid Unicode. The fixtures include its
primitive/property-order examples. This is a bounded interoperability result,
not proof of every native JSON or numerical edge case or of the native
library's identity.

Both workers' `host_lookup` consumers exclude **only the top-level
`signature`** field before passing `JSON.stringify(rest)` into the native
verifier. All other fields remain signed, including nonce, request and unknown
metadata. Current source: exclusion line 11371, rest-copy helper 11527–11546,
host consumer 11794–11825. Cached: 10846, 10999–11018, 11268–11294.

Both versions use the same production public key:

```text
EL37vf6CEFtOP+141jvhQhNmHTQtQovjLxdTPBlZYTw=
```

Current default/getter: 8913 and 11141–11142; cached: 8532 and 10624–10626.
The separately configured staging key is not substituted for this key.

## Civil change and regression evidence

Civil's earlier nonce fix still accepted an unsigned category reply once its
action, host and nonce matched. A regression first reproduced that behavior:
an unsigned reply returned `allowed` where the vendor protocol requires no
verified category decision.

`misc/filters/lightspeed/replySignature.ts` now verifies Ed25519 using Node's
crypto implementation. It serializes the entire unsigned envelope with the
native-compatible recursive ordering, wraps the raw public key in Ed25519
SPKI, and rejects malformed keys, signatures and invalid Unicode. No new
dependency is added. Relay options accept an explicit public key for an
alternate configured relay; the default is the production key above.

The checker requires action, host, nonce **and signature** before accepting
category IDs. Invalid or missing signatures do not finish the lookup; a later
verified reply can still win. Closing or timing out without a verified reply
retains the existing `unknown` verdict. Category taxonomy and user policy
matching continue after verification.

The source-tree fixture file contains synthetic messages, public keys,
signatures and expected results from the current native oracle; it does not
depend on the ignored CRX/WASM files or retain any private key. The cached
binary independently matches all 21 expectations with its own fresh keys.
Five additional tests drive the real checker through an event-emitting mock
WebSocket: correlated signed allow, unsigned unknown, invalid/tampered replies
before a verified block, tampered-only unknown and wrong-key unknown.

Verification:

- Lightspeed tests: **26 passed**.
- Full suite: **73 files passed; 703 tests passed, 1 skipped**.
- `bunx tsc --noEmit`, `bun run lint:check`, `bun run format:check` and
  `git diff --check`: passed.
- Edited production/test functions stay at or below **60 lines**.
- Independent source/review pass found no actionable mismatch.

Real relay acceptance, key rotation, actual installed-extension enforcement,
native identity/licensing internals and full semantic recovery remain open.
The cached release's publication date is not inferred from its version suffix;
it does not fulfill the outstanding dated 2024–2025 acquisition requirement.
