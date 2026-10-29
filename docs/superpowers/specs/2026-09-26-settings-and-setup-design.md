# Settings page and first-run setup

Date: 2026-09-26. Status: approved in chat (design, privacy switches, per-site rules).

## Problem

Civil makes several decisions for user, no way to see or change:

- Proxy transport (epoxy, libcurl, bare) picked per site by best-proxy probe, stored default (`transport`) silently rotated by load timeout.
- Search engine (`search`) no UI.
- History storage (`civil-history-method`) lost chooser on purpose: developer control on beginner page.
- History no quota handling. localStorage write over quota throws out of `void historyAdd(...)`; localStorage (~5 MB per origin) shared with bookmarks, extensions, tab session, so full history breaks those too.

Latent bug on transport path: timeout rotation only writes next transport to localStorage. Auto retry same session still runs old transport, because `SearchBar.applyFrameTransport` no-ops when best-proxy probe returns no pick. Error page then falsely claims "Civil switched to libcurl".

Users who decide themselves (request's audience) need full settings page. First-time visitors need friendly setup that asks or picks sensibly.

## Settings store

`src/lib/settings.ts` owns typed registry. Each setting = one localStorage key with default; enums have allowed values.

- Legacy keys keep names and raw string encoding (`transport`, `search`, `civil-history-method`), so separately bundled scramjet config (`misc/config/scramjet/scramjetInit.ts`, reads `transport` and `search` directly) needs no change or rebuild.
- New keys `civil:` prefix. Booleans, numbers as plain strings; objects JSON.
- Every read validates: unknown enum, unparsable number, bad JSON → default. localStorage is trust boundary (any origin script, incl. proxied page, can write).
- `getSetting(key)` reads at use time. Most consumers need only that; they act on navigation or visit.
- `useSetting(key)` reactive accessor on existing `onLsChange`, which also hears native `storage` event. Event reaches browser shell when settings page (runs in tab's frame) writes.
- `setSetting`, `resetSettings()` (settings only, never history or bookmarks) and `needsSetup()`.

## Settings

| Group | Setting | Values (default first) |
| --- | --- | --- |
| Search | Search engine | Google, DuckDuckGo, Bing, Brave, SearX, custom template containing `%s` |
| | Live suggestions (suggestion WebSocket) | on, off |
| | History suggestions in the address bar | on, off |
| Connection | Pick a method for each site automatically (best-proxy probe) | on, off |
| | Default method | epoxy, libcurl, bare |
| | Per-site rules | host to method list |
| | Switch methods when a page doesn't load | on, off |
| | Remember the method that worked | on, off |
| | Page load timeout | 15 s, 10 s, 30 s, 60 s, never |
| History | Save history | on, off |
| | Location | Automatic, localStorage, IndexedDB |
| | Format | Plain (JSON), Compressed |
| | Space limit | Automatic (2 MB in localStorage, browser quota in IndexedDB), 512 KB, 1 MB, 2 MB, 4 MB, 16 MB, 64 MB, no limit |
| | When space runs out | Remove oldest pages; Start over in the same place; Start over in the best place; Continue in the other place; Compress, then remove oldest; Stop saving new pages |
| | Delete pages older than | never, 1, 7, 30, 90, 365 days, custom |
| | Keep at most | unlimited, 1,000, 5,000, 10,000, 50,000 pages |
| Tabs and appearance | When Civil opens | Restore tabs, New tab, A specific page |
| | Bookmarks bar | Always, On new tabs only, Never |
| | Motion | Match this device, Reduce |
| Privacy | Send site compatibility reports | on, off |
| | Check for filters when Civil opens | on, off |
| Setup | Run setup again, Reset all settings | actions |

"Motion: full" (override OS reduce-motion) dropped: seven style files carry own reduced-motion media rules, so override only partial; overriding accessibility preference not something to offer lightly.

Defaults = today's behaviour; existing user sees no change until choosing. "Delete pages older than" defaults never, so update prunes nobody's history.

## Transport resolution

`src/lib/transport.ts` decides transport for every proxied navigation, in order:

1. One-shot choice from error page's "Try with …" buttons.
2. Per-site rule for host.
3. Session failover pick (set when timed-out navigation rotated methods).
4. Best-proxy pick, only when auto picking on. Off → probe request never sent.
5. Default method.

`SearchBar.submitFrame` always applies resolved transport to frame, fixing retry bug. Load watchdog in `useIframeManager` uses timeout setting (never = no watchdog). On timeout, if switching on and navigation not pinned by site rule: rotates from transport navigation actually used, records as session failover pick, persists as default only when "Remember the method that worked" on. Else shows connection error page, now with one retry button per method.

Last resolution (host, method, why) kept in `civil:transport-last`, so settings page shows what auto picker last chose. Compatibility reports sent only when setting on.

## History storage engine

`src/api/history.ts` keeps public functions (`historyAdd`, `historyGetAll`, `historyDelete`, `historyClear`, `historySearch`, `historyGetMethod`, `historySetMethod`), exposed by `civil.browser.history` and chrome history shim.

- Each location holds one history segment as single payload: localStorage key `civil-history`, or one record in existing IndexedDB store. Payload self-describing (plain JSON text, or `c1:` + base64 deflate for localStorage, or deflate bytes in IndexedDB), so format change never strands old data. Compression via native `CompressionStream`, no dependency.
- Reads merge both locations, so data from "Continue in the other place" or interrupted move never hidden.
- Legacy IndexedDB data (one record per entry) folded into segment on next write.
- Every write checked against space limit (payload size) and real quota errors from either location. Either = "full", runs chosen policy:
  - Remove oldest: drop oldest 10% (min one page) until write fits.
  - Start over in the same place: keep only new page.
  - Start over in the best place: clear both, rank, write new page to winner.
  - Continue in the other place: write to other location from now on. Both full → remove oldest pages from whichever holds oldest, continue there; two act as one ring.
  - Compress, then remove oldest: switch to compressed, rewrite; still no fit → remove oldest.
  - Stop saving: new page not saved; existing history untouched. Later visits save again once room.
- Retention and page cap run every write, across both locations.
- Every full-storage action recorded in `civil:history-full`, shown on History page and Settings until dismissed.
- Ranking checks availability, free space (localStorage: estimated 5 M char quota minus origin usage; IndexedDB: `navigator.storage.estimate()`), and times write+read of real history payload (cap 256 KB). Best = fastest with room for ≥2× current history; none → most room.
- Changing location or format moves data: write new copy first, clear old only after success. Failed move leaves data in place, reports why.
- BroadcastChannel (`civil-history`) announces every change, so History page updates live for IndexedDB writes too.

Ceiling: every visit rewrites location's whole segment, O(history size). Auto 2 MB localStorage limit keeps small. If histories grow enough to matter, split segments by month.

## First-run setup

Route `/setup`. `entry-client` sends `/` to `/setup` before hydration when `civil:setup-complete` missing and no earlier Civil data (`browser-session`). Existing users marked complete silently, never see it.

Steps: Welcome (Set up Civil, or Pick for me), Search, Connection, History, Tabs and appearance, Privacy, Summary. Every step has Back, Skip this step, Next; Skip setup always available. Skipped → auto picked; summary labels "Picked for you" with reason. Beginner wording first; technical options (method names, storage location, format, space limit, full-storage policy) behind Advanced disclosure, since DESIGN.md keeps implementation labels off beginner start screen. Filters and location never asked; Civil already detects both.

Auto picks:

- Search: Brave when `navigator.brave` exists, Bing in Microsoft Edge, DuckDuckGo when Do Not Track or Global Privacy Control on, else Google.
- Connection: auto per-site picking. 3 s WebSocket probe to `/wisp/` decides default method; no connect → network likely blocks WebSockets → default Bare. Slow or data-saving connection (`navigator.connection`) gets 30 s timeout.
- History: location ranking above. Browser quota under 1 GB → compressed, 30 day retention; else plain, 90 days. Remove oldest when full.
- Tabs and appearance: restore tabs; bookmarks bar new tabs only when window under 700 px tall; reduce motion on low-end device (`hardwareConcurrency` or `deviceMemory` ≤2, or Save-Data) or when device prefers reduced motion.
- Live suggestions off under Save-Data.
- Privacy: both switches on (today's behaviour).

Finishing writes every value, moves history if location changed, sets `civil:setup-complete`, opens browser.

## Entry points

Settings keycap beside extensions button, Settings item in browser context menu, Settings link in New Tab header. `browser:settings` already resolves to `/settings`.

## Testing

Vitest: settings codec + validation; every history policy, retention, cap, format and location moves, legacy migration of localStorage array and per-entry IndexedDB records (happy-dom with `fake-indexeddb`); transport resolution order; auto picks with stubbed `navigator`; setup skip path. Then pages in browser on vite at 1366×768 and 390×844.

## Second round (same day)

Owner asked for everything first listed out of scope.

- **Backup.** `src/lib/settingsTransfer.ts` exports every setting as `{ format: "civil-settings", version: 1, settings }`, downloaded as `civil-settings.json` or copied as text (downloads often blocked on school Chromebooks). Import takes file or pasted text. Every value through `setSetting`'s validation; unknown or refused keys skipped and counted. Text settings validate content too (start page must be web page, search template web address with `%s`), since imported file skips UI checks. Import changing history location → history moves.
- **Sites left out of history.** `historyExclude` = list of bare hostnames, each covering subdomains. `historyAdd` skips them. Excluding site with existing pages offers delete (`historyDeleteSite`). Add-a-site form is one shared control (`HostForm`) for this list and connection rules.
- **Ads and analytics switches**, both default on. Ads off: `/` never loads `ss.mrmnd.com` scripts; New Tab footer stops crediting ads. Settings only. Analytics off: PostHog never loads; if running, PostHog's `opt_out_capturing()` stops it at once; back on opts in. School-district lookup (only feeds analytics) skipped too. Settings and setup. `/api/track-visit` stays (ban enforcement), as does server-side PostHog in `misc/filters` (filter vendors probing server, not visitors). PRODUCT.md records decision.
- **Wisp version**: 2 (default, owner's choice: more sites, more reliable, less latency), 1, or auto per site from best-proxy probe's `wispVersion`. Only Epoxy has choice; libcurl bundles v1 client, Bare doesn't use Wisp. `transportKey()` maps Epoxy to `epoxy@2` or `epoxy`; `scramjetInit.ts` builds `epoxy@2` with `wisp_v2` and WebSocket subprotocol, which `run.ts` checks to answer in v2; first transport follows same setting (`civil:wisp-version`, read raw). Not exercised against live server in development.