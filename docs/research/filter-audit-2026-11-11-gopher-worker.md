# Gopher Premium worker and popup, 11 November 2026

The signed Gopher Buddy for Chrome Premium 1.0.0.15 worker uses check-in
responses to configure device and account features, and sends session pings to
one Pub/Sub topic. The replay exercised those paths and the signed popup using
synthetic devices, responses and clocks. The session payloads observed here
contain account and device attributes without page URLs. The available package
and replay provide no URL classifier for Civil's Filter Checker.

## Package and entry points

Civil's `verifiedCrxZip` authenticated CRX3 ID
`becdplfalooflanipjoblcmpaekkbbhe` and rejected both a different expected ID
and a changed package byte. The retained CRX SHA-256 is
`453cd6826271de9cbd17d77f54ce70376a97addcd3cf588a33743722401388ff`.
All 55 extracted files match the signed ZIP bytes. `identity.json` records
their digests. This is the retained Premium package, separate from the legacy
Gopher ID and its unavailable exact-ID channel.

The manifest selects module worker `extension-ServiceWorker.js` and action
popup `index.html`. It declares neither content scripts nor web-accessible
resources. The popup loads `polyfills.4cd6ba70674919c9.js`,
`vendor.64632322c015de7b.js`, `main.0d0870735ac9542c.js` and its CSS.
The other retained main/vendor/polyfill combinations are inactive for this
entry point. The worker bundle embeds Chrome strategy adapters, Redux Toolkit,
Immer, RxJS and the application services. Its signed map contains 82 source
entries, including 33 application entries. That map includes a development
environment with a different API host and Pub/Sub project. Runtime requests
and conclusions below use the compiled production environment.

The original worker SHA-256 is
`97c4dfaddd64edd58154731ba77dcee40e6949e51734c012474b485f742db76a`.
REA parsed that file and the active main bundle, totaling 300,523 bytes with
zero parse failures. The retained application graph has partial semantic
coverage. An earlier combined analysis including the popup libraries timed
out. The export attempted after an MCP session reset was empty and remains
in `rea-evidence.json`. The current selected-source bundle `rea-current.json` contains the
analysis and its summary, with SHA-256
`38ff4e14916d04909baae285dd906b478ecaaadf3ce88424931a22c4ece1b5e6`
and parent Evidence
`ev_d7e8ea195462ff196c76e21a5bd05b8fb6c3077f4fc463a91128f87170423b24`.

## Worker replay

`worker.cjs` runs the whole signed worker and its bundled libraries in Node
26.13.0. It inserts one export statement at the outer bootstrap boundary for
state inspection and targeted calls. The service bodies and startup
registrations are preserved. Chrome adapters, time and fetch are fixtures,
and the transport records and answers only the three expected endpoint
locations. Packaged query credentials are redacted from receipts.
`replay.json` contains 29 assertion-backed observation groups.

