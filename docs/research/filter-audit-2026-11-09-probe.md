# Retained catalog request replay, 9 November 2026

This pass reruns the 56 retained extension builds from the [3 November matrix](filter-audit-2026-11-03-probe.md#request-coverage-and-worker-failures), then adds the five [authenticated new targets](filter-audit-2026-11-09-new-vendors.md). It observes two supplied documents through the current offline sandbox and request-dispatch model. These are bounded observations with synthetic policy and networking, not installed managed-browser allow verdicts or every-input coverage.

## Inputs and reproduction

The ignored `extensions/filter-audit-2026-11-09/catalog-recheck.ts` adapts the earlier `extensions/filter-audit-2026-11-03/catalog-recheck.ts`. It reuses the earlier 56 rows by folder, ID, manifest version and retained directory; it does not silently replace them with newer packages. Prisma, Dyknow, Gopher Premium, ClassLink Analytics+ and OneClick use the signed retained artifacts recorded in the new-vendor audit. Each row records the manifest hash. Cached historical directories retain their earlier provenance limits; this replay is not a fresh authentication pass for all 56.

Run from the repository root:

```sh
bun extensions/filter-audit-2026-11-09/catalog-recheck.ts
```

An optional final `stub` or `proxy` argument runs only that input. Each build runs in its own Bun subprocess, with a 250 ms settle window and a 25-second outer deadline. Four subprocesses run per batch. Partial progress, child exit status, diagnostic hashes, diagnostic tails, unhandled rejections and complete returned observations are retained. A missing manifest, startup exception or child deadline is never reported as a clean read.

The stub is `<body>Civil new tab</body>` at `https://probe.invalid/newTab`. The second input is the retained 12,829-byte `example.com` HTML captured through the built Civil service worker, at its original frame-specific encoded URL. The runner verifies HTTP 200, `fromServiceWorker: true` and body SHA-256 `93415928b402368361755dcdccde18261b45bfa00a331a82939b8e0c167ee63f` against `extensions/filter-audit-2026-11-01/core/proxy-frame-response.json`. This reuses a historical browser capture; it does not claim a newly loaded proxy page or run the full Civil engine in a renderer.

`allowNetwork` is explicitly false. The page fetch is supplied locally; extension calls use the existing offline fixtures. The child also replaces its process-global fetch and WebSocket entry points with recording rejection guards. Zero calls reached those escape guards. This does not mean the extension never requested a fixture URL: mocked/blocked extension networking remains part of the model. No production network, account or tenant was used, and no OffscreenCanvas replacement was supplied.

## Initial results, before host fixes

The stub and captured-document matrices produced identical status totals:

| Population, per input | Rows | Block signal | Inconclusive | No block signal in the observation window | Runner failure |
|---|---:|---:|---:|---:|---:|
| Historical 3 November receipt | 56 | 0 | 14 | 42 | 0 |
| Same retained catalog with current dispatch | 56 | 0 | 4 | 52 | 0 |
| Five new targets | 5 | 0 | 2 | 3 | 0 |
| Current combined matrix | 61 | 0 | 6 | 55 | 0 |

All 61 original document markers remained present in each input. There were no synchronous request cancellations. A preserved marker is not proof that a browser completed navigation: the supplied HTML is fetched outside the synthetic request pipeline. The useful finding is the observation's status and retained limitations, not an inference that every extension has allowed the page.

The ten earlier registration-only inconclusive rows now show no block signal under the current synchronous request model:

- Hāpara Highlights 5.0.62, 6.2.7, 6.9.0 and 6.10.2.
- IMTLazarus 26.4 and 26.10.
- LanSchool WebHelper 8.0.0.1.
- Linewize Connect 4.0.3 and 4.0.6.
- Securly Classroom 1.32.0.

Their former reason was `Matching blocking webRequest listener was not replayed`. The sandbox now calls its main-frame request dispatcher rather than stopping at matching registration metadata. This removes that specific coverage ceiling on these fixture inputs; it does not establish active district policy, later asynchronous enforcement or Chrome's real dispatch timing. The comparison is against saved historical receipts, not an isolated experiment changing only one source file. Two additional comparison rows reflect the corrected legacy Gopher Buddy vendor mapping, from GoGuardian to Gopher Buddy, with no status change.

## Incomplete rows retained

| Build | Observed limitation, on both inputs |
|---|---|
| Cisco Umbrella App 1.3.23 | Rejected while attempting to reach its extension peer. |
| GoGuardian 4.1.177 and 4.1.246 | Worker rejected with `ReferenceError: OffscreenCanvas is not defined`. No fake graphics implementation was added. |
| Lightspeed Insight 3.8.4 | Configuration fetch failed with `Service Unavailable (extension host is offline)`; the altered mirror environment remains a separate provenance/runtime limit. |
| Prisma Browser 1.8984.0 | Background failed because `globalThis.addEventListener` was missing; the collector separately retained `ReferenceError: browser is not defined` from asynchronous work. |
| Dyknow Cloud 7.11.38 | Background bundling could not resolve five extension-root imports beginning `/js/`: globals, filesystem, application, lifecycleEventHandler and logsender. Those source files are shipped; this is a host resolution failure, not proof the installed vendor extension fails. |

Gopher Premium 1.0.0.15, ClassLink Analytics+ 0.6.6 and ClassLink OneClick 12.7 returned no block signal or surfaced startup rejection in this window. The [source audit](filter-audit-2026-11-09-new-vendors.md#gopher-premium-popup-support-and-session-telemetry) separately explains their inventory/support, analytics and SSO roles. These observations do not create a public URL classifier or justify placeholder `/filterCheck` routes.

## Code identity and receipts

`catalog-stub-before-host-fix.json` and `catalog-proxy-before-host-fix.json` retain the initial input identity, every row, the historical comparison and hashes before and after each matrix. All ten initially recorded source/configuration files were byte-stable within both initial runs and identical between inputs. They include the request dispatcher, host, tabs/platform APIs, vendor fixtures, sandbox, detector, vendor mapping, probe data and match-pattern implementation. The later receipts described below cover the revised host.

The request implementation used SHA-256 `fb0e057fa4289a17d217a97399f491b5fde9e32ed2740da99b550a204bb69a23`; the sandbox used `e9fd694d1b5d11318c28ae8805831c76efcdd49a55f54104231e3146ccee0304`. The complete hash maps in the receipts identify the checked worktree state even if another agent later changes those files. The Bun version and start/finish times are recorded there. Source changes after this run require a distinct receipt before describing their behavior as checked.

## Boundary

The dispatcher models a top-frame GET and applies the manifest's declared webRequest/host/blocking permissions plus listener URL, resource-type, tab and window filters. It observes synchronous cancellations and redirects. Promise-returning blocking handlers, callback errors, invalid results and conflicting redirects require incomplete observations unless an independent block signal establishes a result. It does not hold an actual HTTP request or model child-frame requests, other request stages, managed MV3 permission grants, renderer timing, native companions or cloud enforcement.

The graphics, extension-peer, old mirror and new-target startup failures remain open. The check covers two fixed documents, supplied policy and a short observation window; it does not replace managed-browser testing, later rescans, historical acquisition work or a complete native/model reconstruction. No product code was changed by this rerun. The technical README now describes the request-dispatch coverage and links this report.

## Final replay after host corrections

The final `catalog-stub-recheck.json` and `catalog-proxy-recheck.json` supersede the initial results for the current host. Each contains 61 rows and hashes of 55 runtime/configuration files before and after execution. Both runs were source-stable, used the same runtime hashes and completed without a runner failure or escaped-network attempt. All supplied page markers remained present. No fake graphics API was supplied.

| Population, per input | Rows | Block signal | Inconclusive | No block signal observed |
|---|---:|---:|---:|---:|
| Original retained catalog | 56 | 0 | 4 | 52 |
| Five added targets | 5 | 0 | 1 | 4 |
| Combined | 61 | 0 | 5 | 56 |

Dyknow now loads its shipped extension-root module imports. The resolver applies the same extension-directory containment to static and dynamic imports; regression cases reject traversal and foreign extension origins. Worker event registration uses an EventTarget-backed surface, and the host forwards its real native URLPattern implementation. It does not substitute an approximate URL matcher or fake OffscreenCanvas.

Returned startup promises, timer callbacks, microtasks, packaged scripts and worker event failures feed the owning handle's error channel. Node's per-VM promise hooks also contain detached VM rejections, preserve intentionally caught failures and dispose with their VM. Content code is not started without its background/API handle. The suite includes detached startup with a zero-millisecond extra observation wait.

Bun 1.4.4 exposes `promiseHooks.createHook` but throws NotImplementedError. Every raw Bun row therefore retains `asyncContainmentIncomplete`, and the direct detector treats that coverage gap as inconclusive. The isolated runner separately proves its process-level rejection collector with a VM rejection control in every child. Only after that control succeeds does it assess a copy without that single capability reason. It retains the raw observation, raw verdict, collector proof, real rejections and assessed verdict. All 61 controls passed per input; all 61 raw verdicts remain incomplete. This is bounded isolated-process evidence, not an assertion that direct Bun probes have VM-level rejection containment.

The five assessed incomplete rows remain Cisco Umbrella App 1.3.23, GoGuardian 4.1.177 and 4.1.246, Lightspeed Insight 3.8.4, and Prisma 1.8984.0. Cisco still lacks its peer, GoGuardian lacks real OffscreenCanvas, and Insight's offline mirror configuration fails. Prisma now gets past missing worker event registration and URLPattern but rejects on an undefined configuration object. The exact error is retained in each row. No tenant configuration was invented to convert that failure into a clean result.

These final matrices do not close the historical-package, full dependency/native reconstruction, installed-browser or managed-policy requirements. [Implementation verification](filter-audit-2026-11-09.md) records the separate product checks and remaining work.

## Native Chrome and Securly follow-ups, 10 November

The [native Chrome experiment](filter-audit-2026-11-10-goguardian-native-canvas.md)
reproduces both GoGuardian missing-canvas controls, then imports both unchanged
full workers with real OffscreenCanvas. They reach event registration under
explicit empty Chrome API mocks without surfaced initialization errors in the
1,500 ms window. Eight native screenshot-converter cases retain encoded-byte and
decoded-pixel hashes. This closes the observed browser graphics barrier for that
fixture. It does not add graphics to Node/Bun or change the five incomplete rows
above, and no request callback, model or managed policy was exercised.

The [Securly 3.0.79 follow-up](filter-audit-2026-11-10-securly.md) adds one
authenticated package observed on both existing documents. Both assessed rows
show no block signal; raw Bun containment limitations remain. All 55 checked
runtime/configuration hashes are stable. The original 61-build receipts remain
unchanged, with these two supplemental observations retained separately.

## Prisma capability correction, 10 November

The retained Prisma rejection came from the logging helper's access to the
private `chrome.talon.prefs` interface. The Chrome fixtures supplied a truthy
fallback for `chrome.talon`, then returned `undefined` from the preference call.
The helper read `length` from that reply. The decoded source explicitly returns
an empty lifetime ID when `chrome.talon` is absent.

`replay-prisma-preferences.cjs` checks eight branches of the exact decoded
helper. It verifies the native preference name, local-state argument and
delimited string handling. A present namespace with missing preferences or an
undefined reply reproduces the helper's TypeError in the isolated fixture.
`prismaBrowser/preference-replay.json` retains the selected source range and
hashes. The background and content fixtures now leave the private namespace
absent. A regression test checks the background fallback's access and presence
semantics.

The corrected `catalog-stub-talon-capability.json` and
`catalog-proxy-talon-capability.json` receipts each contain 61 rows. Only
Prisma's assessed verdict changes. It now shows no block signal on either
document. Each matrix has 57 no-block observations, four incomplete rows,
61 passed collector controls and zero escaped-network attempts. All 55
runtime/configuration hashes are stable during execution. Raw Bun verdicts
retain their VM rejection-containment limitation. Native Prisma preferences,
enrollment and managed policy require the corresponding environment.

```powershell
node extensions/filter-audit-2026-11-09/replay-prisma-preferences.cjs
bun extensions/filter-audit-2026-11-09/catalog-recheck.ts stub talon-capability
bun extensions/filter-audit-2026-11-09/catalog-recheck.ts proxy talon-capability
```
## Cisco Umbrella peer startup

The supplemental startup replay authenticates all 21 signed App 1.3.23 files
and 24 signed Extension 1.3.4 files from the local Web Store caches. The
existing verifier checks signed ID, version, and per-file tree hashes.
REA parsed six app sources and four extension sources with zero parse
failures. Parent evidence is
`ev_9bbf1bc97c306664b7eb110a24dedfd3cc281caf2b9efcca6cf5b35cf4412838`
and `ev_6b8405981c589676bc9c1b1eb161d351cf919aec75f5b962f1c32bac4823cb6e`.

| Startup fixture | App result |
| --- | --- |
| Peer absent | Reproduces the catalog rejection. Both startup attempts lack a peer response. |
| Peer present, registration false | Startup completes after the signed peer acknowledges the app. The mock local server stops. |
| Peer present, registration true | Startup completes after the signed peer acknowledges the app. The extension registers a request listener in the fixture. |

The replay runs the exact app entrypoint and peer startup scripts in
separate VM contexts. It substitutes local runtime messaging, registration,
network state and server dependencies. It records the peer's initial
enabled notice without dispatching it and never dispatches web requests.
The catalog row remains incomplete for its single-extension environment.
ChromeOS installation, managed registration and live DNS remain untested.

Wayback exact searches found no captures for `http://localhost:8029/` or
`http://localhost:8029/debug`. The analytics script search returned two
captures at the query limit. The January 2013 capture returned its raw
JavaScript body. The replay records the script insertion without loading
the script. [Analytics capture](https://web.archive.org/web/20130130124814id_/https://www.google-analytics.com/analytics.js)

From the Civil root:

```powershell
node extensions/filter-audit-2026-11-11/cisco-peer/startup-replay.cjs
```

`startup-replay.json` and the cumulative `rea-cisco-peer.json` export are in
the same artifact directory. The REA export has SHA-256
`254579d7ec32f6f3acb24ad2f4fd6d882c1dc4da8aca8b254844b9c4207694e6`.
