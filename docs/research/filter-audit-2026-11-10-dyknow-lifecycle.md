# Dyknow lifecycle transitions, 10 November 2026

This pass executes the remaining selected IDN, QSR and activity-collector
lifecycle paths from authenticated Dyknow **7.11.38**. It extends the active
source inventory and client-contract replays. The package ID remains
`ehldjdeaoebgafllfobddbfbfpmammmc`, with CRX SHA-256
`76bd2aacc45650747f2caaf6f9754f9ed03401a0f553addbf85d1430e9c7ecfe`.
The earlier report records its package identity, conditional page dependencies
and client protocol work. [Active-source report](filter-audit-2026-11-10-dyknow-active-closure.md)

New artifacts live under ignored
`extensions/filter-audit-2026-11-10/dyknow-lifecycle/`. The replay passes
**27 lifecycle groups and two actual worker-entry groups**. Eighteen shipped
source files participate in the lifecycle bundle, and twenty-two participate in
the worker bundle. Their exact hashes match the authenticated acquisition's
inventory. All account values, tokens, classroom plans and page activity are
synthetic fixture data.

## Execution setup

`harness.cjs` bundles the shipped ES modules using esbuild and evaluates them in
VM contexts. IDN, QSR, State, Tracker, the lifecycle event handler, filesystem
wrapper, activity collector, timeLord, deferred provider and compression code
execute their shipped functions. QSR restoration also enters the real attention
and blocking managers, whose rendering/Chrome-command dependencies record their
arguments through fixture adapters.

Chrome local/session storage uses asynchronous callbacks and copied values. The
clock uses UTC and a controlled Date implementation. Actual `timeLord.warp`
supplies the historical time observed by the browser-event adapter during queued
event replay. An initial adapter used Date directly, which failed that historical
time check. The adapter was corrected to observe the shipped timeLord service,
then the cases passed.

The shipped filesystem wrapper uses a fresh in-memory `fake-indexeddb` database
per context. Its real database initialization, QSR put/get and deferred completion
paths execute. This environment provides deterministic callback and storage
behavior. Managed-Chrome storage durability, browser suspension and real
identity APIs remain deployment-validation work.

Transport clients are explicit adapters. Their accepted/rejected values select
the lifecycle branches under investigation. The preceding source-executing
client study covers the OAuth, core and satellite request wrappers. The earlier
31 diagnostic cases and ten worker-message input shapes remain referenced by
that study. [Client and diagnostic evidence](filter-audit-2026-11-10-dyknow-active-closure.md)

## IDN persistent authentication

Five groups exercise persistent authentication and recovery.

| Path | Observed transition |
|---|---|
| Cached token rejected, then renewed | IDN offers the cached device token to the OAuth adapter. The selected rejection clears the local token, restarts authentication, then persists the replacement fixture token. Identity confirmation produces the success checkpoint, activity account/token handoff and broadcast initialization. |
| Saved successful session | IDN restores health-check fields and account/token context from session storage. It enters activity recovery, restores classroom state from local storage, replays the queued event with its saved time and releases queued browser events. The activity sleep checkpoint schedules its remaining delay. |
| Future retry checkpoint | Recovery waits for the checkpoint's remaining duration. When that timer fires, the offline fixture selects the ordinary authentication retry and persists the next retry time. |
| Overdue retry checkpoint | Recovery begins the authentication process immediately. The offline fixture persists a new retry checkpoint. |
| Identity lookup temporarily unavailable | OAuth supplies a fixture token, then the core identity lookup rejects with status zero. The local token remains saved, the checkpoint returns to retry and a 15-second delay is scheduled. Broadcast initialization awaits identity confirmation. |

The successful-session case executes the interaction among IDN,
`lifecycleEventHandler.getActivationState`, the event queue and activity recovery.
The lifecycle handler saves the queue reference before its asynchronous storage
callback. Activity recovery receives that saved queue after IDN releases the
live queue. The selected event is delivered with its recorded timestamp through
the actual timeLord service.

`idn.cjs` contains the assertions, and `lifecycle-replay.json` records token
handoffs using fixture strings, storage writes, checkpoints and scheduled
durations. Actual token acceptance, profile permission and tenant identity
remain external observations.

## QSR restoration, expiry and reconnection

Three groups pass through the real filesystem API and in-memory IndexedDB.

- A saved policy state loads through `filesystem.getQSR` and `State.restore`.
  QSR schedules its five-second tick and restores the cached plan while the
  communication fixture is disconnected. The source expiry comparison changes
  at 300,000 ms. At that boundary the selected active state is reset, the empty
  state is persisted, and both managers receive the resulting restoration.
- When communication resumes with a different tracker state, QSR restores the
  tracker state and persists it with the current timestamp. A later tick with
  equal policy content refreshes the timestamp and leaves the manager restoration
  count unchanged.
- Malformed saved JSON leaves the initialized empty state available and still
  schedules the next tick.

The stop path cancels the outstanding timer. `qsr.cjs` records the selected
manager arguments and persistence observations. These are controlled lifecycle
transitions with fixture classroom plans. Installed-extension event ordering and
actual teacher policy still require an authorized browser/tenant session.

