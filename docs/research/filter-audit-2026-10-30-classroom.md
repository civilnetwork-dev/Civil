# Filter extension audit: classroom, identity, and Linewize group

Audit date: 2026-10-30. Scope: the eleven catalog folders below. This is a static, partial investigation, not a managed-device or vendor-cloud end-to-end certification.

## Artifact provenance and version coverage

The current catalog was fetched from `civilnetwork-dev/Filter-Sources/extensions.json`. The root audit acquired current CRXs through each catalog entry's update endpoint. The separate `~/extensions` trees supplied pre-existing unpacked snapshots. A manifest version string identifies a **claimed version**; signed metadata and file-root verification separately authenticate covered files. Original CRX wrapper signatures were **not verified**. The second GitHub acquisition pass below independently verifies Web Store metadata signatures and signed file roots for its four mirrors. File SHA-256 inventories and update/download URLs are retained in `extensions/filter-audit-2026-10-30/<folder>/acquisition.json`; the local and current important-source inventories are `local-snapshot-inventory.json` and `latest-snapshot-inventory.json` in each folder.

| Catalog folder | Pre-existing unpacked version | Freshly downloaded current version | Historical coverage |
|---|---|---|---|
| ckauthenticatorg3 | 5.1 | 5.1 | Same version; no distinct historical CRX acquired |
| classroomcloud | 3.10.0.0 | 3.10.0.0 | GitHub mirror 3.00.7.0 subsequently acquired and authenticated; release date unknown |
| contentkeeper | 2.1.4 | Unavailable at update endpoint | Same-version GitHub mirror subsequently authenticated; no distinct older version |
| gopherbuddy | 0.9.9.3 | Unavailable at update endpoint | GitHub 0.9.8.9 source and 0.9.9.3 CRX subsequently acquired; see signed coverage below |
| impero | 4.0.286 | 4.0.286 | Nested `ChromeOS-Client-MV3.zip` is also 4.0.286; not an older release |
| imtlazarus | 26.4 | **26.9** | Distinct cached/current versions; neither established as a 1–2-year-old release |
| interclass | 6.4.2026.0501 | 6.5.2026.1014 | Distinct cached/current versions; dates embedded in version strings are not independent release evidence |
| linewizeConnect | 4.0.3 | 4.0.6 | Distinct cached/current versions; requested 2024–2025 binaries remain missing |
| loilo | 1.16.13 | 1.18.0 | Distinct cached/current versions; requested 2024–2025 binaries remain missing |
| mobileguardian | 2.2.68 | Unavailable at update endpoint | Cached package only; release date unverified |
| netsupport | 15.0.3.0 | 15.0.3.0 | Same version; no distinct historical CRX acquired |

The catalog reported IMTLazarus 26.8, but its live update response supplied 26.9. That difference is retained, not silently relabeled as the catalog version.

Public archive investigation found these boundaries:

