# ClassLink OneClick analytics and package history, 11 November 2026

The signed OneClick 12.7 worker reports app launch, activity and close to
dedicated production and beta hosts. Its normal collector paths support
Civil's two exact analytics host entries. The replay used synthetic app and
launch tokens and served all responses locally.

## Package and source

The retained CRX authenticates publisher ID
`jgfbgkjjlonelmpenhpfeeljjlcgnkpe`, version 12.7, and SHA-256
`bc6468488ea4413c60c41fe80a92542a5a45e1d777a6c60df8be2074fb32287a`.
All 27 files match the signed archive. Wrong-ID and changed-byte controls
reject. The manifest declares a background worker and four all-frame
content scripts, including jQuery and AES dependencies. Its toolbar action
has no popup. The resource declaration exposes `images/*`.

REA parsed all five JavaScript files in its selected analysis.
`rea-evidence.json` includes parent Evidence
`ev_a79f9204ef136bd80496462528c77749f1a60e2464eb6683d45df500e9135e25`
and its summary, with SHA-256
`c0d2a54278aa8f573386902e81dc4d202e9f27a1e304b26c7be9838ea437a631`.
The recovered graph has partial semantic coverage. The local
`source-graph.json` records the five sources, their hashes and syntax
locations. The replay executes the exact signed module 430 factory and the
signed detection script. `analytics-replay.json` records 15 assertion-backed
groups.

## Collector observations

| Path | Observed contract |
|---|---|
| Launch | POST `/launch/v1p0/launch` sends the encoded application ID in the query and `Authorization: gws …`. A 200 JSON object creates a tracker using its `tk` field. A 201 or malformed JSON reply creates no tracker. An empty 200 object creates a tracker with an undefined token. |
| Activity | A 10 ms timer adds elapsed time while its window qualifies. At 300 seconds it POSTs `/activity/v1p0/activity`, with launch token and seconds in the query, and resets the counter. Lock, minimize and inactive-tab fixtures pause the timer. Activation resumes it. |
| Close | A tab removal or top-level typed navigation POSTs `/activity/v1p0/close`. The query carries the launch token and elapsed seconds rounded up. A 200 reply removes the tracker. The matching 400 invalid-token response removes it during activity or close. Other 400 and 503 close replies retain the tracker with its timer stopped. |
| Host and transport | The module keeps a single LaunchPad URI for all trackers. After production and beta launches in the fixture, closing the earlier tracker uses beta. The fetch calls explicitly follow redirects, omit a request body and pass no abort signal. Activity and close omit the launch authorization header. |
| Transport errors | Fetch and body-read rejection log errors. An unresolved launch leaves no tracker and schedules no retry during the observed fixture interval. |
| Detection script | The signed detection script writes its hidden version marker on the tested browser-SSO path. The ordinary-page control has no marker. Civil's separate resource fingerprint has its own browser verification. |

The replay does not navigate to vendor pages, execute SSO task payloads,
or send tenant traffic. The fixture's reply objects establish client-side
handling. Actual redirect chains and server acceptance remain unverified.

## Historical evidence

Six exact collector queries, three per host, returned no captures.
The OneClick download-index retry returned three distinct captures across
both slash spellings, replacing the earlier lookup failure. All three
matching HTML bodies were retrieved with the requested timestamps.
`archive-index-bodies.json` preserves the bodies and the empty result
for the query starting 1 December 2024.

- The January 2022 and August 2022 index captures both list 10.6, 10.5,
  10.3 and 9.7. They attach different dates to 10.6, 14 May 2021 and
  9 February 2022. These are mirror metadata claims. [January capture](https://web.archive.org/web/20220117051749id_/https://chrome-stats.com/d/jgfbgkjjlonelmpenhpfeeljjlcgnkpe/download) · [August capture](https://web.archive.org/web/20220815103735id_/https://chrome-stats.com/d/jgfbgkjjlonelmpenhpfeeljjlcgnkpe/download)
- The February 2023 index adds 10.7 and 10.8. It lists 24 September 2022
  and 3 December 2022, respectively. [February capture](https://web.archive.org/web/20230206004033id_/https://chrome-stats.com/d/jgfbgkjjlonelmpenhpfeeljjlcgnkpe/download)
- The official Chrome Web Store captures contain version metadata for
  8.1.1 on 19 August 2019 and 8.9 on 18 October 2019. They provide dated
  listing evidence for the same extension ID. No version-specific CRX
  link was recovered from either body. [8.1.1 listing](https://web.archive.org/web/20190819230412id_/https://chrome.google.com/webstore/detail/classlink-oneclick-extens/jgfbgkjjlonelmpenhpfeeljjlcgnkpe) · [8.9 listing](https://web.archive.org/web/20191018163739id_/https://chrome.google.com/webstore/detail/classlink-oneclick-extens/jgfbgkjjlonelmpenhpfeeljjlcgnkpe)

The parser identified 19 distinct OneClick package, interstitial, source
and store leads. Wayback returned captures for the store listing and no
captures for the other 18 leads. The two direct public CRX routes for
10.6 and 10.8 returned HTTP 404. An earlier restricted run failed DNS
resolution and has a separate receipt. The new historical evidence is
metadata and HTML. The signed historical package gap remains.

## Reproduction

The source, archive receipts and assertion outputs are under
`extensions/filter-audit-2026-11-10/oneclick-source-closure/`.
Run the following from the Civil root:

```powershell
node extensions/filter-audit-2026-11-10/oneclick-source-closure/prepare.cjs
node extensions/filter-audit-2026-11-10/oneclick-source-closure/analytics-replay.cjs
node extensions/filter-audit-2026-11-10/oneclick-source-closure/archive-leads.cjs
```

`acquire-history.ts` repeats the two public download attempts and saves a
package only after publisher and version verification. Broader SSO task
execution, managed-browser behavior and actual tenant service responses
require separate evidence.
