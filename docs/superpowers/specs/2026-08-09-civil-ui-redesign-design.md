# Civil Proxy UI Redesign: Schematic Interior

**Date:** 2026-08-09
**Status:** Approved design, pending implementation plan
**Scope:** Pass 1 of 2: shared foundation + three pages. Six more pages in pass 2.

---

## 1. Problem

Brief: Civil Proxy UI more intuitive, beautiful, minimalist but crisp, creative, unlike any prior browser-in-browser UI, complex in meaningful way, no third-party packages for UI.

Taken literally, brief conflicts with both spec docs:

- **DESIGN.md** north star: *"a stealth-cockpit browser chrome for getting past school
  filters without drawing a glance"*: muted, static, built to *"sit open on a shared screen
  without inviting a second look."*
- **PRODUCT.md** principle 1: *"Ship a browser, not a wrapper: chrome-level fidelity
  (tabs, history, bookmarks, new-tab) is core identity, not decoration."*

Visually unprecedented interface = gets looked at. For primary user (student on school-managed Chromebook), being looked at = failure mode.

UI not greenfield. DESIGN.md fully specified (locked Catppuccin Macchiato palette, Rubik-only type, five named rules, per-page signature motifs);
`src/styles/material.css.ts` implements "Backlit Instrumentation" material layer. 5,429 lines across 24 vanilla-extract style files.

## 2. Resolution

**Split by layer.**

- **Chrome** (tabstrip, omnibox, bookmarks bar, window controls) stays stealth,
  browser-shaped. What passer-by sees. Not in redesign.
- **Interior pages**, seen only by user, get full creative direction.

Honours both docs, still delivers new.

## 3. Decisions

| Decision | Choice |
|---|---|
| North star | Stealth chrome, unprecedented interior |
| Complexity model | Depth on demand: spare at rest, dense on intent |
| Design language | Schematic (technical drawing) |
| Sequence | Foundation + 3 pages now; 6 pages in pass 2 |
| Icons and loading animation | Out of scope: user authoring in vector software |
| DESIGN.md rules | All four contested rules unlocked; DESIGN.md rewritten after implementation |
| Palette | Stays Catppuccin Macchiato (new logo pending, brand shift waits) |

### 3.1 Design language: Schematic

Interior pages read as technical drawings. Hairline ruled field, corner registration marks,
labelled dimension rules, mono margin annotations. Content on *sheet*,
not in cards.

Beat two alternatives:

- **Editorial instrument** (Swiss type + instrument margin): distinctive,
  but large display type spends vertical space chrome already used.
- **Depth field** (stacked translucent planes, focus parallax): most striking, but reads as
  glassmorphism; `backdrop-filter` + parallax expensive on target hardware.

Schematic wins on brief's first requirement, *intuitive*: viewer already reads ruled, labelled drawings. Renders with nothing costlier than borders and text; gives newly permitted mono face real job, not decorative.

### 3.2 Complexity model: depth on demand

Spare at rest: few elements, generous space. Complexity behind
user intent: focus, hover, tap, keypress expands annotation region into dense block. First
glance calm; sustained use reveals deep tool. Dissolves "minimalist" vs "complex"
contradiction.

Every reveal user-triggered, so DESIGN.md ban on ambient motion
survives.

## 4. Foundation

### 4.1 New module: `src/styles/schematic.css.ts`

Absorbs, partly replaces `src/styles/material.css.ts`.

| Export | Purpose |
|---|---|
| `RULE` | Hairline vocabulary: `hair` (0.5px), `major` (1px), `accent`. Replaces per-file border strings. |
| `field(density)` | Ruled grid as `repeating-linear-gradient` recipe. `density` one of `"fine"` (8px), `"base"` (16px), `"coarse"` (32px), not raw number, so pages can't invent off-scale grids. |
| `MARK` | Corner registration brackets, axis ticks. Promoted NewTab-local → shared. |
| `titleBlock()` | Page header recipe: eyebrow, title, mono meta row. |
| `ANNO` | Annotation tier: 11px, weight 500, `tabular-nums`, 0.02em tracking. |
| `EASE` / `DUR` | Kept unchanged from `material.css.ts`. |

### 4.2 Retired

Both belong to "backlit instrumentation" metaphor: soft, physical, lit. Schematic = flat ink
on paper, depth from rules and alignment, not simulated light. Keeping either =
two metaphors competing on one page.

- `atmosphere()`: accent bloom, counter-bloom, grain backdrop.
- `edgeLit` / `edgeLitStrong`: top-edge highlight.

Call sites in three slice pages migrated. Call sites in six pass-2 pages keep working
until pass 2; exports not deleted until last page migrated.

### 4.3 Typography

Add `--civil-font-mono` as system stack: `ui-monospace, SFMono-Regular, Menlo, monospace`. Zero
packages, zero download.

Division of labour:

- **Rubik**: prose, labels, titles, controls. Unchanged.
- **Mono**: numerals, hostnames, timings, scores, IDs, dimensions, annotations.

