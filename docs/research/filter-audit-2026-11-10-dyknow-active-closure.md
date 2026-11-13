# Dyknow active-source closure, 10 November 2026

This continues the [new-vendor study](filter-audit-2026-11-09-new-vendors.md)
and [diagnostic follow-up](filter-audit-2026-11-09-diagnostics.md). It maps the
authenticated Dyknow **7.11.38** package's selected execution sources and adds
local protocol replays. It establishes a concrete unresolved authentication-page
dependency and a malformed satellite-response failure. It does not establish
successful tenant authentication, installed Chrome enforcement or a public
anonymous policy endpoint.

All new evidence is under ignored
`extensions/filter-audit-2026-11-10/dyknow-active-closure/`. Production code and
the earlier acquisition were not modified. No vendor service, tenant, account,
real diagnostic upload or live monitoring endpoint was invoked.

## Package identity and dependency inventory

Input: `extensions/filter-audit-2026-11-09/dyknowCloud/unpacked`, exact ID
`ehldjdeaoebgafllfobddbfbfpmammmc`, package SHA-256
`76bd2aacc45650747f2caaf6f9754f9ed03401a0f553addbf85d1430e9c7ecfe`.
`inventory.cjs` matches all **310** extracted files against the earlier
publisher-authenticated acquisition's per-file hashes. This pass checks those
source identities; it does not describe a fresh CRX acquisition or signature
verification. The source tree's REA inventory digest is
`9e5e054059d6d080c8e65db513129c15e5a21ae99f8c0c69d062b43354aa73d9`.

The inventory parses all **224 JavaScript files and one inline HTML script**
as inert Babel ASTs with zero parse failures. It follows literal ESM imports and
re-exports, HTML script/data-main references and selected AMD dependency arrays.
Every packaged file and inline block has an exact source hash. `inventory.json`
retains roots, edges, source ranges, missing resolutions, named `define()`
modules, loader configuration and the entire file inventory.

| Source selection | Static closure | Interpretation |
|---|---:|---|
| Manifest module worker `worker.js` | 83 JavaScript files | Files selected by literal worker imports; not proof that every statement executes. |
| Worker plus manifest popup/options documents | 93 sources: 91 JS, 2 HTML | Popup is `ui/views/browserActionPopup.html`; options is `ui/views/options.html`. |
| Above plus six conditionally opened pages | 117 sources: 109 JS, 8 HTML | Adds `form.html`, `authNotice.html`, and attention/messages/poll/status classroom pages. These require their selecting account or classroom branches. |

The manifest has no `content_scripts` declaration. `js/content/form.js` and
`js/content/authNotice.js` are page scripts selected by authentication documents,
not broad webpage content scripts. The worker primarily imports the ESM
`js/mjs/` tree, but the authentication documents still select RequireJS-backed
AMD code. The AMD tree therefore cannot be discarded wholesale.

`background.html`, `thumbnail.html`, `rawlog.html` and `testAppBlock.html` are
retained auxiliary documents outside the identified active roots. In the active
worker, `alwaysBlock.js` compares tabs with the `background.html` URL and removes
a matching tab; that comparison does not create a background document.
`thumbnail.html` selects legacy AMD desktop-capture resources, whereas the active
`thumbnailGeneral.js` constructs **OffscreenCanvas** directly. No offscreen HTML
entrypoint was established by the manifest/dependency map. This distinction does
not prove that every retained auxiliary document is inaccessible or globally
unused.

Tests, build scripts and library documentation outside these roots remain
separate from selected execution sources. Comments are not interpreted as
imports. Bundled local CommonJS factories are not treated as requests for
similarly named files outside their bundle. The inventory is a reproducible
static dependency boundary, not an exhaustive runtime call graph.

## REA coverage and remaining library frontiers

The earlier whole-package attempt stopped at Knockout after 76 parsed and
149 skipped JavaScript units. Its partial graph is not used as absence evidence.
This pass instead makes **23 explicit selected-source requests**: a three-file
pilot, eight application batches of at most twelve files, and fourteen
single-library requests. Together they request all **109** JS files in the
conditional closure.

REA completes **107** selected files with zero reported parse failures or skipped
files in those successful selections. Two single-library requests time out at
12 seconds: `js/lib/jquery-2.1.1.min.js` and `js/mjs/lib/knockout.js`. Their exact
failures and partial Evidence references remain retained; neither means that the
library or its behavior is absent. The independent Babel inventory supplies
syntax and import observations for those files, not replacement REA semantics.
All successful REA semantic graphs also retain their declared partial
relationship coverage and dynamic unknowns.

