# Filter extension continuation, 1 November 2026

Status: partial. This continues the [30 October audit](filter-audit-2026-10-30.md), preserves its original scope, and adds verified client/server fixes. The requested multiple releases, approximately one-to-two-year-old packages, every important file, and managed-device enforcement coverage are not complete.

The most useful new finding is a separately distributed **Lightspeed Filter Helper**, omitted from the catalog but named by the Filter Agent. It contains the concrete proxy detectors that the earlier large-worker/WASM investigation had not reached. Its resource predicates identify URLs Civil still loaded after neutralizing the engine's entry scripts.

The [collector and rendered-page follow-up](filter-audit-2026-11-01-helper-runtime.md) executes the complete synchronous proxy detector method. It fixes a second, comment-only fingerprint in proxied HTML and records the independent root/new-tab signals that remain. Resource-only zero scores below must not be read as whole-page allow verdicts.

The [Filter Agent native follow-up](filter-audit-2026-11-01-lightspeed-wasm.md) executes its real response verifier in two versions. Civil now checks Ed25519 signatures as well as request correlation before accepting relay categories. This addresses false decisions from unsigned or tampered replies; it does not establish real managed-policy enforcement.

The [2 November follow-up](filter-audit-2026-11-02-provenance.md) authenticates 3,297 listed files across 21 retained caches, records primary dates for selected releases, acquires the separate Gopher Buddy successor, and replays native Lightspeed reporting in two versions.

## Implemented changes

| Surface | Source-established defect | Change |
|---|---|---|
| Runtime resources | Helper 1.5.1.1793289492 assigns 35 points to a matching `/epoxy/`, `/libcurl/`, or `/baremux/` resource; its detector threshold is 30. | `misc/runtimeScripts.ts` serves transport directories directly under neutral aliases. Startup and `setupBareMux` use them. There is no redirect, and missing aliases remain 404. |
| Proxied HTML preambles | Two developer comments in injected scripts each match the helper's engine-code predicate; together they produce a tier-1 match. | Keeps those comments in source outside the HTML strings. Executable JavaScript is identical; real proxied-frame detection clears in the selected pipeline at both viewport sizes. Independent root-page signals remain. |
| Lightspeed relay checker | Both acquired agent workers correlate replies by UUID and verify signed envelopes. Civil omitted the nonce and accepted unsigned or stale replies. | Requires matching action, host, nonce and an Ed25519 signature over the native-compatible canonical envelope. Invalid replies remain inconclusive. |
| Aristotle reputation checker | Both recovered Student socket implementations encode outbound packets with MessagePack, share the socket/authentication session ID, and correlate RPC replies. Civil sent JSON and accepted unrelated decisions. | Uses binary MessagePack, the shared session ID, and matching RPC identifiers. The existing domain-only checker contract remains. |
| iboss checker | Civil defaulted a missing `blockUrl` to zero, producing `allowed` from malformed cloud replies. | Requires a finite numeric decision unless the existing explicit error-code branch applies. Malformed replies return `PARSE`. |
| FortiGuard checker | The shipped agent retries HTTP 414 and rating status 2/3 once without path/query. Civil had no fallback, and its deprecated `validateStatus` option did not admit HTTP 414. | Mirrors the bounded origin fallback using Xior's supported `validateResponse`; other HTTP errors and an unsuccessful retry remain errors. Successful full-URL ratings are unchanged. |
| InterCLASS probe | `message-page.html` carries operational errors as well as policy blocks. Matching only its filename produced false flags. | Known policy modes remain blocks; error, missing, and unknown modes are inconclusive before marker/shrinkage fallbacks. Harness rechecks them and never prints an unresolved result as clean. |

The neutral directory aliases are:

| Resource | Public directory |
|---|---|
| Bare transport | `/_runtime/request/` |
| libcurl transport | `/_runtime/channel/` |
| Epoxy transport | `/_runtime/socket/` |
| BareMux module/shared worker | `/_runtime/worker/` |
| BareMux transport bridge | `/_runtime/bridge/` |

All previous routes remain available for existing clients. The current document already loads three engine entry scripts; the older report's four-script description records an earlier state. This pass changes the additional transport resources, not their implementations or users' selected methods.

## Evidence availability and integrity

The ignored `extensions/filter-audit-2026-10-30/` tree was absent from this checkout. The original `~/extensions/` cache and a newer `extensions/filter-audit-2026-11-01/` acquisition tree were present. Existing receipts identify 23 current-channel packages acquired earlier on 1 November; their acquisition was reused rather than described as a fresh download by this pass. IMTLazarus in that acquisition is **26.10**, superseding the older report's 26.9 current-channel observation.

`verify-acquisitions.cjs` independently validates all 23 retained CRX3 publisher signatures, derives each requested extension ID from its public key, and verifies all **2,430 extracted files** against both the signed ZIP bytes and acquisition inventories. Altered-archive controls fail signature verification. The newly acquired helper's CRX3 publisher proof likewise derives `egnmgclkeiioginamdjpnglaooajmcjm`; its **24 extracted files** match the signed archive. Receipt: `acquisition-integrity.json`.

