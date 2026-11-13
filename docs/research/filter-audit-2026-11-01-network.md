# Filter audit continuation: Aristotle transport and iboss verdicts

Observed 1 November 2026. This supplements the [earlier network report](filter-audit-2026-10-30-network.md). It closes specific protocol questions in Aristotle's large background bundle and fixes two Civil checker errors. It does not establish managed-device compatibility or complete reconstruction of either extension.

## Artifacts and source boundaries

This pass reused the local Aristotle Student 23.14.0 archive at `~/extensions/aristotleStudent/`, and the already acquired 23.19.0 package under `extensions/filter-audit-2026-11-01/aristotleStudent/`. It also examined the acquired iboss 1.0.200 connector. No additional historical version or live district connection was acquired in this pass. Manifest versions and local acquisition timestamps do not independently establish release dates or CRX authenticity.

| Original file | SHA-256 |
| --- | --- |
| Aristotle 23.14.0 `assets/background.ts.88ce4144.js`, 2,129,390 bytes | `f25a2856cd642105a2514df2d55e97dfffafc3da619b381c32a61b8d02ee15c9` |
| Aristotle 23.19.0 `assets/background.ts.48f91a43.js`, 2,129,752 bytes | `54021eda5e681879cc7d0ac32f15dbc0352b51e0c1950622f845f15f34b01312` |
| iboss 1.0.200 `common/ApiCheck.js` | `213bee6a564004c3b7a48432563843d418290af64d598988463ac54ce11093b3` |

The original cached Aristotle bundle was submitted to REA with its manifest and loader. That run parsed the background but reached semantic retention limits; a successful inventory was not treated as complete reconstruction. To follow the useful code without repeatedly analyzing its large ML dependencies, `network/index-aristotle.mjs` parses both original bundles as inert Babel ASTs. It extracts whole top-level declarations, preserves original UTF-16 source ranges and SHA-256 values, and names generated files with their original offsets. Offset names avoid collisions between minified identifiers that differ only by case on Windows.

`network/aristotle-<version>-filtering-offsets/provenance.json` records the REA-analyzed selection: 69 declarations for 23.14.0 and 71 for 23.19.0, covering socket support and the filtering tail. The expanded sibling selection includes the base plugin and image-filter classes. These are derived source selections with unresolved dependencies, not independently shipped extension modules. `bun extensions/filter-audit-2026-11-01/network/index-aristotle.mjs --original` regenerates the analyzed selection; omitting `--original` regenerates the expanded selection.

## Aristotle's actual socket protocol

Both releases contain the following connected source paths:

- `Lr` constructs `new ly("/wss/wf", {cmd: 1}, true)`. The final argument enables MessagePack. `ly.sendMessage` sends `Nw(message)` for this mode; `Nw` calls the packaged MessagePack encoder. The receive handler still calls `JSON.parse(event.data)`.
- `ly.setDomain` puts `rp` into the socket's `ssId` query parameter. The `Lr` authentication frame uses that same value for `guid`.
- `Lr.serverRPC` stores a callback by `requestId`, or generates `_msgId` when no explicit `requestId` exists. Incoming dispatch uses `requestId || _msgId`, removes the matching callback, and resolves that callback with the remaining response fields.
- The outgoing and incoming command enums retain `Authenticate`/`Authentication: 0` and `CheckURL`/`FilterResult: 2` in both releases.
- The auth frame contains `key`, `secret`, `guid`, `user`, `device`, `connect_time`, `version` and `locale`. The prior Civil checker comment's untraced-metadata limitation is now narrowed: the package uses `user` and `device`, whereas the standalone checker inherited `user_id` and `os` from a separate implementation. Which optional identity fields the remote server accepts remains unverified. This pass did not invent a managed device identity or change district credentials.

Civil previously sent JSON text for both authentication and URL checks, omitted an RPC identifier, and generated different values for `ssId` and `guid`. The checker now sends binary MessagePack using the already installed `@msgpack/msgpack`, shares its session identifier, and accepts only the reply matching its URL request. An unrelated pushed `block` field can no longer decide the check.

`checkAristotleFilter` remains a domain-reputation checker. Its only production caller is `domainReputation.ts`; its header explicitly states that contract. It still reduces input to an HTTPS hostname. The packaged URLFilterPlugin uses full URLs, so exposing this helper as a future URL-policy endpoint would require a separate decision about preserving paths and queries.

### Controlled replay

Run:

```powershell
bun extensions/filter-audit-2026-11-01/network/replay-aristotle-socket.mjs
```

The replay executes the original extracted `ly`, `Lr` and both command enums from each release in a VM. WebSocket, Chrome APIs and timers are mocked; the packaged `Nw` encoder is replaced with the installed standards-compatible MessagePack encoder. It does not execute the extension bootstrap or contact a district service.

Both releases send a binary auth frame, use matching socket/auth session identifiers, append `_msgId` to the URL RPC, ignore an unrelated reply, and resolve the correlated JSON reply. Exact observations are saved in `network/aristotle-socket-replay.json`. This verifies the exercised local protocol branches, not remote authentication acceptance, district policy or managed Chrome enforcement.

