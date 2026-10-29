# Settings and first-run setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Settings page exposing every Civil decision (search, transport, history storage, startup, appearance, privacy) + first-run setup that asks or picks for user.

**Architecture:** One typed settings registry over per-key localStorage (legacy keys raw so scramjet config bundle untouched). Transport resolution → one module, used by SearchBar and load watchdog. History → two-location segment store, self-describing payloads, space budget, six overflow policies. Settings and setup pages client-only routes from Strata kit.

**Tech Stack:** SolidJS 2 (rc.6), TanStack Solid Router, vanilla-extract, vitest with happy-dom and fake-indexeddb, native CompressionStream.

**Spec:** `docs/superpowers/specs/2026-09-26-settings-and-setup-design.md`

## Global Constraints

- No new deps. Compression native `CompressionStream("deflate-raw")`.
- Legacy keys keep name + raw encoding: `transport`, `search`, `civil-history-method`, `civil-history`, `browser-session`.
- Every default = today's behaviour (history retention default: never).
- Copy: sentence case, periods and commas, no dashes as punctuation, no uppercase labels (DESIGN.md).
- Styles: material recipes spread with `blend()`, no `backdrop-filter`, no new ambient animation. `.css.ts` files imported by components export no functions.
- Solid 2: `onSettled` callbacks return cleanup, never call `onCleanup` inside.
- Every stored-data reader validates + falls back; quota-risk storage writes caught.
- No commits unless owner asks.

---

### Task 1: Settings store

**Files:** Create `src/lib/settings.ts`, `src/lib/settings.test.ts`. Modify `src/lib/reactiveStorage.ts` (extract `createReactiveKey`, keep `createReactiveJSON` on top).

**Produces:** `SETTINGS` registry; `type SettingKey`; `type SettingValue<K>`; `getSetting(k)`, `setSetting(k, v)`, `useSetting(k): Accessor`, `resetSettings()`, `needsSetup(): boolean`, `markSetupComplete()`; labeled option lists: `SEARCH_ENGINES`, `TRANSPORTS`, `HISTORY_POLICIES`, `HISTORY_LIMITS`, `RETENTION_DAYS`, `HISTORY_CAPS`, `NAV_TIMEOUTS`.

- [ ] Test: defaults when unset; raw legacy values (`transport=libcurl`) read as-is; invalid enum, NaN number, bad JSON fall back; booleans round-trip; `setSetting` fires `onLsChange`; `resetSettings` removes only setting keys; `needsSetup` false when `browser-session` exists (and marks complete), true on clean origin.
- [ ] Implement, run `bunx vitest run src/lib/settings.test.ts`.

### Task 2: History storage engine

**Files:** Create `src/api/historyStorage.ts` (locations, codec, measuring, ranking), `src/api/history.test.ts`. Rewrite `src/api/history.ts` internals, same exports plus `onHistoryChange(cb)`, `historyStatus()`, `historyRankLocations()`, `historyMoveTo(loc)`, `historySetFormat(fmt)`, `historyFullEvent()`, `historyDismissFullEvent()`.

**Consumes:** `getSetting`/`setSetting` for `historyEnabled`, `historyLocation`, `historyMethod`, `historyFormat`, `historyLimitKb`, `historyWhenFull`, `historyDays`, `historyMax`.

- [ ] Tests (fake-indexeddb, happy-dom): legacy localStorage array + legacy per-entry IndexedDB records load, survive write; compressed round-trip both locations; retention and cap prune across both; each policy on tiny limit (trim, wipe, wipe-best, spill incl. both-full ring, compress, stop); `setItem` quota exception counts as full; move writes new before clearing old, failed move keeps data; `historyAdd` no-op when saving off; ranking prefers faster location with room.
- [ ] Implement, run `bunx vitest run src/api/history.test.ts`.

### Task 3: Transport resolution

**Files:** Create `src/lib/transport.ts`, `src/lib/transport.test.ts`. Modify `src/lib/SearchBar.ts` (resolver, always apply transport, search engine + custom template from settings, compat gate), `src/lib/useIframeManager.ts` (timeout setting, rotate from transport actually used, error page per-method buttons, `civil:nav-retry` with `transport`), `tests/searchBar.test.ts`.

**Produces:** `TRANSPORT_ORDER`, `type TransportName`, `resolveTransport(frame, term, bestPick)`, `needsBestProxy(term)`, `rotateFrom(frame)`, `retryWith(frame, t)`, `usedTransport(frame)`.

- [ ] Tests: order one-shot > site rule > failover > auto pick > default; auto off skips probe; rotation persists only with remember on; site-ruled navigation no rotate.
- [ ] Implement, run `bunx vitest run src/lib/transport.test.ts tests/searchBar.test.ts`.

### Task 4: Consumers

**Files:** Modify `src/lib/swUtils.ts` (filter detection gate), `src/components/ui/UrlBar.tsx` and `src/components/SearchBarInput.tsx` (suggestion gates), `src/components/BrowserChrome.tsx` (startup mode, bookmarks bar mode, settings keycap + menu item), `src/entry-client.tsx` (setup redirect, motion attribute), `src/styles/global.css.ts` (`[data-motion="reduce"]` rule), `src/components/NewTabPage.tsx` (Settings link).

- [ ] Implement; covered by Task 7 page checks + existing tests.

### Task 5: Settings page

**Files:** Create `src/components/SettingControls.tsx` (`SettingRow`, `Toggle`, `Choice`), `src/components/SettingsPage.tsx`, `src/styles/SettingsPage.css.ts`, `src/routes/settings.tsx`. Move switch styles from `src/styles/ExtensionsPage.css.ts` into `src/styles/schematic.css.ts` (ExtensionsPage re-exports). Add `IconSliders` (`src/components/icons/index.tsx`, gesture in `src/styles/icons.css.ts`, name in `index.test.ts`). Modify `src/components/HistoryPage.tsx` (live updates via `onHistoryChange`, full-storage notice).

- [ ] Render test: every group renders, toggle writes its key, custom search template without `%s` rejected.
- [ ] Implement.

### Task 6: Automatic picks and setup page

**Files:** Create `src/lib/setupDefaults.ts`, `src/lib/setupDefaults.test.ts`, `src/components/SetupPage.tsx`, `src/styles/SetupPage.css.ts`, `src/routes/setup.tsx`.

**Produces:** `detectSetupDefaults(env?): Promise<SetupPicks>`, each pick `{ value, reason }`.

- [ ] Tests: Brave, Edge, DNT, fallback search picks; WebSocket failure → bare; slow connection → 30 s + no live suggestions; low-end or reduced-motion → reduce; short window → new-tab-only bookmarks bar; small quota → compressed + 30 days.
- [ ] Render test: "Pick for me" lands on summary, every row marked picked; finishing writes settings + `civil:setup-complete`.
- [ ] Implement.

### Task 7: Verification

- [ ] `bunx vitest run`, `bunx tsc --noEmit -p .`, `bun run lint:check`, `bun run format:check`, `bunx fallow dead-code`.
- [ ] Browser on vite 5173 (regenerates `src/routeTree.gen.ts`): `/setup` flow both paths, `/settings` every control, History notice; 1366×768 and 390×844 screenshots.