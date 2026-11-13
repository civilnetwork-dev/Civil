# ClassLink Analytics+ worker and pages, 11 November 2026

ClassLink Analytics+ 0.6.6 reports anonymous domain, identified domain and
identified app sessions. The signed worker's configuration and collector
responses drive reporting, attribution and local session state. These
contracts support the existing exact analytics host entries in Civil.

## Package and coverage

The retained CRX authenticates publisher ID
`ihidolefpgnimlmgfljonacidpkmbhcl`. Its SHA-256 is
`a0d87e3f5c12f3bbbd47c92f8dbf3ad4b12945d8211716078331dd4c5fb5bc5b`.
All 28 extracted files match the archive, including 16 JavaScript files.
The wrong-ID and changed-byte controls reject. The manifest declares
`service-worker.js`, the all-frame content script, popup and options page.
It declares no web-accessible resources.

REA parsed all 16 sources without a parse failure. Its graph has partial
semantic coverage. The retained `rea-evidence.json` contains two records,
including parent Evidence
`ev_84a447a296b3c9406a71dc61fb25b921e5142500747f7c5e6ecd76c1ba31d0e3`.
The export SHA-256 is
`4376cfc4cb91fcc5b6991b29f784d84f362844f4b348baebd93a7ab76e00a890`.

`worker.cjs` executes the original worker and all 12 imported scripts
without source changes. Each loaded file is hash-checked. The signed popup,
options and content scripts run in separate fixture contexts. Browser APIs,
DOM elements, time, responses and credentials are synthetic. The collector
fixtures return locally and never contact a remote service.
`replay.json` records 19 assertion-backed groups and the executed source hashes.

## Observed contracts

| Path | Replay observation |
|---|---|
| Configuration | Managed properties take precedence. Managed read rejection falls back to the HTTPS local configuration URL, then HTTP after a failed response. Malformed local JSON followed by a failed fallback loads defaults and sends no anonymous sessions. Idle session timeout clamps to 30 minutes in the upper-bound fixture. IP refetch clamps to at least one minute. |
| Compatibility feed | The date-stamped GET reads an array of hostname match strings. A 404 array still changes eligibility, and a subsequent network rejection retains that list. A 200 object clears it. The replay observes telemetry eligibility. |
| Anonymous launch | POST `/anonLaunch/v1p0/launch` sends the tenant token in the query and domain and IP address in JSON. With IP lookup disabled, the body uses the configured placeholder. Activity and close use the same route family. |
| Identified launch | POST `/launch/v1p1/url/launch` sends the domain in JSON. POST `/launch/v1p1/lp/launch` sends the application ID in the query. Both use a `gws` authorization header. The identified app fixture selects beta from its LaunchPad URI. |
| Activity and close | Each family POSTs activity and close. Activity carries session identifiers, session tokens and rounded-up seconds. The close query carries the session ID and remaining active seconds. All nine requests leave fetch redirect handling at its default and pass no abort signal. Successful close removes the expired tracker. The app expiration path retains a dormant tracker. |
| Acknowledgement and retry | 1,201 ms of activity sends two seconds and leaves a −799 ms elapsed balance after acknowledgement. A 200 non-JSON activity reply leaves elapsed time intact. A 200 object with an empty `sessions` array subtracts the sent time before checking the count. HTTP 503 on close retains an expired tracker and schedules the one-minute retry. |
| Attribution | A successful collector response can save a note for the token's environment and window realm. The fixture stores regular notes locally and incognito notes in session storage. Later identified requests include the note header. Retirement preserves a note for a close request using the old synthetic token until cleanup. |
| Persistence | An exactly 12-hour snapshot restores. An older snapshot, an observed browser startup during hydration, and a storage read rejection leave empty state. With session storage absent, local storage restores the snapshot. Repeated saves share the one-second debounce. |
| Eligibility and UI | The default incognito setting suppresses the fixture tab's reporting. The excluded IP takes precedence over the allowed range. The popup shows the worker's live tracker status and invokes the options action. The options script reflects regular and beta-incognito login status plus a configuration storage change. The input activity script registers six passive capture listeners and reports at most once per 30 seconds in the tested interval. |

## Archives and remaining evidence

The Wayback MCP returned no captures for all 18 credential-free collector
locations, covering nine routes on production and beta. The exact
compatibility feed with the replay's `2026-11-11` date also returned no
captures. `archive-collector.json` retains all 19 responses with exact-match
and digest-collapse options. The earlier `archive-lookups.json` includes
the bare compatibility feed, both local configuration URLs and additional
variants. No captured endpoint body was available for these requests.

Reproduce from the Civil root:

```powershell
node extensions/filter-audit-2026-11-10/analytics-source-closure/inventory.cjs
node extensions/filter-audit-2026-11-10/analytics-source-closure/replay.cjs
```

The replay covers selected lifecycle, failure and page branches. A managed
Chrome profile and authorized ClassLink test tenant are still required to
verify browser permission and policy behavior, actual redirects, endpoint
availability and server acceptance. The signed popup and options scripts
ran against fixture DOM elements. Civil's existing unsupported-checker
state remains appropriate for Analytics+, whose observed API serves
telemetry. [Initial vendor evidence](filter-audit-2026-11-09-new-vendors.md#classlink-analytics-endpoints-and-functional-sso).
