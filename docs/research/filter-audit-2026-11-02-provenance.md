# Cache provenance, successor channels, and Lightspeed reporting

Audit date: 2 November 2026. This follow-up strengthens the evidence behind
the 28-ID catalog inventory and extends the two-version Lightspeed native
replay. The catalog inventory remains at 54 distinct manifest versions.

## Retained cache authentication

`cached-integrity.cjs` checked the retained cache for every catalog ID using
the pinned Chromium Web Store key and the existing signed file-root verifier.
The receipt `cached-integrity.json` records exact signed IDs and versions,
metadata hashes, individual file hashes, and the negative controls.

**21 of 28** caches have valid Web Store metadata. All **3,297 signed file
entries** match, with zero missing or mismatched entries. The seven caches
without signed metadata are Aristotle Educator and Student, GoGuardian,
Hāpara Highlights, Lightspeed Filter Agent, Securly, and Securly Classroom.
The cache check authenticates listed bytes only. Current CRX publisher
verification and historical package provenance are recorded separately.

The authenticated caches include all five catalog IDs whose current-channel
probes returned no package. They also authenticate the ContentKeeper 2.1.4
native artifacts used in the earlier research. A separately acquired
[ContentKeeper mirror](https://github.com/nevr13/Content-Keeper-Extension/tree/672b97025c4c06fce37e5fee8d03b442f9a3706c)
has 15 matching files, including all six native binaries, and two altered
files, its manifest and icon. Its 2021 commit establishes prior presence of
those bytes. The [Web Store listing](https://chromewebstore.google.com/detail/ckauthenticator/jdogphakondfdmcanpapfahkdomaicfa)
shows a May 2024 update date for the same version.

## Historical and successor evidence

| Artifact or lead | Date and evidence |
|---|---|
| Mobile Guardian 2.2.68 | Exact catalog ID, 443 signed files match. Web Store lists 23 August 2024, consistent with vendor deployment notes. [Web Store](https://chromewebstore.google.com/detail/mobile-guardian/nglbmaiijljohnphofifiodoommladkj) |
| Impero Backdrop MV3 4.0.286 | Exact catalog ID, 199 signed files match. Web Store lists 1 December 2025. [Web Store](https://chromewebstore.google.com/detail/impero-backdrop-mv3/jjpmjccpemllnmgiaojaocgnakpmfgjg) |
| LanSchool Air 2.25.0.20424 | Cached version, 25 signed files match. Vendor release notes list 21 July 2025. [Release notes](https://helpdesk.lanschoolair.com/portal/en/kb/articles/lanschool-air-release-notes) |
| NetSupport 15.0.2.0 | Distributor dates release to 2 July 2025. Package bytes remain missing. [Release notice](https://netsupportsoftware.nl/netsupport-school-chrome-student-versie-15-0-2-0-released/) |
| LanSchool Student 8.0.2.15 | 192 signed files match. Exact-ID Web Store listing dates update to 17 February 2021. [Web Store](https://chromewebstore.google.com/detail/lanschool-student/ifeifkfohlobcbhmlfkenopaimbmnahb) |

Cisco announcement leads identify 2.1.0 in May 2024, 2.1.1 in August 2024,
and 2.2.0 in January 2025. Those package bytes remain missing. The exact
2.2.1 CRX was reacquired with the same digest and valid publisher proof.
The public archive downloads returned HTTP 403. The Aristotle mirror had a
different manifest key ID and lacked signed metadata for the catalog ID.
Both targeted Wayback queries timed out.

Mobile Guardian's vendor migration guide requires a dashboard-supplied
custom ID and update URL. The catalog's 2.2.68 bytes remain authenticated.
Attribution of the vendor's later 3.x packages to that ID is unresolved.
[Vendor migration guide](https://help.mobileguardian.com/hc/en-us/articles/20568960866844-How-to-add-Mobile-Guardian-Custom-Extension)

Gopher Buddy's vendor guide explicitly replaces the catalog ID
`cgbbbjmgdpnifijconhamggjehlamcif` with
`becdplfalooflanipjoblcmpaekkbbhe`. The official Google update channel
supplied successor **1.0.0.15**, 11,550,203 bytes, SHA-256
`453cd6826271de9cbd17d77f54ce70376a97addcd3cf588a33743722401388ff`.
Its CRX3 publisher proof, 54 signed file roots, and 55 extracted inventory
files verify. Delivery lists 14 April 2025 as the artifact modification
date. The successor is tracked separately from the catalog version count.
[Vendor migration guide](https://amplifiedlabs.zendesk.com/hc/en-us/articles/30240623026323-Updating-to-the-Manifest-v3-Version-of-Gopher-Buddy)

The successor manifest declares a module worker and two Google/vendor host
permissions. It declares no content scripts, web request hooks, or declarative
network rules. Its recovered `user-activity.service.ts` uses Chrome idle
events and emits device, account, network, and timestamp session records.
The selected ping payload contains no page URL. The message handler opens
help or device information pages and exposes a user-triggered cache clear
through `chrome.browsingData.removeCache({})`. This evidence supports the
inventory and support role of the selected worker paths. Popup and dependency
coverage remains partial. The extension was inspected statically.

## Lightspeed native reporting and validation

The actual current and cached Filter Agent binaries ran with their
corresponding manifest and worker bytes, synthetic configuration and serial,
and mocked Chrome and network functions. Both requested their local manifest
and worker during initialization. The current binary's preflight wrapper is
WAT function **3189**, lines 1691224–1691714. Its fourth check calls
**3186**, lines 1689925–1690655. The body reads
`chrome.identity.getProfileUserInfo`, invokes `toString()`, and compares
the result with the expected 47-byte native function representation.
The ordinary JavaScript stub fails that comparison. This is a check on the
extension's host API environment.

Fresh boot scenarios confirm that `ConfigureClass` installs `Creds` and
`Sign`. The current runtime exits when this is attempted before Setup.
An exploratory no-argument `GetIdent()` also exits before Setup. Its
supported calling contract remains unresolved. A synthetic
`SetSerialNumber` call returns null without an exit.

After synthetic Setup, **five signing cases per version** match. A report
with string data and a story-mode payload produce JWTs advertising HS256,
with `customer_id`, hex `data`, `iat`, `nbf`, and `exp` claims.
In these cases expiration is five days after issue. An array in report
`data` and malformed report JSON return null. An unknown signing kind
returns an empty string. The synthetic SDK token does not reproduce the
JWT MAC. The signing key and data encoding internals remain unresolved.

With empty cached credentials, `Creds()` issues a mock GET to the supplied
third Setup URL with a Bearer authorization header and device serial. The
fixture returned HTTP 503. Real credential acquisition and report acceptance
remain unverified. The mock environment issued no external requests.

## Reproduction and remaining scope

The ignored `extensions/filter-audit-2026-11-01/` tree holds
`cached-integrity.json`, the `history-cisco/`, `history-classroom-extra/`,
and `history-native-extra/` receipts, and the native current and cached
`setup-replay.json` and `signing-replay.json` results. The current native
static bodies are in `history-native-extra/filter-reference-map/`.

## Probe verdict follow-up

The InterCLASS replay established that vendor operational errors need an
inconclusive verdict. The same detector previously returned a bare
`flagged: false` for a failed fetch, a Civil 5xx, or a vendor without probe
data. Callers could interpret those results as clean. The detector now
includes an inconclusive reason for each case. The live harness shares the
detector's infrastructure failure check for retries and rechecks. Existing
regressions assert the reason as well as the absence of a flag.

Lightspeed's checker can also abstain when it receives no verified category.
The domain classifier previously discarded affirmative ratings after
collecting blocks, leaving the tunnel picker unable to distinguish an
all-unknown candidate from one with a confirmed allow. The classifier now
retains the vendors that returned allow. Within each batch, the picker
chooses among unblocked candidates with an affirmative rating when
available. It keeps the existing fallback when every surviving candidate
has only abstentions. The focused reputation and picker suite passed all
19 tests.

Additional dated packages, important-file coverage, and managed policy
verification remain open.

## Blocksi rating response replay

The shipped `getRating.json` function from cached 4.9.1 and current 4.9.16
was extracted from `background.js` and run with local mock fetch and timer
functions. Both versions accepted top-level numeric `Category` 0 on the
first request and retried missing or string values before accepting 206.
Boolean, lowercase, and nested fields exhausted the three attempts and
returned the vendor's `-1` sentinel. The six observations, source hashes,
and exact source ranges are in the ignored `blocksi/rating-replay.json`.

Civil's Blocksi checker now retries malformed rating bodies and reads the
vendor's top-level integer field without coercion. A missing or negative
category produces `unknown`. Civil retains its configured retry count
and existing backoff. The replay exercises the rating function with mock
responses. District policy and live ratings remain unverified.

## Linewize numeric verdict and fallback replay

Both Connect 4.0.3 and 4.0.6 define numeric verdicts 0 for block and 1 for
allow. The adjacent fallback method was replayed from both workers with a
mock local block-page URL. It marks either outcome with the signature
`Fallback` and supplies a redirect only for a block. The worker hashes,
source offsets, and four observations are in the ignored
`linewizeConnect/verdict-replay.json`.

Civil now treats unsupported numeric values as unknown. It preserves
explicit fallback blocks and treats fallback allows as unknown. The checker
still accepts its existing textual verdicts and the legacy `method` marker.
The worker replay establishes local fallback construction. It does not
establish which shapes a live verdict server returns.

## Cisco DNS block-page evidence

The signed Umbrella Extension 1.3.4 handler was replayed with mock local
resolver replies. It redirected for the category, malware, phishing, and
security addresses ending in .106, .107, .108, and .110. It did not redirect
for 146.112.255.155. The source hash, offsets, and five observations are in
the ignored `history-cisco/blockpage-replay.json`.

Civil's A-record DoH checker now uses the six IPv4 block-page addresses in
Cisco's current support table. The older extension also recognized several
legacy addresses absent from that table. Civil previously treated
146.112.255.155 and generic CNAME fragments such as `proxy` as blocks.
The checker now requires an exact configured block-page address for a
DNS-only block. Local tests cover the six addresses, the infrastructure
address, and an ordinary proxy-like CNAME. Authenticated policy remains a
separate verdict source. [Cisco block-page address reference](https://www.cisco.com/c/en/us/support/docs/security/umbrella/224799-learn-the-umbrella-block-page-ip.html)

The authenticated policy hook receives a full URL. Its previous hostname
cache could return an allow for a second path before calling the hook.
A synthetic policy reproduced that failure with two URLs on one host.
Civil now keys those verdicts by organization, device, and full URL.
DNS-only checks still cache by hostname. The regression also verifies
that repeating the original URL reuses its own verdict.

## Securly pauses in domain reputation

The 3.0.46 and 3.0.76 workers dispatch a broker `PAUSE` decision to their
tab pause action. Civil already presents that decision as a warning, but
its domain classifier counted the warning as an affirmative rating.
A mocked broker response reproduced the false allow with an education
category. The classifier now requires an explicit allowed status for an
affirmative rating. Existing category blocks and explicit policy blocks
keep precedence. This keeps the temporary student decision separate
from a domain-wide rating.

## Dated classroom extension evidence

The exact-ID classroom.cloud archive index places the authenticated
3.00.7.0 mirror in September 2025. It lists 24 September, while 185 entries
in the pinned ZIP carry unsigned file timestamps of 22 September. These
sources corroborate the timeframe. The official notes omit this version,
so its publication date remains unverified. [Archive index](https://chrome-stats.com/d/mpkdoimpgkhjcicmhmlmgboelebflpla/download) · [Pinned mirror](https://github.com/S-PScripts/cc-source/blob/31ce7fcb09e76c991b633ab39f82c871abe8706e/mpkdoimpgkhjcicmhmlmgboelebflpla.zip) · [Official release notes](https://classroom.cloud/new-features-2025/)

LanSchool Air's July 2025 build 2.25.0.20424 and current build
2.25.0.22463 have byte-identical `onBeforeRequest` and
`isURLInBlockedList` methods. The extracted methods matched all six
synthetic cases in each version. Block-list mode matched the URL query
in both main and subframes, skipped script requests, and left a
nonmatching query alone. Allow-list mode reversed the matched and
unmatched results. Redirects used a synthetic block page. These are
request-policy decisions in the selected methods. Teacher configuration,
native messages, and browser enforcement remain unverified by this replay.
Hashes, source ranges, and results are retained in the ignored
`lanschoolAir/weblimit-replay.json`.

Both LanSchool Air handlers construct their local fallback destination
with `chrome.runtime.getURL`. Civil's sandbox now carries its assigned
extension ID into the observation. The detector checks that ID when
attributing a local block-page filename or interpreting an InterCLASS
message-page mode. The regression distinguishes two extension origins
with the same `blocked.html` filename. Historical observations without
an ID retain filename matching.

The sandbox also retains synchronous background load failures. It still
inspects the rendered page for positive block evidence, since a content
script may supply one independently. A benign-looking page with a failed
worker now yields an inconclusive result and enters the existing recheck
path. A fixture declaring a missing worker proves the distinction. This
check covers startup exceptions, including a missing entry file. It does
not measure readiness after an asynchronous worker startup.

A separate worker fixture schedules an interval and then throws during
startup. The host previously rejected with the original error and left the
interval pending. It now runs the same cleanup on startup failure and
normal disposal, clearing tracked timers and closing any background DOM
window. The regression measures the timer count and checks that the
original startup error remains visible.

## Lightspeed Helper image inference

The signed Helper 1.5.1.1793289492 archive contains a Marqo ViT with 12
blocks, width 192, three attention heads, and 16-pixel patches. Its six
shards declare 153 tensors. The 224- and 384-pixel input sizes use
separate position embeddings. A packaged suggestive head reads blocks
5, 8, and 11 and adds a third score alongside the base NSFW and SFW
scores.

The actual signed `marqo-worker.js` ran in a local Node worker emulation.
Fetch served only model and WASM members from the verified CRX. The
worker ran its packaged gradient self-tests and classified uniform gray
RGBA pixels at both supported sizes. An unsupported 256-pixel message
returned a correlated error.

| Backend | Maximum reported self-test error | Gray image NSFW at 224 / 384 |
|---|---:|---:|
| Shipped SIMD WASM | 3.88e-7 | 0.1645 / 0.2098 |
| Shipped scalar WASM | 7.45e-7 | 0.1645 / 0.2098 |

The scalar run forced only the worker's SIMD capability probe to fail.
Both runs executed real inference using the signed weights. The ignored
`core/model-selftest*.json` receipts retain the member hashes and raw
responses. These inputs verify the inference path and error handling.
They provide no estimate of real-image accuracy.

Static decoding traces image classification from `helper-worker.decoded.js`
lines 3011–3050 into the offscreen document and back into the image score
cache and blur policy. Proxy detection starts in
`helper-content.decoded.js` at line 2368 and reports through the helper
worker to the parent Filter Agent. That path consumes page signals
independently of the image model. This evidence leaves Civil's existing
proxy fingerprint fixes and image behavior unchanged.

## Actual Chrome helper installation

Chrome 156.0.8078.74 loaded the unpacked Helper 1.5.1.1793289492 into a
disposable profile. The harness first verified the publisher proof and
compared the extracted files against the signed archive. Chromium assigned
its own unpacked extension ID. The fixture served a local parent and
same-origin iframe, with external browser traffic directed to a closed
loopback proxy.

CDP recorded the actual `content.js` in both frames and associated each
script with its isolated execution context. Both contexts could read a
shared DOM attribute and their assigned extension ID. Neither could see a
main-world JavaScript marker. This extends the earlier synthetic realm
test to the installed extension. The fixture does not initialize a managed
policy or exercise a vendor classification service.

The ignored `core/helper-installed.cjs` and `core/helper-installed.json`
retain the harness and result. The default command sandbox caused a
Chrome Crashpad startup failure. The successful capture used the local
Chrome executable outside that sandbox. [Chromium extension loading protocol](https://chromedevtools.github.io/devtools-protocol/tot/Extensions/#method-loadUnpacked)

The same installed Helper was then observed on the built Civil browser
at 1366×768 and 390×844. At each size the live isolated contexts mapped
to the browser root and its real `/newTab` iframe. Both captures used
explicit setup-complete state in disposable profiles. Earlier attempts
hit a sandbox loopback boundary or captured transient setup contexts.
The harness now tracks context destruction before evaluating frames.
Receipts are `core/helper-installed-civil-1366.json` and
`core/helper-installed-civil-390.json`. They establish script injection
on the built app. The extension's district policy, report delivery,
and block decisions were outside this capture.

A longer local capture recorded what happens after injection in an
unconfigured profile. Both frames logged detection startup, received
configuration, and skipped scanning with `bypassDetectEnabled=false`
within the ten-second capture window. The short capture had seen only
startup. The decoded content script requests `GET_CONFIG` and branches
on that flag, while the worker waits for configuration readiness before
replying. The receipt establishes an explicit disabled state for this
profile. An enabled scan still requires separate validation.

### DNR policy verdicts

The offline probe reported an HTTP-to-HTTPS scheme upgrade as a policy
block. A synthetic extension reproduces the error through the sandbox.
The matcher now gives scheme upgrades no policy verdict. The probe
also requires a matched rule ID before using a DNR redirect as evidence,
including redirects to InterCLASS error pages.
[Chrome DNR rule actions](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#type-RuleActionType)

A literal scan of 2,493 cached JavaScript and JSON files across 28
manifests found no authored scheme-upgrade rule. LoiLo's declared
static ruleset was empty. The enum references found in Blocksi and
LoiLo used `BLOCK`. This scan cannot resolve rules assembled at runtime
or supplied by policy.

### NetSupport and classroom.cloud policy pages

Replayed the unmodified `js/models/Tab.js` AMD modules from NetSupport
15.0.3.0 and classroom.cloud 3.10.0.0 and 3.00.7.0. Web Store signed
roots matched all 171, 306, and 304 listed files, respectively. Four
cases per build exercised tutor include and exclude policy through
`parseWebFilter` and `filterTabs`. Allowed URLs issued no tab update.
Blocked URLs went to `ApprovedWebList.htm` under approved-sites policy
or `weblock.html` under restricted-sites policy. In 3.00.7.0, the
initial parse issued a redirect with an unset tab ID in this fixture.
The subsequent sweep targeted the correct tab in all three builds.
Chrome messaging and timers were stubbed. The replay sent no network
requests and did not exercise a tutor session.

Both extension IDs now produce a block-page signal when the probe
observes a redirect to their own `ApprovedWebList.htm`. The replay and
receipt are under the ignored `netsupport/replay-policy.*`.

NetSupport's archive index lists 15.0.2.0 on 2 July 2025 and 15.0.1.0
on 16 June 2025. Direct index retrieval returned HTTP 403 and the
versioned source pages were unavailable through the search tool. The
index adds a date lead for 15.0.1.0. Both historical packages remain
unverified. [Archive index](https://chrome-stats.com/d/gcjpefhffmcgplgklffgbebganmhffje/download) · [Distributor release notice](https://netsupportsoftware.nl/netsupport-school-chrome-student-versie-15-0-2-0-released/)

### Hāpara Focus links

Offline replay of the signed Highlights 6.10.2 worker's ordinary-link
comparator exposed three differences in the server checker. It treated
HTTP and HTTPS as distinct, folded path case, and admitted child paths
under an exact entry. The checker now ignores the HTTP(S) scheme and
one terminal slash, then compares the rest exactly. Five offline cases
match the vendor comparator. The ignored
`history-native-extra/hapara-focus/` contains the replay.

The Google alias pass replayed 15 cases against the 6.10.2 worker
and both background bundles from the authenticated 5.0.62 CRX.
All three comparators agreed. The server checker now recognizes
matching Google Docs, Drive, Forms, and Classroom IDs, HTTPS Google
Accounts paths, and query variants of the same Google subdomain URL.
Seven cases reproduced false blocks before the fix. The checker parses
hostnames before comparing aliases, so lookalike domains and paths do
not inherit an allow. It also avoids the worker's fallback that can
collapse distinct public Forms links under `/u/1/` to the literal
segment `e`. This pass covers Focus links returned by the session API.
Live redirect state and the separate Forms navigation fallback remain
unverified.

### Versioned sandbox startup

Passing an unpacked version directory previously selected fixture
policy by its basename and gave the worker a random extension ID.
`observeRoute` now accepts the catalog folder and ID separately from
the unpacked directory. A regression fixture registers a rule only
when its managed policy and runtime ID both arrive.

Replayed signed Securly 3.0.0, 3.0.46, 3.0.65, and 3.0.76 with a
stubbed Civil page and offline extension networking. All four configured
runs used the catalog ID and invoked the existing fixture network
handler. The oldest build made two fixture requests and each other
build made four. With neither catalog input, the three newer workers
made zero fixture requests and the oldest failed while reading its
skip list. The configured runs returned an observation for the stubbed
page. This establishes fixture startup, with managed browser policy
and live classification still unverified. The ignored
`securly/versioned-probe*` files retain the harness and receipts.

### Securly cluster availability

The signed 3.0.76 worker's cluster availability predicate rejects
`UNKNOWN_SCHOOL`, `AVOID_OS`, and lowercase `unknown` before requesting
a broker decision. Civil previously substituted a regional cluster.
Offline replay showed that a synthetic deny from that fallback became
a block verdict. The checker now returns an unknown result for each
explicit unavailable status after the cluster lookup alone. Replay
receipts are under the ignored
`history-native-extra/securly-cluster/`. The inputs are synthetic
cluster responses. The live Go broker feature flag remains unverified.

The authenticated 3.0.0 and 3.0.46 workers use the legacy `/broker`
endpoint. In 3.0.65 and 3.0.76, a truthy `goBrokerEnabled` and
`goBrokerFQDN` pair selects `GET /broker/extension`. The worker first
checks the user configuration pair and then its global pair. The Go
response wraps the colon-delimited verdict in JSON `message`. Both
branches were replayed offline. Civil still models the legacy branch.
The ignored `history-native-extra/securly-cluster/go-broker.*` files
retain the inputs, source offsets, and results.

### Catalog startup matrix

Ran all 54 physically available manifest versions across the 28
catalog IDs in separate Bun processes with the catalog folder and ID
set explicitly. Each worker observed a stubbed `/newTab` with a
200 ms settle window and offline extension networking. All 54
returned the served page. Six initially appeared clean because the
sandbox swallowed matching content script failures. It now keeps the
first load or execution error and continues the remaining scripts.
When the detector finds no block signal, it reports that error as
inconclusive.

Three GoGuardian versions (4.0.7386.1, 4.0.7393.1, 4.0.7422.1)
failed in `admin.js` at a storage promise call. IMTLazarus 26.4 and
26.10 hit a duplicate `ES` binding in `i18n.js`. LoiLo 1.16.13
needed `MessageChannel`. These are failures in the sandbox and do
not establish that installed Chrome extensions fail. The other 48
observations had no surfaced startup error or block signal. The
matrix measures startup on one stub page, with async failures and
live policy behavior outside this check. Its ignored
`catalog-startup.ts` and `catalog-startup.json` retain the evidence.

On replay, both IMTLazarus manifests registered `i18n.js` under
three entries matching the same URL and default injection phase.
Chromium deduplicates script paths within the frame, extension, and
injection phase. The sandbox now skips duplicates within a phase
while preserving manifest order. LoiLo 1.16.13 used `MessageChannel`
to schedule work in its content script. The sandbox now supplies a
channel and closes both ports when the observation ends. After both
fixes, the 54-version matrix had 51 observations without a surfaced
startup error. Three historical GoGuardian builds still reported a
storage promise failure. [Chromium user-script injector](https://chromium.googlesource.com/chromium/src/+/refs/tags/132.0.6834.213/extensions/renderer/user_script_injector.cc)

An instrumented copy of GoGuardian 4.0.7393.1 showed that the content
script's Bluebird wrapper created a working storage promise alias.
The page shim answered `chrome.__esModule` with a truthy stub, so
Webpack accessed the stub at `chrome.default` and lost the real storage
namespace. The page and background shims now share the introspection
guard. The three historical GoGuardian builds passed their short
startup replay after this fix. All 54 versions then returned the
stub page without a surfaced startup error. The ignored
`history-native-extra/goguardian-admin/` holds the trace.

### Navigation listener replay

The signed iboss 1.0.200 `WebProxyDetectionService.js` registers two
`webNavigation.onBeforeNavigate` listeners. The host previously
discarded both registrations. A replay of the exact service with
synthetic settings showed that a top-frame request to a listed host or
its subdomain called `tabs.remove(17)`. Four controls caused no tab
removal. Destination checks were disabled and the harness made no
network calls. The ignored
`history-classroom-extra/iboss-nav-replay/` holds the evidence.

The probe now dispatches an unfiltered top-frame `onBeforeNavigate`
event before running the content scripts. A fixture verifies that a
listener's tab update to a vendor policy page reaches the detector.
The event does not intercept the page fetch. URL-filtered event
subscriptions and child-frame navigation remain outside this
implementation.
[Chrome webNavigation reference](https://developer.chrome.com/docs/extensions/reference/api/webNavigation#event-onBeforeNavigate)

A follow-up ran the byte-identical iboss service through Civil's host.
With synthetic settings and the startup scan settled, the listed host
and subdomain each removed the observed tab. A lookalike did not. No
network attempts or listener errors were observed in these three cases.
The probe now records removal of its synthetic tab and reports an
inconclusive verdict when independent policy evidence is absent. The
live runner retains that result if a longer recheck reads clean.
The fixture does not establish deployed tenant settings or why another
extension might close a tab. The same ignored replay directory holds
`civil-host-replay.ts` and its receipt.

Securly 3.0.0, 3.0.46, 3.0.65, and 3.0.76 gate navigation checks on
`frameType === "outermost_frame"`. The synthetic event now includes
this field alongside frame ID zero. An exact callback replay from
3.0.76 confirmed that an outermost-frame binary data URL closed the
tab. The missing-frame-type, subframe, PDF, HTML, plain JSON, and HTTPS
controls caused no removal. The ignored
`history-classroom-extra/securly-nav-replay/` holds the seven cases.
The harness stubbed broker and startup dependencies. The scan also
found historical Securly and Hāpara calls using plural `urls`. Chrome
documents singular `url` for the subscription filter. The replay
did not establish how Chrome handles those plural arguments.
[Chrome webNavigation reference](https://developer.chrome.com/docs/extensions/reference/api/webNavigation#event-onBeforeNavigate)

### GoGuardian keyword evidence

The signed 4.0.7393.1 worker scores legacy proxy keywords after
category and content gates. A hit reaches the trigger handler.
Redirect enforcement requires an applicable block trigger and enabled
filtering. Civil's server checker only has the keyword models. It now
returns an unknown policy verdict and still returns matched keywords
and category evidence. The probe retains its explicit keyword signal.

Offline replay exposed differences between the worker's case-sensitive
content substring check and Civil's scoring across several inputs.
The checker still uses its existing heuristic. Its hit list is not an
exact worker verdict. The signed 4.1.246 worker uses a separate cloud
prediction path. The ignored
`history-native-extra/goguardian-policy/` holds the offline comparisons.

### Redirects before extension execution

The probe fetches its test page outside the extension host. Previously
it followed HTTP redirects and ran the extension over the resulting
markup at the original URL. This could attribute a network or app
redirect to the extension. The probe now records the redirect as
inconclusive and resolves relative destinations against the public
request URL. It leaves the destination unfetched. In a loopback Bun
replay, a 302 from `/newTab` to `/setup` recorded the resolved
destination and made zero requests to `/setup`. Tests also cover
an absolute URL on a vendor block-page host.

Cisco dates Umbrella Extension 1.3.2 and App 1.3.4 to March 2020.
Its migration notice documents manual replacement by Cisco Security
for Chromebook and legacy support through June 2025. These are
historical leads. The exact-ID search recovered no additional package.
[Cisco release notes](https://community.cisco.com/t5/umbrella-software-release-notes/umbrella-chromebook-client-ext-v1-3-2-app-v1-3-4-release-notes/ta-p/5191838) · [Cisco migration notice](https://community.cisco.com/t5/umbrella-announcements/updated-prepare-for-upcoming-changes-umbrella-chromebook-client/ta-p/5191510)

### Route coverage

The sweep now lists all 12 application routes, including Settings,
Setup, Connection Error, and Ban. Replaying Securly 3.0.65 and 3.0.76
against the existing build's SSR handler returned 24 HTTP 200 responses
with no surfaced error or block signal during the 100 ms offline
settle window. The ignored `securly/ssr-route-replay.json` records
status, original text length, and verdict for each cell. The HTML came
from SSR, so this does not cover hydration or tenant policy.

Direct HTTP requests to the encoded proxy path returned the SSR shell
with HTTP 200 and no upstream document. The sandbox now uses the same
XOR URL codec as the browser when a caller provides a proxy document
fixture. The HTTP-only live runner records proxy document cells as
incomplete unless it already has a vendor domain-block verdict.
Automated service-worker capture remains open.

Separate replay of the signed GoGuardian 4.0.7386.1 and 4.0.7393.1
URL matchers produced the same outcomes on eight synthetic rule cases
per build. The matcher includes the fragment in its case-insensitive
URL regex, requires configured query names to be present, counts
empty values, and applies hostname exclusions by substring. These
cases verify matching, with enforcement outside the replay.
The ignored `history-native-extra/goguardian-policy/url-matcher.*`
files hold the source offsets and results.

### Rewritten proxy document replay

Chrome 156.0.8078.74 captured an actual Bare-transport example.com
document through the built Civil service worker on loopback. CDP
reported HTTP 200, `text/html`, and `fromServiceWorker: true`.
The captured URL had two frame-specific path segments before the
XOR-encoded target. The 12,829-byte UTF-8 body exported from CDP
had SHA-256
`93415928b402368361755dcdccde18261b45bfa00a331a82939b8e0c167ee63f`.
The ignored `core/proxy-frame-response.html` and companion JSON
retain the body and receipt.

The offline matrix verified the receipt's body hash and replayed the
captured URL and HTML together through all 54 available versions across
28 catalog IDs. Every replay preserved the upstream page marker, with
no surfaced block signal or startup error in the 200 ms window.
The replay did not execute Civil's page scripts, load the extensions
in Chrome, or use district policy. The capture and replay are local
research tools. The HTTP tunnel runner still requires a browser
capture integration for its live proxy cell. The ignored
`catalog-proxy-replay.json` records the per-version results.

### Content message sender

Signed Linewize Connect 4.0.6 sends an `internet_back_online` message
from the page. The background uses `sender.tab.id` and `sender.tab.url`
to recheck the tab. Replaying the exact callbacks invoked the recheck
with the fixture tab ID and URL. Three controls with missing metadata
skipped it. The replay stubbed the recheck handler, so its result does
not establish a policy verdict. The ignored
`history-native-extra/linewize-sender/` holds the evidence.

The probe now supplies the observed page URL, origin, top-frame ID,
and synthetic tab when it forwards a content message. Direct host
messages keep their original background sender. A regression fixture
verifies the page-to-worker reply through the sandbox. The probe
does not simulate a connectivity change or model child-frame senders.

### Promise-backed policy messages

The GoGuardian `GET_SHOULD_RUN` listener in signed 4.0.7386.1 and
4.0.7393.1 and cached 4.0.7422.1 returns a Promise that resolves to
`undefined`. It delivers the verdict through `sendResponse` after an
async policy lookup. Without a sender tab it skips the lookup. With
the fixture tab it echoes the analyzed URL and reports `shouldRun`
according to the stubbed whitelist. The listener marker was absent
from the signed 4.1.246 JavaScript.

Civil's offline host now collects both returned Promise values and
callbacks issued before the Promise settles. The exact historical
listener replay delivered the callback in all three builds. The
lookup was stubbed. Browser-version behavior and deployed policy
remain unverified. The ignored
`history-native-extra/goguardian-admin/should-run.*` holds the replay.
[Chrome messaging reference](https://developer.chrome.com/docs/extensions/develop/concepts/messaging#responses)

### Restriction verdict cache

The service worker previously cached the parsed `banned` field before
checking the HTTP status or its type. A synthetic 503 carrying
`{"banned":true}` and a successful response carrying the string
`"false"` both blocked the requested page and were cached. The worker
now caches only boolean verdicts from successful responses. Five
isolated replays of the worker function cover both failures, null,
and the valid true and false responses. Invalid responses left the
next request free to recover a valid result. The ignored
`check-banned-replay.ts` and before/after receipts hold the cases.

### Client detection resources

The client probe now includes the exact registry ID for signed iboss
1.0.200 and its public `restricted.html`. It also tries current
resources from signed GoGuardian 4.1.246
(`icons/enabled-light-128.png`), IMTLazarus 26.10
(`css/blocked_overlay.css`), and Securly Classroom 2.0.5
(`disconnected.html`). Each path is present in its package and covered
by a static web-accessible resource declaration. Legacy candidates
remain available. Tests exercise the actual detection function with
simulated resource responses. Chrome 156.0.8078.74 then detected all
four candidates with the production `getFilters` function. A fresh
profile detected none before installation. The installed fixtures
used the verified IDs, exact resource bytes, and resource declarations
with vendor code removed and non-loopback traffic blocked. The
ignored `core/war-browser-replay.*` files record the browser result.
This verifies resource access and detection, with vendor runtime
behavior outside the fixture. [Chrome web-accessible resources](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources)

### Content script injection order

Sixteen available manifests listed a document-start or document-end
entry after an idle entry. Both Aristotle Student versions used this
layout. The sandbox now executes start, end, and idle phases in order
and preserves manifest order and deduplication within each phase. A
fixture lists its start script last and makes the idle script depend
on it. The 54-version startup matrix returned the stub page without
a surfaced error or block signal after the change. Phase ordering is
modeled on a parsed stub page. DOM construction and resource timing
remain outside the replay.
[Chrome content script timing](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#run_time)

The optional Aristotle Student bundle test repeatedly hit its 30-second
deadline. Instrumentation located the stall after the background and
both content scripts completed. The probe was waiting for Happy DOM's
`abort()` on a detached page that could still enqueue work. The probe
now uses `happyDOM.close()` to close that page and disposes the extension
host in `finally`. The full probe file passed after the change.

The exact LanSchool Student ID also appears as 8.0.2.13 in a pinned
2020 manifest dataset. Faronics documents the ID under Insight
Student. This records an additional version lead, with no package
bytes recovered for that release.
[Pinned manifest](https://github.com/mandatoryprogrammer/chrome-extension-manifests-dataset/blob/ed1ec4fab3ea4e9b2618ef559f6d6ad73b1dd0d9/manifests/ifeifkfohlobcbhmlfkenopaimbmnahb.json) · [Faronics manual](https://www.faronics.com/assets/INS_Manual_J.pdf)
