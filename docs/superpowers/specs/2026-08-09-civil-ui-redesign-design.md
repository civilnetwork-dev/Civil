# Civil Proxy UI Redesign — Schematic Interior

**Date:** 2026-08-09
**Status:** Approved design, pending implementation plan
**Scope:** Pass 1 of 2 — shared foundation plus three pages. Six further pages follow in pass 2.

---

## 1. Problem

Civil Proxy's UI should be more intuitive, more beautiful, minimalist but crisp, creative, and
unlike any browser-in-browser UI built before — while being complex in a meaningful way and using
no third-party packages to craft the UI.

Taken literally, that brief conflicts with both existing specification documents:

- **DESIGN.md** sets the north star as *"a stealth-cockpit browser chrome for getting past school
  filters without drawing a glance"* — muted, static, built to *"sit open on a shared screen
  without inviting a second look."*
- **PRODUCT.md** principle 1 states *"Ship a browser, not a wrapper — chrome-level fidelity
  (tabs, history, bookmarks, new-tab) is core identity, not decoration."*

A visually unprecedented interface is, by construction, one that gets looked at. For the primary
user — a student on a school-managed Chromebook — being looked at is the failure mode.

The UI is also not greenfield. DESIGN.md is a fully specified system (locked Catppuccin Macchiato
palette, Rubik-only typography, five named rules, per-page signature motifs), and
`src/styles/material.css.ts` implements a "Backlit Instrumentation" material layer. There are
5,429 lines across 24 vanilla-extract style files.

## 2. Resolution

**Split by layer.**

- The **chrome** — tabstrip, omnibox, bookmarks bar, window controls — stays stealth and
  browser-shaped. It is what a passer-by sees. It is not part of this redesign.
- The **interior pages** — what only the user is looking at — take the full creative direction.

This honours both documents and still delivers something new.

## 3. Decisions

| Decision | Choice |
|---|---|
| North star | Stealth chrome, unprecedented interior |
| Complexity model | Depth on demand — spare at rest, dense on intent |
| Design language | Schematic (technical drawing) |
| Sequence | Foundation + 3 pages now; 6 pages in pass 2 |
| Icons and loading animation | Out of scope — user is authoring these in vector software |
| DESIGN.md rules | All four contested rules unlocked; DESIGN.md rewritten after implementation |
| Palette | Stays Catppuccin Macchiato (new logo pending, so brand shift waits) |

### 3.1 Design language: Schematic

Interior pages read as technical drawings. A hairline ruled field, corner registration marks,
labelled dimension rules, and monospace annotations in the margins. Content sits on a *sheet*
rather than inside cards.

Chosen over two alternatives:

- **Editorial instrument** (Swiss typography plus an instrument margin) — genuinely distinctive,
  but large display type spends vertical space the browser chrome has already consumed.
- **Depth field** (stacked translucent planes with focus parallax) — most striking, but reads as
  glassmorphism, and `backdrop-filter` plus parallax is expensive on the target hardware.

Schematic wins on the brief's first requirement, *intuitive*: a viewer already knows how to read a
ruled, labelled drawing. It also renders with nothing more costly than borders and text, and it
gives the newly permitted monospace face a real job rather than a decorative one.

### 3.2 Complexity model: depth on demand

Surfaces are genuinely spare at rest — few elements, generous space. Complexity is layered behind
user intent: focus, hover, tap, or keypress expands an annotation region into a dense block. First
glance is calm; sustained use reveals a deep tool. This dissolves the apparent contradiction
between "minimalist" and "complex."

Because every reveal is user-triggered, DESIGN.md's existing prohibition on ambient motion
survives intact.

## 4. Foundation

### 4.1 New module: `src/styles/schematic.css.ts`

Absorbs and partly replaces `src/styles/material.css.ts`.

