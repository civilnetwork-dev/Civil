# Securly 3.0.79 follow-up, 10 November 2026

The official-feed acquisition in the [history audit](filter-audit-2026-11-09-history.md)
adds publisher-authenticated Securly **3.0.79**, extension ID
`ckecmkbnoanpgplccmnoikfmpcdladkc`. This pass compares that package with retained
3.0.76, executes selected changed helpers, and runs both existing document
fixtures through the current offline probe. No production classifier changed.

## Identity and comparison

The retained CRX SHA-256 is
`c43192bfb79518326ed4a411447a6b729e9bab6cec0edeb3c552b4c5ef15f898`.
The acquisition evidence includes the expected-ID publisher proof and negative
wrong-ID/tamper controls. It does not establish a historical publication date.

Only `manifest.json` and `securly.min.js` differ across the 37-file packages.
The manifest changes only `version`; its permissions and worker entry remain
unchanged. The other 35 retained files are byte-identical. Worker SHA-256 values:

| Version | Worker SHA-256 |
|---|---|
| 3.0.76 | `bc776e5b04fe3c07b01103ca86a0b03d4e5f364023dcf56d632b6ea484b5a96b` |
| 3.0.79 | `c8aa289496aacfbe43d18c14d695f838a2b2c45dddbf9b5134f1f24a3a1e7707` |

The comparison normalizes local binding names within isolated named definitions.
It finds changed `UserCluster`, `Utils`, and
`onBeforeRequestListenerSyncCases` definitions. `Broker`, `Police`, and the other
paired named definitions are unchanged under that normalization. This is not a
proof of whole-program or cloud-protocol equivalence.

Matched REA source graphs are
`ev_be02d8bee9772a2b515d1698c882f4a454d4c78038b04c06d99f5a3b0a44fcc5`
and `ev_8c4478ddfc040a486ce15d11605d369cee3620308cced5b0dd7e8fc311b0fe90`.
Comparison Evidence is
`ev_9a1a1aff4bfadc8677b8d69d8ed83e868c7428e9a342976520dec2413c980938`.
The selected scope parses four JavaScript files per version without a parse
failure; both application graphs remain incomplete. Unmatched observations are
unknown, not fuzzy matches. The independent CRX proof supplies package identity.

## Controlled source execution

The exact `ENCRYPT` helper matches on **14 supplied values per version**, including
UTF-8, CR/LF, non-BMP text, a 65-character string and invalid input types. The peer
predicate runs on **90 supplied combinations per version**; 20 outcomes differ.
OS, browser and peer presence are explicit input oracles. Other client labels
exercise shared source arms; this distribution fixes `clientName` to
`chromebook`. No installed peer or managed policy is established.

An additional **86 passing checks** execute selected signed worker source:

- Cookie domains now match configured cluster/check/Go hosts, with domain-cookie
  suffix matching and exact host-only matching. Unrelated hosts remain untouched
  in the fixtures. The expanded allowlist preserves named session, parent,
  support and SSO cookies. Removal uses the cookie's own secure flag and path;
  `clearBlob` removes a leading domain dot when constructing its URL.
- AI-mode cookies require the string `"1"`. The worker emits five Google/Bing
  rules with priorities 3, 2, 1, 3 and 1. It raises an existing Gmail rule below
  priority 4 while preserving that rule's action and condition. Update errors
  prevent the fixture's tab reload. These are emitted-rule observations, not
  Chrome enforcement tests.
- The Bing helper accepts path prefixes, including `/searching`; its behavior is
  broader than an exact `/search` path. Edge detection is the literal `Edg/`
  user-agent check.
- The synchronous handler removes the older plain-substring
  `blockXhrRequests` cancellation loop. Securly bypass and YouTube defer branches
  remain on the tested inputs. This does not establish an allowed navigation:
  asynchronous broker handling and DNR can still act separately.

Chrome cookies, DNR and tabs are recording mocks. Pass-cookie validity, the Go
endpoint, domain checking and the Google-tab helper are declared oracles. Source
ranges and hashes identify the executed method bodies. No cookies, browser tabs,
vendor service or tenant account were changed.

## Probe and URL evidence

The [existing probe runner](filter-audit-2026-11-09-probe.md) observes 3.0.79 on
both its stub and retained service-worker document. Both assessed observations
show no block signal, retain the page marker and have no escaped-network call.
Both rejection-collector controls pass. All **55** runtime/configuration hashes
remain stable across this follow-up.

Raw Bun observations still report unavailable per-VM detached-rejection
containment. The runner's separately proved process collector permits only the
bounded assessment described in the probe report. These two rows supplement the
original 61-build matrices; they do not rewrite those receipts or establish
managed-browser allow verdicts.

AST scanning finds 37 HTTP(S) literal candidates, with no additions compared with
3.0.76. Five are prefixes or glob patterns. The other 32 have exact Wayback MCP
attempts. The first receipt records 20 capture results, nine empty results and
three approval-review failures. After the user authorized archive-read tools,
all three retries succeeded. The final ledger has **22 capture results, ten
empty results and five patterns/prefixes**. Review failures remain in their
original receipt and are not empty searches. No archived policy body or live
vendor response is inferred from a capture index.

## Receipts and reproduction

Evidence remains under ignored `extensions/filter-audit-2026-11-09/`:
`history-closure/securly-3.0.79/`, `securly-3.0.79-file-delta.json`,
`securly-3.0.79-worker-delta.json`, `securly-3.0.79-replay.json`,
`securly-3.0.79-probe.json`, `securly-3.0.79-urls.json`,
`securly-3.0.79-wayback.json`, `securly-3.0.79-wayback-retry.json`, and the cumulative
`rea-securly-3.0.79-comparison.json` export. Signed inputs remain unmodified;
formatted reading copies are separate.

```sh
bun extensions/filter-audit-2026-11-09/compare-securly-worker.cjs
bun extensions/filter-audit-2026-11-09/replay-securly-379.cjs
bun extensions/filter-audit-2026-11-09/run-securly-379-probe.cjs
bun extensions/filter-audit-2026-11-09/join-securly-url-retry.cjs
```

All four checks passed. Authored replay functions remain within 60 lines. The
unchanged production suite was not repeated for this evidence-only follow-up.
Real Chrome rule arbitration, peer handoff, tenant policy, identity and server
acceptance require the corresponding installed and authorized environments.
