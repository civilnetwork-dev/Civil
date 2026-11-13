# Securly Classroom web-rule updates, 3 November 2026

This pass compares navigation policy in three Securly Classroom releases for extension ID `hkobaiihndnbfhbkmjjfbdimfbdcppdh`. It uses the retained signed packages from the [historical recovery](filter-audit-2026-11-01-history-native.md) and the [earlier source audit](filter-audit-2026-10-30-core.md). The 1.32.0 bytes match a tree present on 4 March 2025. That date establishes a historical baseline, with the first release date still unknown.

| Version | Retained CRX SHA-256 | Shipped entry points exercised |
|---|---|---|
| 1.32.0 | `6114f7e639289ae8721a01cdb69a09fe40a1a5613f969b18727de6cbb1363acb` | MV2 `background.js`: `ks`, `Cs`, `As`, `Is` |
| 1.36.1 | `a75e79a7f479acabb43ab696a58b56303857a0d45f33ac35b6fe0767e8443294` | MV3 `background.js`: `Hn`, `qn`, `Jn`, `zn` |
| 2.0.5 | `1b45e664674d40a6ef041bbdd5a94672c479cbe4c8aebd418b7ac7013e6b1cf9` | MV3 `background.js`: `Sn`, `Cn`, `Un`, `Ln` |

## MV2 evaluates the request URL in JavaScript

In 1.32.0, `webRequest.onBeforeRequest` registers `ks` for blocking main-frame requests. `ks` calls `Cs`, which selects the allowlist or block-list branch, returns a `blocking/block.html` redirect when the rule rejects the URL, and logs the blocked URL. The replay exercises the block-list branch with course lock and allowlist inactive.

- `As` drops the query for ordinary URLs. The same query pattern blocked a YouTube URL in replay because the function keeps the query when the input contains `youtube.com`.
- The block-list branch uses `Ae.orgBlocklist || Ae.blockingPlanUrls && !Ae.blockingPlanType === re`. The negation runs before strict equality and compares a boolean with the string `"Allow_only"`. With a teacher-only plan and a null organization list, the replay allowed the test URL. With the same teacher plan and an empty organization array, the branch ran and redirected the test URL.

These results describe the shipped request handler given the supplied policy objects. The replay does not establish how often the service sends either organization-list state.

## MV3 replaces browser rules

In 1.36.1, `Hn` compiles organization and teacher block rules through `qn`, then `Jn` replaces the current dynamic rules. The same sequence appears as `Sn`, `Cn` and `Un` in 2.0.5. Both compilers put the complete supplied expression into `condition.regexFilter` on a main-frame redirect rule. A query-sensitive teacher pattern reached the update payload unchanged in both versions. This replay inspects the rule payload, with browser URL matching outside its scope.

Both compilers assign an ID from the pattern's original array index plus a caller-supplied offset and one. Unsupported regexes are skipped. For teacher rules, the offset is the count of surviving organization rules. If an unsupported organization regex precedes a supported one, the two ID ranges can overlap. Each MV3 version produced the following updates from its shipped code with one valid teacher pattern.

| Organization patterns | Proposed rule IDs | Result in the Chrome API model |
|---|---|---|
| Supported | `[1, 2]` | Previous rule removed and new rules installed |
| Unsupported, supported | `[2, 2]` | Update rejected and previous rule retained |
| Supported, unsupported | `[1, 2]` | Previous rule removed and new rules installed |
| Unsupported | `[1]` | Previous rule removed and teacher rule installed |

Chrome documents duplicate IDs as a rejection condition and rule replacement as atomic. In the replay, both workers logged the rejection and kept their previous rule count. If an installed browser encounters the same rejected update, its old policy can remain active after a policy change. This is a stale rule explanation for an unexpected redirect, with no evidence that the URL was reclassified as a proxy. [Chrome dynamic rule update contract](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest/#method-updateDynamicRules)

Civil's offline host previously removed the old rule and added the first replacement before it rejected the duplicate. It now stages additions before changing the active map. Regression tests reproduce the duplicate sequence for both dynamic and session rules and verify that rejection keeps the original rule while a valid same-ID replacement succeeds.

## Reproduction

The replay extracts exact declarations and rule templates from the packaged backgrounds, records their source offsets and SHA-256 values, and executes them in isolated JavaScript contexts. All **13** assertions by case passed across the three versions. The Chrome API model stubs one unsupported regex and rejects duplicate rule IDs atomically. No extension startup, teacher service, managed-browser policy, or real Chrome rule matching was exercised.

The script and receipt are under the ignored `extensions/filter-audit-2026-11-03/securly-classroom/` directory. Run `node extensions/filter-audit-2026-11-03/securly-classroom/replay.cjs`.
