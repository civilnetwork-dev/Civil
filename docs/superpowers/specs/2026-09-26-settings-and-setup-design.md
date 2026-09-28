# Settings page and first-run setup

Date: 2026-09-26. Status: approved in chat (design, privacy switches, per-site rules).

## Problem

Civil makes several decisions for the user with no way to see or change them:

- The proxy transport (epoxy, libcurl, bare) is picked per site by the best-proxy probe, with a stored default (`transport`) that a load timeout silently rotates.
- The search engine (`search`) has no UI at all.
- History storage (`civil-history-method`) lost its chooser on purpose, because it was a developer control on a beginner page.
- History has no quota handling. A localStorage write that exceeds quota throws out of `void historyAdd(...)`, and localStorage (about 5 MB per origin) is shared with bookmarks, extensions and the tab session, so a full history would break those too.

There is also a latent bug on the transport path: the timeout rotation only writes the next transport to localStorage. The automatic retry in the same session still runs on the old transport, because `SearchBar.applyFrameTransport` does nothing when the best-proxy probe returns no pick. The error page then claims "Civil switched to libcurl" when it did not.

Users who prefer to decide things themselves (the request's audience) need a full settings page. First-time visitors need a friendly setup that either asks or picks sensibly for them.

## Settings store

`src/lib/settings.ts` owns a typed registry. Each setting is one localStorage key with a default and, for enums, its allowed values.

- Legacy keys keep their names and raw string encoding (`transport`, `search`, `civil-history-method`), so the separately bundled scramjet config (`misc/config/scramjet/scramjetInit.ts`, which reads `transport` and `search` directly) needs no change or rebuild.
- New keys use the `civil:` prefix. Booleans and numbers are stored as plain strings, objects as JSON.
- Every read validates: an unknown enum value, an unparsable number or bad JSON falls back to the default. localStorage is a trust boundary (any script on the origin, including a proxied page, can write to it).
- `getSetting(key)` reads at use time. Most consumers only need that, because they act on a navigation or a visit.
- `useSetting(key)` is a reactive accessor built on the existing `onLsChange`, which also hears the native `storage` event. That event reaches the browser shell when the settings page, which runs in a tab's frame, writes a value.
- `setSetting`, `resetSettings()` (settings only, never history or bookmarks data) and `needsSetup()`.

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

"Motion: full" (override an OS reduce-motion preference) was dropped: seven style files carry their own reduced-motion media rules, so an override could only be partial, and overriding an accessibility preference is not something a settings page should offer lightly.

Defaults equal today's behaviour, so an existing user sees no change until they choose one. In particular "Delete pages older than" defaults to never, so nobody's history is pruned by an update.

## Transport resolution

`src/lib/transport.ts` decides the transport for every proxied navigation, in this order:

1. A one-shot choice from the error page's "Try with …" buttons.
2. A per-site rule for the host.
3. The session failover pick (set when a timed-out navigation rotated methods).
4. The best-proxy pick, only when automatic picking is on. When it is off the probe request is not sent at all.
5. The default method.

`SearchBar.submitFrame` always applies the resolved transport to the frame, which fixes the retry bug. The load watchdog in `useIframeManager` uses the timeout setting (never means no watchdog). On timeout, when switching is on and the navigation was not pinned by a site rule, it rotates from the transport that navigation actually used, records it as the session failover pick, and persists it as the default only when "Remember the method that worked" is on. Otherwise it shows the connection error page, which now offers one retry button per method.

The last resolution (host, method, and why) is kept in `civil:transport-last`, so the settings page can show what the automatic picker last chose. Compatibility reports are sent only when that setting is on.

## History storage engine

`src/api/history.ts` keeps its public functions (`historyAdd`, `historyGetAll`, `historyDelete`, `historyClear`, `historySearch`, `historyGetMethod`, `historySetMethod`), which `civil.browser.history` and the chrome history shim expose.

- Each location holds one segment of the history as a single payload: localStorage key `civil-history`, or one record in the existing IndexedDB store. A payload is self-describing (plain JSON text, or `c1:` plus base64 of deflate for localStorage, or deflate bytes in IndexedDB), so changing the format never strands old data. Compression uses the native `CompressionStream`, so no dependency is added.
- Reads merge both locations, so data written by "Continue in the other place" or left by an interrupted move is never hidden.
- Legacy IndexedDB data (one record per entry) is folded into the segment on the next write.
- Every write is checked against the space limit (payload size) and against real quota errors from either location. Either one counts as "full" and runs the chosen policy:
  - Remove oldest: drop the oldest 10% (at least one page) until the write fits.
  - Start over in the same place: keep only the new page.
  - Start over in the best place: clear both locations, rank them, write the new page to the winner.
  - Continue in the other place: write to the other location from now on. When both are full, remove the oldest pages from whichever location holds the oldest and continue there, so the two act as one ring.
  - Compress, then remove oldest: switch the format to compressed and rewrite; if it still does not fit, remove oldest.
  - Stop saving: the new page is not saved; existing history is untouched. Later visits save again once there is room.
- Retention and the page cap run on every write, across both locations.
- Every full-storage action is recorded in `civil:history-full` and shown on the History page and in Settings until dismissed.
- Ranking the locations checks availability, free space (localStorage: an estimated 5 M character quota minus what the origin already uses; IndexedDB: `navigator.storage.estimate()`), and times a write and a read of the real history payload (capped at 256 KB). The best location is the fastest one with room for at least twice the current history; if none has room, the one with the most.
- Changing location or format moves the data: write the new copy first, and clear the old copy only after that succeeds. A failed move leaves the data where it was and reports why.
- A BroadcastChannel (`civil-history`) announces every change, so the History page updates live for IndexedDB writes too.

Ceiling: every visit rewrites its location's whole segment, which costs O(history size). The automatic 2 MB localStorage limit keeps that small. If histories grow large enough to matter, split segments by month.

## First-run setup

Route `/setup`. `entry-client` sends `/` to `/setup` before hydration when `civil:setup-complete` is missing and there is no earlier Civil data (`browser-session`). Existing users are marked complete silently and never see it.

Steps: Welcome (Set up Civil, or Pick for me), Search, Connection, History, Tabs and appearance, Privacy, Summary. Every step has Back, Skip this step and Next, and Skip setup is always available. Anything skipped is picked automatically, and the summary labels it "Picked for you" with the reason. Beginner wording comes first; technical options (method names, storage location, format, space limit, full-storage policy) sit behind an Advanced disclosure, because DESIGN.md keeps implementation labels off a beginner's start screen. Filters and location are never asked about; Civil already detects both.

Automatic picks:

- Search: Brave when `navigator.brave` exists, Bing in Microsoft Edge, DuckDuckGo when Do Not Track or Global Privacy Control is on, otherwise Google.
- Connection: automatic per-site picking. A three-second WebSocket probe to `/wisp/` decides the default method; when it cannot connect, the network probably blocks WebSockets, so the default becomes Bare. A slow or data-saving connection (`navigator.connection`) gets a 30 second timeout.
- History: the location ranking above. Under 1 GB of browser quota, compressed format and 30 day retention; otherwise plain and 90 days. Remove oldest when full.
- Tabs and appearance: restore tabs; bookmarks bar on new tabs only when the window is under 700 px tall; reduce motion on a low-end device (`hardwareConcurrency` or `deviceMemory` at most 2, or Save-Data) or when the device already prefers reduced motion.
- Live suggestions off under Save-Data.
- Privacy: both switches on (today's behaviour).

Finishing writes every value, moves history if its location changed, sets `civil:setup-complete`, and opens the browser.

## Entry points

A settings keycap beside the extensions button, a Settings item in the browser context menu, and a Settings link in the New Tab header. `browser:settings` already resolves to `/settings`.

## Testing

Vitest: the settings codec and validation; every history policy, retention, the cap, format and location moves, legacy migration of both the localStorage array and per-entry IndexedDB records (happy-dom with `fake-indexeddb`); transport resolution order; the automatic picks with stubbed `navigator`; the setup flow's skip path. Then the pages in the browser on vite at 1366×768 and 390×844.

## Second round (same day)

The owner asked for everything first listed as out of scope.

- **Backup.** `src/lib/settingsTransfer.ts` exports every setting as `{ format: "civil-settings", version: 1, settings }`, downloaded as `civil-settings.json` or copied as text (downloads are often blocked on school Chromebooks). Import takes a file or pasted text. Every value goes through `setSetting`'s validation, and unknown or refused keys are skipped and counted. Text settings validate their content too (a start page must be a web page, a search template a web address with `%s`), because an imported file skips the UI's checks. If an import changes where history is saved, history moves there.
- **Sites left out of history.** `historyExclude` is a list of bare hostnames, each covering its subdomains. `historyAdd` skips them. Leaving out a site that already has pages offers to delete them (`historyDeleteSite`). The add-a-site form is one shared control (`HostForm`) for this list and the connection rules.
- **Ads and analytics switches**, both default on. Ads off: `/` never loads the `ss.mrmnd.com` scripts, and the New Tab footer stops crediting ads. Offered in Settings only. Analytics off: PostHog never loads; if it is running, PostHog's own `opt_out_capturing()` stops it at once, and turning it back on opts in. The school-district lookup, which only feeds analytics, is skipped too. Offered in Settings and setup. `/api/track-visit` stays (ban enforcement), as does server-side PostHog in `misc/filters` (filter vendors probing the server, not visitors). PRODUCT.md records the decision.
- **Wisp version**: 2 (default, the owner's choice: more sites, more reliable, less latency), 1, or automatic per site from the best-proxy probe's `wispVersion`. Only Epoxy has a choice; libcurl bundles a version 1 client and Bare doesn't use Wisp. `transportKey()` maps Epoxy to `epoxy@2` or `epoxy`; `scramjetInit.ts` builds `epoxy@2` with `wisp_v2` and a WebSocket subprotocol, which is what `run.ts` checks to answer in version 2, and the first transport follows the same setting (`civil:wisp-version`, read raw). Not exercised against a live server in development.
