# Filter integration and verification, 9 November 2026

Implementation is verified below. The wider reverse-engineering goal remains
active: unavailable historical packages, incomplete dependency/native semantics
and managed-browser evidence are not established by passing product tests.

## Product changes

- Added the five authenticated extension identities to acquisition and probe
  catalogs. CRX publisher signatures and expected IDs are checked before
  extraction; traversal and malformed manifests do not create a valid cache.
- Prisma and OneClick use declared accessible resource fingerprints. Dyknow,
  Gopher Premium and Analytics+ have no invented resource fingerprint.
- Unsupported extensions use the existing “Can't check … yet” message.
  Placeholder checker routes were removed. Manual choices include mapped
  extensions, with the same message for unsupported selections. Detection
  storage keeps its automatically observed values. Submission requires a
  supported selection, which also prevents an empty Results table.
- Middleware adds dedicated analytics/classification hosts, Dyknow's block
  destination and the exact Gopher Pub/Sub topic POST. ClassLink authentication,
  Gopher inventory/support and unrelated Pub/Sub traffic remain available.
  This middleware examines incoming Host/path only; it does not intercept an
  installed extension's independent outbound requests.
- Added optional registered ClassLink OIDC sign-in and explicit linking using
  Better Auth. Signed claims or subject-bound discovered UserInfo supply email.
  Implicit linking is disabled, existing Civil email is preserved, and anonymous
  conversion preserves visits and bans. [Deployment and security contract](../classlink-auth.md).
- ClassLink setup/settings controls reuse existing styling. When unavailable,
  the row, button, description, Settings Account tablet and navigation entry
  are absent, including for an existing linked session. Disabling configuration
  does not delete that session. Configured account-load errors stay visible and
  prevent ambiguous sign-in/link actions.
- Request replay now executes eligible synchronous main-frame blocking hooks.
  Startup, callback and detached rejection failures remain incomplete. Module
  imports stay within the owning extension. [Coverage and receipts](filter-audit-2026-11-09-probe.md).

## Verification

| Check | Observed result |
|---|---|
| `bun run test` | 1,011 passed, one skipped, 98 files after the capability and manual-selection corrections |
| `bunx tsc --noEmit` | Passed |
| `bun run audit` | Lint, formatting and dead-code checks passed |
| Fallow health, minimum 100 | 100, all penalties zero |
| `bun run build:configs` | Passed; existing mime top-level-this warning |
| `bun run build` | Passed, including production SSR output |
| `git diff --check` | Passed |
| Native Chrome 156 UI | Setup, Settings and Filter Checker checked at 1366×768 and 390×844; no page errors |
| Retained artifact verifier | All five actual CRX packages passed the production signature/ID verifier |
| Native resource detection | Chrome 156 detects Prisma and OneClick through Civil's actual helper and denies their private fixture resources |
| Offline catalog, two inputs | 61 builds per input, 55 stable runtime/configuration hashes and four assessed incomplete rows after the Prisma capability correction |

Tests cover configured and disabled ClassLink, signed mock OAuth success and
failure, state/nonce/signature/issuer/audience rejection, missing email, bounded
UserInfo errors, explicit different-email linking, anonymous conversion, framed
navigation and local sign-out. No live registered ClassLink client was available.

The initial retained five-vendor research performed 116 exact Wayback queries:
75 found captures, 40 returned none and one failed with HTTP 403. Five relevant
bodies were inspected. The [vendor report](filter-audit-2026-11-09-new-vendors.md)
defines the selected-source URL ledger and does not claim whole-archive coverage.
The [native report](filter-audit-2026-11-09-native.md) closes finite calling,
verification, codec and model-gate fixtures while retaining its unresolved paths.

A subsequent lexical expansion of the five new targets scans 834 retained readable/source-map/native
files totaling 96,024,310 bytes, including unused libraries and decoded Prisma
worker text. `extensions/filter-audit-2026-11-09/all-source-url-ledger.json`
initially retained 1,388 unique candidates and file hashes. After the first expanded Wayback
batch, 100 have captures, 45 returned none, three lookups failed, 59 are patterns
or incomplete prefixes, and 1,181 remain pending. These are candidate counts,
not reachable API counts. New receipt `archive-expanded-001.json` is joined by
`join-expanded-archives.cjs`; subsequent batches must select the first remaining
pending URLs rather than applying an offset to the shortened pending queue.

The [diagnostic follow-up](filter-audit-2026-11-09-diagnostics.md) adds 31 Dyknow
client replays and ten active-worker message cases. It confirms preservation of
the diagnostic/support host and documents the broader analyzer's partial timeout.
Later archive counts are in the live ledger and its numbered receipts; the
initial expansion counts above are retained as a dated progress observation.