`font-variant-numeric: tabular-nums` on mono tier so numeric columns align.

Breaks DESIGN.md One-Family Rule on purpose.

### 4.4 Palette usage

Macchiato kept, used differently: surface tiers = *paper* tiers, accents =
*ink*. Lavender stays chrome accent, mauve stays Filter Checker ink accent:
two-lane split survives though rule unlocked, because still coherent.

## 5. Primitives

New dir `src/components/schematic/`. Seven single-purpose components.

| Primitive | Responsibility | Depends on |
|---|---|---|
| `Sheet` | Page plane: ruled field, registration marks, optional title block | `schematic.css.ts` |
| `TitleBlock` | Eyebrow, title, mono meta row | `schematic.css.ts` |
| `Rule` | Labelled hairline, optional dimension caps. Signature element | `schematic.css.ts` |
| `Plate` | Bounded sub-region in sheet: corner ticks, not border box. Replaces "card" | `schematic.css.ts` |
| `Anno` | Mono annotation, tabular numerals | `schematic.css.ts` |
| `Unfold` | Depth-on-demand container | `schematic.css.ts`, `EASE`/`DUR` |
| `Field` | Schematic input: hairline underline, mono value, margin label | `schematic.css.ts` |

Each pure render + ARIA. None touches app state.

### 5.1 `Unfold` specification

Only primitive with risky details: reveal-based UI excludes keyboard and touch
users by default.

- **Trigger** focusable, not container.
- Responds to hover, `focus-visible`, Enter / Space.
- Trigger has `aria-expanded` and `aria-controls`.
- Collapsed content stays in DOM with `aria-hidden="true"` and `inert`: not announced, not tabbable.
- Animates `grid-template-rows: 0fr → 1fr` with `overflow: hidden`, so siblings don't reflow.
- Touch has no hover: tap toggles. Corner registration tick = hit target.

## 6. Icon and loader indirection

User authoring new icon set and logo in vector software, supplied later. Redesign must keep swap cheap.

- New `src/components/icons/index.ts` exports semantic names (`IconSearch`, `IconClose`,
  `IconRefresh`, …) currently aliasing `solid-icons`. The 17 files importing
  `solid-icons/{bi,cg,fa,tb}` import from this module instead.
- New set arrives → swap one file, no page churn.
- `LoadingAnimation.tsx` keeps public API, so replacing `@lottiefiles/dotlottie-web`
  touches no callers.

No packages removed this pass. `echarts`, `@catppuccin/palette`, `@leeoniya/ufuzzy`,
`@atlaskit/pragmatic-drag-and-drop` all stay.

## 7. Pages

Each page keeps distinct silhouette, per DESIGN.md principle: no two pages
share structure by coincidence.

### 7.1 New Tab: title sheet

Now: wordmark, tagline, search bar in corner brackets and axis ticks, ad notice.
Already gestures this way.

- Sheet with ruled field, registration marks top-left, top-right, bottom-right. Fourth corner unmarked on purpose: title block sits bottom-left, like real drawing.
- Wordmark becomes **drawing title block** bottom-left: `Civil`, then mono meta row
  (revision, session type).
- Omnibox centred on primary rule, dimension caps each end.
- Ad notice becomes labelled margin note (`note 01`), not apologetic sentence.
  PRODUCT.md treats ad revenue as fixed constraint; keeps slot, stops it reading as
  afterthought.

**Unfold:** focusing omnibox expands mono status strip below: detected filter vendors,
chosen engine, transport, Wisp version, latency. None visible at rest.

**Data source:** `/api/best-proxy` and `detectedFilters` localStorage key, both already
populated. No backend work.

### 7.2 Apps: parts plate

Now: add bar, grid of `appCard`s with icon stage, name bar, always-visible remove
button; empty state with ghost tiles.

- Grid becomes parts plate. Each app = numbered position (`01`…`n`) aligned to ruled
  field, marked by corner ticks not card border.
- Add bar becomes `Field` on plate top rule, labelled `add item`.
- Empty state becomes ghost positions with dimension callouts.

**Unfold:** hover/focus tile expands annotation: hostname, date added,
remove action. Remove no longer permanent, so plate calm
at rest.

### 7.3 Filter Checker: test report

Now: header with lavender→mauve gradient title, detected-filter badges, form, one
result card per vendor with status variants, spinner, rescan button. 865 lines in one file.

- Reads as test report sheet. Title block top-left with mono report meta (vendor count,
  specimen URL).
- Detected filters become labelled specimen row.
- Form becomes `Field` rows on rules.
- **Results become ledger**, not cards: row per vendor, aligned mono columns: vendor,
  verdict, latency, category count. Verdict keeps existing status colour.
- Gradient headline removed. Gradient text fill can't coexist with flat ink.

**Unfold:** result row expands to full vendor breakdown: actual verdict discriminant,
category chips, typed error variant, retry.

