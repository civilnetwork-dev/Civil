# Settings and first-run setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A settings page that exposes every decision Civil makes (search, transport, history storage, startup, appearance, privacy) and a first-run setup that asks or picks for the user.

**Architecture:** One typed settings registry over per-key localStorage (legacy keys kept raw so the scramjet config bundle is untouched). Transport resolution moves to one module used by SearchBar and the load watchdog. History becomes a two-location segment store with self-describing payloads, a space budget and six overflow policies. Settings and setup pages are client-only routes built from the Strata kit.

**Tech Stack:** SolidJS 2 (rc.6), TanStack Solid Router, vanilla-extract, vitest with happy-dom and fake-indexeddb, native CompressionStream.

**Spec:** `docs/superpowers/specs/2026-09-26-settings-and-setup-design.md`

## Global Constraints

- No new dependencies. Compression is native `CompressionStream("deflate-raw")`.
- Legacy keys keep name and raw encoding: `transport`, `search`, `civil-history-method`, `civil-history`, `browser-session`.
- Every default equals today's behaviour (history retention default: never).
- Copy: sentence case, periods and commas, no dashes as punctuation, no uppercase labels (DESIGN.md).
- Styles: material recipes spread with `blend()`, no `backdrop-filter`, no new ambient animation. `.css.ts` files imported by components export no functions.
- Solid 2: `onSettled` callbacks return cleanup, never call `onCleanup` inside them.
- Every reader of stored data validates and falls back; storage writes that can hit quota are caught.
- No commits unless the owner asks.

---

### Task 1: Settings store

**Files:** Create `src/lib/settings.ts`, `src/lib/settings.test.ts`. Modify `src/lib/reactiveStorage.ts` (extract `createReactiveKey`, keep `createReactiveJSON` on top of it).

**Produces:** `SETTINGS` registry; `type SettingKey`; `type SettingValue<K>`; `getSetting(k)`, `setSetting(k, v)`, `useSetting(k): Accessor`, `resetSettings()`, `needsSetup(): boolean`, `markSetupComplete()`; option lists with labels: `SEARCH_ENGINES`, `TRANSPORTS`, `HISTORY_POLICIES`, `HISTORY_LIMITS`, `RETENTION_DAYS`, `HISTORY_CAPS`, `NAV_TIMEOUTS`.

- [ ] Test: defaults when unset; raw legacy values (`transport=libcurl`) read as-is; invalid enum, NaN number and bad JSON fall back; booleans round-trip; `setSetting` fires `onLsChange`; `resetSettings` removes only setting keys; `needsSetup` false when `browser-session` exists (and marks complete), true on a clean origin.
- [ ] Implement, run `bunx vitest run src/lib/settings.test.ts`.

### Task 2: History storage engine

**Files:** Create `src/api/historyStorage.ts` (locations, codec, measuring, ranking), `src/api/history.test.ts`. Rewrite `src/api/history.ts` internals, same exports plus `onHistoryChange(cb)`, `historyStatus()`, `historyRankLocations()`, `historyMoveTo(loc)`, `historySetFormat(fmt)`, `historyFullEvent()`, `historyDismissFullEvent()`.

**Consumes:** `getSetting`/`setSetting` for `historyEnabled`, `historyLocation`, `historyMethod`, `historyFormat`, `historyLimitKb`, `historyWhenFull`, `historyDays`, `historyMax`.

- [ ] Tests (fake-indexeddb, happy-dom): legacy localStorage array and legacy per-entry IndexedDB records load and survive a write; compressed round-trip in both locations; retention and cap prune across both; each policy on a tiny limit (trim, wipe, wipe-best, spill incl. both-full ring, compress, stop); a quota exception from `setItem` counts as full; move writes new before clearing old and a failed move keeps data; `historyAdd` no-ops when saving is off; ranking prefers the faster location with room.
- [ ] Implement, run `bunx vitest run src/api/history.test.ts`.

### Task 3: Transport resolution

**Files:** Create `src/lib/transport.ts`, `src/lib/transport.test.ts`. Modify `src/lib/SearchBar.ts` (resolver, always apply transport, search engine and custom template from settings, compat gate), `src/lib/useIframeManager.ts` (timeout setting, rotate from the transport actually used, error page per-method buttons, `civil:nav-retry` with `transport`), `tests/searchBar.test.ts`.

**Produces:** `TRANSPORT_ORDER`, `type TransportName`, `resolveTransport(frame, term, bestPick)`, `needsBestProxy(term)`, `rotateFrom(frame)`, `retryWith(frame, t)`, `usedTransport(frame)`.

- [ ] Tests: order one-shot > site rule > failover > auto pick > default; auto off skips the probe; rotation persists only with remember on; site-ruled navigation does not rotate.
- [ ] Implement, run `bunx vitest run src/lib/transport.test.ts tests/searchBar.test.ts`.

### Task 4: Consumers

**Files:** Modify `src/lib/swUtils.ts` (filter detection gate), `src/components/ui/UrlBar.tsx` and `src/components/SearchBarInput.tsx` (suggestion gates), `src/components/BrowserChrome.tsx` (startup mode, bookmarks bar mode, settings keycap and menu item), `src/entry-client.tsx` (setup redirect, motion attribute), `src/styles/global.css.ts` (`[data-motion="reduce"]` rule), `src/components/NewTabPage.tsx` (Settings link).

- [ ] Implement; covered by the page checks in Task 7 plus existing tests.

### Task 5: Settings page

**Files:** Create `src/components/SettingControls.tsx` (`SettingRow`, `Toggle`, `Choice`), `src/components/SettingsPage.tsx`, `src/styles/SettingsPage.css.ts`, `src/routes/settings.tsx`. Move the switch styles from `src/styles/ExtensionsPage.css.ts` into `src/styles/schematic.css.ts` (ExtensionsPage re-exports). Add `IconSliders` (`src/components/icons/index.tsx`, gesture in `src/styles/icons.css.ts`, name in `index.test.ts`). Modify `src/components/HistoryPage.tsx` (live updates via `onHistoryChange`, full-storage notice).

- [ ] Render test: every group renders, a toggle writes its key, a custom search template without `%s` is rejected.
- [ ] Implement.

### Task 6: Automatic picks and setup page

**Files:** Create `src/lib/setupDefaults.ts`, `src/lib/setupDefaults.test.ts`, `src/components/SetupPage.tsx`, `src/styles/SetupPage.css.ts`, `src/routes/setup.tsx`.

**Produces:** `detectSetupDefaults(env?): Promise<SetupPicks>` where each pick is `{ value, reason }`.

- [ ] Tests: Brave, Edge, DNT and fallback search picks; WebSocket failure picks bare; slow connection picks 30 s and no live suggestions; low-end or reduced-motion picks reduce; short window picks new-tab-only bookmarks bar; small quota picks compressed and 30 days.
- [ ] Render test: "Pick for me" lands on the summary with every row marked picked; finishing writes settings and `civil:setup-complete`.
- [ ] Implement.

### Task 7: Verification

- [ ] `bunx vitest run`, `bunx tsc --noEmit -p .`, `bun run lint:check`, `bun run format:check`, `bunx fallow dead-code`.
- [ ] Browser on vite 5173 (regenerates `src/routeTree.gen.ts`): `/setup` flow both paths, `/settings` every control, History notice; 1366×768 and 390×844 screenshots.