## Background filtering and reporting

Direct source tracing through the selected declarations establishes these additional boundaries:

- `_n` orders always-allowed URLs, domain exceptions, offline policy, classroom rules, Internet Referee, YouTube, cloud URL checks, title/content checks and the image RPC plugin. Blocking plugins run in order and can short-circuit on a returned result, including an explicit allow. Nonblocking plugins are collected; a blocked result can win after they complete. The plugin enable checks also depend on the global filter-enabled state.
- The cloud URL plugin caches checks for five minutes with a maximum of 1,024 entries. It sends command 2 and the original URL, choosing `main_frame` or `sub_frame`. A response with `block` creates a block event. A nonblocked categorized response allows JavaScript; an uncategorized response allows navigation while invoking the policy-controlled JavaScript blocker.
- The legacy content plugin sends command 5 with the title and URL when its content policy is enabled. A received `ScriptInjectionConfig` for `contentScript` disables that legacy content filter in favor of injected scripts. The remotely supplied injection policy therefore matters independently of built-in proxy signatures.
- The injection manager loads policy-selected scripts, supplies page configuration for requesting frames, handles extension runtime messages and `/__aiNetCmd__/` RPC/push paths, and forwards selected requests to the server. Page classification and server reporting are privileged extension paths; Civil's request-host middleware does not intercept them.
- Block event command 16 includes user/device metadata, event type and payload. `_n` deduplicates events with the same type and URL within three seconds. It registers tab title updates, history-state navigation, main-frame commits and subframe requests; this is active filtering orchestration, not an unused signature list.
- The image plugin loads the packaged MobileNet model and handles `classifyImage` RPCs through a prediction queue. That is a separate content-classification surface. This pass did not recover all model decisions or reinterpret model-weight strings as proxy indicators.

## iboss: an absent decision was incorrectly reported as allowed

The latest connector's `common/ApiCheck.js` reads `blockUrl` from the cloud reply. Its normal allow branch compares that field with zero; a non-null `errorCode` changes the decision to a temporary block. Its network-failure fallback constructs an explicit default object containing `blockUrl: 0`. Those are distinct from a received reply with no decision field.

Civil's checker instead used `(response.blockUrl ?? 0) !== 0` after returning unvalidated `response.data`. An HTTP-200 empty object therefore produced an `allowed` verdict; null could throw during result mapping. This conflicted with `FilterVerdict`'s existing rule that missing data is not a pass.

`misc/filters/iboss/checker.ts` now validates the received decision before mapping it. A null, array, string, missing decision or nonnumeric `blockUrl` returns a `PARSE` error. Explicit numeric zero remains allowed; nonzero remains blocked; a cloud `errorCode` retains the connector's documented block behavior. No gateway, filtering policy, vendor blocklist or client runtime marker changed for this fix.

## REA ledger and verification

The session export is `extensions/filter-audit-2026-11-01/network/rea-evidence.json`: 86,263,514 bytes and 12 records at export. Its bundle-level unknown count is not a measure of each record's semantic coverage.

| Input or operation | Parent Evidence ID | Scope |
| --- | --- | --- |
| Aristotle cached original tree | `ev_5d027e0c35c4923fd56e557976d4a7624ba92e67f4f1aa32edaaafbde40c4f64` | Manifest, loader and original background selected; semantic retention limits reached. |
| 23.14.0 selected protocol declarations | `ev_30d7843fd23d46c8e558cb299e23503105ce05a82efa96270b6ec0f490401e6f` | Seven derived declarations; unresolved references remain. |
| 23.19.0 selected protocol declarations | `ev_c0258b87afc7ba43c0de32acb83158060e4cb59f0194913882040f50ca3324b1` | Seven derived declarations; unresolved references remain. |
| 23.14.0 filtering/socket selection | `ev_09d90056eabdeacf8e65cfb8f28a9cb6864bb6464316e1c44dce467eb6b88f69` | 69 parsed declarations, no parser failures; partial relationships and 4,535 semantic unknowns. |
| 23.19.0 filtering/socket selection | `ev_3c280cb68894a8287623522e2234a33ddedba651781a8585c0955f260d81ce6a` | 71 parsed declarations, no parser failures; partial relationships and 4,549 semantic unknowns. |
| Filtering selection comparison | `ev_9ecdfea2eea8a2b1903da18fbc3a4afef4910682ff9a069d5d9fe38445d34bf4` | Partial inputs: 57 changed and 234 unknown entities. These counts do not establish 57 behavioral changes or absence of additions/removals. |

Validation performed for this change:

- Aristotle binary-framing/correlation regression plus ten iboss response cases: 11 passing tests.
- Those tests plus domain-reputation suites: 23 passing tests.
- Both-release vendor socket replay: passed.
- Formatting and oxlint on the four changed checker/test files: passed.

No managed Chrome policy, live district socket, remote classifier or real gateway verdict was tested. Additional dated packages, the remaining background/model dependencies, native payloads and tenant-specific policy remain open. Existing Blocksi, Cisco and Linewize findings are retained in the prior reports; this continuation does not claim new complete analyses of those vendors.