## Activity windows and upload transitions

Nineteen groups execute activity-collector entrypoints and their asynchronous
continuations. The receiver decompresses the actual gzip output and asserts the
serialized monitoring envelope.

| Path | Observed behavior |
|---|---|
| Ordinary completed window | Events before the boundary enter the outgoing envelope. The boundary event stays queued. The outgoing window gains its required initial status, and the next queue receives a stale activity marker. A fulfilled upload resets the failure counter, backs up the queue and schedules the next one-minute check. |
| Collection starts partway through a window | The outgoing start time moves to the supplied collection boundary. The latest earlier activity becomes the stale state at that boundary. |
| Collection ends partway through a window | Later activity is removed from the outgoing slice and the envelope completion time moves to the supplied boundary. |
| IP-restricted configuration | The selected envelope contains the supplied restriction-status record. The fixture address is `192.0.2.4`. |
| Configuration has a reason and lacks an upload URL | The selected window produces zero upload calls and schedules the next check. |
| Switchboard delay is active | The current check leaves upload unstarted and schedules the next check. |
| Configuration request rejects | The collector restores its prior target/window values and returns the selected records to its queue before scheduling another check. |
| Upload rejects | The failure counter increments and the one-minute continuation runs. The selected old-window slice stays removed from the queue. A second injected failure emits the source's giving-up log. The next-window stale marker remains queued. |
| Cached activity is valid | Startup restores the saved activity, target and window fields. |
| Cache is malformed, five days old, or arrives after upload has begun | Startup declines the selected saved activity. |
| Recovery checkpoint is `getconfig` or `upload` | Activity recovery initializes its account/PAL state. Both selected switch branches finish with zero continuation timers. |
| Several windows await upload | Successive scheduled checks produce distinct window envelopes and advance the target one window at a time. |
| A blackout spans queued activity | Records inside the supplied blackout interval are removed. The next queued segment starts with its status marker and its target is recalculated. |
| Cache-write callback reports an error | The backup code removes `activitycollector_cache`, updates the backup time and fulfills its completion promise. |
| A saved sleep checkpoint is overdue | Recovery immediately enters `runTimer`, establishes its backup timestamp and schedules the next one-minute check. |

The upload-rejection result differs from configuration-rejection recovery. The
upload error handler increments its counter and completes its promise chain,
so the outer recovery branch receives fulfillment. In the selected cases, the
earlier event slice is absent from the live queue after the failed write. The
receipts retain the remaining queue and attempt count. Real storage-service
acceptance and server-side deduplication remain outside this observation.

The two in-flight recovery checkpoint branches contain empty switch cases in
the shipped collector. Their replay starts the PAL observer and records zero
scheduled continuation timers. This is a local recovery gap in those selected
states. The future and overdue sleep branches receive separate timer assertions.

The backup-write error is represented through `chrome.runtime.lastError` during
the callback. The selected source explicitly attempts cache removal and resolves
its deferred result. This completion state therefore describes execution of its
fallback path.

`activity.cjs` contains the cases. Configuration and upload adapters use
`.fixture.invalid` addresses, and their gzip payloads contain synthetic titles
and URLs. The selected concrete OAuth/core addresses were already recorded in
the preceding study. This pass identified no additional concrete vendor URL for
a new Wayback query. Upload destinations remain values supplied by the core
configuration response.

## Actual worker entry

Two additional groups import the shipped `worker.js` and actual `App` module.
Both retain the selected lifecycle, IDN, QSR, filesystem and collector code.
Fixture adapters cover log watching, health response, renderer commands and
transport. The browser is represented as an offline ChromeOS environment.

The successful database case observes the first check-in alarm, the filesystem
session checkpoint and the later application-start hooks in that order. QSR
establishes its timer, and the offline identity path establishes a retry
checkpoint. The source's normal filesystem gate therefore participates in this
replay.

In the injected IndexedDB-open error case, the filesystem logs the error while
its initialization promise remains pending across the bounded replay turns.
The worker's filesystem rejection callback receives no rejection, the application
start hooks remain uncalled and the lifecycle handler still has events paused.
The receipt records six event-loop turns and the emitted log. The native
IndexedDB follow-up below checks the database boundary in Chrome.

`worker.cjs` records these groups in `worker-replay.json`. The previously studied
runtime-message callbacks are registered through the real entrypoint, and their
earlier input cases remain in the prior evidence.

## REA and verification

REA analyzed an explicit eight-file lifecycle selection with eight parsed
JavaScript sources, zero skips and zero parse failures. Its relationship graph
retains the tool's partial/static limitations. Parent Evidence is
`ev_e11f0d8a80e27e73ef1539690db636ab39c9aa19ddc28d6c44ee13096b5879e0`.
`rea-summary.json` retains the source selection and statistics.
`rea-retention.json` records the server's complete-record retention result.

`rea-evidence.json` retains the analysis and its summary view as two selected
records, totaling **11,680,651 bytes**. `retain-rea.cjs` selects them from the
tool export, and `rea-selection.json` records the full-export digest, selected
IDs and retained-file digest. Its input export contained 46 session records.