The helper is version **1.5.1.1793289492**, package SHA-256 `35e1c055989ca0a1fe44218d827b0a165e452b3356679edce27f6d7b8e6688e2`. It was obtained from the official vendor endpoint named in the acquired Agent's distribution configuration. It is a dependency of a requested target, not another version of one of the catalog's 28 IDs.

The initial `coverage.cjs` inventory contained **43 distinct manifest versions across the 28 requested IDs**, plus the separate helper. The [historical/native follow-up](filter-audit-2026-11-01-history-native.md) restores eight signed packages; the later [signed-mirror restoration](filter-audit-2026-11-01-signed-history.md) adds three manifest versions, bringing the inventory to **54 versions**. A separate authenticated Blocksi 3.4.15 code subset is excluded because its altered manifest says 3.4.4. This is not a count of fully authenticated complete releases. Cached trees and historical mirrors retain their own provenance limits. Other versions documented by the older group reports are still absent; those earlier reports are evidence of the prior investigation, not proof that their local artifacts remain available. No older-package date is inferred from a version suffix.

The five current-channel gaps remain Cisco Umbrella App, Cisco Umbrella Extension, ContentKeeper, Gopher Buddy, and Mobile Guardian. Their retained update responses supplied no package. The cache provides code to inspect, not proof that its version is the latest distribution anywhere.

## New analysis and controlled replays

Detailed sources, hashes, exact selections, and limits are recorded in:

- [Core follow-up](filter-audit-2026-11-01-core.md): recovered Lightspeed worker pools, omitted helper, concrete proxy predicates, reporting/policy gates, and nonce protocol.
- [Network follow-up](filter-audit-2026-11-01-network.md): selected Aristotle background/socket recovery in both versions, actual-code socket replay, and iboss response handling.
- [Native follow-up](filter-audit-2026-11-01-native.md): eight additional ContentKeeper native helpers, G3's shipped WASM codec, and LanSchool's gated input-reporting path. It also corrects the old `.rodata` address to `0x10020200`.
- [Classroom follow-up](filter-audit-2026-11-01-classroom.md): 20 authored InterCLASS source-map modules, policy/error distinctions, input reports, LoiLo's health-triggered reloads, and Mobile Guardian's transport-failure path.
- [Historical/native follow-up](filter-audit-2026-11-01-history-native.md): restored signed packages, five-version Securly replay, complete LanSchool PNaCl decoding, and selected native policy-message paths.
- [Filter Agent native follow-up](filter-audit-2026-11-01-lightspeed-wasm.md): complete current WAT, six native bridge methods, 42 actual native verification cases across two versions, and Civil's signature fix.

### FortiGuard rating fallback

The selected current `service_worker.js` has SHA-256 `c937c9b02b59ba67f5769715cadff6b87b3b90849fbc9d0dc3a623b375887c06`. REA analyzed the manifest and worker as `ev_c9ca31cfde67be54a337ec86c990a23537286302aacb95eff5bf72c51a020bf1`; source selection and semantic limits leave application coverage partial.

`fortiguard/rating-replay.cjs` extracts the exact shipped `rateUrlProcess`, `retryRateUrlProcess`, and `rateTrimmedUrl` methods. With supplied HTTP/rating responses, mocked networking, and timers not advanced, it demonstrates:

- HTTP 414, rating timeout 2, and rating internal error 3 each produce exactly one origin retry.
- HTTP 503 does not become a category decision.
- Repeated HTTP 414 stops after the second request.

The regression suite exercises Civil through real Xior response handling, including a plain-text 414 and an error body shaped like a successful rating. No vendor rating submission was made.

### Impero and IMTLazarus

The pre-existing Impero and IMTLazarus replay scripts were read and rerun; their assertions pass. These findings had not been incorporated into the older main summary.

Impero 4.0.286's `serviceWorker.js`, SHA-256 `47f1af6a90f618a866c2e24ba8ca813359511cad32bd3b04c1810eb8682f7794`, contains separate typed-word and viewed/OCR-word monitors. The selected factories compare an XXH32 candidate and SHA-256 verification hash, obtain keyword policy, and construct capture reports. The replay supplies a synthetic keyword, mocked OCR/capture/hash helpers and network, and verifies a SHA-256 negative control. Captured requests target an analyst-created `.invalid` tenant and are never sent. The synthetic word is not evidence of the vendor's actual keyword policy.

The IMTLazarus replay uses the exact selected `procesarTextoEscrito` function and the packaged 18,765-entry risk dictionary in cached 26.4 and current 26.10. The dictionary bytes match. For the retained `proxy gratis` input, 26.4 clears the input and alerts without a runtime report; 26.10 emits `report_risk_term` even when the returned popup setting is off. Turning the popup on adds clearing/alert behavior. These are controlled function-level observations, not full injection or cloud enforcement tests. No Civil edit can establish control over a separately installed extension's privileged reporting by changing Civil's request-host middleware.

## Real Chrome verification

