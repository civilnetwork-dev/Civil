# Prisma signed pages and offscreen document, 11 November 2026

Prisma Browser Extension 1.8984.0 loads an offscreen document for browser
services. The signed bundle announced readiness and answered ten requests in
the controlled Chrome replay. The observed services cover video encoder
configuration, image conversion, password scoring and geolocation.

## Package and page inventory

Civil's production CRX verifier authenticated publisher ID
`dbpnkcjkchadgbgihmmolkjcgjkodoaf` and rejected a different expected ID
and a one-byte change. The package SHA-256 is
`c1909819e6fbd9bab8e9f316ab2099d80cb384d19b764b3983948e33b19a85e7`.
All 498 files in the retained unpacked tree match the signed archive.
`identity.json` records the file digests and scripts declared by all 16
HTML pages. Every declared script resolves to a packaged file. The
inventory found no files with conventional native or Wasm suffixes.

The selected static decoding records for `content.js`, `injected.js`,
`popup.js` and `offscreen.js` match their input and output hashes. The
signed `offscreen.js` SHA-256 is
`f21126644360e4524a25dc5d21a6b5f2fb0321695d5f633d80f87a6225a72054`.
REA parsed its 299,972 bytes without a parse failure. The semantic graph
has partial coverage. The retained `rea-offscreen.json` includes parent
Evidence `ev_52456d69ec79d3033c13712041f963e3c6876b6c4d8b9e63ae202c5807beee70`
and its summary, alongside the previous Gopher records from the same MCP
session. The export SHA-256 is
`49084317161eaf1f2430edcf99dc7124ec6a2839a4fae907dbd9e9641e848546`.

## Browser observations

Chrome 157.0.8103.50 ran the original HTML and JavaScript at a fixture
HTTPS origin. The harness supplied the extension messaging and port
boundary, fulfilled requests from the signed package, and blocked other
origins. The initial HTTP attempt lacked `VideoEncoder`. The final
replay asserts a secure context and a real encoder API before testing
the native capability path. All five page requests matched package
hashes and the run produced zero page errors.

| Path | Observed contract |
|---|---|
| Readiness | The document announces `offscreenReady` on its internal channel. The fixture supplies a port for each tested service and receives responses associated with the request ID. |
| Codec support | The script checks four codecs at 1280 × 720, 10 fps and 1.5 Mbps. Chrome reported VP9 and AV1 with the software preference, H.265 with the hardware preference, and H.264 with both. These results describe configuration support on the replay host. |
| Codec failure | With `VideoEncoder` absent, both preferences report unavailable for each codec. With injected API rejection for hardware and a truthy software result, each hardware entry carries its error message and each software entry reports support. |
| Image conversion | A one-pixel PNG data URL goes through the browser image and canvas APIs and returns a PNG of the same dimensions. Invalid image input produces the load error in the fixture reply. |
| Password scoring | The first request loads packaged chunks `6233.js`, `4107.js` and `4716.js`. Two synthetic samples return `StrengthLevelWeak` and `StrengthLevelVeryStrong`. Null input yields undefined data. The three chunks remain the only script dependencies loaded after startup across the tested requests. |
| Geolocation | With isolated browser coordinates supplied by Playwright, the browser API returns the specified latitude, longitude and accuracy. An injected permission rejection yields undefined data. |

The receipt in `offscreen-replay.json` contains the observed request paths,
readiness message and results. The fixture port preserves JavaScript
objects for inspection. Chrome's actual extension transport and the
managed worker's connection lifecycle still need direct verification.
The codec check records support and leaves actual encoding untested.

## Iframe, ICE and Atlas detection follow-up

Thirteen additional cases ran in Chrome 157.0.8103.50 with the same signed
document and port fixture. Both resource requests matched the package
inventory. The run recorded zero page errors and made no vendor requests.

| Path | Observed contract |
| --- | --- |
| Iframe creation and reuse | Opening the fixture creates a hidden iframe with the supplied sandbox tokens. A second open with the same ID updates the source on the existing element and preserves its original sandbox. |
| Removal and invalid input | Removing the fixture twice returns the same empty success result. Null attributes return a caught exception message in the result data and leave the document unchanged. |
| ICE completion | The script creates a data channel and local offer. The synthetic end-of-candidates event resolves immediately with the two distinct valid fixture addresses. The repeated and invalid candidates are omitted. |
| ICE timeout and failure | Without an end-of-candidates event, the script returns the partial candidate list after about five seconds. A failed connection state closes the fixture peer immediately. The timeout later closes it again and resolves with an empty list. |
| Atlas detection | Five fixtures cover the brand guard, immediate voice lists, the voices-changed event, and timeout. The brand guard and timeout return false. The timeout took about three seconds. |

The iframe fixture navigates only between `about:blank` fragments. Its
sandbox permits same-origin access so the Playwright service-worker guard
can initialize in the child frame. The ICE fixture supplies documentation
addresses and creates no network connection. The Atlas fixtures replace
browser brand and voice values only in the replay document. These cases
establish JavaScript handling of the supplied events. Actual ICE discovery,
Atlas browser behavior and the managed worker's port lifecycle remain
unverified.

## Archives and remaining evidence

The offscreen source index contains the incomplete literal `http://[`.
It supplies no concrete archive target. All observed page requests
were packaged files at the fixture origin. The initial vendor report
retains exact Wayback results for the distribution and classifier URLs.
[Initial Prisma findings](filter-audit-2026-11-09-new-vendors.md#prisma-category-requests-policy-and-native-companions).

Reproduce from the Civil root:

```powershell
bun extensions/filter-audit-2026-11-10/prisma-source-closure/identity.ts
node extensions/filter-audit-2026-11-10/prisma-source-closure/offscreen.cjs
node extensions/filter-audit-2026-11-10/prisma-source-closure/offscreen-lifecycle.cjs
```

The decoder can be rerun with `prepare.cjs` in the same directory. The
browser replays require installed Chrome and the retained Playwright Core
dependency. The second receipt is `offscreen-lifecycle-replay.json`.
The identity iframe service, remaining page behavior, native companions
and managed-policy enforcement remain open. The observed
offscreen services provide no classifier contract for Civil.