esbuild emits the packaged Pako CommonJS-in-ESM warning during both bundles. The
warning remains in each receipt. The selected gzip execution passes Node's
decompression checks and the envelope assertions in this harness. The Chrome
follow-up below checks the unbundled module and selected gzip branches.

Run the local replays and scoped checks from the repository root.

```powershell
node extensions/filter-audit-2026-11-10/dyknow-lifecycle/replay.cjs
node extensions/filter-audit-2026-11-10/dyknow-lifecycle/verify.cjs
```

The scripts use installed dependencies. The replay writes fresh receipts and
generated bundles in its own directory. `verification.json` checks their hashes,
the source identities, both group counts and every authored function's length.
The maximum after project formatting is **49 lines**. The scoped formatter and
all replay assertions pass.

The previously demonstrated AMD sandbox dependency remains a packaged
authentication-page frontier. This lifecycle replay follows the worker's ESM
paths and supplies explicit authentication-client outcomes. An authorized tenant
is still needed to observe accepted OAuth credentials, actual classroom state,
satellite discovery and remote upload behavior. An authorized managed browser is
needed for native storage durability, real identity APIs, event timing,
permissions and service-worker suspension. The selected local lifecycle and
failure behaviors above are reproducible through the retained fixtures.

## Unbundled compression in Chrome

Dyknow 7.11.5, 7.11.6, and 7.11.38 ship identical `js/mjs/lib/pako.js`
bytes. The replay checks each copy against its signed-package inventory.
Chrome 157.0.8103.50 loads the exact module into a document and a dedicated
module worker. Both contexts expose the same object as the default export
and the global `pako` property. The document and worker return identical
results in all eight cases.

Four gzip inputs cover an empty string, a synthetic Unicode activity
envelope at the collector's compression level, the same envelope with
smaller output chunks, and default compression. Node's decoder reproduced
every original input. The two level-nine settings emitted identical bytes.
The replay also checks invalid compression level, a damaged checksum, and
two incomplete gzip streams. For these two incomplete fixtures Pako
returns the original decoded text and Node's strict decoder reports
`Z_BUF_ERROR`. The activity collector uses gzip for outbound data. This
library replay leaves server decoding and acceptance unknown.

REA's earlier Pako-only analysis parsed the signed source without errors
under parent Evidence
`ev_23c0bb0d2bb4a7690c9562b9da14a009aa427ba50b46a2c8c6d8dd5e444f2f73`.
The browser replay uses a local fixture origin, requests only the two
fixture resources and the signed module in both contexts, and discovers
no new vendor endpoint. Extension service-worker startup and unrelated
compression library branches remain outside these cases.

```powershell
bun extensions/filter-audit-2026-11-11/new-vendor-history/compare-dyknow.ts
node extensions/filter-audit-2026-11-11/new-vendor-history/dyknow-compression-browser.cjs
```

The browser script requires installed Chrome. Its receipt is
`dyknow-compression-browser.json` beside the script.

## Native IndexedDB in Chrome

The browser replay checks the signed inventory hashes for the filesystem,
queue, and deferred modules in Dyknow 7.11.5, 7.11.6, and 7.11.38. All
three files match across the releases. Chrome 157.0.8103.50 imports the
unmodified modules on an isolated HTTPS fixture origin. A fixed clock and
a sessionStorage adapter supply the lifecycle checkpoint. IndexedDB is
Chrome's native implementation.

| Case | Result |
| --- | --- |
| Fresh database | Startup creates the version-2 log and QSR stores and the two log indexes. The early queued record is committed before the later record is read. The QSR value is readable. |
| Reopen after reload | The saved checkpoint selects the same log. Both records and QSR survive the reload. Deleting the QSR value leaves it absent on the next read. |
| Blocked upgrade | An open version-1 connection holds the version-2 request at the native blocked event. Closing that connection lets initialization complete. The recent log remains, the older log is pruned, and the QSR store is added. |
| Incompatible version | An existing version-3 database causes Chrome to emit `VersionError` for the module's version-2 request. The module logs its IndexedDB error and its startup promise remains unsettled through four more event-loop turns. |

The receipt records 24 fixture-origin resource requests, including 12
for signed modules, and zero uncaught page errors. The native error
corroborates the startup gate observed with the [worker fixture](#actual-worker-entry).
The replay covers storage behavior in a Chrome document. Managed Chrome
session storage, extension service-worker suspension, and device-wide
storage failures remain open. It uses no vendor network endpoints.

```powershell
bun extensions/filter-audit-2026-11-11/new-vendor-history/compare-dyknow.ts
node extensions/filter-audit-2026-11-11/new-vendor-history/dyknow-indexeddb-browser.cjs
```

The result is retained in `dyknow-indexeddb-browser.json` beside the
script. REA's filesystem selection is in
`../dyknow-active-closure/rea-batch-04.json` relative to the earlier
lifecycle artifacts, under parent Evidence
`ev_9257e227315ebd5cc4a9201ea741df4f01f4d66f7c57872cf8eb621cd3b3c2a6`.
