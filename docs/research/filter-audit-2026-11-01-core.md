# Filter extension continuation: Lightspeed's helper and relay protocol

Audit date: 1 November 2026, America/Los_Angeles. This pass builds on the
30 October core report. It recovers a previously omitted detector dependency
and fixes one concrete mismatch between Civil and the acquired agent protocol.
It does not establish a managed-device allow verdict or complete recovery of
every vendor file.

The later [collector/runtime follow-up](filter-audit-2026-11-01-helper-runtime.md)
supersedes the page-global uncertainty below with recovered collection-path
reachability and CDP isolated-world controls. It also executes the complete
synchronous proxy method, fixes an injected-comment fingerprint and records
the independent root/new-tab detections that remain.

The [signed-history follow-up](filter-audit-2026-11-01-signed-history.md)
restores Insight 3.8.4 with explicit changed-file exclusions, compares its
authenticated reporting code with 3.11.0, and validates both signed WASM
binaries without executing them. The earlier 3.7.6 source remains missing.

The later [native WASM pass](filter-audit-2026-11-01-insight-wasm.md) indexes
15 application functions per Insight version and runs 22 actual Go/WASM cases
with supplied responses. It establishes selected validation, request, metric
and adaptive-payload behavior. Filter Agent classifier semantics remain open.

The subsequent [Filter Agent WASM pass](filter-audit-2026-11-01-lightspeed-wasm.md)
recovers the native bridge, executes 21 response-verification cases in each of
two versions, and adds Civil's missing signature check. It supersedes the
nonce-only verification boundary recorded below. Full native identity,
licensing and reporting semantics remain open.

## Artifacts and acquisition

The local evidence root is the ignored
`extensions/filter-audit-2026-11-01/core/` directory. Existing 1 November
acquisitions elsewhere under that date's artifact directory predate this pass.
The missing 30 October artifact directory was not silently reconstructed from
the research prose.

| Artifact | Version and source | Identity |
| --- | --- | --- |
| Filter Agent, cached | `4.4.6.1785883975`, pre-existing `~/extensions/lightspeedFilterAgent/` | `worker.js` SHA-256 `e1b04c40c0294717c7457f5920e0e377c2d788240d1f2b0b9b51df152e234265`; acquisition/release date unknown. |
| Filter Agent, current | `4.4.10.1792039522`, official vendor update manifest and CRX downloaded again during this pass | CRX SHA-256 `db60e49b770b3c490e3d35285481453f6330c18c1578452c890ed347f6456b71`; identical to the pre-existing 1 November acquisition. `worker.js` SHA-256 `fcd8a09f259f829cc3e88fc85aa279869c26b801bef40f8c98674a76c3e045f7`. |
| Filter Helper dependency | `1.5.1.1793289492`, official vendor update manifest and CRX | Extension ID `egnmgclkeiioginamdjpnglaooajmcjm`. CRX SHA-256 `35e1c055989ca0a1fe44218d827b0a165e452b3356679edce27f6d7b8e6688e2`. `content.js` SHA-256 `4e04766756d56c43e48b1c03837436d634e072d7650e2a728725e16fed694107`; `worker.js` SHA-256 `6bb09b2d8b81f324a81e6072d6de8e602697b77b5a83e0f60d8c208df9f36927`. |

The Filter Agent's recovered default configuration names that exact
`helperId`, and its manifest permits external messages from it. The helper is
not one of the catalog's 28 IDs. It is included as an actual dependency of a
requested target, not counted as another release of the Filter Agent.