The production build and configuration bundles were served on loopback with test credentials. A temporary fixture loaded the unmodified production engine, controller, initialization bundle, all three transport modules, and the BareMux shared-worker bridge. A real `https://example.com/` document loaded through Civil's **Bare** transport. The normal browser UI also completed that navigation separately.

REA launched and cleaned up disposable Chrome profiles at **1366×768** and **390×844**. Both fixture runs report `passed`, show the proxied document title, and retain actual parent/frame resource-timing URL arrays. Browser version: Chromium **156.0.8078.74**.

| Capture | Evidence ID |
|---|---|
| 1366×768 | `ev_489745a799a0172cbbd60cba1c6680149bb3ef0b0e47e1f515356521c490aeed` |
| 390×844 | `ev_5f020ea3133cf74230875ac9c68caa545e56d66ee7103ce9ab7c818678162382` |

The helper's actual recovered Scramjet/BareMux functions were replayed with those **observed resource arrays**. Both parent and frame arrays score zero at both sizes. Adding the previous `/epoxy/index.mjs` URL to each observed parent array is a negative control: it scores 35 and sets the aggregate tier-1 detection flag. This proves the specific resource-predicate reduction on those captured inputs; it is not a replay of the full helper collector or policy.

The initial Epoxy/Wisp navigation in the normal browser UI failed with `Wisp(WsImplSocketClosed)`. The server's retained session output reported `routeUpgradeCallbacks is not supported on this platform`; `misc/wisp/native/src/lib.rs` contains that non-Unix fallback. The test machine is Windows. PostgreSQL/Redis were also unavailable under the placeholder test configuration. Importing the Epoxy/libcurl modules succeeded, but successful navigation was demonstrated only through Bare. No successful Wisp-network claim follows from these captures.

The captures mark event coverage incomplete because some background requests were unfinished when capture ended; no retained event was dropped. Completed fixture assertions, DOM, screenshots and explicit resource arrays remain available, while later activity is unknown. No vendor extension was installed, and isolated-world global visibility, remote classifier verdicts, tenant policy, later rescans and real school enforcement were not established.

Complete root REA records are exported to `root-rea-evidence.json`; per-run JSON, resource snapshots and PNGs are adjacent. The fixture is retained as `runtime-probe.html` in the ignored evidence directory; it is not a product page.

## Verification

- The combined worktree suite passed **729 tests across 76 files**, with one opt-in live CAPTCHA test skipped. This run includes the 2 November probe, domain picker, Blocksi, Linewize, and Cisco changes.
- `bunx tsc --noEmit`, `bun run lint:check`, `bun run format:check`, and `git diff --check`: passed.
- `bun run build:configs` and `bun run build`: passed for the earlier runtime changes. The later server-only signature fix was checked with the full suite, typecheck and lint; the build was not repeated for it.
- Actual-code FortiGuard, Aristotle, helper detector, Impero, IMTLazarus, G3 WASM and LanSchool controlled replays: passed, with their individual limits retained.
- A fresh integrity pass verified all 23 retained current-channel CRXs and the separate Lightspeed helper. The version inventory still reports 54 distinct manifests across the 28 catalog IDs.

## Remaining requirements

1. Restore or reacquire earlier documented packages from their pinned public sources, and acquire genuinely dated 2024–2025 and intermediate releases for every remaining catalog ID. Current cache versions and unrelated legacy extension IDs do not satisfy that requirement.
2. Resolve the five package-channel gaps through legitimate available distribution sources. A `noupdate` reply is not global proof of retirement or latest version.
3. Continue unresolved native/model/runtime coverage: remaining decoded LanSchool PNaCl functions, additional ContentKeeper variants and message paths, Filter Agent native identity/licensing/reporting and helper-model internals, and unselected dependencies or dynamic branches in the large workers. The [Insight WASM pass](filter-audit-2026-11-01-insight-wasm.md) executes selected native success/error/adaptive paths in two versions. The [Filter Agent pass](filter-audit-2026-11-01-lightspeed-wasm.md) recovers its bridge and executes response verification, without proving all remaining internal behavior. The historical/native follow-up supersedes the earlier absence of PNaCl decoding tools.
4. Test actual installed extensions and representative authorized policy in managed Chrome. The new resource aliases address demonstrated signals; cloud content classification, teacher controls and direct extension reporting remain separate mechanisms.
5. The collector follow-up establishes CDP isolated-world visibility and full synchronous proxy-method results on rendered Civil states; it does not install the helper. Continue actual-extension/policy validation, unresolved root/new-tab inputs, later rescans, and Wisp on its supported Unix callback implementation with a complete backend.

The 3 November follow-ups cover [probe attribution and request coverage](filter-audit-2026-11-03-probe.md), including GoGuardian 4.1.177, [LanSchool's policy expiry path](filter-audit-2026-11-03-lanschool.md), [Securly Classroom's rule-update behavior](filter-audit-2026-11-03-classroom.md), and [Hāpara Focus redirect handling](filter-audit-2026-11-03-hapara.md). The remaining requirements above are open.