**Why this is slice's biggest functional win.** Every `misc/filters/*/checker.ts` returns
`neverthrow` `Result` with typed error union (`INVALID_URL`, `NETWORK`, `PARSE`) and
vendor-specific verdicts (`LOCKED`, `PAUSED`, `UNMONITORED`, `NO_SESSION`). Current cards
flatten most into colour. Surfacing discriminant turns "it didn't work" into "the
vendor changed its response shape": info backend already computes, UI currently
drops.

### 7.4 Component split

`FilterCheckPage.tsx` (865 lines) becomes:

- `FilterCheckPage.tsx`: composition
- `FilterCheckForm.tsx`
- `FilterCheckResults.tsx`
- `filterCheckVendors.ts`: vendor metadata

No refactoring outside three slice pages.

## 8. Accessibility

- `Unfold` requirements in §5.1, main accessibility risk.
- **Contrast correction:** DESIGN.md `overlay1` (`#8087a2`) on `base` (`#24273a`) ≈
  4.0:1, fails WCAG AA small text. Annotation tier 11px, so
  annotations use `subtext0` (`#a5adcb`, ≈ 6.6:1). Decorative rules and ticks may stay
  on darker tiers; contrast rules don't apply.
- Decorative marks (registration brackets, axis ticks, field gradient) get `aria-hidden="true"`.
- `Field` links margin label to input via `for` / `id`.
- Existing global `:focus-visible` ring kept.

## 9. Motion

- Every reveal user-triggered; no ambient motion added.
- `Unfold` uses `DUR.base` with `EASE.enter`.
- Reduced-motion handling in `global.css.ts` collapses durations, not disables
  animations, so unfold still completes under reduced motion.

## 10. Performance

Primary hardware: low-end school Chromebooks.

- No `backdrop-filter`, no blur, no animated shadows.
- Ruled field = one repeating gradient on one element.
- Only `transform`, `opacity`, `grid-template-rows` animate.

## 11. Empty and error states

Schematic improves these, not degrades.

| State | Treatment |
|---|---|
| Apps, empty | Ghost positions with dimension callouts |
| Filter check failed | Ledger row with actual error discriminant |
| Service worker unavailable | Labelled margin note. Now only `console.error` in `swUtils.ts`: real gap |
| Proxy probe failed | Status strip shows fallback engine explicitly, not silently |

## 12. Testing

Primitives = first truly unit-testable components in codebase.

- Add `vite-plugin-solid` to `vitest.config.ts`. `happy-dom` already installed.
- Tests in `src/components/schematic/*.test.tsx`.

Coverage:

| Target | Assertions |
|---|---|
| `Unfold` | Collapsed and expanded state; keyboard activation via Enter, Space; `aria-expanded` tracks state; collapsed content `inert` and `aria-hidden` |
| `Rule` | Label renders; decoration `aria-hidden` |
| `Field` | Label associated with input |
| `Sheet` | Registration marks `aria-hidden`; children render |

Behaviour and accessibility only. No screenshot or visual-regression tests.

Existing tests must still pass. `bun run check`, `bun run test`, `./build.sh` all gate
work.

## 13. Verification

No dev server (`bun dev` removed; `start:watch` doesn't rebuild client), so
visual check = `./build.sh` then `bun run start:watch`, then load `/newtab`,
`/apps`, `/checkfilters`.

Wrinkle: `NewTabPage.tsx` wraps search bar in `<Show when={inFrame()}>`, so
visiting `/newtab` directly renders title block but **not** omnibox, so no
status-strip unfold. Verifying that unfold needs New Tab inside browser chrome
(via `/`), not standalone route. Plan must state which surface each page checked on.

## 14. Documentation

Final task, user's order: implement first, then bring DESIGN.md back to
truth. Rewrite covers:

- New north star: stealth chrome, schematic interior.
- Sheet model, seven primitives.
- Mono tier, retirement of One-Family Rule.
- Corrected annotation contrast value.
- Explicit record of retired rules and why, so `atmosphere()` not reinstated by
  someone assuming accidental loss.

MAINTENANCE.md gains section on schematic primitives and icon indirection layer.

## 15. Out of scope

- Browser chrome (`BrowserChrome.tsx`, `SearchBar*`, `BookmarksBar`, `TabPill`, `UrlBar`,
  `TabSearch`, `ContextMenu`, `ExtensionIconBar`).
- Six pass-2 pages: bookmarks, history, extensions, benchmarks, ban, baninfo.
- Icon set and loading animation assets.
- Removing any third-party package.
- Palette changes.
- Any backend or API changes.

## 16. Risks

| Risk | Mitigation |
|---|---|
| Reveal-based UI excludes keyboard and touch users | `Unfold` spec in §5.1; tests in §12 |
| Two metaphors coexist during pass 1 | `atmosphere()` / `edgeLit` exports kept until pass 2 migrates last page; slice pages use neither |
| Schematic reads cold or unfinished | Rubik kept for all prose; mono only for data |
| 11px annotations too small | Contrast raised to `subtext0`; 11px is floor, not target |
| Pass 1 direction rejected after build | Exactly why slice is three pages, not nine |