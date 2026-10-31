# Filter extension audit: network and classroom bridge group

Observed 2026-10-30. This report covers eleven catalog entries. It records source observations and one controlled replay; it does not establish that a managed Chrome installation cannot detect Civil.

## Acquisition and coverage

The catalog came from [Filter-Sources extensions.json](https://raw.githubusercontent.com/civilnetwork-dev/Filter-Sources/refs/heads/main/extensions.json). Current packages were fetched by the root audit's `acquire.tmp.mjs` through each catalog entry's update endpoint. Existing local packages were copied separately. Third-party code was not installed in Chrome. CRX signatures were not independently verified.

Local artifacts are under `extensions/filter-audit-2026-10-30/<folder>/`. Each folder has `acquisition.json` with request provenance, package hashes and full per-file inventories. `existing-inventory.json` and, when available, `latest-inventory.json` contain manifests and SHA-256 hashes. Context indexes are search aids, not proof of execution.

| Catalog folder | Existing local version | Update endpoint version | Distinct available versions | Important coverage boundary |
| --- | --- | --- | --- | --- |
| aristotleEducator | 11.0.0 | 11.0.0 | 1 | Same bytes in both inventories; all four code/config files selected for REA. |
| aristotleStudent | 23.14.0 | 23.19.0 | 2 | Proxy detector traced in both releases. Latest content/text/image scripts selected; 2.1 MB background and model weights are not fully reconstructed. |
| blocksi | 4.9.1 | 4.9.16 | 2 | Background URL detector traced in both releases. Latest background/content/iframe sources selected; graph truncated at configured semantic limits. |
| ciscoSecurity | 2.2.1 | 2.2.1 | 1 | Same bytes. Background direct source/config inspection; REA background worker timed out. Separate manifest/PAC/schema analysis succeeded. |
| ciscoUmbrellaApp | 1.3.23 | No codebase returned | 1 | Update response says `noupdate`; this does not establish that cached version is the newest version anywhere. |
| ciscoUmbrellaExtension | 1.3.4 | No codebase returned | 1 | Same acquisition limitation as companion app. |
| fortiguard | 2.0.0.0017 | 2.0.0.0017 | 1 | Same bytes. Worker/content/offscreen/schema selected; remote EMS policy and rating service unavailable to static inspection. |
| iboss | 1.0.170 | 1.0.200 | 2 | Both actual proxy detector pairs inspected; both actual content scripts replayed offline. Policy actions and MAIN-world probe not replayed. |
| lanschoolAir | 2.25.0.20424 | 2.25.0.22463 | 2 | Background direct source inspection. REA background analysis hit 30-second worker deadline; smaller manifest/PiP analysis succeeded. |
| lanschoolStudent | 8.0.2.15 | 8.0.2.15 | 1 | Same bytes. JS background/preferences selected. `student.pexe` native core was inventoried, not decompiled. |
| lanschoolWebHelper | 9.2.0.2 | 9.2.0.2 | 1 | Same bytes. Background, block-page and content bridge scripts selected. Local student application not supplied. |

The initial acquisition above contains fifteen distinct versions across eleven entries, with two versions for four entries. The GitHub follow-up below adds authenticated older FortiGuard and LanSchool WebHelper versions and a signed Blocksi code subset. Existing cache dates and Git commit dates are not release dates. Historical and additional intermediate coverage remains incomplete.

Historical-source checks: GitHub's public repository metadata reports Filter-Sources was created on 2026-08-24; its `extensions.json` commit query before 2025-10-30 returned no entries. It cannot supply the requested older releases through that file's history. A direct public CRX4Chrome iboss package page request returned HTTP 404; web access to the tested CRX4Chrome/chrome-stats history URLs also failed. These bounded failed checks do not prove no archive exists. They do not justify labeling cached 2026-era packages as one-to-two-year-old releases.

Additional bounded acquisition checks:

- Asking the iboss and Blocksi Google update endpoints with browser compatibility versions `120.0.6099.0`, `131.0.6778.0` and `142.0.7444.0` still returned current versions 1.0.200 and 4.9.16. Both retired Cisco entries returned `noupdate` for all three requests, and also for ChromeOS requests with `chromecrx` and `chrome` product parameters. Full XML replies are retained as `compatibility-*.json` under each entry. These parameters do not select a historical release date.
- Aristotle's current student and educator codebases use opaque tenant/hash download paths, rather than version-bearing filenames. No older artifact URL follows directly from that pattern.
- [Cisco's employee release note](https://community.cisco.com/t5/umbrella-software-release-notes/umbrella-chromebook-client-app-version-1-3-23/ta-p/5191733) dates the App 1.3.23 update to 2023-05-11 and names Extension 1.3.4 as its companion. Those packages therefore have a primary-source historical anchor, but the date is outside the requested one-to-two-year window and supplies no additional distinct package.
- [Chrome-Stats' own iboss archive listing](https://chrome-stats.com/d/mkhjobnjhllkhekbbedlkmgcglgaeidc/download) lists 1.0.125 at 2025-09-29, 1.0.55 at 2025-02-19 and 1.0.35 at 2024-12-12, with old versions requiring Pro access. These are archive metadata dates, not independently verified package release dates. Normal requests to its publicly offered free 1.0.195/1.0.190 download links returned HTTP 403. No login, purchase or access-control bypass was attempted.
- A direct current CRXSoso page fetch succeeded but advertised 1.0.200, despite the search cache showing 1.0.160. Its page says historical downloads require login. A stale search result was not counted as an acquired version.
- Filter-Sources exposes no GitHub release assets and its GitHub Actions cache API returned zero caches. The reviewed workflow uses Blacksmith snapshots of processed sources. A generic Aristotle Wayback CDX query timed out after 20 seconds; it was not retried.

## GitHub follow-up and cryptographic source validation

After the request to look on GitHub, exact-ID code searches, source-specific filename/symbol searches, repository searches, branches, manifest histories and identified source mirrors were inspected. Search results are retained locally under the corresponding entry. Searches were bounded and do not establish global absence. A repository containing an extension ID in a removal script or extension list was not counted as an extension package.

The offline check `aristotleEducator/verify-github-metadata.tmp.mjs` verifies the `webstore` RS256 signature in retained `verified_contents.json`, then computes each listed file's SHA-256 block/Merkle root using Chromium's format. The official Web Store public key is pinned to [Chromium commit e8b9ab62](https://github.com/chromium/chromium/blob/e8b9ab62bfdc7f3a09cdaa5a69089433e3e5aa2a/extensions/common/constants.cc). Signature framing and tree construction were checked against Chromium's `verified_contents.cc`, `content_hash_reader.cc` and `content_hash_tree.cc`. The verified key's SHA-256 is `b5e4096227b83f82101fc2aa49f2a251accde3d98471464dd17d1819b43786b0`.

The check was also run against newly downloaded iboss 1.0.200, Blocksi 4.9.16 and FortiGuard 2.0.0.0017 packages: signatures validated and all 155, 167 and 23 listed file roots matched respectively. This validates signed file content, not a remote policy verdict or an original CRX signature.

| Commit-pinned source | Signed identity/version | File-root result | Treatment |
| --- | --- | --- | --- |
| [kkilobyte/blocksi-extension, cab525a7842a](https://github.com/kkilobyte/blocksi-extension/tree/cab525a7842af8faef90751a60eee1f410ff41a5), commit 2025-02-02; initial manifest commit 2024-09-25 | Requested `ghlpmldmjjhmdgmneoaibbegkjjbonbk`, signed version **3.4.15** | 63 matches, 8 mismatches, none missing. All reviewed JS, background/content files and model files match. Manifest, four locale metadata files and three icons differ. | Authentic signed **3.4.15 file subset**; not an authentic complete package and not claimed version 3.4.4. The mirror's manifest says 3.4.4, contradicting signed metadata. Commit dates are source snapshot provenance, not release dates. |
| [Src-Skol/FortiClient, c0b714d655c6](https://github.com/Src-Skol/FortiClient/tree/c0b714d655c63dc78f2daebc95d0be4e9e66f41e), commit 2023-02-04 | Requested `igbgpehnbmhgdgjbhkkpedommgmfbeao`, **1.0.1.0042** | All 29 listed files match. | Additional authenticated historical version; substantially older than the requested one-to-two-year window. |
| [BKFighter/lanschool_web_helper, 55ded3ea45dc](https://github.com/BKFighter/lanschool_web_helper/tree/55ded3ea45dc474461f29e5c6919a1e86ca5b83c), commit 2016-11-29 | Requested `honjcnefekfnompampcpmcdadibmjhlk`, **8.0.0.1** | All 32 listed files match. | Additional authenticated historical version; outside the requested age window. |
| [phexus23/Lanschool, 8b43bc183d3e](https://github.com/phexus23/Lanschool/tree/8b43bc183d3ec2e495091458926f88c1866e5963), commit 2025-05-14 | Requested `honjcnefekfnompampcpmcdadibmjhlk`, **9.2.0.2** | 41 matches; only manifest differs. | Authenticated code snapshot from the requested period, but same version as current download; not another distinct version. |
| [NXX99/schoolextensionsource, 469f708ed873](https://github.com/NXX99/schoolextensionsource/tree/469f708ed873a25c960a4b87dcbe250ab3537333/1.3.4_0), source commit 2023-02-15 | Requested `jcdhmojfecjfmbdpchihbeilohgnbdci`, **1.3.4** | 18 matches, 6 locale/icon/manifest mismatches. Reviewed JS matches. | Authenticated code subset of already acquired version; not another version. |
| [Src-Skol/cisco-umbrella, 779f78c9777d](https://github.com/Src-Skol/cisco-umbrella/tree/779f78c9777d20d301db41ebb781be73a737b95f), commit 2023-01-14 | Requested Cisco ID, **1.3.4** | 17 matches, **7 JS mismatches**, none missing. | Signature is genuine but altered JS cannot establish shipped behavior. Prefer the signed-matching NXX99 JS. |
| [Src-Skol/blocksi, a8a189749eef](https://github.com/Src-Skol/blocksi/tree/a8a189749eefa9cd1d421fda099830de91240aa7) | **Different ID** `pgmjaihnmedpcdkjcgigocogcbffgkbn`, 1.0.168 | Valid signature, all 50 listed files match. | Related vendor artifact, excluded from requested extension/version counts. |
| [Src-Skol/iboss, a38befeb6a36](https://github.com/Src-Skol/iboss/tree/a38befeb6a364aebea1a1cb8b28fcc914bd6dd16) | **Different ID** `kmffehbidlalibfeklaefnckpidbodff`, 5.3.205 | Valid signature, all 17 listed files match. | Legacy vendor artifact, excluded from current `mkhjob...` extension/version counts. |

Downloaded ZIP hashes, full Git commits, acquisition times and file SHA-256 inventories are in adjacent `github-*-provenance.json` records. Per-file match/mismatch results are in `*-integrity.json`. Matching files are accepted only alongside a valid signature and exact requested ID. A retained signed file root authenticates that file's bytes; it does not authenticate differing files elsewhere in the same mirror.

Remaining source leads were checked without promoting unrelated content into evidence: `c00lkiddtech/ARISTOTLEK12-lks` contains a 23.19.0 tree under a different `jfpdbo...` ID; its companion repository is empty. The school district Aristotle repository inspected contains a block page, not an extension. The LanSchool Air research repository discusses a native Electron client, not an exact-ID historic Chrome extension package. None satisfies a missing catalog extension version.

## Important files and responsibilities

| Entry | Files or modules examined | Source-established role |
| --- | --- | --- |
| Aristotle Educator | `manifest.json`, `config.json`, `service-worker-loader.js`, `assets/background.ts.541c4b27.js` | Teacher portal launcher. Reads tenant config, watches the session cookie, fetches `GetClassSchedule`, opens educator/classroom windows on alarms. No manifest content script or student filtering surface in this package. |
| Aristotle Student | `manifest.json`, loader/config, `scripts/contentScript.js`, `scripts/textFilterScript.js`, `scripts/imgFilterScript.js`; background and model resources inventoried | Content filtering, text/image classification, classroom policy and reporting. Content/text scripts contain explicit engine identification and emit Proxy classification events. Image model assets are a separate ML content classifier; their base64 payloads are not JavaScript proxy signatures. |
| Blocksi | `manifest.json`, `background.js`, `contentScript.js`, `iframeObserver_contentScript.js`; policy/classification chunks inventoried | Background owns policy, tab navigation, filtering and reporting. Content script sends page content to the worker. All-frame iframe observer asks `GET_FILTERING_RESULT` and YouTube checks, then pauses media/overlays blocked content; this is distinct from the literal proxy URL detector. |
| Cisco Security | `manifest.json`, `schema.json`, `pacProxy.js`; background configuration and PAC construction sites | Enterprise device registration/sync plus managed proxy/DNS routing. Background holds `registration.polaris.qq.opendns.com`, `sync.hydra.opendns.com`, `devices.api.sse.cisco.com`, `doh.umbrella.com` and `doh.sse.cisco.com` endpoints. PAC chooses a configured external proxy for HTTP(S), honoring configured exceptions. Manifest has no content script. |
| Cisco Umbrella App | `manifest.json`, `main.js`, `scripts/config.js`, `server.js`, `nameServer.js`, `registrationHandler.js`, `vaUpdater.js`, `schema.json` | Chrome app companion providing local DNS/registration functionality. Managed resolver/organization settings and a local service support the extension. Defaults include OpenDNS resolver addresses; this is not a page-DOM classifier. |
| Cisco Umbrella Extension | `manifest.json`, `background.js`, `config.js`, `idInfo.js`, `cache.js`, `utils.js` | `webRequest.onBeforeRequest` asks the local app at `http://localhost:8029/` with a `Domain-Name` header. Returned DNS addresses determine block/phish/malware redirects. It does not derive that verdict from Civil's response HTML in the reviewed path. |
| FortiGuard | `manifest.json`, `service_worker.js`, `content-script.js`, `offscreen.js`, `schema.json` | Worker manages EMS profile, URL/video rating queues and keyword filtering; content script handles supported page/search observations. Rating host includes `wsfgd1.fortiguard.net:3400`, with video service path `service/vrquery`. `onBeforeRequest` can cancel keyword matches and block a tab according to configured actions. A rating/category answer alone is not the district's full policy. |
| iboss | `manifest.json`, `background.js`, `common/Constants.js`, settings/PAC services, both proxy detection files | Managed PAC/network routing plus dedicated active proxy classification. Background injects content, invokes privileged MAIN-world probes, categorizes submitted destinations/searches and submits `riskDetection` reports. Direct gateway policy can close or replace tabs. |
| LanSchool Air | `manifest.json`, `js/background.js`, `js/pip.js` | Classroom tab/history and web-limit instrumentation. Background supports native messaging requests named `History`, `WebLimit`, `tabinfo`, `currentTabs`, `currentOTMTabs`; activity is gated by class state. PiP content script reacts to blank-screen policy. Teacher/native/cloud decisions remain outside Civil's page scripts. |
| LanSchool Student | `manifest.json`, `main.html`, `script/background.js`, `defaults.js`, `platform.js`, `preferencedata.js`; `studentNACL.js`, `NACL_message.js`, `student.nmf`, `student.pexe` inventoried | Chrome app maintains classroom/preferences and communicates with WebHelper extension IDs. `main.html` loads the native bridge scripts and embeds `student.nmf` as `application/x-pnacl`; the manifest resolves that to the 2,104,828-byte `student.pexe`. Native protocol implementation remains unknown. |
| LanSchool WebHelper | `manifest.json`, `js/background.js`, `ParseURL.js`, `blockedPageURL.js`, `configstudent.js`, `kl.js`, `pip.js` | Browser extension companion. Posts history and URLs to a configured local student service at `http://localhost:<port>/History` and `/WebLimit`. Applies returned block decisions via redirects/DOM injection and forwards content instrumentation. There is no fixed public host that covers this local protocol. |

Libraries, icons, translations and model weight shards were hashed in the inventory. Their names or matching substrings were not interpreted as evidence of proxy classification. Native code, remote district policy, server-side classifiers, teacher actions and renderer-dependent behavior require additional evidence.

LanSchool Student's native payload starts with `PEXE`, SHA-256 `6794203ca95da677bc5b5ca50a543ca710f6236d41f3a2dd2d670836feb264f3`. `student.nmf` also names a debug `debug_version.bc`, which was absent from the acquired package inventory. No `llvm-dis`, `pnacl-dis`, `clang` or `llvm-bcanalyzer` executable was available through the checked shell PATH. No replacement toolchain was installed.

## Direct proxy detection findings

### iboss 1.0.170

`services/WebProxyDetectionService.js` injects `services/webProxyDetectionContent.js` in the active tab. The content script enumerates script `src` values and registered service-worker script URLs. A substring match against configured engine tokens increments `proxyLibraryCount`.

Default engine tokens are: `ultraviolet`, `uv.sw`, `uv.bundle`, `uv.config`, `wisp`, `scramjet`, `baremux`, `bare-mux`, `corrosion`, `rammerhead`, `eclipse-proxy`, `meteorproxy`, `mercuryworkshop`.

The background marks the page as a proxy when any of these conditions holds:

- `proxyWordCount >= 200`.
- `proxyEngineWordCount >= 4`.
- A proxy disclaimer or proxy server selector is present.
- `proxyLibraryCount > 0`.
- `proxyWordCount >= 100` and a large iframe exists, more than five rewritten links exist, or twice rewritten links is at least checked links.

The variable named `proxyEngineWordCount` does not count the engine URL token array. It counts a separate strong-term list: `discord server`, `discord-button`, `discord-dialog`, `billigerhost`, `rammerhead`, `hammerhead`, `piratebay`. This distinction matters when interpreting replay results.

On a positive verdict, background code can screenshot the visible tab, POST a report to the configured gateway's `/riskDetection?authToken=...`, and close the tab according to policy. Submit/click/Enter listeners also report an entered destination for gateway categorization. These are privileged extension requests, not requests routed through Civil's server.

### iboss 1.0.200

The new release removes the older word-count/disclaimer rules from this heuristic path. Its positive library verdict is `proxyLibraryCount > 0`. It searches the pathname of script URLs with token boundaries, and scans both the controlling service worker and registrations. Matches are deduplicated by token.

Background registers the ISOLATED content script at `document_idle` with `allFrames: true`. It separately runs a MAIN-world function in each requesting frame that checks whether any of these property names exists in `window`:

`__uv$config`, `__uv`, `$scramjet`, `__scramjet$config`, `__Cpn`, `%hammerhead%`, `__meteor$config`, `BareMux`, `__wispClient`.

Property existence is sufficient; setting its value to `undefined` would still satisfy `name in window`. The MAIN-world probe is a remaining detection surface after URL aliases.

The content script can establish proxy state from `[__cpGenerated]`, `[__cpp]`, `[__uv-script]`, `[data-scramjet]` or a positive globals notice. It checks an external `<base href>`, then external canonical/`og:url` metadata when proxy state is established. Background can recover destinations from URL path/query candidates through up to three URI/base64 decode passes. Input listeners report both URLs and search keywords, with exclusions for sensitive-looking fields. Policy additionally controls block pages, automatic tab closure and inherited handling of spawned tabs.

### Aristotle Student 23.14.0 and 23.19.0

In content/text filtering scripts, `Vs()` returns an engine identifier after checking known globals, local storage, service-worker scope/script URLs and IndexedDB database names. Checks include `window.scramjetController`, `window.$scramjetController`, local-storage key `bare-mux-path`, service-worker values containing `scramjet` or `bare-mux`, and database names matching `/scramjet/i`.

This is not dead signature data. The caller runs the detector when `block_proxies.value` is enabled, unless the site is educator/parent-allowed, already categorized, or a block page. A positive result produces a `content-classification` event with category `Proxy`, policy ID and `details.proxy_identifier`; the content event handler sends it to the server and shows the block page. It also repeats on an interval.

Neutral public script URLs address only one of several surfaces. Storage/database names, page globals and policy-driven content classification remain. The second pass (root report, live-browser probe) removed the `$scramjetController` global, the `bare-mux-path` key and the `__scramjet_controller` database name. The real `Vs()` from 23.19.0 now returns `null` on the page, an internal frame and a proxied frame. Policy-driven content classification remains.

### Blocksi 4.9.1 and 4.9.16

`background.js` contains an active `M(e)` navigation handler guarded by policy `proxyDetection`. It returns unless the URL contains literal `hvtrs8` and is not the extension's own URL. A match redirects the affected tab, or other tabs on the same origin when no tab ID is provided, to a block page with category `206` and a Proxy Page detected reason. It also adds hostname/origin entries to the student's local blocked list.

**Corrected in the second pass.** This literal is what Ultraviolet's codec writes for `https:`. Civil's codec percent-escapes the colon before it XORs, so its addresses start `hvtrs%27` and do not contain `hvtrs8` (pinned in `tests/xorCodec.test.ts`, which now also fails if an encoded address ever contains the literal). The first-pass statement that Civil matched was wrong; no codec change is needed. The detector is registered on `webRequest` and `history` events as `detectProxyUsage`, so it sees every request URL, which is why the literal matters if the codec ever changes.

## Controlled replay of Civil's runtime aliases

Runnable local check:

```powershell
bun extensions/filter-audit-2026-10-30/iboss/scanner-replay.tmp.mjs
```

The check executes the actual copied content script from each iboss release in a VM with happy-dom and mock Chrome runtime/service-worker APIs. Separate cases contain the four old document runtime script paths or the current three aliases (`engine.js`, `controller.js`, `start.js`), and the two original proxied-frame runtime paths or their `engine.js`/`frame.js` aliases. All cases use a neutral `/sw.js` registration. These are minimal documents, not a real nested frame or installed extension. No fetch or WebSocket is supplied, and happy-dom script loading is disabled. Assertions fail unless old paths produce a positive library count and aliases remove that specific signal.

| Actual content script | Original paths | Aliases |
| --- | --- | --- |
| iboss 1.0.170 | `proxyLibraryCount: 4` | `proxyLibraryCount: 0` |
| iboss 1.0.200 | `proxyLibraryCount: 2`, tokens `baremux`, `scramjet` | No library statistics report emitted |
| iboss 1.0.170, frame runtime paths | `proxyLibraryCount: 2` | `proxyLibraryCount: 0` |
| iboss 1.0.200, frame runtime paths | `proxyLibraryCount: 1`, token `scramjet` | No library statistics report emitted |

Results and source digests are saved in `iboss/scanner-replay.json`. This is shell-controlled replay evidence, not a full Chrome extension run. Timers are not advanced; MAIN-world probes, actual proxied page globals/markers, input capture, destination classification and gateway enforcement are excluded. The aliases reduce a demonstrated public URL signal; they do not establish that an entire proxied session is unflagged.

The current document also omits the redundant standalone BareMux UMD script. That removes a separate source of a `BareMux` page global, one name the latest background MAIN-world probe checks. The content-script replay above does not measure that separate probe. `$scramjet` and other runtime probes/markers remain separate limitations.

REA's `capture_process_scenario` was also attempted for this check. It is unavailable on native Windows because that adapter does not yet verify descendant cleanup. No REA runtime Evidence ID is claimed for the shell replay.

## Artifact identities and REA ledger

Key latest file SHA-256 values:

| Artifact file | SHA-256 |
| --- | --- |
| iboss 1.0.170 `services/webProxyDetectionContent.js` | `ecdfaf5e4fa1d3d690ef240c7fabfbcdb2e37f6128ec20c8e2baefcef1f5d519` |
| iboss 1.0.200 `services/webProxyDetectionContent.js` | `f680016687f34473f78a9da9b3721626b57f492d867469ecc87752cf3cfb600f` |
| iboss 1.0.200 `services/WebProxyDetectionService.js` | `89e0c623da79b2b9a25867fb4ad7ac9c7f8fb65c2ca1f5b8559c5c4d3dac260f` |
| Aristotle Student 23.19.0 `scripts/contentScript.js` | `9cd29bf60c34c9c2b5807f78b7c866d12ee2756365cec264fd7734352f0b5476` |
| Aristotle Student 23.19.0 `scripts/textFilterScript.js` | `22782d83635b950da0629245a003a2ab1bd8a300eed615744c0cfe0a78e1e682` |
| Blocksi 4.9.16 `background.js` | `9af29eaca2644bbd8cd4a2a8df84a03237dc59bd051b75c466c843d00bc68d52` |

REA parent Evidence identifiers below reference selected inert-source analysis. All relationship graphs contain explicit unknowns; none establishes runtime reachability or remote policy behavior. The root artifact digest is a REA inventory digest, not a CRX package digest.

The complete network-group REA session was exported to `extensions/filter-audit-2026-10-30/iboss/network-rea-evidence.json`: 220,615,178 bytes, 29 records, and one bundle-level unknown, as reported by `export_evidence_bundle`. It preserves the original Evidence IDs below and the analysis records' own coverage/unknown declarations. The bundle-level unknown count does not replace each record's semantic unknown counts. No native target session was opened or closed by this group.

| Input | Parent Evidence ID | Boundary |
| --- | --- | --- |
| Aristotle Educator 11.0.0 | `ev_6205c782ea6dd2757cc200126dabd7484aa5c6386c055751c54b36ff57c91606` | Four selected files; no unselected code/config file. Dynamic semantic relationships remain partial. |
| Aristotle Student 23.19.0 | `ev_7172ea40fb6390e81a0d42d224681a1cd83d2d4f2f6124d0c08526b2e605b957` | Manifest/config/loader and three filtering scripts; 292,725 text bytes read. |
| Blocksi 4.9.16 | `ev_ae06950118c5a79340ad3cd303366d3112f5f65c59baa28db3af94b071b89a24` | Four selected files; 590,902 text bytes; semantic node limits reached. |
| Cisco Security 2.2.1, small scope | `ev_85beb129d9f2ccec11f6efbeaf7cb170ba0b9012fef193ba340dc695ff482a74` | Manifest/PAC/schema; background omitted after its previous timeout. |
| Cisco Security 2.2.1, timed-out scope | `ev_0d1ff2d7c7f1ef7d3f53a75895cfc58b34d4f48cc3679f7562c189206df22c08` | Background worker deadline; partial evidence only. |
| Cisco Umbrella App 1.3.23 | `ev_b14c41cb695976f03e538861d0788ffb0b3061e14f09623169789a3ee641fc54` | Eight selected files; 34,366 text bytes. |
| Cisco Umbrella Extension 1.3.4 | `ev_42eb9d932f5a8d8ba9d4a2b75af0bda52dd5fd2c479cf96ca65ce67ff7093d24` | Six selected files; 8,216 text bytes. |
| FortiGuard 2.0.0.0017 | `ev_814930fd36cd6ca9a01902be192ae58116084fc7aac056edab9f3f4380a36016` | Five selected files; 238,601 text bytes. |
| iboss 1.0.170 | `ev_2ae597173443b6e4e5a9ab39db7d3106fa0d4f2d73c66ff68d58dbdb49dfe68d` | Eight selected files; 90,344 text bytes. |
| iboss 1.0.200 | `ev_10d595733748b9b60937314f5ef2d5a598fc990ec2541b4ebc8b5718249e0c86` | Seven selected files; 120,639 text bytes. |
| LanSchool Air 2.25.0.22463, timed-out scope | `ev_41ac30269c0526d19d01879a64bf598c409fcbe6e09e84ec1f689dda5650297f` | Worker deadline, zero parsed JS sources; inventory and partial record only. |
| LanSchool Air 2.25.0.22463, small scope | `ev_97401480d21cde9fd5fd007084d13d6b4ad055e9a9bf16e6462f9cb16e721ef3` | Manifest and PiP content script; 1,496 text bytes. |
| LanSchool Student 8.0.2.15 | `ev_1263a17b8d5f5d6393f9cbd09111d8af1cfd5942463c5bfd742257e256915660` | Six selected files; 59,133 text bytes. PNaCl omitted. |
| LanSchool WebHelper 9.2.0.2 | `ev_5d6a2d91c254f4130d0bb4278fecb00066f1f26af35601b889609989a0f09417` | Seven selected files; 61,199 text bytes. |

REA's iboss version comparison is `ev_ae66ad6e90a3e92e88d8d5491af580742390fe1fac63998a25a5d32e568c3f43`: 24 changed entities and 155 unknown entities, with partial input coverage. Zero reported added/removed entities is not proof of no additions/removals.

## Changes and remaining work

This group made no production vendor-module changes. Existing uncommitted checker/middleware work was preserved. The direct findings supported the root task's coordinated public runtime aliases and exposed Aristotle and iboss global-name surfaces, addressed in the second pass (root report), and a Blocksi surface that the second pass showed does not apply to Civil's codec.

Remaining requirements include additional complete packages and dated intermediate releases for the uncovered entries, complete reconstruction of unselected/background/native code, a real managed-Chrome run with policy controls, and live network/gateway validation where specifically authorized. A request-host middleware cannot intercept a separately installed extension's direct gateway traffic; tests of that middleware alone cannot prove school-filter evasion.
