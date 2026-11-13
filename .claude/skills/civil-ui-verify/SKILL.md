---
name: civil-ui-verify
description: Preview and verify a Civil UI change in a real browser (Vite dev server on port 5173), with the required viewport sizes, the expected dev-console noise, the first-run setup reset, and the methods that work here for drag and drop, hover animations, Safari, baseline comparison and trustworthy screenshots. Use after any change to components, styles, routes or pages under src/, or when asked to check, screenshot, polish or redesign the UI.
---
# Verify Civil's UI

## Start

- Browser pane: `preview_start` with `{name: "vite-dev"}` (from `.claude/launch.json`: `bunx vite --port 5173 --strictPort`). UI need no backend.
- Check at 1366x768 (common school Chromebook) and 390x844 with `resize_window`. Reset to desktop after.
- Expected dev noise listed in AGENTS.md Gotchas. Any other console message = new.
- `/setup` appear only when localStorage has neither `civil:setup-complete` nor `browser-session`. Remove both keys, reload to see it.
- Stale `browser-session` with dozens of tabs = old build state, not bug: `tabManager` singleton survive HMR remounts.
- `VITE_ROUTER_DEVTOOLS=1` fire delegated click handlers twice. Never judge click behaviour with it on.
- Design rules: DESIGN.md (Strata) and ICONS.md. Redesigns follow skill rules in AGENTS.md.

## Trustworthy screenshots

- Pane stop painting when Claude window behind another window: screenshots come back with blank band or time out, while `elementFromPoint` still find page. Then use Python Playwright (`py -3.13`, `channel="chrome"`), `page.screenshot(full_page=True)` to absolute path under `.playwright-mcp/` (gitignored), animations disabled through `add_style_tag`.
- Transient raster bugs (glyph pixelated mid-hover, text blurring then snapping sharp) never show in screenshots, because capture force fresh raster. Use headed Chrome with GPU, record with CDP `Page.startScreencast` (ack every frame), score crops by Laplacian mean.
- Hydration races: put Bun proxy in front of `vite preview` that send each HTML document in two pieces with pause.

## Interactions

- Tab drag-reorder: `left_click_drag` never start native HTML5 drag. Dispatch `DragEvent`s sharing one `new DataTransfer()`: `dragstart` on source tab, `dragenter` and `dragover` over few rAF frames, then `drop` and `dragend` on target. Run in fronted tab: rAF never fire in background tab.
- Hover animations, frame by frame: hover element, take `document.getAnimations()` filtered to its subtree, `pause()` each, set `currentTime` per frame in ascending order before each screenshot. Finished paused animations drop out of list.
- Chrome not transition from animation's current value when hover remove it: hover keyframes must end at rest. Hover acts latch through `src/lib/acts.ts` (read `data-act`).
- Render one component in page: `import()` the `@solidjs_web` dependency URL found in performance entries, then `import('/src/components/...')`.

## Safari

Python Playwright `p.webkit` (Safari 26.5 engine): no CSS `d` property (d-only keyframes run with zero keyframes), SMIL `<animate>` works. Headless WebKit draw about 8 frames per second: hold hovers at least 450 ms. Tab skip links, as in Safari.

## Is a warning new?

Run pre-change baseline beside change:

1. `git worktree add --detach <scratchpad>/civil-baseline HEAD`, then `bun install` in it.
2. Add temporary launch.json entry running `bun run --cwd=<path> vite --port 5174 --strictPort`.
3. Compare both servers side by side.
4. Clean up: `git worktree remove` fail on long `node_modules` paths. Run `git worktree prune`, then in PowerShell `Remove-Item -LiteralPath "\\?\<absolute path>" -Recurse -Force`. Remove temporary launch.json entry.

## Proxied pages

- Pane cannot register service workers, so proxied navigation never work in it. Use live probe in civil-filter-research skill.
- Edits under `misc/config/` need `bun run build:configs`: Vite never rebuild those bundles.

## Done means

Screenshots at both sizes, console checked against expected noise, interactions exercised. Stop dev server you started.