- GitHub's repository metadata reports Filter-Sources created **2026-08-24**. Its `extensions.json` commit query before 2025-10-30 returned no commits. This repository does not supply the requested 2024–2025 history.
- A normal Wayback CDX query for each extension's uppercase-ID CRX filename under `clients2.googleusercontent.com/crx/blobs/*/` for 2024–2025 returned HTTP 200 with `[]`. The exact bounded queries and receipts are saved as `<folder>/history-cdx.json`. This is absence from those queries, not proof that no archive exists anywhere.
- A separate Linewize Omaha-response CDX query returned 503. It supplies no negative historical evidence.
- [Chrome-Stats' Impero download listing](https://chrome-stats.com/d/jjpmjccpemllnmgiaojaocgnakpmfgjg/download?hl=fr) publicly lists 4.0.275 dated 2025-10-23 and 4.0.274 dated 2025-10-21 among recent versions, and lists 3.0.219 dated 2024-11-27 and 3.0.227 dated 2025-01-14 behind its Pro archive. Direct public page acquisition returned 403. No binary was obtained from that listing. These are secondary index dates, not analyzed artifacts.
- [Extension Auditor's Linewize download link](https://extensionauditor.com/scan/linewize-connect-ddfbkhpmcdbciejenfcolaaiebnjcbfc) redirected to sign-in. No account or paid-archive access was used.

## Source observations and implications

Paths below are relative to the stated extension package. Minified files are one-line bundles, so zero-based character offsets are used where a line number would not identify a useful location. Source hashes in the final table bind those observations to exact bytes. No extension was installed or executed for this audit, and no URL or content was submitted to a live vendor classification service.

### CK-Authenticator G3 5.1

Important files: `manifest.json` declares an MV3 service worker and no content scripts; `serviceWorker.js` imports `common.js` and `ckenc.js`; `ckenc.wasm` provides encryption/decryption through Emscripten `Module.ccall`.

`serviceWorker.js` obtains the signed-in profile email, discovers a ContentKeeper gateway via `http://192.0.2.1/?get_ck_ip` with `.2` fallback, and sends encrypted identification pings. `provideCredentialsAsync` handles proxy 407 authentication using the email and epoch. `onHeadersReceived` reads `X-CKBYOD`; `onBeforeSendHeaders` attempts to append a `ck={...}` gateway identifier to User-Agent. These are gateway identification/authentication flows. There is no content-script proxy-signature detector in the manifest-reviewed surface. That does not establish the gateway's server-side classification logic. The WASM implementation was inventoried and hashed, not decompiled; no native provider claim is made.

### ContentKeeper / CKAuthenticator 2.1.4

Important files: `manifest.json`, `background.html`, `background.js`, `common.js`, `newlib/Release/ckauth.nmf`, and the platform-specific `.nexe` artifacts. `background.html` loads the background page and NaCl module. `background.js` uses `common.naclModule.postMessage('encrypt|...')` and `'decrypt|...'` for profile/gateway identification, the same documentation-address gateway discovery and `X-CKBYOD`/User-Agent identification family as G3. The local NaCl executables are substantial important files. This group's initial investigation did not decompile them; the subsequent [ContentKeeper native addendum](filter-audit-2026-10-30-native.md) records the root audit's authenticated selected handler decompilation. No content scripts are declared. This extension is not evidence that Civil's DOM can prevent ContentKeeper gateway categorization.

### classroom.cloud Student 3.10.0.0

Important files: `background.js`, `js/modules/background/websocket.js`, `js/modules/ciccore.js`, `js/models/Tab.js`, `js/models/sites.js`, `js/modules/background/webFilter.js`, `js/modules/background/esafety.js`, `js/phrase/processor.js`, phrase dictionaries, and the manifest-listed all-frame content scripts.

`webFilter.configure` ingests a tutor-provided `filter` string containing `redirect:`, `include:`, and `exclude:` sections. `webFilter.request` evaluates URL/sub-URL restrictions and time windows; it is policy evaluation, not an autonomous Civil fingerprint detector. `esafety.getPhraseMatch` constructs reports containing matched phrases, the page authority, user/class/teacher context, and optionally thumbnails or desktop screenshots. The English phrase dictionary contains the literal `Proxy` with `[32768,2]`. A dictionary entry alone does not prove that a visit triggers an alert: loaded policy, scanning paths, priority actions, and tutor connectivity matter. Civil must not claim that network interception hides DOM text or screenshots from these privileged extension paths.

### Gopher Buddy 0.9.9.3

Important files: `app.config.js`, `background.js`, `scripts/sessions.lib.js`, `scripts/pubsub.lib.js`, `scripts/analytics.lib.js`, `scripts/content_script.js`, and `manifest.json`. The declared content script matches only the product's own `gopher-buddy-*.appspot.com` pages and forwards the `RW759_connectExtension` DOM event into runtime messages. Configuration identifies inventory/support/session services at `gopher-buddy-prod.appspot.com/v2` and a `session-ingest` Pub/Sub topic. The reviewed source provides device/session/support plumbing; no general-page content detector is declared. A universal filter vendor bypass cannot be inferred from this inventory tool's presence. Third-party Angular/jQuery/Q/lodash code was inventoried but not reverse engineered function by function.

### Impero Backdrop MV3 4.0.286

Important files: `js/serviceWorker.js`, `js/content_script.js`, `js/offscreen.js`, `js/frontend/blocked.js`, the OCR/Tesseract files, and `manifest.json`. The nested `ChromeOS-Client-MV3.zip` was unpacked safely into `nested-4.0.286`; its manifest confirms the same version.

The all-frame document-start `content_script.js` responds to `htmlContent` runtime messages with `location.href` and `document.documentElement.innerText`. Its keyup handler sends `WrittenWord.keydown`, the URL, modifier/key data, `activeElementValue`, and `activeDocumentValue`. This is concrete privileged page-text/input collection. The background bundle was manually searched but REA's automated analysis timed out; cloud dispatch, OCR handling, and all blocking policy edges are not fully reconstructed. The very small content script was separately analyzed successfully. A page-origin service worker cannot make this extension's isolated-world runtime messages invisible.

### IMTLazarus 26.4 and 26.9

Important files: `bckgrnd.js` imports `js/config.js`, `js/HTTP_Request.js`, `js/bckgrndmain.js`, `js/tabcontrol.js`, `js/onbeforerequest.js`, `js/pageChecker.js`, `js/flags.js`, and other modules; `bl/categories.js` carries a large local domain/category database. Manifest content scripts add broad frame controls plus many site-specific behaviors. The `model/` assets and `nsfwjs.min.js` implement a separate content-model surface that was inventoried, not fully decompiled.

`js/onbeforerequest.js` calls `ifBlock(...)`, consumes a returned `redirectUrl`, and updates tabs or returns redirects. `js/pageChecker.js` contains the `ifBlock` path and screenshot collection/reporting. In fresh 26.9, screenshot reporting uses `https://<configured-instance>.imtlazarus.com/lazarus/api/chrome-screen/index.php`, with URL/title metadata and screenshot form data; the fetch occurs in the extension background. `js/content_gettextocr.js` collects `document.body.innerText` with page URL on selected Wikipedia/Google Sites contexts and sends `get_textocr`. These are local category/policy checks, site controls, and remote content reporting, not proof of a single universal URL-signature detector. Version comparison is partial; no claim that all 26.4-to-26.9 changes are understood.

### InterCLASS Filtering Service 6.4.2026.0501 and 6.5.2026.1014

Important files: `sw.js`, `filter_category.json`, `publicKey.json`, `contentScripts/content.js`, `contentScripts/content_not_overlay.js`, `error_page.js`, and the manifest. The fresh background's environment sets manager/inspection origin `https://wf.interclasscloud.com/` and constructs `url_check/v3`, `get_allow_data/v2`, and `input_data_check/v1` endpoints (fresh `sw.js`, offsets around 959106 and 961034). URL checks include `target_url`, user identity, category lists, and organization/group identifiers.

The fresh worker subscribes to tab updates and webNavigation history/fragment updates, injects content scripts into existing tabs, and observes request bodies for safety-input checks. Safety-input block handling can call `chrome.scripting.executeScript` to navigate a frame, then fall back to `chrome.tabs.update` (around offset 1066380). This is extension-controlled navigation and organization policy, outside Civil's page-origin fetch authority. Automated analysis of the large worker timed out; smaller content/config comparisons completed. No claim about all cryptographic or network policy branches is made.

### Linewize Connect 4.0.3 and 4.0.6

Important files: `background/background.bundle.js` and its source map, `content_scripts/filter.bundle.js`, `content_scripts/categoriser.bundle.js`, `content_scripts/notifications.bundle.js`, `offscreen/offscreen.js`, `offscreen/assets/domains.json`, `schema.json`, and `manifest.json`.

`categoriser.bundle.js` listens for `categoriser/get-page-content` and returns serialized HTML: 128000 characters ordinarily or 256000 for a full scan; SVG documents expose `foreignObject` markup. The manifest injects it into all frames. In fresh 4.0.6 the background enumerates frames using `chrome.webNavigation.getAllFrames`, sends that message per frame, then passes returned markup to `this.engine.categoriseContent(u,this.ignoreThreshold)` with `ignoreThreshold:80` (offsets around 1754500–1759000). It loads a downloaded weighted-phrase list and a remove-tags list. This is an actual local content-aware classification trace, not merely a search hit on the word `Proxy`.

The background also maintains category/signature policy results and reports connection events to `https://stats-xlb.<region>.linewize.net/<appliance>/-/extension` (fresh offset around 1860174). Teacher focus-lock handling can close tabs or navigate them back to the prior allowed URL. Therefore the Civil vendor-domain blocker may limit Civil-origin contacts, but it does not stop extension-origin classification/reporting. The weighted phrase data and organization configuration were not obtained; the exact active phrases deciding a real school's proxy category remain unknown. No concrete bug in the already-modified Civil Linewize checker was established, so it was preserved.

### LoiLo Web Filtering 1.16.13 and 1.18.0

Important files: `dist/background/background.js`, `dist/client/content_script.js`, `rules.json`, blocked/error/setup components, and the manifest. Fresh background `fetchWebFilteringCanView` POSTs `{device_id,url,language}` to `/api/web_filtering/can_view` at the configured LoiLo origin; fallback checks use `/fallback_api/web_filtering/can_view` (fresh offsets around 21229 and 21833). The production origin is `https://n.loilo.tv`. Returned `can`/`student_can`, categories, and `categorizing` status control cached decisions and blocked-page handling. This directly depends on the outer browser-visible URL and remote policy. Client-bundle automated parsing timed out on the cached version; the background parsed successfully. No claim is made that changing page JavaScript suppresses the extension's own API request.

### Mobile Guardian 2.2.68

Important files: `background_app/config.js`, `background_app/filter.js`, `background_app/api.js`, `background_app/api-request.js`, `background_app/tab-control.js`, capture/heads-up modules, `background.js`, and `manifest.json`.

`Filter.Init` installs webRequest listeners and tab listeners. `CheckAllowed` sends `action=urlIsAllowed`, the complete `uri`, device signature, and student identifier to `Config.API_HOST + '/json?' + Api.serialize(data)`. `res.status != 2` is the allow condition. Denied responses navigate the tab to the packaged `block.html?url=...&category=...` via `chrome.tabs.update`. Config lists regional Mobile Guardian API hosts; this is privileged extension cloud filtering. Remote classification and teacher screen controls remain independent of page-origin request interception. The large localized Angular UIs were hashed, not analyzed in full.

### NetSupport School Student 15.0.3.0

Important files: `background.js`, `js/models/Tab.js`, `js/models/TabData.js`, `js/comms.nc.js`, `js/comms.websocket.js`, `js/comms.commands.js`, `js/modules/initialize.js`, `js/connection.js`, managed schema/defaults, and `manifest.json`.

`Tab.parseWebFilter` receives tutor policy with include/exclude lists and redirect pages. `Tab.mustFilter` evaluates those rules and returns a redirect; `Tab.Update` requests a privileged tab update. `Tab.getDetails` forwards tab URL/title via `TabData.send` to connected sessions. This trace establishes classroom URL restriction/reporting, not self-discovery of a specific proxy engine. It cannot be defeated merely by returning a different response to a proxied vendor URL. Protocol authentication, complete tutor transport handling, and screen-capture runtime behavior were not fully reconstructed.

## REA evidence and residual limits

Complete retained REA records were exported to `extensions/filter-audit-2026-10-30/ckauthenticatorg3/classroom-rea-evidence.json` (53,019,942 bytes at export; 42 records). No native binary session was opened. Every automated application graph below is partial because selected sources exclude other package files and conservative semantic ceilings/dynamic expressions remain unknown. A successful parse is static evidence, not observed execution.

| Artifact/scope | Parent Evidence ID |
|---|---|
| CK G3 local important JS | `ev_c161065095043ea01b6e202a9cc13c3cca22b102ca718ced7897223a28d15b7d` |
| ContentKeeper local background/common | `ev_c9577499800d24a70ddf69d11e2f3ee45a10679250c3d10e90638b892d62810d` |
| classroom.cloud local selected background/content | `ev_f5208ad6a9ecdeeb0edfea7ef9bb6b74d366d5f03dfc9fa083dbfdd363201359` |
| Gopher Buddy local application modules | `ev_7405d92d1a6d19bb3aac4f3e90073884c261e9293cd4e9c2a9857948074b5834` |
| Impero worker timeout, zero JS files parsed | `ev_bc4886c6600ab303a89e4e0f696adb50c3470e51dd7825bbb8597a31ba483b28` |
| Impero fresh content script, successful separate parse | `ev_241ccfaf569e24f2507b9e3e9594553f7b3707adaa44a5a660c0fdbeba30a595` |
| IMTLazarus 26.4 core modules | `ev_42558f693d1aaf878ee89b09167f5baafd82fb7ee3e27059ffa737568d84d771` |
| IMTLazarus 26.9 core modules | `ev_7f046a9d81323e5664ae4e4bc6c00aa7f6ad69cfccc0673c579a7e5096fe8fa6` |
| InterCLASS worker timeout, zero JS files parsed | `ev_5c6efcbdeb9ea250a896e4cae10033b7217cbdd9b464d53a6780e3fbdde8c4cb` |
| InterCLASS cached small content/config selection | `ev_f6fcf6402ff5fc36f2e2917542bff2224439f8ffcbf6434b43a690b44872ec0d` |
| InterCLASS fresh small content/config selection | `ev_15bac3bb540d8c7d492ab20f86b7afeb407224a86f48b92236cd19eaaf3bae45` |
| Linewize 4.0.3 content/schema selection | `ev_c157c2a7c538f7eb6407f724f8eb4df3eb44ed335eb767d2f44b649ea1e892cf` |
| Linewize 4.0.6 content/schema selection | `ev_b93f32eb33cb7cb60cdfe6cf8931fc461ca3ce5008c27adda07bfce6a88ce3d3` |
| LoiLo cached background parsed; client timed out | `ev_396d022390ab7b41ed5e9e001cd832c9653bf9d2a850b9c6f722abbf87adf166` |
| LoiLo fresh background/config selection | `ev_f29a47cec9a901bdce438cb186ab75859c8bf3019d677ca240be1efcdb259da3` |
| Mobile Guardian local selected background modules | `ev_bc6842118d2d3ecb2157b33aa28d1d483fe18d1cf3efc0d83f91026bd246d2b3` |
| NetSupport local selected policy/background modules | `ev_3492973d86f55d2d26a0500631a8398a3b4a42c2492c8b63666caf5d02932aae` |

Version comparisons retain the above limits:

| Comparison | Evidence ID | Reported changed entities / unknown entities |
|---|---|---|
| Linewize cached/current selection | `ev_538e22f3a83613d94406d248e270f231fac7c263f0db8e4f50785e91e72a2910` | 16 / 91 |
| IMTLazarus cached/current selection | `ev_c4c56811b4bd9b23ef323daba419067a5cd0dfaf6c490b23aa775732a3148eef` | 12 / 238 |
| InterCLASS cached/current small selection | `ev_308792111830c855a7e253896af4e442528d27c206c537671f8e79aa8125924a` | 6 / 26 |
| LoiLo cached/current selection | `ev_90cd986eb8d430bff7a4148de5aa7e4e8d19b8a118e2fa3906772cbe2161e055` | 7 / 47 |

These entity counts are graph comparison results, not counts of behavior changes. They do not prove equivalence of unknown or unselected files. Source maps, packaged resources, native/NaCl/WASM internals, vendor-cloud code, and real managed-device execution retain explicit coverage gaps.

## Implementation disposition

No vendor-specific production edits were justified by this group's evidence. Existing Linewize code already contains unrelated uncommitted verdict/middleware changes and was left intact. The useful common action is to reduce Civil-controlled URL/resource metadata disclosure and prevent unintended contacts to vendor origins in Civil's own proxy path. Such changes do not stop privileged installed extensions from reading the outer URL, DOM, visible screen, or reporting directly from their background context. The requested all-version/every-important-file/universal-nondetection objective remains incomplete.

## Second acquisition pass: GitHub mirrors and primary support sources

This pass searched GitHub for every exact catalog ID, then followed concrete source-archive candidates and primary vendor support links. It did not repeat the already-empty Wayback CRX queries or gated Chrome-Stats requests. `<folder>/github-search-boundary.json` records each exact-ID query and its first-page bound: 8 results for CK G3, classroom.cloud, Gopher Buddy, and Mobile Guardian; 10 for ContentKeeper; 12 for the other six. Search counts are not evidence that all GitHub history was examined.

### Downloaded snapshots and authenticated identity

Four public mirrors were downloaded without executing their contents. The archive URLs below are pinned to exact Git commits. Every acquisition receipt includes all extracted files' SHA-256 values.

| Package/version | Public artifact | Archive SHA-256 | Snapshot date evidence |
|---|---|---|---|
| classroom.cloud 3.00.7.0 | [S-PScripts ZIP](https://raw.githubusercontent.com/S-PScripts/cc-source/31ce7fcb09e76c991b633ab39f82c871abe8706e/mpkdoimpgkhjcicmhmlmgboelebflpla.zip) | `892cae5d8d3ea882bcd06dc7b29869fb93bf62424a6d2eef7b5803778d89d8bb` | ZIP-added commit `ea2bc5df1b2ba4f68172a363f55cbe814a6a1642` declares 2026-01-14T12:34:23Z; release date unknown |
| ContentKeeper 2.1.4 | [Src-Skol source ZIP](https://codeload.github.com/Src-Skol/CKAuthenticator/zip/95b2a5da1053b6234708c0923c41bbb47063341b) | `ca06ff4883e0c765db25c9f0cfab8a1012804ffab6c13e67f1cc3b742a4cf1af` | Pinned commit declares 2023-02-04T14:57:51Z; repository created 2023-02-04; release date unknown |
| Gopher Buddy 0.9.8.9 | [Src-Skol source ZIP](https://codeload.github.com/Src-Skol/Gopher-Buddy/zip/22997e42cde8619c199d4f834c20ecd5ca497a05) | `b12b079c24ce69dfff6426a39ddf111cc4696809d88a1c122e0fcbd8ca00bed1` | Commit declares 2023-01-10T16:15:53Z; repository created 2023-01-15, so commit time is not a verified upload/release time |
| Gopher Buddy 0.9.9.3 | [Bee4Queer CRX](https://raw.githubusercontent.com/Bee4Queer/gopher-buddy-source-code/e4829504dc0dbcb7c29fe82868dfb664dec906e8/gopherbuddy.crx) | `a848025943afca71d4f5c28a382cf7ac9ed1771ee7599007792adce5e5324ae8` | Commit declares 2024-02-15T16:16:58Z; repository created 2024-02-15; release date unknown |

Git commit timestamps are mirror metadata, not vendor release dates. The two Gopher snapshots are older than the requested approximately 1–2-year window; they extend historical comparison but do not satisfy that window.

Identity verification used the RSA public key defined by [Chromium's `extensions/common/constants.cc`](https://raw.githubusercontent.com/chromium/chromium/main/extensions/common/constants.cc), whose use for content verification is explicit in [ChromeContentVerifierDelegate::GetPublicKey](https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/extensions/chrome_content_verifier_delegate.cc). The downloaded key definition is retained locally. Its DER SHA-256 is `b5e4096227b83f82101fc2aa49f2a251accde3d98471464dd17d1819b43786b0`.

The audit verified each Web Store JWS signature over the exact protected-header and payload strings using RSA-SHA256, decoded the signed `item_id` and `item_version`, and checked the signed SHA-256 tree roots against extracted bytes. A tampered-message self-check failed signature verification as expected. This authenticates the signed metadata and the matching covered files; it does **not** verify the CRX wrapper signature or establish publication date.

| Snapshot | Signed item ID | Signature | Signed file roots | Local verification record under `extensions/filter-audit-2026-10-30/` |
|---|---|---|---|---|
| classroom.cloud 3.00.7.0 | `mpkdoimpgkhjcicmhmlmgboelebflpla` | Valid | 304 match; 0 mismatch; 0 missing | `classroomcloud/github-mirror-3.00.7.0-verification.json` |
| ContentKeeper 2.1.4 | `jdogphakondfdmcanpapfahkdomaicfa` | Valid | 17 match; 0 mismatch; 0 missing | `contentkeeper/github-Src-Skol-CKAuthenticator-2.1.4-verification.json` |
| Gopher Buddy 0.9.8.9 | `cgbbbjmgdpnifijconhamggjehlamcif` | Valid | 681 match; 0 mismatch; **415 missing** | `gopherbuddy/github-Src-Skol-Gopher-Buddy-0.9.8.9-verification.json` |
| Gopher Buddy 0.9.9.3 | `cgbbbjmgdpnifijconhamggjehlamcif` | Valid | 1096 match; 0 mismatch; 0 missing | `gopherbuddy/github-Bee4Queer-gopher-buddy-source-code-0.9.9.3-verification.json` |

All 415 missing signed files in the 0.9.8.9 mirror are under `vendor/lodash/fp/`; their names are retained in its verification record. That source ZIP is incomplete even though its reviewed application files match authenticated roots. Extra unsigned files are not authenticated by matching signed roots. The 2.1.4 mirror's 18 inventoried files match the cached 2.1.4 tree byte for byte. The freshly obtained 0.9.9.3 CRX's 1097 extracted files likewise match the cached 0.9.9.3 tree byte for byte, providing provenance without a new version or need to re-analyze identical source.

### Actual source comparisons

The 0.9.8.9 Gopher application source was analyzed with REA (`ev_7f10535e10d53f6a7bd3745ac3f539f61d32717c7c81f5487f21c03669ba578d`). Direct comparison with 0.9.9.3 shows `app.config.js` adds the `userJWT` storage key; the old analytics version literal is 0.9.8.8 despite the signed manifest version 0.9.8.9. `background.js` changes user-profile/license handling to use retry arguments and JWT state. It also removes the old `request.add`/`request.remove` branches and their `onBeforeSendHeaders` token-header listener. These are concrete authentication/session changes, not evidence of a newly added proxy detector.

Its REA version comparison completed and was retained as `ev_ec04825cb31c79565967faeaa6d4970c079180717c9ac029096146fb0fe1a82a`: 411 changed graph entities, 2146 unknown. The inline MCP response exceeded its transport budget. That producer was not repeated; the exact retained comparison was read from the exported evidence bundle. This REA server does not support `inspect_analysis_view` for comparison results.

The classroom.cloud 3.00.7.0 important-source selection was analyzed as `ev_e344da8f36ca54d747c2f2d3f86a39cf1d0f1c92e77e9296f33a0c72ea42f079`; comparison with the current selection is `ev_00424dbd32d48bb81522bbf3e84fd687407873c06c5b6b1000129391811b215c` (60 changed entities, 678 unknown). The selected background/manifest/policy/content scripts parsed successfully. The graph comparison retains its partial source/semantic coverage and does not establish a complete behavior delta. The authenticated ContentKeeper mirror's selected background/common source was analyzed as `ev_8b1038be333cc4f0545de4f66d2dc27f53a3f35835927d9d8ec6a2536b00d3bd`; its exact byte match to the cached tree means it contributes stronger provenance, not a distinct release.

Second-pass REA records, including the complete oversized Gopher comparison, are exported to `ckauthenticatorg3/classroom-rea-evidence-second-pass.json` (84,492,088 bytes; 52 records at export).

### Remaining GitHub and primary-vendor search boundary

| Folder(s) | Additional concrete candidates inspected | Result |
|---|---|---|
| CK G3 | Exact-ID GitHub code results; repository search for CKAuthenticator; Src-Skol mirror | Mirror is authenticated old-ID ContentKeeper 2.1.4, not CK G3. No distinct G3 package acquired. |
| classroom.cloud / NetSupport | [Official MV3 support notice](https://kb.netsupportsoftware.com/knowledge-base/netsupport-chromeos-extensions-and-manifest-v3/); exact-ID results; repository searches for NetSupport extension/source | Vendor notice confirms Web Store distribution and an MV3 publication update dated 2025-08-21. It offers no historical CRX archive. Classroom mirror acquired above; no older NetSupport package acquired. The manifest-only `mandatoryprogrammer/chrome-extension-manifests-dataset` result is not a complete extension. |
| Gopher Buddy | Three named GitHub source/dump repositories; [official MV3 migration article](https://amplifiedlabs.zendesk.com/hc/en-us/articles/30240623026323-Updating-to-the-Manifest-v3-Version-of-Gopher-Buddy) | Original-ID mirrors acquired above. Official successor ID is `becdplfalooflanipjoblcmpaekkbbhe`; this is a separate extension, not silently counted as a version of catalog ID `cgbbbjmgdpnifijconhamggjehlamcif`. The 2026 Premium ZIP candidate was not counted as original-ID evidence. |
| Impero | Exact-ID GitHub results; repository query `impero backdrop source` | Inspected result page contains ID lists and utilities, not a complete versioned extension archive. Repository query returned no candidates. No additional package acquired. |
| IMTLazarus | Exact-ID results; repository search; `galzstuff/lazarchive` tree; `r3versee/IMTlazarus_Bypass` tree | LazArchive contains no CRX/ZIP/manifest/background artifact in the inspected tree. The other candidate contains a bypass executable and Python script, not the requested extension. Neither was executed or counted as a vendor package. |
| InterCLASS | Exact-ID results; repository query; [official `chieru/ICFS-tools`](https://github.com/chieru/ICFS-tools) root/releases | Official repository supplies log-picker support tools, not the extension; no releases with package artifacts returned. `bettame/RedirectPlus` is a separately described extension. No historical InterCLASS package acquired. |
| Linewize | Exact-ID results; repository queries; [ading2210/ext-watcher](https://github.com/ading2210/ext-watcher) complete tree; first 15 of 60 generic `linewize` repository results followed to four concrete candidate trees | Watcher repository contains downloader/diff tooling and configuration, but no retained CRX/source snapshots in the inspected tree. Its README's reference to a local `crx/` directory is not a published archive. `Haesaann/LinewizeTrash` contains a Roblox installer, not a filter package. `sh495/Hackwize` and `v78641440/LinewizeRemoval` expose utilities rather than a packaged extension in the inspected file inventory; `RXM119528/linewize-dashboard` exposes no matching artifact files. No additional package acquired. |
| LoiLo | Exact-ID results; repository query `loilo web filter`; vendor support searches | Repository query returned no package candidates. Public LoiLo Web Card and unrelated `loilo` GitHub projects are different products. No historical filter package acquired. |
| Mobile Guardian | Exact-ID results; repository queries; `manikk1ll3r/mobileguardianx.` complete tree/manifest | Candidate manifest is a PWA named MobileGuardianX with `start_url` and `display`, not the catalog extension. Other similarly named repositories were unrelated mobile applications. No complete exact-ID historical package acquired. |

Literal GitHub web searches for `<catalog-ID>.crx` for IMTLazarus, InterCLASS, Linewize, LoiLo, Mobile Guardian, and NetSupport returned no results in this pass. Additional bounded repository queries `impero extension`, `netsupport source`, and `loilo filter` produced no matching vendor-package archive; a NetSupport alternative was a different product. No account login, paid archive, installed extension change, package execution, or live vendor classification submission was used. These are bounded failed searches, not proof that no additional public or private archive exists. The original every-extension/2024–2025/multiple-release target remains open.

## Important-source SHA-256 index

The following entries are generated from the byte inventories. Fresh current source is preferred; cached-only packages are labeled. The complete per-package file index remains in the ignored audit directory.

| Package/version | File | SHA-256 |
|---|---|---|
| ckauthenticatorg3 5.1 (current) | `manifest.json` | `793e760b85dfce374dacdeb7fea97d31a73f6f9a42bebf7f6aabd914d9d509d0` |
| ckauthenticatorg3 5.1 (current) | `serviceWorker.js` | `d90229f00500121a28785088392270e509c1b0879ae6f69939448f0aedb33f6b` |
| ckauthenticatorg3 5.1 (current) | `ckenc.wasm` | `3148053fdd36cc956e1b5b60bbcc3699ce5d5bf15166c26b7098ba6e232d5033` |
| classroomcloud 3.10.0.0 (current) | `manifest.json` | `1256e3c75e3b03312ec1f4189e477d11fc005e4b73ef347901d5bd5de3a5c341` |
| classroomcloud 3.10.0.0 (current) | `js/modules/background/webFilter.js` | `f8dc744079f14fab8a83c7324ea07f282a2a9c70f67dbe6627a000caf6b348b1` |
| classroomcloud 3.10.0.0 (current) | `js/modules/background/esafety.js` | `3c8528fd0201bb91dfab2db13026c3a25b12b7451a368bb66d274f0c16ab036f` |
| classroomcloud 3.10.0.0 (current) | `js/phrase/lang/en/en.js` | `2eba2e1c130402a56b6587bdeda8a01437972ca46a7f719a64952b2144b5968a` |
| contentkeeper 2.1.4 (cached) | `manifest.json` | `f5eb402d4de5bd22bb675dbfcd8abc094d262599b79fa8917768b06d207eb745` |
| contentkeeper 2.1.4 (cached) | `background.js` | `96101c6d5f93b9a79c21fd6de04da2c24b444e939196adeb79a51ba92b0c57f3` |
| contentkeeper 2.1.4 (cached) | `newlib/Release/ckauth.nmf` | `e269f67d08c67134f4f8214f0d63d2fb8b500ba5ca1431b5c315464ff302ecb4` |
| gopherbuddy 0.9.9.3 (cached) | `manifest.json` | `10f04108527f545d70a096a87a2bd048d1d53e1cd3de76925c057cc98d3b9fd5` |
| gopherbuddy 0.9.9.3 (cached) | `background.js` | `7a42bb94e6eb7cc1e994dd7b4868af8682b8e7d1aba4f6de0309412cff4a983c` |
| gopherbuddy 0.9.9.3 (cached) | `scripts/content_script.js` | `d2aaad9165cd23e156c41be5f59e496967226a4af0ea3ea465e9b407310c747e` |
| impero 4.0.286 (current) | `manifest.json` | `be36a8c2edb7b828f819a7f6df6be57e6f8a15987536761667f87c465bf71b01` |
| impero 4.0.286 (current) | `js/serviceWorker.js` | `47f1af6a90f618a866c2e24ba8ca813359511cad32bd3b04c1810eb8682f7794` |
| impero 4.0.286 (current) | `js/content_script.js` | `b20a2ff6226f25fcfcb537d83fd878cc7645ff5086fd54e320ed6d2022ba6e9f` |
| imtlazarus 26.9 (current) | `manifest.json` | `e2f554cfa9cb49ff2d8654a61c085d991a972cb4e86876927cb318283fc44369` |
| imtlazarus 26.9 (current) | `js/pageChecker.js` | `53b507050c4816fc7f9f44767142df14bbe7857fe94027873fa8931e73281bf5` |
| imtlazarus 26.9 (current) | `js/onbeforerequest.js` | `892a2e99cb0637cd660bdba299d3a0e26e7889d1618f77c6915a2c972853468a` |
| imtlazarus 26.9 (current) | `bl/categories.js` | `cc64870a00691f89f0ac5f75556f3a90c61f123beca296fa0add5719050972dd` |
| interclass 6.5.2026.1014 (current) | `manifest.json` | `b7f7b1ce8266f411c9c6ce02009e37bff7b1a0d55b41d9f50ca58df82488877d` |
| interclass 6.5.2026.1014 (current) | `sw.js` | `b1e1884a222787541f5fe9c3a9d6c0df95b6bde1c0441f4baf13a06f5f710614` |
| interclass 6.5.2026.1014 (current) | `contentScripts/content.js` | `82bbd886eef8f0ac53edb4cae9f057839dcc32cfe2461d85f850000b5a9b46ff` |
| linewizeConnect 4.0.6 (current) | `manifest.json` | `19a74ea39f5256e0effd05ebb571868f35a65863d972338ad407fe45ee551a2f` |
| linewizeConnect 4.0.6 (current) | `background/background.bundle.js` | `8e5655df8fd878a35dbe1e269c4a25a5f4ad2fb11b10dcd4fcd962a2e0c55eeb` |
| linewizeConnect 4.0.6 (current) | `content_scripts/categoriser.bundle.js` | `d458ebbbe5a67c5eab47fdbe86064300d7f7fa71f6df2d19cf9735a70f69f415` |
| loilo 1.18.0 (current) | `manifest.json` | `41710c16fd56fac724f31b9c329310845f0dcd585066167cb6f18b77e3fbf5fb` |
| loilo 1.18.0 (current) | `dist/background/background.js` | `455e040b09cddb0089cd52d5155e3cb4a87f26d93185e2b1029913c344dcb47c` |
| loilo 1.18.0 (current) | `dist/client/content_script.js` | `33f2ff09d4cdcf2fecd5c99887ab418c4e2842bbe84c0091d3736a96c612430c` |
| mobileguardian 2.2.68 (cached) | `manifest.json` | `1507ebff735e07cae0348ab8512f4d9b1b8a47a8e6d9047449b509321e1b1b3e` |
| mobileguardian 2.2.68 (cached) | `background_app/filter.js` | `e5421dc7df93959d8ef00bdec6d57a9f96538f318e1af37d65b73f88c184f3fb` |
| mobileguardian 2.2.68 (cached) | `background_app/config.js` | `14c65af57bc2f5d0e859258a4a4934b9277716b1d92fcae1717e82c8dac26745` |
| netsupport 15.0.3.0 (current) | `manifest.json` | `45b5a123514390ec844434e13b0e16d7038c715cf41991857199a289445c59c1` |
| netsupport 15.0.3.0 (current) | `js/models/Tab.js` | `d1a996927a171196d56aa89116a86eb1b2922d011f5059867e07ad0eeb6a8bdd` |
| netsupport 15.0.3.0 (current) | `background.js` | `befa8b94834fdd1ad9ac7755d37ea4265d58ac49e3585f1a8d78095358493f01` |
