# Filter extension audit, 30 October 2026

Status: partial. The client/server fixes below are implemented and checked, including a second pass on 30 October that replaced the engine names and the proxy path prefix, and that **corrects one first-pass claim** (Blocksi, below). The requested multi-version, every-important-file investigation is **not complete**: older binaries are missing for most extensions, five update services supplied no package, some native or large bundled code remains unanalyzed, and no managed-device enforcement test has been run. These findings do not establish universal undetectability.

## Targets and provenance

The requested [Filter-Sources catalog](https://github.com/civilnetwork-dev/Filter-Sources/blob/00e749c43b6d0793b56dce2e7fe917881dfcfd57/extensions.json) contains 28 extension IDs. Catalog commit: `00e749c43b6d0793b56dce2e7fe917881dfcfd57`, 26 October 2026. Git blob: `e050d4565e59c5bef8317e75e9d430fb498ff097`.

Local evidence lives under the ignored `extensions/filter-audit-2026-10-30/` directory. Each extension has its own `acquisition.json`, update XML, preserved cached package, downloaded CRX when available, and unpacked latest package. Acquisition records contain per-file SHA-256 values and original download URLs. Cached packages came from the pre-existing user archive; their acquisition and release dates are unknown unless separately corroborated. A manifest version alone does not prove age, package authenticity, or unchanged source bytes. CRX signatures have not been verified.

The initial live acquisition downloaded 23 current update-channel packages. Five Google update responses said `noupdate`; the same five still supplied no codebase when queried with Chrome 109, Chrome 131, and ChromeOS 131 client parameters. Exact queries and responses are in `legacy-update-probes.json`. This does not prove that no newer package exists through another distribution channel.

Filter-Sources was created on 24 August 2026 and has no catalog history before 30 October 2025. Its repository history cannot supply the requested one-to-two-year-old packages. Public historical artifacts were sought separately; see the group reports for successful acquisitions, dated records, failed archive queries, and login or paid-download boundaries.

## Version coverage

“Cached” is an existing local snapshot, not a dated historical release. “Current” means the package returned by the configured update endpoint on this audit date. Identical version strings in both columns count as one version, even when formatting or package bytes differ.

| Extension | Cached version | Current download | Additional artifacts |
|---|---|---|---|
| Aristotle Educator | 11.0.0 | 11.0.0 | Older/intermediate unavailable so far |
| Aristotle Student | 23.14.0 | 23.19.0 | Dated older release unavailable so far |
| Blocksi | 4.9.1 | 4.9.16 | Dated older release unavailable so far |
| Cisco Security | 2.2.1 | 2.2.1 | Older/intermediate unavailable so far |
| Cisco Umbrella App | 1.3.23 | `noupdate` | Latest and historical channels unresolved |
| Cisco Umbrella Extension | 1.3.4 | `noupdate` | Latest and historical channels unresolved |
| CK-Authenticator G3 | 5.1 | 5.1 | Older/intermediate unavailable so far |
| classroom.cloud | 3.10.0.0 | 3.10.0.0 | Older/intermediate unavailable so far |
| ContentKeeper | 2.1.4 | `noupdate` | Latest channel and native payload coverage unresolved |
| FortiGuard | 2.0.0.0017 | 2.0.0.0017 | Older/intermediate unavailable so far |
| GoGuardian | 4.0.7422.1 | 4.1.246 | 4.0.7386.1 and 4.0.7393.1; update XML archived July/August 2025 |
| Gopher Buddy | 0.9.9.3 | `noupdate` | Latest and historical channels unresolved |
| Hapara Highlights | 6.9.0 | 6.10.2 | 5.0.62 acquired; exact release date unverified |
| iboss | 1.0.170 | 1.0.200 | Dated older release unavailable so far |
| Impero | 4.0.286 | 4.0.286 | Embedded package is the same version |
| IMTLazarus | 26.4 | 26.9 | Dated older release unavailable so far |
| InterCLASS | 6.4.2026.0501 | 6.5.2026.1014 | Dated older release unavailable so far |
| LanSchool Air | 2.25.0.20424 | 2.25.0.22463 | Dated older release unavailable so far |
| LanSchool Student | 8.0.2.15 | 8.0.2.15 | Older/intermediate unavailable so far |
| LanSchool Web Helper | 9.2.0.2 | 9.2.0.2 | Older/intermediate unavailable so far |
| Lightspeed Filter Agent | 4.4.6.1785883975 | 4.4.10.1792039522 | Dated older release unavailable so far |
| Lightspeed Insight Agent | 3.11.0 | 3.11.0 | Older/intermediate unavailable so far |
| Linewize Connect | 4.0.3 | 4.0.6 | Dated older release unavailable so far |
| LoiLo | 1.16.13 | 1.18.0 | Dated older release unavailable so far |
| Mobile Guardian | 2.2.68 | `noupdate` | Latest and historical channels unresolved |
| NetSupport | 15.0.3.0 | 15.0.3.0 | Older/intermediate unavailable so far |
| Securly | 3.0.60 | 3.0.76 | Dated older release unavailable so far |
| Securly Classroom | 1.37.3 | 2.0.5 | Dated older release unavailable so far |

This initial coverage is 44 distinct manifest versions across all 28 IDs, including cached artifacts. It does not mean 44 independently authenticated releases or complete analyses.

## Implemented changes

1. `src/Document.tsx` now loads the browser's four runtime entry scripts through neutral `/_runtime/` URLs. `misc/runtimeScripts.ts` serves the original bytes directly, without redirecting to the engine-named URL. The controller configuration also uses the neutral engine and frame-injector URLs for proxied documents. Existing public routes and encoded history/bookmark addresses remain compatible.
2. `misc/filterProbe/downloadBundles.ts` now parses update XML with the existing XML parser, correctly scoping the requested app while accepting single-quoted and reordered attributes and escaped query strings. The previous double-quote-only matcher missed valid GoGuardian, Hapara and Lightspeed updates. The repaired acquisition retrieved GoGuardian 4.1.246, Hapara 6.10.2 and Lightspeed Filter 4.4.10.1792039522.
3. `tsconfig.json` excludes the existing ignored `extensions/` artifact directory. Otherwise `allowJs` made the downloaded third-party packages part of Civil's typecheck. No vendor artifact is added to the published source tree.
4. The Host blocker comment now states its actual boundary: it can reject requests reaching Civil with matching Host headers. It cannot intercept an installed extension's direct reporting, policy fetches or privileged DOM inspection.

Second pass, same day:

5. **Engine names.** `misc/runtimeScripts.ts` now rewrites the served engine, controller and frame bundles (`neutralizeEngineNames`). `$scramjet` becomes `$rtEngine`, `$scramjetController` becomes `$rtController`, the controller's cookie database `__scramjet_controller` becomes `rt-controller`, the `scramjet-attr-*` attributes on rewritten markup become `rt-attr-*`, `scramjet-injected` becomes `rt-injected`, and the `$scramerr`, `$scramdbg` and `$scramitize` hooks get neutral names. A rename is a straight textual substitution applied to all three bundles, so page, frames and workers still agree. The `$scramjet$data` and `$scramjet$messagetype` envelope keys stay; the service worker and extension shim read them.
6. **Helper globals.** `scramjetInit.ts` passes the engine's own `globals` config with the `$scramjet` prefix replaced by `$rt`, so rewritten page code calls `$rt$wrap` and the like instead of `$scramjet$wrap`.
7. **Paths.** Proxied frames now live under `PROXY_PREFIX` (`/_p/`) instead of `/~/scramjet/`; the WebAssembly module is served at `/_runtime/engine.wasm` and injected as `engine.wasm.js`. Frame addresses are what `webNavigation`, `webRequest` and a content script's `location` expose.
8. **Saved state.** Returning visitors keep their proxied-site cookies: `retireLegacyDatabase` copies the old database's cookie record to `rt-controller` once, then deletes the old database. Without that, `indexedDB.databases()` would keep listing the old name for existing users.
9. **`bare-mux-path`.** bare-mux writes this localStorage key and nothing in Civil reads it. Aristotle Student reads it as a proxy marker. It is deleted at startup and right after bare-mux sets it. The bare-mux connection itself looks vestigial (scramjet carries its own transport) but was left in place.

No vendor domain was added to any blocklist. Deleting a global at run time was rejected: the controller and frames read these names as free variables, so a rename at the source is the only change that keeps rewriting working.

Not changed: `$scramjet$setrealmfn` is compiled into the rewriter's WebAssembly, so it cannot be renamed by config or textual substitution. `window.scramjet` and `window.scramjetReady` are Civil's own globals; no read vendor source checks them.

## What the evidence establishes

The actual iboss 1.0.170 and 1.0.200 content scanners were replayed offline against a minimal page with the original four script URLs, then the neutral URLs, with the same `/sw.js` registration. Version 1.0.170 reported `proxyLibraryCount: 4` before and `0` afterward. Version 1.0.200 reported two matched tokens before and sent no statistics for the neutral-URL case. Source hashes, the runnable replay and complete observations are in `iboss/scanner-replay.json` and `iboss/scanner-replay.tmp.mjs`.

This replay uses mocked Chrome APIs and happy-dom, with network access disabled and timers not advanced. It proves a reduction in the specific script-URL signal on the replayed page. It does not execute the background MAIN-world probe, verify all frames in Chrome, query cloud classifiers, or establish an unblock verdict on a managed device.

### Live-browser probe (second pass)

Civil was served locally (`bun run.ts`, placeholder credentials, Bare transport) and driven with Playwright in installed Chrome. No vendor extension was installed. The page was loaded, a real proxied navigation was made through the controller (`https://example.com/`, then `https://www.wikipedia.org/`), and the vendors' own checks were evaluated in the page, in an internal tab frame and in the proxied frame. The Aristotle function is the `Vs()` text cut from `aristotleStudent/latest-23.19.0/scripts/contentScript.js`; the iboss list is `ENGINE_GLOBALS` from `iboss/latest-1.0.200/services/WebProxyDetectionService.js`. Aristotle injects that script into the page itself (`injection_point: "body-end"`), which is why it can read page globals.

| Signal | Before | After |
|---|---|---|
| iboss 1.0.200 `name in window`, page and proxied frame | `$scramjet` | none of the nine names |
| Aristotle 23.19.0 `Vs()`, page, internal frame, proxied frame | page and proxied frame read `$scramjetController` (truthy) | `null` everywhere |
| Aristotle `localStorage["bare-mux-path"]` on internal frames | set | absent |
| `indexedDB.databases()` | `__scramjet_controller` | `rt-controller` only |
| Engine-named properties on the proxied window | twelve (`$scramjet`, `$scramjetController`, nine `$scramjet$` helpers, `$scramitize`) | none match; helpers are `$rt…` |
| Engine attributes in proxied markup | `scramjet-attr-href`, `scramjet-attr-src` on `LINK`, `use`, `A`, `SCRIPT` | none |
| Proxied frame address | `/~/scramjet/<id>/<id>/hvtrs%27…` | `/_p/<id>/<id>/hvtrs%27…` |

Negative control: with `window.$scramjetController` set, then `bare-mux-path` set, then an IndexedDB database named `__scramjet_controller` created, the extracted `Vs()` returned `"scramjet"`, `"bare-mux"` and `"scramjet"`. It returned `null` on the clean page, so the probe can see these signals. Wikipedia loaded with its title, its scripts ran (`html.js-enabled`) and `$rt$wrap` was defined as a function in the proxied frame.

What this does not show: the extensions were not run, so their ISOLATED-world scans, background MAIN-world injection, `webRequest` listeners and remote classifiers were not exercised. Only the static name lists read in the sources were evaluated, on one Chrome build, with no Wisp transport and no real filter policy.

### Correction: Blocksi

The first pass said Blocksi's literal `hvtrs8` "matches the existing XOR-encoded HTTP scheme used by Civil". That is wrong for the current codec. Ultraviolet XORs the unescaped text, so its `https:` becomes `hvtrs8`. Civil percent-escapes first, so the colon is `%3A` and the XOR lands on the `%`: every `https` address starts `hvtrs%27` (`tests/xorCodec.test.ts` pins this; the real frame address above shows it). Blocksi 4.9.16 `detectProxyUsage` is registered on `webRequest` and `history` events and checks `url.includes("hvtrs8")`, so Civil addresses do not trip it. The codec was not changed. `tests/xorCodec.test.ts` now fails if any encoded address contains `hvtrs8`. `hvtrs%27` is itself a constant prefix on every `https` address; no read vendor matches it.

Important residuals include:

- iboss 1.0.200 injects its MAIN-world probe and scans every frame. Civil no longer defines the nine names it lists. Other engine-shaped markers (the `$rt…` helpers, the compiled `$scramjet$setrealmfn`, request shapes) were not checked against it. It also captures submitted destinations and keywords.
- Aristotle Student's `Vs()` returns `null` on the replayed page. Its other checks, remote policy and content classification of page text are separate.
- GoGuardian 4.1.246 sends page text, DOM metadata and script URLs to a remote predictor that can return a proxy classification. Securly accepts remotely supplied DOM fingerprints. The remote decision rules and district policy are not established by static source alone.
- Linewize, Impero and classroom monitoring products can read DOM text or markup through installed extension privileges. Civil's origin code cannot prevent that access.
- ContentKeeper native NaCl payloads, unavailable historic artifacts, renderer-dependent behavior and tenant-specific configurations remain explicit gaps.

## Evidence reports

- [Core vendors](filter-audit-2026-10-30-core.md): GoGuardian, Securly, Securly Classroom, Lightspeed Filter, Lightspeed Insight and Hapara.
- [Network vendors](filter-audit-2026-10-30-network.md): Aristotle, Blocksi, Cisco, FortiGuard, iboss and LanSchool.
- [Classroom and other vendors](filter-audit-2026-10-30-classroom.md): ContentKeeper, classroom.cloud, Gopher Buddy, Impero, IMTLazarus, InterCLASS, Linewize, LoiLo, Mobile Guardian and NetSupport.

REA analyses are static, often source-selected, and sometimes limited by parser, memory or time budgets. Their IDs and source selections are recorded in the group reports. A complete manifest/file inventory must not be mistaken for complete semantic analysis or observed execution.

## Verification

First pass:

- Focused filter probe and Host blocker suites, plus runtime route checks: 65 passing tests.
- XML acquisition and runtime route regressions: 9 passing tests after the frame-injector wiring.

Second pass (after the rename, prefix and cookie-store changes):

- `bun run test`: 67 files, 633 passed, 1 skipped.
- `bunx tsc --noEmit`, `bun run lint:check`, `bun run format:check`: passed.
- `bun run build:configs` and `bun run build`: passed. The server was started from that build for the live probe above.
- Edge Add-ons update endpoint, asked for all 28 catalog IDs: HTTP 404 for every one, so Edge supplies no older package. A Wayback CDX wildcard query for the Google update URL timed out at 20 seconds for each of the first eight IDs and was not repeated; it is no evidence either way.

## Remaining work

- Acquire dated historical and intermediate packages for each ID still at one or two versions. The public routes tried so far (update-endpoint compatibility parameters, GitHub mirrors, Wayback, Edge, free archive listings) returned nothing or sit behind a login or payment, which this audit did not use. Searches were bounded, so other routes may exist.
- Install the extensions in an authorized managed Chrome profile and rerun the probe with them active. That is the only way to see their ISOLATED-world scans, background injections and remote verdicts.
- Recover the Lightspeed Filter Agent worker and `filter.wasm`, the LanSchool Student PNaCl module, the remaining ContentKeeper native code and Aristotle Student's 2.1 MB background.
- Decide whether to drop the unused bare-mux connection, and whether to rename `window.scramjet`, `window.scramjetReady` and the `$scramjet$setrealmfn` rewriter hook (the last needs a WebAssembly patch).

The original goal stays open.