The [10 November Securly follow-up](filter-audit-2026-11-10-securly.md)
authenticates 3.0.79, compares it with 3.0.76, and adds 86 changed-helper checks
and two bounded document probes. All 32 concrete Securly URL lookups now have
archive responses. No classifier change follows from those fixture results.

The [native Chrome follow-up](filter-audit-2026-11-10-goguardian-native-canvas.md)
runs both full GoGuardian workers past their canvas startup barrier under
explicit Chrome API mocks. Eight native image conversions pass. The Node/Bun
matrix still lacks that graphics capability; these are separate observations.

The [report-cipher follow-up](filter-audit-2026-11-10-native-report-cipher.md)
verifies 24 reports from untouched current/cached Filter Agent WASM, including
clock and encoding cases. It derives the tested keys from shipped initialized
bytes and public time claims, verifies HS256, and authenticates AES-256-GCM.
Four integrity mutations reject. Earlier fixed-key assumptions remain recorded
as failed checks; cloud report acceptance and the complete native API remain
outside those results.

The expanded URL ledger has 1,389 candidates, including the composed Dyknow
`RequestLogs` route. After the user enabled Wayback archive reads, receipts
`archive-expanded-045.json` through `archive-expanded-061.json` recorded 515
retries. The joined ledger has 1,149 capture results, 137 empty results, 44
lookup failures, and 59 prefixes or patterns without an exact URL to query.
Every concrete candidate received an archive response or a lookup error. The
44 outstanding failures report HTTP 403 or `fetch failed`. Earlier tool approval
failures remain in their original receipts.

The [separate archive recheck](filter-audit-2026-11-10-archive-recheck.md) covers
57 distinct HTTP(S) URLs outside that ledger and the Securly follow-up. It
records 31 empty results, two capture records and 24 lookup failures. An Insight
mirror body supplies version leads with unverified capture chronology. It
yielded no signed historical package.

The [Dyknow active-source audit](filter-audit-2026-11-10-dyknow-active-closure.md)
verifies 310 package files and maps 109 conditionally reachable JavaScript
sources. REA completes 107 source analyses and times out on two libraries.
Twenty new replay groups and two RequireJS loader checks pass. The packaged
authentication pages request a missing `amd/sandbox` module, and malformed
satellite attachment replies can leave the outer promise pending.

The [LanSchool producer replay](filter-audit-2026-11-10-lanschool-native-contract.md)
translates selected original LLVM bodies to Wasm and passes 15 checks. Twelve
messages reach the expected shipped Student JavaScript handlers. Installed
Pepper and native packet dispatch remain untested.

