# Classroom filter follow-up, 1 November 2026

Status: partial. This continues the [classroom group audit](filter-audit-2026-10-30-classroom.md) through InterCLASS's shipped source map, LoiLo's current content script, and selected Mobile Guardian background paths. It fixes one verified false positive in Civil's offline filter probe. No extension was installed in managed Chrome, and no vendor classification API was contacted.

## Artifact coverage and evidence

The ignored `extensions/filter-audit-2026-11-01/classroom-followup/` directory contains the extraction script, exact recovered InterCLASS source modules, source inventories, and a formatted copy of LoiLo's content script. The already-acquired current packages were reused. Mobile Guardian 2.2.68 still comes from the existing user archive; its latest update channel and release date remain unresolved. No new distinct historical package was obtained in this pass.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| InterCLASS 6.5.2026.1014 `sw.js` | 1,084,813 | `b1e1884a222787541f5fe9c3a9d6c0df95b6bde1c0441f4baf13a06f5f710614` |
| InterCLASS `sw.js.map` | 2,137,313 | `cb7aa6d36958069f71b56ae684127fbb8b324f586f5c697955010feac1f558ec` |
| LoiLo 1.18.0 `dist/client/content_script.js` | 18,370 | `33f2ff09d4cdcf2fecd5c99887ab418c4e2842bbe84c0091d3736a96c612430c` |
| LoiLo 1.18.0 `dist/background/background.js` | 42,534 | `455e040b09cddb0089cd52d5155e3cb4a87f26d93185e2b1029913c344dcb47c` |
| Mobile Guardian 2.2.68 `background_app/filter.js` | 11,267 | `e5421dc7df93959d8ef00bdec6d57a9f96538f318e1af37d65b73f88c184f3fb` |
| Mobile Guardian `background_app/application-block.js` | 5,478 | `e02c4b9c0f8e74c8cd31cb308a3faa99bce27fa67da546c252be78f68de99b03` |

`recover-interclass.cjs` copies the 20 authored `src/` entries from the shipped map's `sourcesContent`, out of 269 total source entries. All 20 selected entries have content. Names retain their `.ts` suffix, but these entries already contain transpiled JavaScript. The extraction does not execute code, fetch dependencies, or re-run the earlier timed-out whole-worker analysis. It records each selected source index, path, length, and SHA-256.

A shipped source map is companion evidence, not automatically proof that every original module remains reachable in the generated worker. Generated-token mappings and package signatures were not revalidated here. The report follows concrete entry-point imports and call paths; an unused module name alone does not establish enforcement. The source map includes `crypto_mgr.ts`, for example, but this pass does not claim its signature verifier gates the active worker's settings path.

## InterCLASS: URL checks, input reports, and error modes

Paths below are relative to `classroom-followup/interclass-sources/`.

`sw.ts` constructs `Main`, `ConnectMgr`, `UrlCheckMgr`, `SafetyInputSettingMgr`, and `SafetyInputCheckMgr`. It registers navigation/tab callbacks and a `webRequest.onBeforeRequest` listener requesting `requestBody` for `<all_urls>`. Its input listener invokes `startSafetyInputEvent`; this is privileged extension observation, outside a page-origin service worker's request pipeline.

`scripts/api.ts` builds three configured endpoints: `url_check/v3`, `get_allow_data/v2`, and `input_data_check/v1`. The URL-check POST includes the trimmed browser-visible URL, profile email, category and alert-category settings, and organization/group identifiers. Local URL-list outcomes can also be included in that POST. Remote category rules were not obtained.

`scripts/url_check_mgr.ts` adds local policy before or around remote decisions:

- Exception lists support substring, prefix, exact, and selected YouTube matching. Another matching mode checks the URL without its query string.
- HTTP(S) URLs of **8192 characters or more** exceed the local length limit. The `toolongurl` page is an operational restriction, not evidence of proxy classification.
- Time windows and accumulated browsing time can independently produce a policy block.
- `scripts/main.ts` can inspect nested `http://` or `https://` substrings after `decodeURIComponent` when local `isAnalyseInnerUrl` policy enables it. No claim is made about whether that option is active in a district.
- Valid cloud outcomes carry `check_result` and `Category`. HTTP 4xx becomes `CLIENT_ERROR`; 5xx becomes `SERVER_ERROR`; an otherwise unusable result becomes `RETRY`. Those failures are distinct from a category block.

`scripts/safety_input_setting_mgr.ts` loads enabled, remotely supplied word definitions. Matching supports substring, prefix, and exact equality; GET/POST inspection has separate configuration switches and an ignored-domain list. Default input settings contain an empty word list with both method switches off. This does not reveal a district's loaded policy.

