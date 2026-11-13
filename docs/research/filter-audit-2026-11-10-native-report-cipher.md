# Lightspeed native report cipher and key derivation

Audit date: 10 November 2026, America/Los_Angeles. This closes the selected
report-cipher and signing-key data-flow gaps in the
[9 November native report](filter-audit-2026-11-09-native.md). It covers outbound
`Sign("report", ...)` with synthetic Setup inputs in two retained Filter Agent
modules. It does not establish cloud acceptance, installed enforcement, or the
complete native API.

**Twenty-four reports from the untouched current and cached WASM modules
independently verify as HMAC-SHA256 JWTs and decrypt as AES-256-GCM.** Their keys
are derived from a shipped byte pool and the public JWT time claims. They are
not one fixed key, and equality within a short replay is not a boot-lifetime
property. [Verification receipt](../../extensions/filter-audit-2026-11-10/native-report-cipher/original-crypto-verification.json).

## Inputs and method

| Module | Provenance retained from acquisition | SHA-256 |
|---|---|---|
| Filter Agent 4.4.10.1792039522 | CRX3 publisher proof for `ehnniokiiebpinnfegpkdlcamgdcaaje`; current archive hash rechecked | `0b45f4e211ef5096e43249ea57a6b04c208be3b66cd21d7386a1bd5ecf3a523d` |
| Filter Agent 4.4.6.1785883975 | Local retained cache; no signed archive proof | `975e3a27930349de8d235c8654556625fa739f226102f2b802de6e8ac4a7bc0a` |

The harness checks both original WASM and extracted Go runtime hashes before
instantiation. Setup uses analyst-only product, serial, identity and `.invalid`
configuration. Manifest, license and worker fetches resolve to local files;
other fetches receive a local 503. No vendor request, tenant credential, account
secret or successful report submission is used.
[Source identities and WABT tool hash](../../extensions/filter-audit-2026-11-10/native-report-cipher/source-facts.json),
[Setup harness](../../extensions/filter-audit-2026-11-10/native-report-cipher/setup-replay.cjs).

Early derived-module hooks helped locate native frames. Reusing captured keys
against older untouched-module outputs failed, including an incorrect initial
eight-byte HMAC assumption. Those failed checks remain retained; they are not
equivalence evidence.
[Failed initial check](../../extensions/filter-audit-2026-11-10/native-report-cipher/crypto-verification-failed.json),
[snapshot comparison](../../extensions/filter-audit-2026-11-10/native-report-cipher/original-snapshot-verification.json).

The final observations execute the original bytes. JavaScript wrappers around
the existing `syscall/js.stringVal` import and `crypto.getRandomValues` inspect
live native stack frames without changing WASM instructions, data, function
indices or returned values. Static call sites supply the frame layout; every
candidate is then checked against its own original token. Finally, the verifier
derives keys independently from shipped initialized bytes and JWT claims,
recomputes the MAC, authenticates GCM, and compares decoded plaintext with the
fixture. [Observer](../../extensions/filter-audit-2026-11-10/native-report-cipher/observe-original.cjs),
[independent verifier](../../extensions/filter-audit-2026-11-10/native-report-cipher/verify-original-crypto.cjs).

## Report envelope and encoding

| Layer | Established behavior in the finite fixtures |
|---|---|
| JWT header | `{"alg":"HS256","typ":"JWT"}`; Base64url segments, HMAC-SHA256 over the encoded header and payload |
| Claims | `customer_id`, `data`, `exp`, `nbf`, `iat`; `customer_id` is the synthetic Setup customer, not an added report metadata field |
| Lifetime | `exp - iat` is 432,000 seconds in every observed report |
| Claim `data` | Lowercase hexadecimal encoding of `nonce || ciphertext || tag` |
| Encryption | AES-256-GCM; 32-byte key, 12-byte nonce from the native entropy request, 16-byte authentication tag, no additional authenticated data |
| Plaintext | UTF-8 JSON containing the typed `action` and string `data` fields, in that order |

The encrypted byte length is **28 plus the serialized plaintext byte length**.
The earlier `63 + UTF-8 data bytes` relationship holds for the simple
`relay-report` samples, but is not a general encoding rule: Go JSON escaping
expands `<`, `>`, `&`, U+2028 and U+2029 in the tested string. The recovered
plaintext and byte lengths are retained in the
[verification receipt](../../extensions/filter-audit-2026-11-10/native-report-cipher/original-crypto-verification.json).

Unknown metadata is dropped before encryption. The explicit `customer_id`,
`email`, `device_sn` and `os` additions are also absent from the report
plaintext; the JWT customer remains the Setup value. Missing `action` becomes
an empty string; missing or null `data` becomes an empty string. These results
describe the report struct for these inputs, not story-mode or every native
report type. Earlier invalid-input boundaries remain in the
[9 November signing receipt](../../extensions/filter-audit-2026-11-09/native-closure/current/signing-boundaries.json).

## Native data flow and key provenance

