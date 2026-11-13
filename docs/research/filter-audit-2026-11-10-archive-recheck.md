# Retained archive lookup recheck, 10 November 2026

After the user enabled the Wayback read tools, this pass retried **20** prior
HTTP(S) archive failures outside the separately handled whole-source and Securly
URL ledgers. Results were **11 empty**, **2 with capture metadata**, and **7
lookup failures**. Neither GoGuardian guard URL remained blocked by approval:
its exact ping URL and the previously derived HTTPS Pusher URL returned no
captures. The literal `wss:` URL remains unsupported by the tool schema.

The useful new lead is a Lightspeed Insight mirror page listing 22 versions.
Its body was retrieved through direct fallback with **`Available: No`**, so its
requested capture timestamp is unverified. No historical package was recovered
or authenticated by this pass, and no vendor API was contacted directly.

## Selection and preserved provenance

`extensions/filter-audit-2026-11-10/archive-recheck/inventory.json` records a
read-only scan of **103** retained archive/Wayback JSON files, with no parse
failures. It found 562 failure rows, excluded 523 rows belonging to the parent
queues, and deduplicated the remainder to 21 URLs: 18 history lookups, the two
GoGuardian HTTP(S) lookups, and one unsupported WebSocket URL. Duplicate rows
retain their original receipt and JSON-pointer provenance.

Every exact URL in `extensions/filter-audit-2026-11-09/all-source-url-ledger.json`
and `securly-3.0.79-urls.json` was excluded, regardless of its current status.
The exclusion snapshots contain the original URL lists and file hashes; they
do not depend on those independently updated ledgers remaining byte-identical.
The 17 earlier failure-receipt files used by this pass were checked unchanged.
The three completed queries in `native-closure/wayback-searches.json` were
reviewed and not repeated. Gateway-dependent templates remain nonconcrete; no
gateway address, tenant or account was invented.

The nine failed mirror-index queries retain their earlier **2024–2025** window,
digest collapse and five-result limit. Trailing-slash feed/artifact candidates
use explicit prefix searches. Other candidates use exact searches; the Google
blob candidate retains its literal CDX wildcard pattern. No more than two
archive calls ran concurrently. All raw query arguments and responses remain
in numbered receipts.

| Prior failure group | Retried | Capture metadata | Empty response | Lookup failure |
|---|---:|---:|---:|---:|
| Mirror download indices | 9 | 1 | 5 | 3 |
| Previously extracted public CRX API routes | 3 | 0 | 3 | 0 |
| Dyknow version prefix and two CRX candidates | 3 | 0 | 0 | 3 |
| Google CRX blob pattern | 1 | 0 | 0 | 1 |
| Securly subscriber prefix | 1 | 1 | 0 | 0 |
| Prisma artifact prefix | 1 | 0 | 1 | 0 |
| GoGuardian HTTP(S) guards | 2 | 0 | 2 | 0 |

Failure responses in this pass were `Failed to search archives: fetch failed`.
They are Wayback/MCP lookup failures, not evidence that the target URL or its
history is absent. No new response was an approval denial. An empty response
means no captures were returned within the recorded query boundary.

## Identity binding

The full IDs are tied to the retained acquisition and manifest files recorded
and hashed in `identity-bindings.json`:

| Full extension ID | Retained manifest name | Retained version |
|---|---|---|
| `jgfbgkjjlonelmpenhpfeeljjlcgnkpe` | ClassLink OneClick Extension | 12.7 |
| `ehnniokiiebpinnfegpkdlcamgdcaaje` | Lightspeed Filter Agent | 4.4.10.1792039522 |
| `njdniclgegijdcdliklgieicanpmcngj` | Lightspeed Insight Agent | 3.11.0 |

The ClassLink acquisition receipt includes verified CRX3 proofs and wrong-ID /
changed-package negative controls. The two older Lightspeed acquisition files
provide the retained package/manifest mapping; this pass did not reauthenticate
their signatures. The recovered mirror uses the same full Insight ID and the
title “Lightspeed Digital Insight Agent.” That title and its historical release
listing remain mirror claims. No relationship to any other Insight, legacy or
successor ID is inferred.