| Export | Purpose |
|---|---|
| `RULE` | Hairline vocabulary: `hair` (0.5px), `major` (1px), `accent`. Replaces per-file border strings. |
| `field(density)` | The ruled grid as a `repeating-linear-gradient` recipe. `density` is one of `"fine"` (8px), `"base"` (16px), `"coarse"` (32px) — not a raw number, so pages cannot invent off-scale grids. |
| `MARK` | Corner registration brackets and axis ticks. Promoted from NewTab-local to shared. |
| `titleBlock()` | Page header recipe: eyebrow, title, monospace meta row. |
| `ANNO` | Annotation tier: 11px, weight 500, `tabular-nums`, 0.02em tracking. |
| `EASE` / `DUR` | Retained unchanged from `material.css.ts`. |

### 4.2 Retired

Both belong to the "backlit instrumentation" metaphor — soft, physical, lit. Schematic is flat ink
on paper, with depth from rules and alignment rather than simulated light. Keeping either would
leave two metaphors competing on one page.

- `atmosphere()` — the accent bloom, counter-bloom and grain page backdrop.
- `edgeLit` / `edgeLitStrong` — the top-edge highlight.

Call sites in the three slice pages are migrated. Call sites in the six pass-2 pages keep working
until pass 2; the exports are not deleted until the final page is migrated.

### 4.3 Typography

Add `--civil-font-mono` as a system stack: `ui-monospace, SFMono-Regular, Menlo, monospace`. Zero
packages, zero download.

Division of labour:

- **Rubik** — prose, labels, titles, controls. Unchanged.
- **Mono** — numerals, hostnames, timings, scores, IDs, dimensions, annotations.

`font-variant-numeric: tabular-nums` on the mono tier so numeric columns align.

This breaks DESIGN.md's One-Family Rule deliberately.

### 4.4 Palette usage

Macchiato is retained, used differently: surface tiers read as *paper* tiers, accents read as
*ink*. Lavender stays the chrome accent, mauve stays the Filter Checker's ink accent — the
two-lane distinction survives even though the rule was unlocked, because it is still coherent.

## 5. Primitives

New directory `src/components/schematic/`. Seven single-purpose components.

| Primitive | Responsibility | Depends on |
|---|---|---|
| `Sheet` | Page plane: ruled field, registration marks, optional title block | `schematic.css.ts` |
| `TitleBlock` | Eyebrow, title, mono meta row | `schematic.css.ts` |
| `Rule` | Labelled hairline with optional dimension caps. The signature element | `schematic.css.ts` |
| `Plate` | Bounded sub-region inside a sheet — corner ticks, not a border box. Replaces "card" | `schematic.css.ts` |
| `Anno` | Mono annotation, tabular numerals | `schematic.css.ts` |
| `Unfold` | The depth-on-demand container | `schematic.css.ts`, `EASE`/`DUR` |
| `Field` | Schematic input: hairline underline, mono value, margin label | `schematic.css.ts` |

Each is pure render plus ARIA. None reaches into application state.

### 5.1 `Unfold` specification

The one primitive whose details carry risk, because reveal-based UI excludes keyboard and touch
users by default.

- The **trigger** is focusable, not the container.
- Responds to hover, `focus-visible`, and Enter / Space.
- Trigger carries `aria-expanded` and `aria-controls`.
- Collapsed content stays in the DOM but receives `aria-hidden="true"` and `inert`, so it is
  neither announced nor tabbable.
- Animates `grid-template-rows: 0fr → 1fr` with `overflow: hidden`, so siblings do not reflow.
- Touch has no hover: tap toggles. The corner registration tick is the hit target.

## 6. Icon and loader indirection

The user is authoring a new icon set and logo in vector software, and will supply them later. The
redesign must not make that swap expensive.

- New `src/components/icons/index.ts` exports semantic names (`IconSearch`, `IconClose`,
  `IconRefresh`, …) that currently alias `solid-icons`. The 17 files importing from
  `solid-icons/{bi,cg,fa,tb}` import from this module instead.
- When the new set arrives, the swap is one file with no page churn.
- `LoadingAnimation.tsx` keeps its current public API so replacing `@lottiefiles/dotlottie-web`
  likewise touches no callers.

