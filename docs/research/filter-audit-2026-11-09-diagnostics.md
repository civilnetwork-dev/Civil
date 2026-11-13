# Dyknow diagnostics and expanded URL evidence, 9 November 2026

This follows the [five-vendor audit](filter-audit-2026-11-09-new-vendors.md).
The signed Dyknow 7.11.38 package includes a diagnostic uploader that the initial
selected-source pass did not characterize. It is not a website classifier.
Civil preserves this service; no diagnostic request was sent to the vendor.

## Active and retained entry points

The manifest selects `worker.js` as its module service worker. That worker imports
`js/mjs/application.js` and `js/mjs/clients/logsender.js`. Application constructs
LogWatcher and starts it after account information is established. The retained
AMD `js/background.js` is a different, unused manifest entry, so its `.done` and
`.fail` handlers cannot establish current worker behavior.

The active worker registers two runtime-message callbacks. The first invokes its
callback with the literal `YUUSSSS` without selecting a message type. The second
dispatches `sendlogs`, converts supplied dates, and invokes LogSender; it sends
`{}` after fulfillment or `{error: ...}` after rejection. A replay of the exact
two callback source ranges covers ten JSON input shapes. Null inputs and a null
`sendlogs` value throw in the second callback after the first callback emission.
Invalid dates reach the mocked sender as invalid Date values. These observations
do not establish installed Chrome's response arbitration or caller authorization.

LogWatcher also supports requested diagnostic collection through the authenticated
core API. Its polling interval is 1,800,000 ms. Its hour predicate accepts local
hours 9 through 16 inclusive; the adjacent comment's “9 and 3pm” wording does not
change that expression. It checks account information before polling
`v1/RequestLogs`, whose GET and status-update PUT parameters include account/request
identifiers and an access token. The sender takes the preceding seven days of
logs and environment metadata. This is not solely a user-clicked flow. No token
or real account value was used in this investigation.

## Client request and response contract

Default diagnostic base:
`https://diag.dyknow.com/dyknowlogservice60/dylogservice.svc/json/`.

| Action | Observed client contract |
|---|---|
| `DyKnowLogMac` | JSON environment/contact report. Successful response must have numeric `RetCode: 0`; `UploadDir` supplies the subsequent directory. Missing/nonzero/string codes reject. |
| `CreateMarker` | JSON `{DirPath, Type}`; Type 1 marks start and Type 2 marks end. The same strict RetCode check applies. |
| `UploadChunk` | JSON `{UploadDir, FileName, ChunkData, ChunkNum, TotalChunks}`. Base64 chunks use zero-based indices and 102,400-byte boundaries. Empty files emit no chunk. UTF-8 samples establish byte boundaries rather than character counts. |

The actual API wrapper posts JSON, defaults to 60,000 ms, and passes
`credentials: 'same-origin'`. Its source passes a `cors` property rather than a
Fetch `mode`; this replay does not establish browser CORS acceptance. It does not
set a redirect policy. Optional retry handling uses the supplied attempt count
and status list with 5,000 ms waits. Diagnostic sender calls do not supply that
retry option. Abort, HTTP errors and malformed JSON remain client failures.
Wrapper error code 4410 is normalized to a fulfilled result with status 200; that
does not satisfy the sender's separate RetCode contract or establish policy.

Thirty-one source-executing cases cover response shapes, HTTP/non-JSON/network
errors, abort, retries, explicit header replacement, environment defaults,
malformed options, marker requests, byte boundaries and upload-stage failures.
They reveal two important completion limits in this client:

- A rejected chunk leaves `_uploadFiles` pending in the bounded replay and emits
  an unhandled rejection; its recursive chain has no rejection forwarding.
- A rejected end marker does not prevent outer completion; that marker promise
  is not awaited. The replay records both the fulfillment and rejection.

Neither result is an allow/deny verdict. No new API client or diagnostic blocking
rule was added. A middleware regression verifies `diag.dyknow.com` stays allowed.

## Receipts and reproduction

All following files are under ignored `extensions/filter-audit-2026-11-09/`:

- `replay-dyknow-diagnostics.cjs` and `dyknow-diagnostics-replay.json`: 31 passing
  assertions, source/bundle hashes and captured request/response observations.
- `replay-dyknow-worker-messages.cjs` and `dyknow-worker-message-replay.json`:
  ten cases, exact worker callback ranges, emissions and synchronous failures.
- REA selected diagnostic graph `ev_24ded713ad636bcfbdd6e67c711909617dda35b75b12990dc5852cb50046272e`
  and active worker graph `ev_449052494e575af846249d478f3589163217004bf2b8c9953f1e43ff4b132b60`.
  Exports `rea-expanded-diagnostics-trace.json` and `rea-dyknow-active-worker.json`
  retain the complete Evidence. Static traces did not resolve the selected
  dynamic method slots; zero matches are not proof that these methods are unused.
- A broader REA attempt retained partial graph
  `ev_59de7f293e45fde3e48d41e5eb79b009fec980f8e75a101ca8a46328f2c1dfcb`:
  76 JavaScript sources parsed, 149 skipped after the 45-second timeout at
  `js/mjs/lib/knockout.js`. `rea-dyknow-whole-source.json` preserves this failure;
  it does not close complete dependency coverage.

Run both replay scripts with Bun from the repository root. The uploader replay
executes shipped client, deferred, event and underscore code with explicit mocked
device/environment, filesystem, clock, logger and Fetch dependencies. One case
runs per subprocess. The message replay substitutes only the sender result and
records callback emissions, not a real browser policy or server acceptance.
Authored replay functions remain at most 60 lines after project formatting.

## Archive observations

Exact Wayback MCP searches returned no captures for the diagnostic base or its
three action paths, and none for the credential-free `api.dyknow.me/v1/RequestLogs`
candidate. The latter is an analyst-composed route; real query credentials were
omitted. Empty results do not prove the services were absent.

Two additional relevant bodies were inspected and retained in
`archive-expanded-bodies.json`: ClassLink Analytics dashboard on 29 April 2024,
and a Gopher development API status page on 14 November 2022. The development URL
came from retained source-map content; its presence does not prove production
worker reachability. Neither body supplies a tenant policy classifier. The
whole-package URL queue remains tracked in `all-source-url-ledger.json`.

A host-wide union CDX pilot timed out while its exact-URL control succeeded.
The availability tool also failed on its yearly-statistics response schema.
These failures are retained in `archive-union-pilot.json` and
`archive-availability-pilot.json`; exact searches remain the working method.