## Recovered body and chronology boundary

The Insight index search returned a
[5 October 2024 capture record](https://web.archive.org/web/20241005101521/https://chrome-stats.com/d/njdniclgegijdcdliklgieicanpmcngj/download).
The body tool instead reported a direct-fallback retrieval at a trailing-slash
archive URL, the requested timestamp `20241005101521`, and **`Available: No`**.
The tool's timestamp field alone does not authenticate the returned body's
historical date. No scripts in that body were executed.

The body contains 22 version/date entries, retained in `body-findings.json`.
Examples of its advertised data are:

| Mirror version claim | Mirror date claim | Advertised ZIP bytes |
|---|---|---:|
| 3.7.6 | 2024-10-02 | 2,213,396 |
| 3.7.5 | 2023-12-05 | 2,237,722 |
| 3.4.0 | 2022-05-10 | 43,335 |
| 2.1.2 | 2020-09-13 | 38,123 |

These are acquisition leads, not observed package sizes or publisher release
dates. The page exposes one concrete public CRX API route for 3.7.6 and 35
version-specific download-page routes: 22 ZIP and 13 CRX. All **36** routes
were queried once through Wayback, with exact URL matching, digest collapse and
a three-result limit: **19 empty**, **17 lookup failures**, **0 captures**.
No arbitrary page links were crawled and no download/account workflow was run.

The Securly subscriber-prefix search returned
[27 September 2025 capture metadata](https://web.archive.org/web/20250927234346/https://crextnaut.securly.com/subscribers/)
with XML MIME type. Body retrieval returned no archived body and `Available: No`;
its archive target contained a doubled trailing slash. A separately searched
no-trailing-slash variant returned empty. Retrying the body with that changed
input produced the single-slash archive target but still no body and
`Available: No`. The XML MIME record does not establish the feed's contents,
package URLs or historical versions.

Earlier historical body fallbacks also remain unchanged: both the Web Helper
and LanSchool Air receipts reported `Available: No`. Their provider timestamp
fields echo the requested timestamps; that does not independently verify the
body dates. `carry-forward.json` records those boundaries without promoting
either to exact-date package evidence.

## Closure, receipts and checks

Across the original retries, newly selected package routes and canonical feed
variant, this pass made **57 unique archive searches**: **31 empty**, **2 with
capture metadata**, **24 lookup failures**, and **0 approval failures**. Three
archived-body reads produced one fallback body with unverified timing and two
unavailable feed bodies. The literal WebSocket rejection is preserved without
another invalid request.

The remaining external blockers are the 24 failed archive lookups, unavailable
feed content, unverified fallback-body chronology and absence of authenticated
historical package bytes from these leads. Archive metadata does not supply
managed policy, native gateway configuration or a vendor API contract.

Ignored evidence is under
`extensions/filter-audit-2026-11-10/archive-recheck/`: `retry-01.json` through
`retry-20.json`, `new-lead-01.json` through `new-lead-36.json`, body and canonical
variant receipts, input inventory, identity bindings, extracted findings and
`summary.json`. Query parameters, original response text, provenance and hashes
are retained. The new-lead runner initialized its raw `elapsedMs` before awaiting
the lookup; those timing values are invalid, preserved in raw receipts and
normalized to `null` in the summary. They do not affect response classification.

Run `node extensions/filter-audit-2026-11-10/archive-recheck/verify.cjs` to check
deduplication, exclusion snapshots, prior receipt stability, identity hashes,
all result classifications, `Available: No` handling and the 60-line function
limit. It passed. `extract-body.cjs` reproduces the inert version/route
extraction; `inventory.cjs` reproduces the initial selection against the retained
files. Running it later may discover additional receipts added by other work.

This pass changed research files only. It did not rerun Chrome, modify the
offline matrices, live-fetch vendor APIs or acquire accounts. The native canvas
replay's [runtime boundary](filter-audit-2026-11-10-goguardian-native-canvas.md)
and the broader historical acquisition requirements remain separate.