No packages are removed in this pass. `echarts`, `@catppuccin/palette`, `@leeoniya/ufuzzy` and
`@atlaskit/pragmatic-drag-and-drop` all stay.

## 7. Pages

Each page keeps a distinct silhouette, per DESIGN.md's existing principle that no two pages should
share a structure by coincidence.

### 7.1 New Tab — title sheet

Current state: wordmark, tagline, search bar wrapped in corner brackets and axis ticks, ad notice.
It already gestures at this direction.

- Sheet with a ruled field and registration marks at top-left, top-right and bottom-right. The
  fourth corner is deliberately unmarked because the title block occupies bottom-left, which is
  where a real drawing puts it.
- The wordmark becomes a **drawing title block** at bottom-left: `Civil`, then a mono meta row
  (revision, session type).
- The omnibox sits centred on the primary rule with dimension caps at each end.
- The ad notice becomes a labelled margin note (`note 01`) rather than an apologetic sentence.
  PRODUCT.md treats ad revenue as a fixed constraint; this keeps the slot and stops it reading as
  an afterthought.

**Unfold:** focusing the omnibox expands a mono status strip beneath it — detected filter vendors,
chosen engine, transport, Wisp version, latency. At rest none of it is visible.

**Data source:** `/api/best-proxy` and the `detectedFilters` localStorage key, both already
populated. No backend work.

### 7.2 Apps — parts plate

Current state: add bar, grid of `appCard`s with icon stage, name bar and an always-visible remove
button, empty state with ghost tiles.

- The grid becomes a parts plate. Each app is a numbered position (`01`…`n`) aligned to the ruled
  field, marked by corner ticks rather than a card border.
- The add bar becomes a `Field` on the plate's top rule, labelled `add item`.
- Empty state becomes ghost positions with dimension callouts.

**Unfold:** hovering or focusing a tile expands its annotation — hostname, date added, and the
remove action. Remove stops being permanently visible, which is what lets the plate read as calm
at rest.

### 7.3 Filter Checker — test report

Current state: header with a lavender→mauve gradient title, detected-filter badges, form, one
result card per vendor with status variants, spinner, rescan button. 865 lines in one file.

- Reads as a test report sheet. Title block top-left with mono report meta (vendor count,
  specimen URL).
- Detected filters become a labelled specimen row.
- The form becomes `Field` rows sitting on rules.
- **Results become a ledger**, not cards: one row per vendor with aligned mono columns — vendor,
  verdict, latency, category count. Verdict carries the existing status colour.
- The gradient headline is removed. A gradient text fill cannot coexist with flat ink.

**Unfold:** a result row expands into the full vendor breakdown — the actual verdict discriminant,
category chips, the typed error variant, and retry.

**Why this is the slice's biggest functional win.** Every `misc/filters/*/checker.ts` returns a
`neverthrow` `Result` with a typed error union (`INVALID_URL`, `NETWORK`, `PARSE`) and
vendor-specific verdicts (`LOCKED`, `PAUSED`, `UNMONITORED`, `NO_SESSION`). The current card UI
flattens most of that into a colour. Surfacing the discriminant turns "it didn't work" into "the
vendor changed its response shape" — information the backend already computes and the UI currently
discards.

### 7.4 Component split

`FilterCheckPage.tsx` (865 lines) becomes:

- `FilterCheckPage.tsx` — composition
- `FilterCheckForm.tsx`
- `FilterCheckResults.tsx`
- `filterCheckVendors.ts` — vendor metadata

No refactoring is proposed outside the three slice pages.

## 8. Accessibility

- `Unfold` requirements are specified in §5.1 and are the primary accessibility risk.
- **Contrast correction:** DESIGN.md's `overlay1` (`#8087a2`) on `base` (`#24273a`) is
  approximately 4.0:1, which fails WCAG AA for small text. The annotation tier is 11px, so
  annotations use `subtext0` (`#a5adcb`, approximately 6.6:1). Decorative rules and ticks may stay
  on darker tiers, where contrast requirements do not apply.
