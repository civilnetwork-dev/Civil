# Probe attribution and manifest scope

Audit date: 3 November 2026. The live Filter-Sources manifest contains
the same 28 extension IDs, folder names, and update URLs as the retained
1 November catalog. Blocksi and IMTLazarus are now listed at 4.9.16
and 26.10 respectively, matching the previously acquired CRXs.
The raw response is retained as
`extensions/filter-sources-live.json`, SHA-256
`4996cde58c008819c2164c75b792391031403bf42fd86b3b4f5994cb55a9bb91`.
[Filter-Sources manifest](https://raw.githubusercontent.com/civilnetwork-dev/Filter-Sources/refs/heads/main/extensions.json)

## Content script scope

Signed Securly 3.0.0, 3.0.46, 3.0.65, and 3.0.76 declare broad
`matches` for `content9.min.js` with an `include_globs` constraint of
`https://www.google.*/*`. Civil's sandbox applied the broad matches
alone and ran this script on unrelated probe hosts. The sandbox now
applies both inclusion lists and both exclusion lists before injecting
a declarative content script. A fixture covers the include and exclude
conditions and wildcard behavior.
[Chrome content script URL matching](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#exclude_matches_and_globs)

## Page text attribution

The probe previously reported a policy block when the unmodified HTTP
response already contained a vendor's block marker. The sandbox now uses
the same text extraction before and after content-script execution.
Markers and vendor-name phrases present in the original text no longer
count as extension evidence. The text-collapse check compares lengths
from the same extraction method. An inert extension over a page with
vendor block text stays clean. A content script that adds an image-only
block message still produces a marker verdict.

## FortiGuard rating outage

The signed FortiGuard 2.0.0.0017 `service_worker.js`, SHA-256
`c937c9b02b59ba67f5769715cadff6b87b3b90849fbc9d0dc3a623b375887c06`,
sets the unknown category sentinel to `-1` near offset 100250.
`getBlockPageType` near offset 177628 selects the separate
`blocked_page_FGD_down.htm` template for a block with that category.
The template says that the rating service is inaccessible.

When the extension introduces this message or redirects to the
outage template, the probe records the loss of access as inconclusive
for URL policy. An explicit matching DNR
block still establishes a block. A fixture verifies that the outage
message takes precedence over generic block text and text collapse.

These checks cover the offline sandbox and the cited packaged source.
Managed policy, live vendor outages, and browser injection timing remain
unverified.

## GoGuardian request interception

The vendor archive supplied GoGuardian Shield **4.1.177**, with HTTP
`Last-Modified` of **4 March 2025**. This dates the delivered artifact.
The verified CRX3 publisher proof derives catalog ID
`haldlgldplgnggkjaafhelgiaglafanh`. The manifest reports the exact
version and the extracted inventory contains 87 files. Archive SHA-256
`510d6cfc81d448fb7a4d55b0ce43ca04cb4164dd6cf9eb2d453f50d5fb1864c5`.
[Vendor archive](https://shield.goguardian.com/release/v4.1.177.crx)

The 4.1.177 worker uses a blocking `webRequest.onBeforeRequest` listener
for Google and YouTube account pages. It checks the managed consumer
account policy before cancelling a matching request. Two separate
all-URL request listeners in the same worker lack the blocking option.
The 4.1.246 worker registers a blocking listener for all URLs of type
`main_frame`, `sub_frame`, and `object`. Its callback forwards the
request to a shared policy dispatcher and returns the dispatcher's
response. A synchronous rule can return a redirect immediately. An
uncached category can take the asynchronous lookup path.

An AST-guided replay executed both exact registration expressions
against a stubbed Chrome event API. It also verified that the current
listener passes the original request, store, and rule array to its
dispatcher and returns a synthetic redirect. The policy dispatcher was
stubbed. The sandbox currently stubs `webRequest`, so this path remains
outside its vendor coverage. The separate GoGuardian keyword probe
does not establish a managed request verdict either.

A full 4.1.177 startup attempt against the stub page logged
`ReferenceError: OffscreenCanvas is not defined` from the worker,
even though the probe returned an unflagged result without a surfaced
worker error. Treat that observation as incomplete. The bounded
registration replay above supplies independent evidence.

Retained inventory and replay are under the ignored
`extensions/filter-audit-2026-11-03/` tree. Run
`node extensions/filter-audit-2026-11-03/goguardian-request-replay.cjs`
to reproduce the registration checks. REA's full-worker analysis reached
its provider deadline on both versions. Its bounded analysis parsed both
extracted registrations and retained partial static evidence
`ev_b13d8c99882153deba5545a72a0da95860c4762fde7a913c44fdbc5f55b1267f`
in `goguardian-rea-evidence.json`.

## Request coverage and worker failures

The offline host now records blocking `onBeforeRequest` registrations.
The probe checks for a matching listener when the synthetic main-frame
request would occur, accounting for the manifest permissions and the
listener's URL, tab, window, and resource-type filters. If the listener
matches and no independent block signal exists, the verdict is
inconclusive. The host does not invoke the listener. Managed MV3
permission and policy dispatch remain outside this model. The live
GoGuardian keyword check still uses its separate path.
[Chromium request matching](https://github.com/chromium/chromium/blob/main/extensions/browser/api/web_request/extension_web_request_event_router.cc#L2859-L2888)

The isolated audit runner now collects unhandled Promise rejections in
each version's own subprocess. The first recheck exposed six asynchronous
errors in 55 versions, including `OffscreenCanvas` in both GoGuardian
4.1.177 and 4.1.246, Hāpara 5.0.62's chunk load failure, and Cisco
Umbrella App 1.3.23's missing extension peer. This corrects the earlier
interpretation of the startup and rewritten-document matrices. An
unflagged row can still have incomplete worker or request coverage.

Both Lightspeed Insight versions initially stopped at the managed
entitlement gate. The page probe now uses the existing synthetic
enrollment fixture shared with the extension-host tests. The 3.11.0
worker proceeds without an unhandled rejection in the settle window.
The 3.8.4 mirror still fails to fetch configuration because its modified
environment file does not point to the shipped service. Earlier
signed-file comparisons excluded that file. The mirror startup therefore
remains inconclusive, while its authenticated code remains available for
selected replays.
[Insight artifact limits](filter-audit-2026-11-01-signed-history.md)

Run `bun extensions/filter-audit-2026-11-03/catalog-recheck.ts` from
the repository root to reproduce the stub-page matrix. Set
`CIVIL_AUDIT_PROXY_CAPTURE` to the retained
`extensions/filter-audit-2026-11-01/core/proxy-frame-response.json`
receipt to verify and replay the captured service-worker document.
The runner preserves the before and after observations in separate
ignored receipts. Both runs use synthetic configuration and no vendor
network.

Before the Hāpara loader change, the stub and captured-document runs each preserved the page marker
in all 55 versions and produced no block signals. Each run marked
**13** cells inconclusive. Five had asynchronous worker errors and
eight had a matching blocking request hook outside the replay. The other
42 cells showed no block signal within the offline observation window.

## Hāpara background chunk loading

The signed 5.0.62 background resolves chunk 140 to the correct
`chrome-extension://<id>/webpack/140.js` URL. The background bundles its
loader in `webpack/background-971c4f4307330b739aed.js` near character
offset 550400. It creates a classic script element, assigns the package
URL, registers load and error handlers, and appends the element to
`document.head`. Before the host change, this sequence produced
`ChunkLoadError: Loading chunk 140 failed.` even though the package
contains the requested file. The chunk's SHA-256 is
`1840dfb2cdac52d5240b9bad1c3e0a79b44163a7c96095aee0a706d28ae394b1`.

The offline host now handles that classic-script append in its existing
background VM. It resolves only files inside the same extension package
and checks their real paths before reading. A regression fixture verifies
execution and the load event for a packaged script, and error events for
a missing file, a remote URL, a foreign extension ID, and encoded path
traversal. The unchanged signed bundle reached the end of a 600 ms
startup observation without the chunk rejection. It also recorded the
`#D73842` badge color set by the student chat code in chunk 8460, which
confirms that initialization proceeded beyond the shared React chunk.
The host now closes its MessageChannel ports during disposal because
the loaded React scheduler kept the replay process alive. The ignored
`hapara-chunk-replay.json` records the badge call and rejection list.
The fix covers the observed background insertion path. Other insertion
methods, module scripts, and browser execution order remain outside the
replay.
[HTML script processing model](https://html.spec.whatwg.org/multipage/scripting.html#script-processing-model)

The updated stub and captured-document matrices each covered 56 versions
across all 28 catalog IDs, including the newly acquired 6.2.7 build.
All 56 page markers remained present and no block signal was observed.
Each run marked 14 cells inconclusive, including four asynchronous worker
errors and ten matching blocking request hooks outside the replay.
Hāpara 5.0.62 moved from a chunk failure to an observed request hook.
[Hāpara package and Focus evidence](filter-audit-2026-11-03-hapara.md)

## Cisco historical update-channel check

Cisco Security 2.2.1 declares a minimum Chrome version of 122.
A query to Google's public update endpoint for the exact catalog ID,
with client version 121.0.6167.184 and CRX3 accepted, returned HTTP
200 and `updatecheck status="noupdate"`. This request did not recover
2.2.0 or another older build. Other client configurations and distribution
channels remain outside the check. The ignored
`extensions/filter-audit-2026-11-03-history/cisco-chrome121.xml`
retains the response.