The [Prisma capability correction](filter-audit-2026-11-09-probe.md#prisma-capability-correction-10-november)
traces the earlier rejection to the Chrome fixture advertising the private
`chrome.talon` namespace. Eight selected preference-helper cases pass. Both
61-build replays now show 57 no-block observations and four incomplete rows.
Only the Prisma assessed verdict changes. Managed Prisma behavior remains
unverified.

The [resource detection replay](filter-audit-2026-11-10-resource-detection.md)
loads inert manifests using authenticated keys and fingerprint bytes into Chrome
156. Civil's actual helper returns exactly the two expected keys. Both positive
resources match their retained hashes, and both private resource controls fail.

The [Dyknow lifecycle follow-up](filter-audit-2026-11-10-dyknow-lifecycle.md)
adds 27 lifecycle groups and two worker-entry replays covering saved-session
recovery, QSR expiry, activity windows and uploads. Source hashes match the
authenticated package. Transport, clocks and Chrome adapters are explicit
fixtures. The observed queue-loss and startup-stall behaviors remain in the
owning report.

The [Gopher worker and popup follow-up](filter-audit-2026-11-11-gopher-worker.md)
reauthenticates all 55 package files. It adds 29 whole-worker replay groups and
native Chrome coverage of six popup controls and three additional panel
states. The worker treats a parsed Pub/Sub error as a successful publish and
removes the queued batch. Network rejection keeps the batch queued without an
automatic retry in the observed state. Eight exact archive queries returned
no captures. Managed device and tenant behavior remain open.

The [Analytics+ follow-up](filter-audit-2026-11-11-analytics-plus.md) verifies
all 28 package files and runs the signed worker, popup, options and input
activity scripts with fixtures. Nineteen replay groups cover the three
collector lifecycles, configuration, eligibility, storage and failures.
Nineteen exact Wayback searches returned no captures. Managed Chrome and
server acceptance remain unverified.

The [Prisma offscreen follow-up](filter-audit-2026-11-11-prisma-offscreen.md)
reauthenticates all 498 package files and maps the scripts for all 16 HTML
pages. Chrome runs the signed offscreen document through ten requests for
codec capability, image conversion, synthetic password scoring and
geolocation. Thirteen additional cases cover iframe reuse and removal,
ICE completion and timeout, and the Atlas detection branches. Both replays
use signed local assets and fixture inputs. Other services and managed
native companions are still unverified.

The [OneClick analytics and history follow-up](filter-audit-2026-11-11-oneclick.md)
verifies all 27 signed files and 15 fixture groups. Six collector locations
returned no Wayback captures. Three mirror bodies yielded six older version
leads, and two archived Chrome Web Store listings confirm versions 8.1.1
and 8.9. Both direct historical CRX routes returned 404.

The [Dyknow history follow-up](filter-audit-2026-11-11-dyknow-history.md)
acquires and authenticates 7.11.5 and 7.11.6. Comparing them with 7.11.38
isolates the debug flag change and six SignalR event-target changes.
Eighteen replay cases confirm the callback behavior. Six supplemental
offline document probes observed no block across the three builds.
Publisher captures also date the Gopher Premium successor identity and
corroborate the Dyknow migration boundary.

The [Dyknow compression follow-up](filter-audit-2026-11-10-dyknow-lifecycle.md#unbundled-compression-in-chrome)
checks identical signed Pako bytes across those three builds and confirms
eight matching results in Chrome's document and dedicated module worker.

The [Dyknow IndexedDB follow-up](filter-audit-2026-11-10-dyknow-lifecycle.md#native-indexeddb-in-chrome)
checks startup, reload persistence, a blocked upgrade, and the unsettled
startup promise after a native version error.

The [Cisco peer startup replay](filter-audit-2026-11-09-probe.md#cisco-umbrella-peer-startup)
reproduces the legacy app's rejection without its companion. The signed
peer completes startup with both registration fixtures. The single-extension
catalog receipt still records the missing-peer error.

The [storefront history follow-up](filter-audit-2026-11-12-storefront-history.md)
records seven archived Google listings for Gopher Premium and both
ClassLink extensions. The nine candidate package downloads returned 404.

The [ClassLink deployment follow-up](../classlink-auth.md#user-and-account-behavior)
checks the canonical HTTPS origin when Civil's configured reverse proxy
terminates TLS. Capability and signed mock OAuth regressions pass, as does
a loopback check through the Hono Node adapter. The refreshed suite reports
1,013 passed and one skipped. Type checking, lint, formatting, configuration
bundles and the production build pass.

The final manual-picker UI check uses normal Vite page entrypoints in Chrome
156 at 1366×768 and 390×844. Unsupported selections retain their messages,
submit no classifier requests and leave detection storage intact. The disabled
check action produces no empty Results table. Settings hides its unavailable
ClassLink section, navigation entry and sign-in button. Both screen sizes have
zero page errors and horizontal overflow. The test's disabled-auth responses
are local fixtures. Evidence is in
`extensions/filter-audit-2026-11-10/manual-filter-ui/browser-replay.json` and the
two corresponding screenshots. A first test fixture matched frontend source
imports as API requests. Restricting it to origin-root `/api/` paths fixed the
test harness. Final configuration and production build logs are retained under
`extensions/filter-audit-2026-11-10/`.

## Completion audit and remaining work

The corrections to the checker and unavailable-account UI are complete. The
following broader goal requirements remain open and must not be inferred from
the checks above:

- Reconstruct the remaining worker/dependency and native packet paths identified
  in the owning vendor reports. The selected report-cipher/key branches now have
  the separate original-module evidence linked above.
- Acquire and authenticate the missing dated/intermediate and exact-ID current
  releases, or retain concrete acquisition failures and their access conditions.
- Extend URL discovery beyond the selected-source ledger; query newly found
  concrete targets through Wayback and characterize any API before adding a
  client for it. No new tenant classifier client is introduced by this change.
- Resolve the four incomplete Node/Bun rows with the appropriate peer,
  graphics environment or configuration. The native Chrome follow-up covers
  the selected GoGuardian graphics path under fixtures. The Cisco startup
  replay covers peer acknowledgements under fixtures. Managed-browser
  policy decisions require an installed and configured environment.
- Validate actual installed-extension enforcement, native companions, a complete
  Unix Wisp/backend deployment and registered ClassLink consent/callback behavior
  when those environments are available.

Existing worktree changes were preserved. No deployment, registration, database
migration, commit or vendor-account action was performed.