`scripts/safety_input_check_mgr.ts` checks GET URLs and POST form/raw bodies, including nested JSON values when locating a matched field. A white-listed definition returns without reporting. For a new detected word, it attempts to trim the matched value around that word to 100 characters, obtains the active tab URL, and passes a report to `ConnectMgr.postDetectedWord`. The API body includes the definition name, detected key/value, URL, timestamp, email, and organization/group IDs. Reporting requires a populated server-side user email and has bounded retries. A definition with `is_block` also triggers the extension's own main-frame blocking path; repeated-word report caching does not remove that separate block decision.

### Civil fix: errors no longer count as proxy flags

The same packaged `pages/message-page.html` serves policy blocks **and errors**. The recovered `scripts/main.ts` constructs these modes:

| Meaning | Mode |
|---|---|
| Category/list or identity policy block | `blocked` |
| Time-window restriction | `outoftime` |
| Safety-input restriction | `safetyinput` |
| Accumulated-time restriction | `cumulativelimit` |
| Retry/network/configuration/request error | `errorpage`, `clienterror`, `servererror`, `paramerror`, `cantinitialize`, `toolongurl`, `brouseruserinfoerror` |

Civil previously matched `message-page.html` by pathname alone. An operational error therefore became `flagged: true`. Ignoring only the block-page match was insufficient: generic block-marker or page-shrinkage fallbacks could still produce the same false positive.

`misc/filterProbe/detect.ts` now checks InterCLASS's mode before that signal cascade. Known policy modes remain blocks. Error, missing, and unknown modes return an explicit inconclusive reason. The same guard handles a DNR redirect to that error page; an actual matched DNR hard-block rule remains direct evidence of a block.

`misc/filterProbe/harness.ts` rechecks an inconclusive read. If the recheck stays inconclusive, or an inconclusive first read only gets a failed network recheck, it enters the existing error-result path. It cannot be printed or counted as a clean `ok`. A conclusive later observation can resolve the uncertainty.

Ten new cases reproduced the prior false positives before the fix. Sixteen focused InterCLASS regressions pass after the fix, including real policy modes, error/unknown modes, DNR redirects, the marker/shrinkage cascade, and the requirement for a matched DNR rule. This changes probe attribution, not district enforcement or InterCLASS's package.

## LoiLo: privileged decisions and client health recovery

The earlier report traced LoiLo's cloud `can_view` request. The current client bundle now has a smaller inspected surface than the old automated timeout suggested: most of its 18 KB is date/time support; its final section implements runtime messaging, toasts, iframe handling, and background health recovery.

The manifest injects the client at document start into all HTTP(S) frames except a configured exclusion list. In the inspected client tail, `can_view` and `default_can_view` messages carry the current frame's `window.location` string. A `get_status` request retrieves categories for the toast. Restricted-allow and night-filter warnings render through the extension's own DOM element. A `replace_deny_url_in_iframe` message from the extension's own runtime ID navigates that frame to the packaged deny image.

On DOMContentLoaded, the client checks background health while the document is visible. Each health attempt has a 15-second timeout, up to three attempts, with 5-second gaps. If no attempt confirms health, it reloads the document while a session-storage `reload_count` remains below 10. Background connectivity can therefore cause a reload without proving a proxy classification. These are static control-flow observations; no wall-clock or managed-device replay was run.

The formatted copy is a reading aid only. Original artifact bytes remain unchanged and retain the hash above. No general page-text classifier is established by the inspected client path; the cloud decision and the remainder of the background's policies remain separate requirements.

## Mobile Guardian: policy versus transport failure

The inspected `background_app/filter.js` confirms a remote URL verdict followed by local cache and tab control. `CheckAllowed` sends the complete URI, device signature, and student ID to the configured API's `urlIsAllowed` action. A parsed response with `status == 2` is denied; other parsed status values use the allow branch. The API may supply its own redirect URL; otherwise a denial selects the packaged `block.html` with the URL and categories encoded in its query. Cached outcomes last 10 seconds.

This is conditional on device/profile state and additional screen-block rules. The ordinary non-YouTube request handler ignores POST and non-main-frame requests, while separate tab-created/tab-updated paths also call `CheckAllowed`. It would be inaccurate to infer that all browser traffic shares one blanket URL check.

The fetch failure branch catches the exception but leaves `res` unset, then accesses `res.status`. That source path can throw instead of establishing a cloud verdict. This is a vendor-code failure mode, not evidence that a submitted hostname has a blocked category. The extension also has separate application-block and screen-capture surfaces: application policy can disable managed apps or close their launch tabs, and the selected capture module calls privileged `captureVisibleTab`. No complete capture-policy or cloud-runtime reconstruction is claimed.

No Mobile Guardian product workaround follows from these static paths. Civil's request-host middleware does not control a separately installed extension's background fetch, management API, or capture API.

## Remaining work

The source-map recovery substantially improves the previously timed-out InterCLASS worker coverage, but dynamic policy transitions, all downloaded data, and every dependency branch remain unverified. Complete LoiLo background policy execution, Mobile Guardian's current package channel and cloud/capture runtime, dated historical packages, and managed Chrome enforcement runs remain open. Existing Impero and IMTLazarus replays were reused by the root audit and were not duplicated here.
