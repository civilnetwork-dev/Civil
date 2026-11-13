# Historical package acquisition, 9 November 2026

Status: partial. This pass found one additional authenticated Securly build,
refreshed two existing package provenances, and recovered historical version
leads. It did **not** acquire a missing dated 2024–2025 package or resolve the
five exact-ID current-channel gaps. The [remaining requirements](filter-audit-2026-11-01.md#remaining-requirements)
and [earlier provenance boundaries](filter-audit-2026-11-02-provenance.md) remain
applicable. Research date is 9 November in America/Los_Angeles; fresh shell
receipts use 10 November UTC.

All new artifacts are under the ignored
`extensions/filter-audit-2026-11-09/history-closure/` directory. No production
files, credentials, accounts, vendor policy or telemetry endpoints were changed.
Downloaded extension code was not executed by this acquisition pass.

## Authenticated official-feed observations

The retained public Securly update manifest named these package URLs. A fresh
manifest fetch also returned HTTP 200. Publisher authentication uses the
existing `misc/filterProbe/crxSignature.ts::verifiedCrxZip` before `unzipSync`.
Every successful acquisition rejects a changed archive byte and the wrong ID;
the extracted inventory records each file's SHA-256 and verifies the written
bytes. Package identity, acquisition time and publication date remain separate.

| Exact ID / version | Fresh package identity | Disposition |
|---|---|---|
| `ckecmkbnoanpgplccmnoikfmpcdladkc` / Securly **3.0.79** | 2,761,618 bytes; 37 files; SHA-256 `c43192bfb79518326ed4a411447a6b729e9bab6cec0edeb3c552b4c5ef15f898` | Additional build. `securly-3.0.79/acquisition.json`, `package.crx`, `source/`. [Official package](https://crextnaut.securly.com/apps/ckecmkbnoanpgplccmnoikfmpcdladkc/versions/3.0.79/extension.crx) |
| `hkobaiihndnbfhbkmjjfbdimfbdcppdh` / Securly Classroom **2.0.5** | 170,393 bytes; 48 files; SHA-256 `1b45e664674d40a6ef041bbdd5a94672c479cbe4c8aebd418b7ac7013e6b1cf9` | Provenance refresh. Identical digest in `extensions/filter-audit-2026-11-01/securlyClassroom/acquisition.json`; earlier source directory is `latest-2.0.5`. New receipt is `securlyClassroom-2.0.5/acquisition.json`. [Official package](https://crextnaut.securly.com/apps/hkobaiihndnbfhbkmjjfbdimfbdcppdh/versions/2.0.5/extension.crx) |
| `ehldjdeaoebgafllfobddbfbfpmammmc` / Dyknow **7.11.38** | 5,356,986 bytes; 310 files; SHA-256 `76bd2aacc45650747f2caaf6f9754f9ed03401a0f553addbf85d1430e9c7ecfe` | Positive control and provenance refresh. Matches the [new-vendor acquisition](filter-audit-2026-11-09-new-vendors.md). Receipt and inventory in `candidate-receipts.json`; package/source in `dyknow-get-7.11.38/`. [Official package](https://crextnaut.securly.com/apps/ehldjdeaoebgafllfobddbfbfpmammmc/versions/7.11.38/extension.crx) |

The public default feed is
`https://crextnaut.securly.com/subscribers/defaultfrommanifest@securly.com/update-manifest.xml`.
These are observations of that feed and those bytes, not proof of the version
served to every tenant. HTTP `Date`, cache age, version suffixes and download
times do not establish a publication date. Neither new Securly package URL had
captures in its bounded Wayback MCP search.

## Five exact-ID channel gaps

`channel-replies.json` retains fifteen Google update responses: each ID was
requested with ChromeOS 109.0.5414.125, ChromeOS 156.0.8078.74 and Windows
156.0.8078.74. Every response was HTTP 200 with `updatecheck status="noupdate"`.
This establishes only those request outcomes; it does not establish global
retirement, the newest supported version or private-channel availability.

| Target | Exact catalog ID | Retained authenticated version(s), unchanged by this pass |
|---|---|---|
| Cisco Umbrella App | `cpnjigmgeapagmdimmoenaghmhilodfg` | 1.3.23 |
| Cisco Umbrella Extension | `jcdhmojfecjfmbdpchihbeilohgnbdci` | 1.3.4 |
| Legacy ContentKeeper | `jdogphakondfdmcanpapfahkdomaicfa` | 2.1.4 |
| Legacy Gopher Buddy | `cgbbbjmgdpnifijconhamggjehlamcif` | 0.9.8.9, 0.9.9.3 |
| Mobile Guardian | `nglbmaiijljohnphofifiodoommladkj` | 2.2.68 |

Cisco's [legacy-client announcement](https://community.cisco.com/t5/umbrella-announcements/updated-prepare-for-upcoming-changes-umbrella-chromebook-client/ta-p/5191510)
describes support through June 2025 when the prescribed MV2 policy is applied.
That lifecycle statement does not supply a newer legacy-ID package. The earlier
Cisco 2.1.0, 2.1.1 and 2.2.0 dated release leads still lack package bytes.

Gopher's [publisher migration guide](https://amplifiedlabs.zendesk.com/hc/en-us/articles/30240623026323-Updating-to-the-Manifest-v3-Version-of-Gopher-Buddy)
explicitly replaces the old ID with `becdplfalooflanipjoblcmpaekkbbhe`, installed
from the Web Store. The authenticated Premium 1.0.0.15 remains a separate
successor, not a second package channel for the old ID.

Mobile Guardian's [custom-extension guide](https://help.mobileguardian.com/hc/en-us/articles/20568960866844-How-to-add-Mobile-Guardian-Custom-Extension)
requires both the replacement extension ID and custom update URL from the
organization's Mobile Guardian dashboard. It also requires Google Workspace
admin access for deployment. No dashboard or account was accessed. Later
publisher 3.x release notes do not establish identity with the catalog ID.
Legacy ContentKeeper likewise remains a separate ID from the authenticated
generation-three `odoanpnonilogofggaohhkdkdgbhdljp` package; no fresh legacy
distribution URL was established here.

## Public history search across all 33 targets

All 33 direct requests to `https://chrome-stats.com/d/<exact-id>/download`
returned HTTP 403. `index-receipts.json` retains URLs, status, headers, body
hashes and local response files. No account, paid archive entitlement or
access-control bypass was used. Publicly readable Chrome-Stats page text
advertises a limited number of recent versions for free and Pro access for
older versions; that text is an acquisition lead, not publisher authentication.

The same 33 exact URLs were queried through Wayback MCP with
`from=20240101`, `to=20251231`, `collapse=digest`, `limit=5`, at no more than two
concurrent requests. Results: **7 with captures, 17 empty, 9 failed**. The limit
and date window are part of the search boundary. Empty means no captures
returned by that query; failure is not empty and neither proves historical
absence. Each row below describes this new index query, not all available
package evidence for that vendor.

| Target | Wayback index result |
|---|---|
| Aristotle Educator | Empty |
| Aristotle Student | Empty |
| Blocksi | Empty |
| Cisco Security | Empty |
| Cisco Umbrella App | Empty |
| Cisco Umbrella Extension | Capture: 2024-07-24 |
| CKAuthenticator generation three | Empty |
| classroom.cloud | Empty |
| Legacy ContentKeeper | Capture: 2024-08-12 |
| Legacy Gopher Buddy | Capture: 2024-10-06 |
| FortiGuard | Empty |
| GoGuardian | Empty |
| Hāpara Highlights | Empty |
| iboss | Empty |
| Impero | Empty |
| IMTLazarus | Empty |
| InterCLASS | Capture: 2024-06-13 |
| LanSchool Air | Capture: 2025-07-17; body retrieval used fallback |
| LanSchool Student | Failed: fetch failed |
| LanSchool Web Helper | Capture: 2024-08-12; body retrieval used fallback |
| Lightspeed Filter Agent | Failed: fetch failed |
| Lightspeed Insight Agent | Failed: fetch failed |
| Linewize Connect | Empty |
| LoiLo | Failed: fetch failed |
| Mobile Guardian | Failed: fetch failed |
| NetSupport | Capture: 2025-01-16 |
| Securly | Failed: fetch failed |
| Securly Classroom | Failed: fetch failed |
| Prisma Browser | Empty |
| Dyknow Cloud | Empty |
| ClassLink Analytics+ | Empty |
| ClassLink OneClick | Failed: fetch failed |
| Gopher Buddy Premium | Failed: fetch failed |

## Retrieved index bodies and dated leads

Seven raw responses are retained as `archive-body-01.json` through
`archive-body-07.json`. `extract-indexes.cjs` reads serialized data as text,
without evaluating scripts, and writes `archive-index-findings.json`. Its
balanced-field and expected-version assertions passed. Mirror timestamps below
are explicitly secondary index fields, not asserted publisher release dates.

| Body / requested capture | Recovered version leads and boundary |
|---|---|
| [Umbrella Extension, 24 July 2024](https://web.archive.org/web/20240724192934id_/https://chrome-stats.com/d/jcdhmojfecjfmbdpchihbeilohgnbdci/download) | Only `v1.3.4`; index timestamp 2023-07-09. No intermediate version recovered. |
| [ContentKeeper, 12 August 2024](https://web.archive.org/web/20240812113615id_/https://chrome-stats.com/d/jdogphakondfdmcanpapfahkdomaicfa/download) | 2.1.4 timestamp 2022-02-09; 2.1.3 timestamp 2020-09-13. The known 2.1.4 bytes do not become a 2024 release because the index or Web Store was updated in 2024. |
| [Legacy Gopher, 6 October 2024](https://web.archive.org/web/20241006161232id_/https://chrome-stats.com/d/cgbbbjmgdpnifijconhamggjehlamcif/download) | Only 0.9.9.3; index timestamp 2023-08-14. No intermediate package recovered. |
| [InterCLASS, 13 June 2024](https://web.archive.org/web/20240613064826id_/https://chrome-stats.com/d/jbddgjglgkkneonnineaohdhabjbgopi/download) | 6.1.2024.0522 timestamp 2024-05-25; 6.0.2024.0216 timestamp 2024-03-02; 5.3.2023.1025 timestamp 2024-01-23. These are useful 2024 acquisition candidates; all three package bytes remain missing. No date was inferred from their version suffixes. |
| [Web Helper, requested 12 August 2024](https://web.archive.org/web/20240812103043id_/https://chrome-stats.com/d/honjcnefekfnompampcpmcdadibmjhlk/download/) | 9.2.0.2 timestamp 2024-08-09; 8.0.2.6 timestamp 2022-02-09; 8.0.2.5 timestamp 2020-09-13. Provider reported `Available: No` and direct-URL fallback, so the observed body's exact capture time is unresolved. |
| [LanSchool Air, requested 17 July 2025](https://web.archive.org/web/20250717161924id_/https://chrome-stats.com/d/baleiojnjpgeojohhhfbichcodgljmnj/download/) | Eighteen version records, including 2.25.0.17802, 2.25.0.18920, 2.25.0.19516, 2.25.0.19642 and 2.25.0.20020. Provider used the same unavailable/fallback path; do not treat the requested timestamp as independently confirmed body time. Full list remains in the findings JSON. |
| [NetSupport, 16 January 2025](https://web.archive.org/web/20250116090003id_/https://chrome-stats.com/d/gcjpefhffmcgplgklffgbebganmhffje/download) | 15.0.0 timestamp 2023-07-03 and nine older entries; no 2024–2025 package recovered. The separately documented 15.0.1.0 and 15.0.2.0 leads remain open. |

LanSchool's [own release notes](https://helpdesk.lanschoolair.com/portal/en/kb/articles/lanschool-air-release-notes)
independently list 2.25.0.17802 under 6 May 2024, 2.25.0.19516 under
21 January 2025, 2.25.0.19642 under 3 February 2025 and 2.25.0.20020 under
14 April 2025. These provide primary dated targets for future package
acquisition. The authenticated cached 2.25.0.20424 is listed under 21 July 2025;
that establishes its presence in that release-note entry, not its first
publication date. The mirror's 2025-05-27 timestamp for the same version remains
a separate, weaker field. Product release notes and package publication need
not use the same date.

Five public CRX API URLs were extracted from the archived page data, for
Umbrella Extension, ContentKeeper, legacy Gopher, InterCLASS and Web Helper.
All five now return HTTP 404; no bytes were extracted. Their exact URLs and
responses are in `public-candidates.json` and `candidate-receipts.json`.
Wayback returned no captures for two and lookup failures for three. Older page
routes are not proof of a working present-day download API.

## New-vendor history and access boundaries

- **Prisma Browser:** the authenticated public stable-feed 1.8984.0 remains the
  only acquired version for its exact ID. The feed's Wayback query was empty;
  the artifact-prefix query failed with HTTP 503. No dated older extension
  version or package URL was established. A publisher-supplied archive, archived
  update manifest or authorized retained signed package is still needed.
- **Dyknow:** 7.11.0 through 7.11.37 HEAD probes all returned HTTP 501 and are
  inconclusive. Changed-method GETs for 7.11.0, 7.11.20 and 7.11.37 returned
  HTTP 404; the 7.11.38 GET control succeeded and authenticated. This bounded
  candidate check is not a complete version history. The publisher's
  [installation guide](https://support.securly.com/hc/en-us/articles/27567772885399-Reveal-Installing-Reveal-Cloud-Connector-on-student-Chromebook-devices)
  specifies a customer installation URL containing the organization's FID and
  asks administrators to confirm it with Securly. No tenant URL or FID was
  obtained. A live request to the public release-note section redirected to
  Securly sign-in; search-cached text is not a fresh authenticated body.
  The [11 November follow-up](filter-audit-2026-11-11-dyknow-history.md)
  completed the GET matrix and authenticated 7.11.5 and 7.11.6. Thirty-six
  other older candidates returned 404. The 7.11.38 control matched.
- **Gopher Premium:** 1.0.0.15 remains the sole authenticated successor build.
  Its index archive query failed. Its earlier delivery `Last-Modified` date is
  artifact metadata, not a newly established publisher release date.
- **ClassLink Analytics+:** 0.6.6 remains the only authenticated build. No
  historical index captures returned within the selected window.
- **ClassLink OneClick:** public mirror indices advertise 12.5 with a
  2024-12-17 timestamp and additional older versions. No corresponding signed
  package was acquired. A [pinned GitHub mirror](https://github.com/Fwoofie/classlink-oneclick/tree/dfd357e78d5b5aa17c36192e1e441dd72d47bbea)
  has manifest version 10.8, but its returned tree inventory contains neither
  a CRX nor signed `_metadata`. Its publisher identity and unchanged-file
  integrity are unverified, so it is excluded from authenticated counts.
  The [11 November follow-up](filter-audit-2026-11-11-oneclick.md#historical-evidence)
  recovered three older index bodies and two official store listings. The
  10.6 and 10.8 direct CRX attempts returned 404.

The [12 November storefront follow-up](filter-audit-2026-11-12-storefront-history.md)
confirms archived listing metadata for Analytics+ 0.6.2 and
OneClick 10.8, 12.2, 12.3 and 12.5, and dates the known Gopher Premium
1.0.0.15 listing. Nine additional candidate package URLs returned 404.

GitHub code searches were bounded to ten results for each of the InterCLASS
ID, exact version 6.1.2024.0522 and OneClick ID. The exact InterCLASS version
query returned no results. ID searches primarily returned metadata or
extension-ID lists; only the OneClick source mirror above was inventoried.
Search results and a repository's own attribution do not authenticate packages.

## Evidence and reproduction

`archive-search-ledger.json` joins **51 Wayback searches**: 7 with captures,
26 empty, 18 failed. Besides the 33 indices, these cover selected update feeds,
artifact prefixes, newly acquired package URLs, the five discovered mirror
download routes, three Dyknow candidates and two pinned mirror resources.
HTTP 503, 30-second timeout and `fetch failed` outcomes remain explicit.
`archive-index-*.json`, `archive-followup-*.json`, `archive-initial.json`,
`archive-package-results.json`, `archive-feeds.json` and
`archive-oneclick-mirror.json` retain the original tool responses. No failed
query was retried blindly or reclassified as an empty history.

Run from the repository root:

```powershell
bun extensions/filter-audit-2026-11-09/history-closure/collect.ts packages
bun extensions/filter-audit-2026-11-09/history-closure/collect.ts channels
bun extensions/filter-audit-2026-11-09/history-closure/collect.ts indexes
bun extensions/filter-audit-2026-11-09/history-closure/collect.ts dyknow
bun extensions/filter-audit-2026-11-09/history-closure/collect.ts candidates
node extensions/filter-audit-2026-11-09/history-closure/extract-indexes.cjs
```

Network commands require network access and write fresh local receipts; retain
this run before repeating them. Initial sandbox DNS failures were followed by
authorized network-enabled requests. The archive index query is reproducible
with `search_archives({url, from:"20240101", to:"20251231", collapse:"digest",
limit:5})`; raw body retrieval uses each recorded timestamp and `modifier:"id_"`.
Other selected URL searches have no date filter and use bounded digest-distinct
pages. None establishes exhaustive archive coverage.

Cryptographic negative controls, extracted-byte checks and the index parser's
self-checks passed. No broad product suite, installed-extension runtime,
managed policy, tenant classifier or publication-date verification was performed
for this research-only change. Remaining work is actual authenticated dated
package acquisition and the authorized managed-environment validation already
named by the earlier reports.