`rea-summary.json` joins selections, statistics and Evidence IDs.
`rea-pilot.json` and `rea-batch-01.json` through `rea-batch-22.json` retain the
inline results. `rea-evidence.json` exports **44 records, 160,147,530 bytes**.
The application pilot parent is
`ev_49d7f028d5b606628fd2f42f9f656066c9c7e55f341270e9da66acb942f63d98`.
The timeout parents are
`ev_96779475677fa4abdeb40d0f563554f4dea13729f0bcc5574645266373918001`
and `ev_723a836f8e8582bb737a2936da8d31aa2b4b3e09efeaba212495960cac54c48f`.
The per-batch ledger provides the remaining parent IDs without conflating a
summary view with its underlying analysis Evidence.

The active resolution ledger has seven entries: two missing AMD sandbox
dependencies, one dynamic `importScripts` site inside RequireJS, and four
conditional UMD/AMD dependency references in Knockout/binding libraries. UMD
`exports`/`require` slots are not mislabeled missing packaged files. Dynamic
callback names, server-selected satellite addresses and runtime resource values
remain semantic frontiers beyond literal import resolution.

## Authentication-page dependency frontier

An initial inventory assertion expected `js/amd/sandbox.js` to exist and failed;
`inventory-initial-failure.json` preserves that mistaken assumption and its
boundary. A filename search alone would not establish a missing AMD module.
The follow-up checks the mechanisms that could supply it:

- Both authentication main scripts configure `amd` as `/js/amd` and underscore
  as `/js/amd/lib/underscore`. Their loaded configurations have no bundle, shim
  or map override supplying `amd/sandbox`.
- Named `define()` literals across the parsed package include linkify modules,
  underscore and jquery; none names `amd/sandbox`.
- `replay-loader.cjs` executes the unmodified packaged RequireJS loader and each
  actual main script. A replacement transport hook records module loads and
  fetches nothing. Both pages request `/js/amd/sandbox.js`;
  `requirejs.defined('amd/sandbox')` remains false, and that packaged file does
  not exist.

`loader-replay.json` retains the main/loader hashes, exact requested URLs and
observed definition state. The initial assumption was corrected into a checked
resolution frontier. No replacement sandbox or successful form login is supplied.
This proves the selected packaged fallback requests an unsupplied dependency;
it does not claim that an installed device necessarily enters this fallback,
or that every other deployment artifact has the same gap.

## Selected client and monitoring execution

`replay-clients.cjs` bundles the shipped selected modules with esbuild and executes
their real functions in isolated VM contexts. `clients-replay.json` records
**20 passing fact groups**, fourteen selected source hashes, the generated
bundle hash, explicit dependency fixtures and outputs. Network dispatch,
identity callbacks, hub events, upload addresses, device information, clocks and
canvas primitives are controlled fixtures. An unexpected live Fetch is rejected.
The packaged application Authorization value is replaced with a fixture value
before any synthetic request. No real token, password, account or image is used.

| Active path | Locally observed contract |
|---|---|
| OAuth client | Requires a truthy username; posts `oauth/authenticate` under the configured OAuth base. Missing optional password, vanity and device context become empty strings. Device/client context and supplied headers are forwarded. The log helper masks the password; malformed log JSON throws. |
| Google profile client | Returns a supplied primary-profile email; rejects empty/null data, `runtime.lastError`, API exceptions and the five-minute timeout. A late callback does not reverse an already rejected promise. This is Chrome identity behavior under explicit fixtures, not a real account grant. |
| Core API client | Requires an access token before hub initialization. `users/get` and `activitydata` carry that token; missing activity date/offset become `fake` and zero. Gzip activity uploads preserve their destination and explicitly disable the wrapper's forced teardown flag. HEAD requests retain their supplied URL. |
| Core hub callbacks | Hub options contain the core token and configured API base. Selected 401/403 and error 4908 callbacks emit the fatal event; 503 sets a 15-second reconnect delay. A generic error increases backoff; reconnected resets it. Transport establishment itself is a fixture. |
| Satellite command dispatch | Missing core token, base URL and connection state throw at their guards. User-joined/left payloads are ignored; new/open/end commands generate their observed event names. Unknown or malformed commands throw. |
| Satellite attachment and frames | Attachment selects `/v2/broadcast/attach` and supplies broadcast, connection and core-token parameters. A supplied reply token becomes the satellite token for subsequent Cabra requests. Frame envelopes preserve their selected payload/context; image uploads carry the supplied content type, bounded retry statuses and forced teardown flag. Query serialization is explicitly a fixture, not a claim about every SignalR encoding branch. |
| Activity configuration | Preserves account/token context. A reason without a HEAD URL exits without probing an upload. An existing object requests a new device offset; HEAD 404 returns that candidate configuration. HEAD 403 instead fulfills with `undefined`; a core request rejection remains rejected. None is an allow verdict. |
| Blocking manager | Transforms supplied web, web-fragment and Chrome application bundles into its separate application/URL calls. Whitelist/blacklist slots, unsupported-type clearing and null-state clearing are exercised. Missing bundles throw in the selected malformed case. Predicate matching itself reuses the earlier URL-filter study; this manager replay substitutes its filter dependencies. |
| Safe Chrome tab update | A dragging-tab error schedules a 200-ms retry and delays the callback. The saved-group error selects tab removal. These are shipped privileged-command choices, not an installed-browser observation. |
| Thumbnail conversion | Empty/protected/blocked inputs reject before image work. A synthetic bitmap exercises aspect-ratio sizing, OffscreenCanvas conversion and bitmap closing. No screen capture, real image processing quality or browser permission is established. |

