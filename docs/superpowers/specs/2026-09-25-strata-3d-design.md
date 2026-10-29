# Civil Proxy UI: Strata, a 3D material language

**Date:** 2026-09-25
**Status:** Direction approved (Strata, picked over Firn, Basalt clay from live mockup); spec pending review
**Scope:** All app surfaces, icon set + hover motion, remove `/benchmarks` route

---

## 1. Problem

Owner want interface, esp. icons + hover, read 3D + textured, stay on Strata palette in `src/styles/palette.ts`.
Every page alive but calm, every component 3D, every interactive thing answer hover with transition. Look like no other site, stay easy read/use. `/benchmarks` route go, plus everything only it use.

Reverses three DESIGN.md rules: *flat palette surfaces*, *no animated shadows*, *no
ambient decorative movement*. Owner direction override; DESIGN.md rewritten to match (section 9). Two old rules stay — protect primary user, student on low-end school Chromebook: no `backdrop-filter`, no blur effects on large areas.

## 2. The idea

Palette geological: basalt, stratum, scree, talus, firn, calcite, sandstone. Strata make literal. Interactive things = **slabs** of layered stone, side edge show sediment bands. Inputs = **wells** carved in stone. Icons = **mineral specimens**: polished, grained, palette-tinted tiles, glyph raised out. Pages sit on **terrain** of faint survey contour lines, drift very slow.

Height = meaning, keeps readable: flat = text, raised = pressable, carved = typeable. Hover raise slab one step; press sink into bed.

## 3. Material system (foundation)

All in `src/styles/material.css.ts` as build-time recipes for other `.css.ts`
files, beside existing `EASE`, `DUR`, `hairline()`, `hitArea()`.

| Recipe | What it is |
|---|---|
| `GRAIN` | Fractal noise baked in tiny inline SVG, rasterised once, tiled. Top background layer on slabs, wells, pages. |
| `TERRAIN` | Seamless topo contour tile, `public/assets/terrain.svg`, generated once from periodic noise, index contour every fifth line. |
| `edge(px, a, b)` | Strata edge: `px` one-pixel hard offset shadows alternating band tones `a`/`b`, then soft contact shadow. Hard offsets paint once, free to hold. |
| `SLAB` levels | `chip` 2px, `key` 3px, `slab` 4px, `float` 6px edges. Face = top-lit gradient of surface, 1px firn inner highlight, grain. |
| `WELL` | Carved field: basalt gradient, inset shadow top, light lip bottom edge. Focus fill rim cobalt meltwater. |
| `KEY` | Buttons. Primary = cobalt slab, deep-cobalt strata, basalt text (keeps 6:1 contrast; firn on cobalt fail AA). Secondary = stone slab. |
| `TINT` | Specimen mineral tones from palette slots via `color-mix(in oklab, …)`: highlight, face, band, deep band. Nothing off-palette. |
| motion | `lift` (spring, 320ms) hover rise, `sink` (90ms) press, `rise` entrance keyframe, `drift` terrain. |

Neutral stone band tones = palette mixes: talus into basalt, scree into basalt.

## 4. Icons

### 4.1 Glyphs (every icon, every size)

Single swap point stay `src/components/icons/index.tsx`, contract stay `size`,
`class`, `currentColor`. `icon()` factory now draw each glyph three times:

1. **depth**: thicker copy in `color-mix(currentColor, basalt)`, offset down-right. The
   extrusion.
2. **rim**: firn-tinted copy offset up-left. Lit upper edge.
3. **face**: glyph in `currentColor` on top.

Hover or parent keyboard focus: face + rim lift toward viewer, depth stay, extrusion visibly deepen. Each glyph keep per-path gesture (arrows extend, hands turn, meridians narrow), now on all layers so solid move as one. Filled glyphs same three layers with fills. Path data unchanged, geometry tests stay meaningful.

### 4.2 Specimens (large icons)

New `src/components/Specimen.tsx`: palette-tinted mineral tile holding one glyph. Used for New Tab emblem + shortcuts, every interior page title emblem, empty states, stop card, 404.

- Tile: top-lit radial gradient of tint, strata edge in deeper tones same tint, grain.
- Glyph: embossed by one shared SVG filter `#civil-emboss` (defined once in `Document.tsx`): turbulence-textured specular lighting inside glyph + hard extrusion shadow.
- Hover (tile or parent link): tile tilt 3D toward viewer, glyph rise own plane, specular sheen sweep face.
- Tints: `cobalt`, `stone` (neutral), four mineral tones `juniper`, `calcite`,
  `sandstone`, `wine`. Light minerals = basalt inlay glyph, dark/saturated = firn glyph. Specimens decorative + labelled; verdict never shown by tint alone; on filter report specimens only for matching verdict.

