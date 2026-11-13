# GoGuardian native worker canvas replay, 10 November 2026

Native Chrome closes the specific missing-`OffscreenCanvas` startup boundary for
the retained GoGuardian 4.1.177 and 4.1.246 bundles in a controlled browser replay.
Both complete their initial native canvas allocations and reach mocked Chrome
listener registration without a surfaced error during the 1,500 ms observation
window. Removing only `OffscreenCanvas` reproduces the exact earlier
`ReferenceError: OffscreenCanvas is not defined` in both bundles.

This does **not** change the incomplete GoGuardian rows in the
[Node/Bun catalog matrix](filter-audit-2026-11-09-probe.md#final-replay-after-host-corrections).
No production host implementation changed. This browser replay uses dedicated
Workers, explicit Chrome API mocks and blocked network access; it is not an
installed MV3 extension or a managed-policy allow result.

## Source identity and execution

The confined fixture serves each complete, unmodified `background.js` through
`importScripts`. No webpack module, startup call or model result is replaced.
The server asserts the previously recorded source hash and checks the extracted
screenshot expression against the exact retained source range before listening.
This reuses retained artifacts; it is not a new package-authentication pass.

| Version | `background.js` SHA-256 | Manifest SHA-256 |
|---|---|---|
| 4.1.177 | `888c3b23b2253254d4b1dad546c433b006270eed12d6ff60d65d9f185394a0c5` | `3bda67334149d7fa4af0d2449c58d34de0348bd68568bd3cae49e61582d87d68` |
| 4.1.246 | `dd0b4d6e5683b4417a5682d2cdb4b417c0991add1cd6a6f4346fd768da0d61f6` | `e7e2c4a8cbcafe6e8e168308ecbb54a2801a163551c19b020dd795627bc7329e` |

REA `capture_browser_scenario` launched the installed Chrome executable headless
and waited for the fixture's completion marker at 1366-by-768. The browser
reported **Chromium 156.0.8078.80**. Final observed evidence is
`ev_b991b0197efd789943dbf395638fa60575b8d3539eee7ac106809cc6521ad4c6`.
An earlier successful capture is
`ev_c69bd3d5f5bcf54744a1769a2f3647a6d4b3a49553731c890266dc0272399805`.
Both are controlled-replay evidence. REA does not independently bind the served
bytes to a local artifact identity; the fixture's source and harness hash
receipts supply that separate binding.

The constructor recorder forwards to Chrome's original `OffscreenCanvas` with
`Reflect.construct`, returns the native object and records its dimensions and
native-instance check. It supplies no drawing, pixel, bitmap or model results.
The missing-API controls delete that constructor in their own isolated workers.

| Version | Missing-API control | Native allocations | Mocked listener registrations | Native-run surfaced errors |
|---|---|---|---:|---:|
| 4.1.177 | Exact `ReferenceError`, before API calls/listeners | 0-by-0 screenshot canvas | 66 | 0 |
| 4.1.246 | Exact `ReferenceError`, before API calls/listeners | 224-by-224 predictor canvas; 0-by-0 screenshot canvas | 76 | 0 |

Both native runs register `webRequest.onBeforeRequest`. Registration counts count
calls, including repeated listeners; they are not distinct API counts or proof
that Chrome granted blocking permission. `importScripts` returns even in the
failing controls because their entry initialization rejects asynchronously; the
worker rejection recorder and REA both retain that failure. Thus a returned
import alone is not treated as successful startup.

## Native graphics outputs

A fifth dedicated worker executes the exact screenshot expressions recorded in
the [earlier graphics audit](filter-audit-2026-11-03-goguardian.md#graphics-paths-and-the-offline-startup-failure).
Their zero-based source character ranges, with exclusive ends, remain
**1237937–1238520** for 4.1.177 and **1292061–1292738** for 4.1.246.
Only their base64 helper dependency is supplied through native `atob`,
`Uint8Array` and `Blob`; no canvas or decoder output is mocked.

Chrome creates a solid-red synthetic PNG with native drawing APIs, runs each
shipped converter, decodes the actual output blob and reads its native pixels.
Eight assertions check dimensions, scale, MIME type, nonempty output and a red
opaque output sample. The retained receipts include encoded-byte and complete
decoded-RGBA SHA-256 values, the sample and the actual encoded bytes.

| Input; maximum dimension | Output | 4.1.177 | 4.1.246 |
|---|---|---|---|
| 80-by-40; 40 | 40-by-20, scale 0.5 | JPEG, 770 bytes | JPEG, 770 bytes |
| 30-by-60; 30 | 15-by-30, scale 0.5 | JPEG, 764 bytes | JPEG, 764 bytes |
| 16-by-8; 40 | 16-by-8, scale 1 | JPEG, 762 bytes | JPEG, 762 bytes |
| 16-by-8; 40; WebP flag | 16-by-8, scale 1 | JPEG, 762 bytes | WebP, 550 bytes |

JPEG samples were `[223,21,21,255]`; WebP was `[224,21,21,255]`. These are measured
outputs for one synthetic color and these dimensions, not image-quality or
real-screen coverage. The model was not loaded and no predictor verdict,
TensorFlow output, screenshot capture or upload was fabricated.

## Mocks, networking and remaining boundaries

Native Worker, event handling, IndexedDB availability, OffscreenCanvas, 2D
contexts, `createImageBitmap`, PNG/JPEG/WebP encoding and decoding are supplied by
Chrome. Extension APIs are explicit local mocks: the real retained manifest,
a fixed runtime ID, a loopback `runtime.getURL`, a synthetic Windows platform
result, empty storage/identity/tabs/windows/management results, no-op mutations
and messaging, and recorded event registrations. No event callbacks or request
handlers are dispatched. Storage writes do not persist. File-scheme access is
false. Tenant policy and identity are absent. These mocks can change branches
and do not reproduce extension permissions, service-worker suspension, native
companions, offscreen extension documents or browser request timing.

The server binds only `127.0.0.1:19896` and serves an exact nine-path map, never a
directory tree. Every response carries `default-src 'none'`, `connect-src 'none'`,
same-origin script/worker restrictions and blocked frames/images/objects/forms.
The full-worker bootstrap also rejects `fetch`, WebSocket construction and XHR
opening before they reach native network APIs. Chrome messaging is mocked.
All **11** recorded browser requests were loopback artifact requests, all **45**
events were retained, and REA reported no missing/truncated capture sections.

The guards recorded, without sending, these source attempts:

- 4.1.177: a Pusher WebSocket at `ws-goguardian.pusher.com`, application
  `2cedd07d43bc844c3987`, protocol 7 / client js / version 8.4.0-rc2.
- Both versions: `https://extension.goguardian/ping`.

Sequential Wayback MCP lookups are retained. The literal `wss:` lookup was
rejected because the tool accepts only HTTP(S); an explicitly derived HTTPS
equivalent and the exact ping URL each returned `fetch failed`. These are lookup
failures, not empty archive results. No archive content or vendor response was
obtained, and no account, teacher session or telemetry endpoint was contacted by
the replay.

The bounded observation leaves later timers, all-input behavior, actual extension
installation, real screenshots, model acquisition/inference, native companion
access and managed Chrome policy unresolved. The Node/Bun host still lacks
OffscreenCanvas; this experiment establishes that supplying the real browser
capability passes the observed initialization barrier under the stated mocks.

## Receipts, reproduction and cleanup

Ignored evidence lives in
`extensions/filter-audit-2026-11-10/goguardian-native-canvas/`:
`input-receipt.json` records source, manifest and harness hashes;
`capture-final.json` is the complete REA return;
`results-final.json` preserves parsed worker/pixel results;
`output-0.jpg` through `output-6.jpg` and `output-7.webp` retain native blobs;
`server-requests.json` records the confined server accesses. The earlier capture,
archive lookup failures and first sandbox-loopback failure remain separate.

Run `node extensions/filter-audit-2026-11-10/goguardian-native-canvas/server.cjs`,
then replay the browser scenario parameters retained in `capture-final.json`.
The REA action waits for `#result[data-state='complete']`; the provider must be
able to reach the loopback fixture. The first sandboxed-server attempt timed out
before loading the document; the successful server used the authorized local
execution path. Run
`node extensions/filter-audit-2026-11-10/goguardian-native-canvas/verify.cjs` to
verify controls, native allocations, all eight encoded hashes, observed request
confinement and current source/harness identity against the final receipts.
That verification passed after the final capture.

REA records five created and five closed workers and
`cleanup: terminated-owned-process`. The owned fixture server was stopped after
capture; `cleanup.json` retains its terminated execution-session result. No
production files, account state or running user browser were changed. Broader
product checks were not rerun for these isolated research artifacts.

## Archive retry after read-tool configuration

The later [archive recheck](filter-audit-2026-11-10-archive-recheck.md) retries the
exact ping URL and the already-derived HTTPS Pusher equivalent after the user
enabled the Wayback read tools. Both returned no archived versions under the
recorded exact searches. The earlier fetch-failure receipts remain intact; the
literal `wss:` rejection remains unsupported rather than an empty result. These
archive responses do not alter the native runtime or managed-policy findings.