### Satellite failure completion

Two additional attachment cases expose limits beyond the direct guards:

1. A synthetic transport rejection rejects the outer attachment promise with
   `undefined`; the original error reason is not forwarded.
2. A synthetic fulfilled reply without `access_token` throws in
   `_attachSuccessful`, inside the nested `.then()` callback. Across two
   event-loop turns, the outer attachment promise remains pending and an
   unhandled rejection contains `Access token not provided!`.

The replay captures the latter event with a temporary local rejection listener
and then removes it. This is a bounded pending observation, not proof that the
promise can never settle in every environment. A malformed mocked reply does
not establish that a real tenant sends it. Neither result is a policy allow or
successful login, and no production workaround was added.

## Reused evidence and archive requests

The earlier **31 diagnostic cases** and **10 worker-message input shapes** were
not rerun or counted as new groups. `verify.cjs` checks their source hashes
against the same authenticated package and checks the current worker hash
against the earlier callback receipt. The selected current ESM client paths
therefore remain distinct from the unused `js/background.js` entry discussed in
the earlier diagnostic report. Its AMD promise handlers do not establish current
worker behavior.

Three credential-free, source-composed concrete routes received **sequential**
Wayback MCP searches with `collapse:digest`, `limit:2`:

- `https://oauth.dyknow.me/oauth/authenticate`
- `https://api.dyknow.me/v1/users/get?id=me`
- `https://api.dyknow.me/v1/activitydata`

Every query returned `Failed to search archives: fetch failed`.
`archive-lookups.json` retains each response and the omission of credential
fields. These are failed lookups, not empty archive histories. No synthetic
satellite/upload host was queried, and no real tenant address or token was
invented to fill a dynamic endpoint. Existing diagnostic URL results remain in
the earlier report.

## Reproduction, limits and external requirements

From the repository root:

```powershell
node extensions/filter-audit-2026-11-10/dyknow-active-closure/inventory.cjs
node extensions/filter-audit-2026-11-10/dyknow-active-closure/rea-summary.cjs
node extensions/filter-audit-2026-11-10/dyknow-active-closure/replay-clients.cjs
node extensions/filter-audit-2026-11-10/dyknow-active-closure/replay-loader.cjs
node extensions/filter-audit-2026-11-10/dyknow-active-closure/verify.cjs
```

These commands use installed dependencies and make no live vendor calls. REA
selections are retained per batch, including their timeout, heap and semantic
limits. The authored scripts were formatted with the project formatter;
`verification.json` checks all authored function bodies, with a maximum of
**60 lines**. Source/hash, loader and replay assertions passed. No broad product
test-suite result is claimed for this research-only change.

The local closure is the checked dependency inventory and the specifically
executed contracts above. It does not execute all statements in 117 sources.
Whole application startup, IDN persistent-authentication recovery, QSR's complete
restore/expiry lifecycle, the activity collector's complete time-window/upload
loop, every UI binding and the timed-out library semantics remain further local
execution work. Their omission is not attributed to missing vendor permission.

The genuinely external requirements are narrower:

- An authorized ChromeOS/managed-Chrome installation and profile are needed to
  observe service-worker startup/suspension, real identity/device APIs,
  navigation/window timing and capture permissions in the deployed environment.
- An authorized tenant is needed to test accepted OAuth/core credentials,
  account/classroom rules, runtime satellite discovery, real hub traffic and
  server validation of attachment/frame messages.
- Actual server-supplied upload URLs and their lifetime/CORS/storage behavior
  are needed to validate accepted monitoring/image uploads. Fixture responses
  do not establish those services or a real enforcement outcome.

The missing packaged AMD dependency is a local artifact frontier, not something
a fabricated successful policy or guessed tenant credential can resolve.