Current-build native function identities are tied to complete WAT and function
body hashes in the [source receipt](../../extensions/filter-audit-2026-11-10/native-report-cipher/source-facts.json).

| Function | Selected role and corroboration |
|---|---|
| 3165 | Passes configured state and report data into 3096 |
| 3096 | Builds report claims, requests key material through the provider interface, calls 3098, and passes a key to JWT `SignedString` |
| 3098 | Calls AES constructor 2242 and GCM constructor 2215; seals through the GCM interface with nonce-prefix output |
| 2217 | Retained GCM `Seal` method; its observed arguments match the successful standard GCM decryption |
| 2925 / 2889 | JWT `SignedString` and HS256 `Sign`; recomputed HMAC-SHA256 matches every original token |
| 3112 | Retained symbol `rqsMsa.(*tN00Ig).Key`; derives time-dependent byte sequences from the pool |
| 3134 | Returns the configured pool slice from the native global at initialized memory address 2,329,840 |

Both shipped modules initialize the same **48,135-byte pool** at memory address
2,279,264. Its SHA-256 is
`8fb21e56c5d7bd16602c92e1f7521859ba4bf2426e88af72157074c351230dcc`.
Instantiating each module without calling Go main confirms the pool is already
present in shipped initialized data. Pool and key bytes are omitted here.
[Independent source checks](../../extensions/filter-audit-2026-11-10/native-report-cipher/source-facts.json).

For the tested modern positive timestamps, the selected `Key` branches use a
state masked by integer `71811299943583663`. Each output byte selects the pool
at `state % pool_length`, then updates the state with `exp` under the same mask.
The AES path starts from `exp` and uses the first 32 generated bytes. The HS256
path starts from `nbf` and generates `12 + ((nbf - 1718294000) % 512)` bytes.
This model reproduces both live key candidates and all original native outputs;
it uses the shipped pool and public claim values, not the synthetic SDK token
as the MAC key. [Native Key body](../../extensions/filter-audit-2026-11-10/native-report-cipher/function-3112.wat),
[model and assertions](../../extensions/filter-audit-2026-11-10/native-report-cipher/verify-original-crypto.cjs).

A controlled one-second clock step changes `exp` by one and changes the AES
key in each original version. Key equality among equal-`exp` samples therefore
does not establish a per-boot key. The varying `nbf` values also explain why
one report's HMAC key does not verify another report merely because Setup and
report data match. The complete selection and validity rules for all key
provider branches, older timestamps and future releases remain outside this
finite result. [Clock and key checks](../../extensions/filter-audit-2026-11-10/native-report-cipher/original-crypto-verification.json).

## Verification and limits

Each version contributes twelve original native reports: the initial Setup
report, nine action/data/encoding/metadata fixtures and two controlled clock
fixtures. All 24 pass independent key derivation, HS256 verification and GCM
authentication. Four additional integrity checks reject a changed GCM tag or
JWT MAC, one of each per version. These checks authenticate the fixture
envelopes; backend acceptance and teacher or tenant authorization were not
tested.

REA's connected WASM tool lacked `REA_WABT_BIN_DIRECTORY`. The retained 6.7.0
CLI used the existing WABT 1.0.42 directory through a process-only environment
variable. Its summary flag was unsupported. A normal request first encountered
the command sandbox's file-read denial; the authorized external run reached
`provider_timeout`, retaining partial output. No successful REA Evidence ID is
claimed. Complete direct WABT output and original-byte runtime observations
support the selected findings; partial REA output is not a complete decode.
[CLI command and status](../../extensions/filter-audit-2026-11-10/native-report-cipher/rea-command.json),
[raw failure](../../extensions/filter-audit-2026-11-10/native-report-cipher/rea-current.json),
[unsupported flag](../../extensions/filter-audit-2026-11-10/native-report-cipher/rea-summary-unsupported.json).

No new concrete vendor URL lead was needed for this data flow. This pass makes
no new archive-coverage claim. Original keys, full synthetic JWTs and memory
observations stay only in the ignored evidence directory. Production code is
unchanged. Authored research functions and callbacks pass the 60-line limit;
the unchanged production suite was not repeated.
[Function-size check](../../extensions/filter-audit-2026-11-10/native-report-cipher/function-lengths.json).

Reproduce from the repository root with retained local artifacts:

```sh
node extensions/filter-audit-2026-11-10/native-report-cipher/observe-original.cjs current
node extensions/filter-audit-2026-11-10/native-report-cipher/observe-original.cjs cached
node extensions/filter-audit-2026-11-10/native-report-cipher/verify-original-crypto.cjs
node extensions/filter-audit-2026-11-10/native-report-cipher/source-facts.cjs
node extensions/filter-audit-2026-11-10/native-report-cipher/check-functions.cjs
```

Story-mode, credential acquisition, cloud report delivery, installed extension
policy and server-side handling remain untested in this pass. These local
results do not establish that a constructed token is accepted as an authorized
report by a vendor service.
