# Restored signed historical sources and Insight version comparison

Audit date: 1 November 2026, America/Los_Angeles. This continues the
[historical/native restoration](filter-audit-2026-11-01-history-native.md).
The original missing evidence directory remains absent; the sources below were
downloaded again from commit-pinned public GitHub archives and checked afresh.

The subsequent [native WASM follow-up](filter-audit-2026-11-01-insight-wasm.md)
executes both authenticated Insight binaries through selected success/error
and adaptive-payload paths. The static-only scope below records this earlier
comparison, not the current total coverage.

The catalog inventory now contains **54 distinct manifest versions** across
the 28 requested IDs. A separate authenticated Blocksi code subset is excluded
from that count because its mirror manifest contradicts its signed version.
These counts do not establish complete releases, complete source analysis or
the requested 2024–2025 coverage for every ID.

## Reacquired mirrors and exact authentication boundaries

Evidence root: ignored `extensions/filter-audit-2026-11-01/`. The public GitHub
connector supplied commit/tree metadata and Chromium verification sources. It
cannot return binary archives, so the downloads use GitHub's public codeload
endpoint at the exact recorded commits. No vendor extension is installed or
run during acquisition.

| Requested target and pinned source | Signed version | Signed file results | Commit provenance |
|---|---|---|---|
| [FortiClient, Src-Skol/FortiClient](https://github.com/Src-Skol/FortiClient/tree/c0b714d655c63dc78f2daebc95d0be4e9e66f41e) | 1.0.1.0042 | 29 match; none changed or missing. | 2023-02-04; outside the requested age window. |
| [LanSchool Web Helper, BKFighter/lanschool_web_helper](https://github.com/BKFighter/lanschool_web_helper/tree/55ded3ea45dc474461f29e5c6919a1e86ca5b83c) | 8.0.0.1 | 32 match; none changed or missing. | 2016-11-29; outside the requested age window. |
| [Insight, ranleak/ls-insight](https://github.com/ranleak/ls-insight/tree/b4826f8f2908e463f4d769ff1ccb773cecf20d11) | 3.8.4 | 22 match, 8 differ; none missing. | 2026-04-08; supplies another version, not the requested old-period package. |
| [Blocksi, kkilobyte/blocksi-extension](https://github.com/kkilobyte/blocksi-extension/tree/cab525a7842af8faef90751a60eee1f410ff41a5) | 3.4.15 | 63 match, 8 differ; none missing. Mirror manifest says 3.4.4. | 2025-02-02; matching source is anchored within the requested period, but this is not an authentic complete package. |

The four archives' SHA-256 values are:

| Target | GitHub archive SHA-256 |
|---|---|
| FortiClient | `c97c1ffe076b4e3bfc525adcd877bd4949e7ad28697f4e232e857c2c6029c645` |
| LanSchool Web Helper | `9a2b0416adc9a7fd0aa67be013f2fd37d4f430f223bf3fd1339f8ffc70d34bf5` |
| Insight | `4a8515f5808a0ac423c3a4a842ad13d384a1c71c71b75fc198b353bd77625b22` |
| Blocksi | `4d41bd75b8b7f8c1a86b9d91ac6fd0fcdced229c3902b762536a28a0f2839325` |

The Insight differences are its manifest, three environment JSON files and
four enabled-state icons. All selected JavaScript and `client.wasm` match their
signed file roots. The Blocksi differences are its manifest, four locale files
and three icons; reviewed JavaScript/model bytes match. Changed files remain
unchanged in the evidence tree and are excluded from shipped-behavior claims.
No altered manifest was repaired or relabeled as publisher-authentic.

`restored-signed-mirrors.json` gives the summary. Per-target acquisition
receipts preserve archive inventories and every signed file's expected root,
actual root, digest and match status. `signed-metadata/commit-provenance.json`
retains commit/tree IDs and author/committer dates. GitHub commit dates are
snapshot provenance, not independently certified first-release dates.

## Independent Web Store metadata verification

`signed-metadata/verify.cjs` checks the Web Store signature in
`verified_contents.json`, binds the signed extension ID and version, and then
recomputes each listed file's SHA-256 Merkle root. Its implementation follows
Chromium's pinned
[signature parser](https://github.com/chromium/chromium/blob/e8b9ab62bfdc7f3a09cdaa5a69089433e3e5aa2a/extensions/browser/verified_contents.cc),
[tree-hash implementation](https://github.com/chromium/chromium/blob/e8b9ab62bfdc7f3a09cdaa5a69089433e3e5aa2a/extensions/browser/content_hash_tree.cc),
and [public-key constant](https://github.com/chromium/chromium/blob/e8b9ab62bfdc7f3a09cdaa5a69089433e3e5aa2a/extensions/common/constants.cc).

The pinned DER public key's SHA-256 is
`b5e4096227b83f82101fc2aa49f2a251accde3d98471464dd17d1819b43786b0`.
The checked signature uses RS256 over the encoded protected header, a period,
and the encoded payload. File leaves hash the declared blocks; each parent
hashes up to `hash_block_size / 32` child digests until one root remains.

For every directory, negative controls reject an altered signed payload, a
different expected extension ID and a changed file byte. The same verifier
also passes all 23 listed files of current FortiClient 2.0.0.0017 and all 167
listed files of current Blocksi 4.9.16. The Insight comparison additionally
verifies current 3.11.0's selected source against its signed metadata.

This verifies Web Store-signed file content. GitHub's ZIP has no CRX publisher
proof, and a valid file list does not authenticate extra unlisted files,
changed files, remote policy or runtime server replies. The earlier reports'
phrase “publisher-signed metadata” should be read as Web Store-signed metadata
for the verification performed here; CRX publisher proofs are separate.

## Insight 3.8.4 versus 3.11.0: actual activity paths

`lightspeedInsightAgent/history-replay.cjs` refuses to execute a selected file
unless its bytes match the signed file list. It executes the full interaction
script and exact selected `setActivityForTab`/`dropBlockedActivity` functions
with explicit synthetic storage, interval creation, Chrome messaging, DOM/media
listeners, clock and timers. The current `filter-link.js` executes with its
logger import supplied locally. No extension bootstrap or network runs.

The interaction scripts are byte-identical. At both versions, controlled click,
keyup, touchstart, debounced scroll and playing-video events produce messages
containing the observed URL. Two scroll events produce one report; pausing the
synthetic video prevents another playing report. These are supplied events and
media states, not observations of a student's browsing.

The activity comparison covers **14 cases**, seven per version:

| Supplied filter outcome | 3.8.4 selected activity path | 3.11.0 selected activity path |
|---|---|---|
| `{ blocked: true }` | Retains activity; makes no Filter Agent query. | Removes matching activity after the reply. |
| `{ blocked: false }` | Retains activity. | Retains activity. |
| String `"true"` or null reply | Retains activity. | Retains activity; only boolean `true` establishes blocking. |
| Filter absent, timeout, or messenger exception | Retains activity. | Retains activity after the failed lookup. |

The current path sends external action `scoreUrl` to the actual Filter Agent
ID `ehnniokiiebpinnfegpkdlcamgdcaaje`. An additional exact-source cache replay
shows a cached false decision still applies at exactly five minutes; one
millisecond later it queries again and accepts a new true reply. Source uses
`Date.now() > expiry`, which explains that boundary.

These checks establish the selected local behavior, not whether collection is
enabled, which URL a real installation receives, whether a report is later
uploaded, or what a tenant does with it. The privileged content-script and
extension-message paths remain separate from Civil's page-origin request
middleware. No new Civil workaround follows from this comparison alone.

## Signed WASM comparison

The speed-test JavaScript glue is also byte-identical across the two versions.
Its WASM binaries differ:

| Insight version | WASM bytes / SHA-256 | Retained build information |
|---|---|---|
| 3.8.4 | 10,508,842 / `76b83bf75abdec330ff3b625e2f69ce3dd4d9b8e0e7d3dd563c64cc9ca88d530` | Go `go1.24.3`; module `v1.0.5+dirty`. |
| 3.11.0 | 11,043,978 / `78b1150e2d950d7640f90d862971c94ca20afd1bf7de6c29c9a067442b95b0f3` | Go `go1.26.0`; module `v1.0.7+dirty`. |

Both retain the module path
`github.com/Lightspeed-Systems/insight-speedtest/wasm/cmd/speedtest`, named main
wrappers and the pointer receiver `(*SpeedClient).RunSpeedTest`. Both validate
and compile locally, with identical lists of 22 imports and four exports:
`run`, `resume`, `getsp`, `mem`. Neither is instantiated or executed by this
comparison. The Go names are literal binary strings; no source checkout or
upstream tag correspondence was inferred from the `+dirty` build values.

`wasm-history.json` retains import/export lists, hashes, build strings and byte
offsets. This supports the glue's speed-test role and a stable host interface;
it does not prove identical algorithms, all function semantics or the absence
of every possible classifier branch. The earlier static WASM analysis and
remaining internal-function work remain relevant.

## Verification and remaining work

All four mirror signature/file checks, three negative controls per mirror,
14 activity cases, both interaction replays, the cache boundary, and both WASM
validation/compilation checks pass. `signed-metadata/research-receipt.json`
hashes the analysis scripts, primary verification sources and result files.
`git diff --check` passes. This pass changes research documents and ignored
evidence only; it does not repeat the unchanged production test suite.

The 3.7.6 source mentioned in the older core report is still not restored in
this checkout. The retained ranleak repository's manifest history contains
only 3.8.4, so it cannot supply that missing version. Earlier notes are not
treated as a substitute for its missing bytes and receipt.

The five current-channel gaps, additional dated releases, full important-file
coverage, unresolved native/model functions and managed-extension/policy
verification remain open. The original goal remains active.
