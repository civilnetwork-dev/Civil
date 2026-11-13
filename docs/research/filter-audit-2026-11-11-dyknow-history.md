# Dyknow signed history and publisher archive checks, 11 November 2026

Dyknow Cloud 7.11.5 and 7.11.6 were acquired from Securly's public package
server and authenticated for `ehldjdeaoebgafllfobddbfbfpmammmc`. Both
predate the retained 7.11.38 build by version. Publication dates remain
unverified.

## Acquisition

The earlier HEAD probes yielded HTTP 501 and three sampled older GETs
returned 404. This pass issued a bounded GET for each exact candidate
from 7.11.0 through 7.11.38. Thirty-six returned 404. Versions 7.11.5,
7.11.6 and 7.11.38 returned HTTP 200 and passed Civil's production CRX
publisher and manifest-version checks. The 7.11.38 control matches the
previously retained package.

| Version | Bytes | CRX SHA-256 |
|---|---:|---|
| 7.11.5 | 5,356,440 | `c39f28dd79c2168fded5112eac52aabbc06d2e2b5299b749abfb558f07743148` |
| 7.11.6 | 5,356,441 | `db637853976aa411efb609c94c0e56334b8a82a244dfd0b4b7d181da76d2b933` |
| 7.11.38 | 5,356,986 | `76bd2aacc45650747f2caaf6f9754f9ed03401a0f553addbf85d1430e9c7ecfe` |

`dyknow-version-get.json` retains all 39 receipts. Wayback returned no
captures for the package prefix or the two exact newly acquired CRX URLs.
The version interval was tested against the known public path. Other
release series, delivery channels and publication dates remain open.

## Signed differences and transport replay

All three signed archives contain 310 files with the same paths and
Manifest V3. Their manifest objects differ only in version.
`dyknow-version-diff.json` records per-file hashes and differences.

- **7.11.5 to 7.11.6.** 308 identical files. Besides the manifest version,
  `js/isDebug.js` changes its exported debug flag from true to false.
- **7.11.6 to 7.11.38.** 306 identical files. The four changed files are the
  manifest, README, packaged SignalR tests and
  `js/mjs/lib/jquery.signalR-SW-2.0.2.js`. The six runtime edits change the
  event target from the transport to the connection. The edited lines
  contain no new remote endpoint.

The replay executes the signed SignalR library and its five dependencies
as ES modules in Node. Each module is checked against the corresponding
signed inventory. Fixture WebSocket and EventSource callbacks exercise
the six changed branches without network traffic. The loader supplies
the worker's `self` and navigator fields and keeps dynamic code generation
disabled.

| Branch | 7.11.5 callbacks | 7.11.6 callbacks | 7.11.38 callbacks |
|---|---:|---:|---:|
| WebSocket reconnect opens | 0 | 0 | 1 |
| SSE reconnect opens | 0 | 0 | 1 |
| SSE constructor fails during reconnect | 0 | 0 | 1 |
| SSE reconnect times out | 0 | 0 | 1 |
| SSE reports a closed event | 0 | 0 | 1 |
| SSE reports another error | 0 | 0 | 1 |

Both reconnect-open controls move the connection to connected in every
version. The older builds miss the connection's registered callback.
The packaged event helper indexes listeners by object identity, which
explains the observed difference. These are 18 checked transport cases.
Teacher policy and managed browser behavior still require a test tenant.

REA parsed the 7.11.6 SignalR library, event helper and debug module without
parse failures. The partial graph has parent Evidence
`ev_a3e7f380a406e5692dd3e213ea9dd66e2e94373a60d56497c7b171ee43`.
The cumulative `rea-dyknow-history.json` export has SHA-256
`18a09ce470a09825bce41326c1ab3f70fddfe0a73f387deb3ea7fc9a0ad3c9cc`.

## Offline document comparison

The three builds each ran against the `/newTab` stub and the retained
proxied document from the [catalog probe](filter-audit-2026-11-09-probe.md).
The runner checks all 310 file hashes per build against the authenticated
inventory. All 55 probe source hashes matched the reference run.

All six isolated Bun child processes exited successfully. The documents
retained their expected text, and the probe observed no block, request
cancellation, escaped network request or unhandled rejection during the
250 ms fixture window. The raw verdicts retain the VM rejection-containment
warning. Each child's rejection collector passed its control through one
event-loop turn after teardown, which supports the six assessed results.
The receipt is `dyknow-probe.json`. The fixtures have no managed policy and
leave later background activity unobserved.

## Other publisher archive evidence

Twenty searches across mirror indexes, package prefixes, publisher pages
and exact package URLs returned four capture results and sixteen empty
results. The prior Gopher Premium index failure and Prisma package-prefix
failure now have successful empty responses. Five relevant publisher
bodies returned their requested timestamps.

| Vendor | Verified evidence and limit |
|---|---|
| Prisma | The mirror index and official artifact prefix had no captures in the selected searches. The public upgrade management support matrix excludes the extension from its deployment upgrade feature. The signed 1.8984.0 package remains the sole verified build. [Publisher support matrix](https://docs.paloaltonetworks.com/prisma-browser/administration/manage-prisma-browser-policy-profiles/configure-prisma-browser-browser-customization/configure-upgrade-management) |
| Dyknow | The September 2025 publisher capture distinguishes the legacy self-hosted ID `kmpjlilnemjciohjckjadmgmicoldglf` from the Crextnaut ID authenticated above. The recovered files belong to the Crextnaut ID. [Securly migration capture](https://web.archive.org/web/20250927234948id_/https://support.securly.com/hc/en-us/articles/30561805156119-Filter-How-to-migrate-my-Securly-browser-extensions) |
| Gopher Premium | The July and October 2024 migration captures identify `becdplfalooflanipjoblcmpaekkbbhe` as the Manifest V3 successor and list the separate legacy ID. Neither supplies a versioned CRX. The 2022 product change archive supplies no successor build number. [July migration capture](https://web.archive.org/web/20240722200233id_/https://amplifiedlabs.zendesk.com/hc/en-us/articles/30240623026323-Updating-to-the-Manifest-v3-Version-of-Gopher-Buddy) · [October migration capture](https://web.archive.org/web/20241014234155id_/https://amplifiedlabs.zendesk.com/hc/en-us/articles/30240623026323-Updating-to-the-Manifest-v3-Version-of-Gopher-Buddy) |
| ClassLink Analytics+ | The archived product announcement is dated 18 March 2021. Its body does not establish the exact extension ID or a manifest version. The mirror and ID-only store searches yielded no captures. [Announcement capture](https://web.archive.org/web/20210420071309id_/https://www.classlink.com/news/announcing-analytics-plus) |

## Reproduction

The artifacts are in `extensions/filter-audit-2026-11-11/new-vendor-history/`.
From the Civil root:

```powershell
bun extensions/filter-audit-2026-11-11/new-vendor-history/dyknow-versions.ts
bun extensions/filter-audit-2026-11-11/new-vendor-history/compare-dyknow.ts
node --experimental-vm-modules extensions/filter-audit-2026-11-11/new-vendor-history/dyknow-signalr-replay.cjs
bun extensions/filter-audit-2026-11-11/new-vendor-history/dyknow-probe.ts
```

Only the first command requires network access. The retained receipts and
two historical CRX files support the comparison and replay offline.