Google's update service returned `error-unknownApplication` for the helper.
The public vendor update manifest returned its package successfully:
[helper update manifest](https://lsrelay-extensions-production.s3.amazonaws.com/FilterHelper/f8db5b5547d93ef167b094ef5c73485f56e752bb4971141abb5cda8ffb88c8ee/FilterHelperAgent.xml),
[helper CRX](https://lsrelay-extensions-production.s3.amazonaws.com/FilterHelper/f8db5b5547d93ef167b094ef5c73485f56e752bb4971141abb5cda8ffb88c8ee/FilterHelperAgent.crx).
The URL uses the same tenant path already present in the acquired Filter Agent.
The receipt `helper-acquisition.json` preserves the exact URLs, version, package
digest and every extracted file's digest. Its initial signature flag is false;
any separate signature-verification receipt must be read for that additional
claim. The root continuation's `acquisition-integrity.json` now verifies the
helper's CRX3 publisher signature, derived ID, and all 24 extracted files against
the signed archive. Version suffixes are not authenticated release timestamps.

## Static recovery method

`decode-worker.cjs` parses the files as Babel syntax, reads literal string
arrays, solves their bounded rotation arithmetic, and substitutes calls whose
lexical binding identifies the known pool resolver. It does not execute the
vendor's resolver, rotation code, module bootstrap, extension or WASM.
`worker-decoding.json` records exact input/output hashes and limitations.

| Input | Literal resolver calls replaced |
| --- | ---: |
| Cached Filter Agent worker | 9,212 |
| Cached Filter Agent content script | 1,001 |
| Current Filter Agent worker | 9,583 |
| Current Filter Agent content script | 1,079 |
| Helper worker | 2,997 |
| Helper content script | 7,855 |

These are readable derived copies, not original source. Dynamic strings,
runtime inputs and unselected modules remain separate unknowns.

REA's selected cached-agent analysis timed out at 60 seconds and retained partial
Evidence `ev_cd31cd10a8482651791cb31d5579bc7e4b50a4f14511ae91a18a45f633731abb`.
Its timeout is not reported as a successful full analysis.

REA examined the helper manifest and worker without executing them. Parent
Evidence `ev_789a0ba52b10b74190cca22ee29353f29a37681d92e02ee2f4db2fd8305e1b15`
has incomplete semantic coverage: only those two sources were selected, with
1,000-node and 1,000-unknown per-file limits. The ordinary AST recovery and
manual reading of the content script supply the detector findings below;
they are not misattributed to REA's unselected content-script scope.

## The omitted helper contains the proxy detector

The helper manifest runs `content.js` at `document_start`, in every frame.
The recovered content script implements separate Scramjet, Ultraviolet,
BareMux, Rammerhead and Ghost detectors, plus behavioral, URL, DOM, script,
metadata, resource and game-platform checks. It caches results and rescans
after relevant page mutations. A clean initial page therefore does not
establish that a later browsing state remains unclassified.

The collector reads script `src` values and inline script text, localStorage
keys, iframe IDs, page text/markup, DOM properties and up to 500 resource names
from `performance.getEntriesByType("resource")`. Only inline scripts contribute
their first 2,000 text characters through this path; this is not a demonstrated
download of every external JavaScript file.

`detectBareMux` merges script and resource URLs, deduplicates them, and adds
35 points for each matching URL. The relevant patterns include `/baremux/`,
`/bare-mux/`, `/libcurl/`, `/epoxy/`, `bare.cjs`, `bare-mux.js`, `libcurl.js` and
`epoxy.js`. It reports `detected` at 30 points. `detectScramjet` likewise adds
35 for matching engine URLs and 40 for an exact listed global such as
`scramjet`.

The aggregator treats those engine detectors as tier 1. A tier-1 detected
result sets its aggregate `detected` flag regardless of the final weighted
confidence. Reporting a low weighted confidence alone as an all-clear would
misread this code.

The exact `scramjet` global is a residual source-level concern, but a content
script's isolated world does not automatically expose a page's globals. This
pass has not demonstrated that this helper sees Civil's page global in Chrome.
The URL and resource-name inputs do not depend on that claim.

The helper worker sends `detectReport` with `proxy_detections` to the Filter
Agent. The Agent's corresponding handler combines detections by tab/hostname,
retains relevant early reports, and applies them to held or later activity.
Actual blocking also depends on `BypassDetectEnabled`, the configured
`Categories.bypass_detect` values, the tab's current category, and its
`IsRtdExempt` policy result. Game detections have a separate game-policy gate.
The source establishes this path; no district policy or remote enforcement was
queried.

The helper also packages an NSFW image model, TFJS WASM backends, an offscreen
document and a model worker. Those assets were inventoried and hashed, not
fully interpreted or executed. Its manifest lists `main.wasm` as accessible,
but no file with that path exists in this acquired archive.

## Controlled detector replay

`helper-detector-replay.cjs` extracts four exported pure functions and their
lexically referenced declarations from the recovered source. It executes those
closures with explicit synthetic inputs and retains the source ranges in
`helper-detector-replay.json`. It does not run the full extension bootstrap,
Chrome APIs, timers, network, model inference or a managed browser.

| Explicit input | Engine detector | Aggregate result |
| --- | --- | --- |
| Neutral `/_runtime/engine.js` and controller URLs | Both engine scores 0 | `detected: false` |
| `/scramjet/scramjet.all.js` | Scramjet 35 | `detected: true`, tier-1 match |
| `/libcurl/index.mjs` resource | BareMux 35 | `detected: true`, tier-1 match |
| `/epoxy/index.mjs` resource | BareMux 35 | `detected: true`, tier-1 match |
| `/baremux/worker.js` resource | BareMux 35 | `detected: true`, tier-1 match |
| Implemented `/_runtime/{socket,channel,worker,request,bridge}/…` resource aliases | Both engine scores 0 | `detected: false` |
| Exact `scramjet` global supplied as visible | Scramjet 40 | `detected: true`, tier-1 match; real isolated-world visibility remains unverified |

The replay supplies only the stated detectors to the aggregator. It is a
predicate comparison, not a full-page confidence score. The unconditional
tier-1 gate applies when the full pipeline also supplies its other detectors.
Clean alias inputs do not establish that every detector returns clean.

The installed epoxy transport contains a default relative `epoxy.wasm` URL;
the implemented directory alias keeps that resolution inside the neutral directory.
`epoxy.wasm` alone does not match the listed engine-resource expressions.
`epoxy.js` would match one and must not be assumed neutral from its directory.
The installed libcurl transport embeds its WASM payload in its module.

The [root continuation](filter-audit-2026-11-01.md) subsequently verified these
aliases with actual Chrome parent/frame resource arrays at 1366×768 and 390×844.
The recovered functions score those arrays zero. Adding the old Epoxy URL
restores the tier-1 detection flag in both negative controls. The browser loaded
a real proxied page through Bare; this is still not full helper enforcement.

## Civil relay fix

Both acquired Filter Agent versions send a `crypto.randomUUID()` nonce with
each `dy_lookup`. Their `host_lookup` consumers require the reply's nonce to
match the pending request before accepting its category. They also verify a
publisher response signature. The initial nonce-only pass below did not verify
it; the later Filter Agent WASM follow-up now implements and tests that check.

Civil previously omitted the nonce and matched replies only by action and host.
`misc/filters/lightspeed/checker.ts` now sends a UUID and requires that same
nonce in its reply. Malformed JSON, unrelated actions/hosts, missing nonces and
stale nonces do not complete a lookup. Timeout/no category still yields the
existing `unknown` verdict.

The new offline regression drives the real request serialization and reply
consumer through a mocked event-emitting WebSocket. It sends malformed and
unrelated replies, then the correctly correlated category. It requires a UUID
and verifies that the stale blocked category cannot win over the correct reply.
An initial loopback-server version was replaced because this host's sandbox
denied even local WebSocket connections with `EACCES`; the final test needs no
network access.

Verification: the focused checker/verdict run passed six tests; the changed
files passed oxlint and oxfmt checks; `bunx tsc --noEmit` passed. The edited
functions and test callbacks remain within 60 lines.

## Remaining boundaries

- The Filter Agent WASM still lacks complete internal semantic recovery.
  The later native follow-up completely decodes the current bytes with WABT
  1.0.42 and executes response verification in both versions; identity,
  licensing and reporting internals remain unresolved.
- No dated historical helper version was acquired. The cached Filter Agent
  does not satisfy the requested one-to-two-year date requirement by itself.
- Helper page-global visibility, all-frame rendering behavior, tenant policy,
  cloud classifiers and real enforcement need an authorized browser test.
- Securly, GoGuardian, Hāpara and Insight findings in the previous core report
  were not re-established by this bounded Lightspeed continuation.