## 5. Surfaces, component by component

| Area | Treatment |
|---|---|
| Page ground | Stratum, grain, faint cobalt dawn glow top, terrain drift on one fixed composited layer. New Tab + every Sheet. |
| Chrome | Tab strip = basalt bedrock. Tabs rise on hover; open tab = top of terrace continuing into toolbar + bookmarks shelf. Terrace end in strata cliff edge, shadow fall on page below. Toolbar buttons low keycaps; address field well; suggestions float as slab. |
| Bookmarks bar, extension icons | Pebbles (chip slabs) rise on hover. |
| Menus and pickers | Context menu, tab search, suggestions: `float` slabs rise in; rows lift to small raised chips on hover. |
| New Tab | Embossed wordmark, cobalt globe specimen with rare slow sheen, engraved heading, deep search well + cobalt Browse key, four specimen shortcuts (cobalt, calcite, juniper, sandstone) tilt on hover. |
| Interior pages | TitleBlock get specimen emblem per page + engraved title. Fields wells, buttons keys, list rows chip slabs lift + show edge on hover, Unfold regions slide open. |
| Filter check | Result rows slabs; verdicts keep text + glyph + colour, with verdict specimens. Strike gauge = carved channel, raised fill. |
| Stop card, toasts, Chii panel | `float` slabs. Stop card carry wine ban specimen. |
| 404 | Numeral extruded as layered strata text. |
| Loader | Keep API; C mark get same extrusion. |

Every interactive element get hover, press, focus-visible states. Static text no move.

## 6. Motion

- Hover lift: `translateY(-2px)` + deeper edge, spring ease, 320ms. Press: sink, 90ms.
- Entrance: slabs rise 8px + fade in first paint, stagger 40ms, decelerate only.
- Ambient, calm: terrain drift over minutes; dawn glow breathe ~18s; New Tab emblem sheen rare. Nothing blink, fast loop, or move text.
- Reduced motion: existing global rule collapse durations, ambient loops stop, states change instant. Tilts/lifts still show end state; nothing animate.

## 7. Performance budget (low-end Chromebooks)

- No `backdrop-filter`, no blur large areas, no filter animation.
- Grain + terrain static images; only ambient animation = `transform` + `opacity` on one layer per document.
- Box-shadow transitions only on element under pointer.
- SVG lighting filter only on specimens, handful per page, small pixel sizes.

## 8. Accessibility

- Text tokens + contrast pairs unchanged; key text stay basalt on cobalt.
- Global cobalt focus ring kept; wells show focus on row, not input.
- Decorative layers (depth, rim, specimens, terrain) `aria-hidden` or CSS-only.
- Touch: all reachable without hover, as today.

## 9. Documentation

- DESIGN.md: rewrite Elevation and Depth (material system), Shapes, Components, icon paragraph, Do's and Don'ts; record why flat rules retired so not reinstated by accident.
- ICONS.md: replace stale construction notes with three-layer glyph + specimens.
- PRODUCT.md: drop benchmarks page from context + evidence lists.
- `palette.ts`: header echarts rationale go with route.

## 10. Removing `/benchmarks`

Delete `src/routes/benchmarks.tsx`, `src/components/BenchmarkChart.tsx`,
`src/lib/benchmarkConfig.ts`, `src/styles/BenchmarksPage.css.ts`, `tests/runBenchmarks.js`
(only make route data). Remove `echarts` dependency (nothing else import), `build:benchmarks` script + its `build.sh` step, `.fallowrc.json` entry, `.dockerignore` + `tests/.gitignore` lines, stale `tests/benchmarks/**` lint ignore, Dockerfile comment, filter-probe route entry; regenerate `routeTree.gen.ts`. `$tests` alias stay (component tests use); `tslib` stay (server graph use). `diagram.excalidraw` lose benchmarks nodes.

## 11. Testing and verification

- Existing suites keep pass: `bun run test`, `bun run lint:check`, `bun run format:check`,
  `fallow dead-code`, `vite build`.
- New tests: icon factory draw depth, rim, face layers, stay `aria-hidden`; Specimen `aria-hidden`, carry tint, render glyph.
- Visual check in dev server at 1366×768 + 390×844 every page, hover + focus states, reduced-motion emulation, zero new console errors.

## 12. Out of scope

Palette values, wordmark geometry, Patreon mark, backend + API code, copy.