- Decorative marks (registration brackets, axis ticks, field gradient) carry `aria-hidden="true"`.
- `Field` associates its margin label with its input via `for` / `id`.
- The existing global `:focus-visible` ring is retained.

## 9. Motion

- Every reveal is user-triggered, so no ambient motion is introduced.
- `Unfold` uses `DUR.base` with `EASE.enter`.
- The reduced-motion handling in `global.css.ts` collapses durations rather than disabling
  animations, so unfolding still completes when motion is reduced.

## 10. Performance

Primary hardware is low-end school Chromebooks.

- No `backdrop-filter`, no blur, no animated shadows.
- The ruled field is one repeating gradient on one element.
- Only `transform`, `opacity` and `grid-template-rows` animate.

## 11. Empty and error states

Schematic improves these rather than degrading them.

| State | Treatment |
|---|---|
| Apps, empty | Ghost positions with dimension callouts |
| Filter check failed | Ledger row carrying its actual error discriminant |
| Service worker unavailable | Labelled margin note. Currently only a `console.error` in `swUtils.ts` — a real gap |
| Proxy probe failed | Status strip shows the fallback engine explicitly rather than silently |

## 12. Testing

The primitives are the first genuinely unit-testable components in the codebase.

- Add `vite-plugin-solid` to `vitest.config.ts`. `happy-dom` is already installed.
- Tests live in `src/components/schematic/*.test.tsx`.

Coverage:

| Target | Assertions |
|---|---|
| `Unfold` | Collapsed and expanded state; keyboard activation via Enter and Space; `aria-expanded` tracks state; collapsed content is `inert` and `aria-hidden` |
| `Rule` | Label renders; decoration is `aria-hidden` |
| `Field` | Label is associated with input |
| `Sheet` | Registration marks are `aria-hidden`; children render |

Behaviour and accessibility only. No screenshot or visual-regression tests.

Existing tests must continue to pass. `bun run check`, `bun run test` and `./build.sh` all gate the
work.

## 13. Verification

There is no dev server (`bun dev` was removed; `start:watch` does not rebuild the client), so
visual verification is `./build.sh` followed by `bun run start:watch`, then loading `/newtab`,
`/apps` and `/checkfilters`.

One wrinkle to plan around: `NewTabPage.tsx` wraps its search bar in `<Show when={inFrame()}>`, so
visiting `/newtab` directly renders the title block but **not** the omnibox — and therefore not the
status-strip unfold. Verifying that unfold requires opening New Tab inside the browser chrome
(via `/`), not as a standalone route. The plan should state which surface each page is checked on.

## 14. Documentation

Final task, in the order the user requested: implement first, then bring DESIGN.md back into
truth. The rewrite covers:

- New north star: stealth chrome, schematic interior.
- The sheet model and the seven primitives.
- The mono tier and the retirement of the One-Family Rule.
- The corrected annotation contrast value.
- An explicit record of which rules were retired and why, so `atmosphere()` is not reinstated by
  someone assuming it was lost by accident.

MAINTENANCE.md gains a section on the schematic primitives and the icon indirection layer.

## 15. Out of scope

- The browser chrome (`BrowserChrome.tsx`, `SearchBar*`, `BookmarksBar`, `TabPill`, `UrlBar`,
  `TabSearch`, `ContextMenu`, `ExtensionIconBar`).
- The six pass-2 pages: bookmarks, history, extensions, benchmarks, ban, baninfo.
- Icon set and loading animation assets.
- Removing any third-party package.
- Palette changes.
- Backend or API changes of any kind.

## 16. Risks

| Risk | Mitigation |
|---|---|
| Reveal-based UI excludes keyboard and touch users | `Unfold` spec in §5.1; tests in §12 |
| Two metaphors coexisting during pass 1 | `atmosphere()` / `edgeLit` exports retained until pass 2 migrates the last page; slice pages use neither |
| Schematic reads as cold or unfinished | Rubik retained for all prose; mono confined to data |
| 11px annotations too small to read | Contrast raised to `subtext0`; 11px is the floor, not a target |
| Pass 1 direction rejected after build | Precisely why the slice is three pages and not nine |