| Path | Observed contract |
|---|---|
| Startup and alarms | Managed install runs the initial services, registers nine message handlers and starts the session timers. Startup with null directory and serial IDs marks the device `notManaged` and skips managed services. The 30-second fallback initializes a fresh worker and a subsequent tick skips a loaded worker. Only the named alarm advances its stored timestamp. |
| Partial startup | A profile without email interrupts the first service chain before message registration, but the worker still marks itself loaded. The network API error marks private IP as failed while aggregate status stays loading, so this case leaves the device marked managed. |
| Connectivity and version | A fulfilled Google request marks the worker online even on HTTP 503. A rejection or false `navigator.onLine` marks it offline. IPv6 is a fallback for absent IPv4. Browser version uses the Google Chrome high-entropy brand, then the Chrome UA value. |
| Check-in request | GET `/check-in` adds the packaged `apiToken`, domain, device ID and email to the query and sets JSON content type. It concatenates values directly. The fixture's plus sign in email becomes a space when parsed as query data. The request has no explicit deadline or abort signal. |
| Check-in response | The client parses JSON without inspecting status. A JSON HTTP 403 error object produces a successful thunk state with invalid customer status. An HTTP 503 carrying all three true license, authorization and configuration flags produces a valid customer state. An empty object leaves validity unset. JSON null leaves status loading. JSON parse and network rejection mark failure. An unresolved response remains loading across the observed turn. |
| Check-in timing | With a cached response, exactly 60 seconds skips the fetch and leaves the thunk's loading status. At 60 seconds plus 1 ms it sends. A popup resync acknowledges a rejected Redux thunk as successful. Its successful response updates check-in state, while the periodic path copies device, customer, profile and license fields to their other slices. The failed check-in fixture produces one initial request and 15 retries, with delays of 5, 10, 20, 40 and 80 seconds followed by ten 60-second delays. |
| Activity and storage | Locked state suppresses session creation. Active online state requires a valid successful check-in. Active offline state writes a partial ping without account or device ID. Reconnection supplies those fields and preserves the timestamp and ID. A failed storage clear leaves the persisted entry and an in-memory hydrated copy. A later successful hydration adds a duplicate of that ID. |
| Publish request | POST to the exact `gopher-buddy-prod` project and `session-ingest:publish` topic adds the packaged key to the query. The JSON envelope contains Base64 JSON records and user ID, device ID and timestamp attributes. Non-Latin-1 text fails at `btoa` before fetch. Manifest host permissions list Google and the Gopher API host. Actual Chrome delivery to the Pub/Sub host depends on browser and server access conditions. |
| Publish reply and queue | Parsed HTTP 200, parsed HTTP 403 error and a fixture marked as redirected all clear the sent items. The fixture provides the final reply directly. JSON parse and transport failures retain the items in failed state, and a never-settling reply keeps them in loading state. The next timer tick sends neither queue. Once readiness and connectivity have latched true, a queued batch can still be attempted after both state fields turn false. |
| Popup messages and reminders | Worker fixtures exercise all nine messages, unmatched input, cache success and failure, tab failure, remote help, notification buttons and version thresholds. The version comparison uses the major and fourth component. An absent notification timestamp represented by Chrome storage's empty object suppresses the reminder, as does an age of exactly 15 minutes. One additional millisecond allows it. |

## Popup and archive observations

Chrome 157.0.8103.50 rendered the signed HTML, active JavaScript and CSS with
the message API bridged to the replayed worker. Six visible controls sent the
expected messages for fixing the Chrome version, clearing the cache, device
info, FAQ, version recheck and reload. Notification fixtures observed both
cache outcomes. Additional pages exercised the unmanaged and unlicensed
panels, and the loading panel's transition after 180 seconds of virtual time.
All four pages had zero page errors. Each loaded 14 fixture resources and
blocked two external font requests. `popup.json` records the observed UI
states, messages and requests. Resync and remote help have worker replay
coverage. The active popup has a resync method but the tested footer has no
resync control.

The Wayback MCP queried eight credential-free locations with exact matches,
two capture results per request at most, and digest collapse. All eight
returned no captures. Three repeat the production check-in, support and
Pub/Sub paths. Two add support method query variants. Three derive from the
development environment in the shipped map and are marked separately in
`archive-lookups.json`. The earlier archived production root and vendor FAQ
bodies remain in the initial report. Dynamic device/account values and query
credentials were omitted from the archive queries. The local
`chrome://os-settings/help` route has no HTTP archive lookup. [Earlier
archive bodies](filter-audit-2026-11-09-new-vendors.md#evidence-archive-coverage-and-reproduction).

## Reproduction and remaining access

From the Civil root:

```powershell
node extensions/filter-audit-2026-11-10/gopher-source-closure/inventory.cjs
bun extensions/filter-audit-2026-11-10/gopher-source-closure/identity.ts
node extensions/filter-audit-2026-11-10/gopher-source-closure/replay.cjs
node extensions/filter-audit-2026-11-10/gopher-source-closure/popup.cjs
```

The last command uses the retained Playwright Core dependency and installed
Chrome. Its page requests are fulfilled or blocked by the harness. No live
check-in, publish, support navigation, cache removal or Chrome settings action
was performed. Enrollment, CORS, response schemas beyond the tested inputs and
actual policy behavior require an installed managed ChromeOS device and
authorized test tenant. The original popup's third-party library internals and
inactive builds have partial static coverage. The exact existing telemetry
topic rule remains supported by the compiled request path, and the shared
check-in and support host still serves functional traffic. The evidence adds
no tenant API client or filter verdict.
