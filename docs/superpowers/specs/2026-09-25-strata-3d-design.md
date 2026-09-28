# Civil Proxy UI — Strata, a 3D material language

**Date:** 2026-09-25
**Status:** Direction approved (Strata, chosen over Firn and Basalt clay from a live mockup); spec pending review
**Scope:** Every surface of the app, the icon set and its hover motion, plus removal of the `/benchmarks` route

---

## 1. Problem

The owner wants the interface, and above all the icon set and its hover effects, to read as
three-dimensional and textured while staying on the Strata palette in `src/styles/palette.ts`.
Every page should feel alive but calm, every component should look 3D, everything interactive
should answer hover with a transition, and the result should look like no other site while
staying easy to read and use. The `/benchmarks` route goes, along with everything only it uses.

This reverses three rules in DESIGN.md: *flat palette surfaces*, *no animated shadows*, and *no
ambient decorative movement*. The owner's direction supersedes them; DESIGN.md is rewritten to
match (section 9). Two things from the old rules survive because they protect the primary user,
a student on a low-end school Chromebook: no `backdrop-filter`, and no blur-based effects on
large areas.

## 2. The idea

The palette is geological: basalt, stratum, scree, talus, firn, calcite, sandstone. Strata makes
that literal. Interactive things are **slabs** of layered stone whose visible side edge shows
sediment bands. Inputs are **wells** carved into the stone. Icons are **mineral specimens**:
polished, grained, palette-tinted tiles with the glyph raised out of them. Pages sit on a
**terrain** of faint survey contour lines that drift very slowly.

Height carries meaning, which is what keeps it easy to read: flat means text, raised means you
can press it, carved means you can type into it. Hover raises a slab one step; press sinks it into
its bed.

## 3. Material system (foundation)

All of it lives in `src/styles/material.css.ts` as build-time recipes used by other `.css.ts`
files, beside the existing `EASE`, `DUR`, `hairline()` and `hitArea()`.

| Recipe | What it is |
|---|---|
| `GRAIN` | Fractal noise baked into a tiny inline SVG, rasterised once and tiled. Laid as the top background layer on slabs, wells and pages. |
| `TERRAIN` | A seamless topographic contour tile, `public/assets/terrain.svg`, generated once from periodic noise with index contours every fifth line. |
| `edge(px, a, b)` | The strata edge: `px` one-pixel hard offset shadows alternating band tones `a`/`b`, then a soft contact shadow. Hard offsets paint once and cost nothing to hold. |
| `SLAB` levels | `chip` 2px, `key` 3px, `slab` 4px, `float` 6px edges. Face is a top-lit gradient of its surface, a 1px firn inner highlight, and grain. |
| `WELL` | Carved field: basalt gradient, inset shadow at the top, a light lip on the bottom edge. Focus fills the rim with cobalt meltwater. |
| `KEY` | Buttons. Primary is a cobalt slab with deep-cobalt strata and basalt text (keeps the existing 6:1 contrast; firn on cobalt would fail AA). Secondary is a stone slab. |
| `TINT` | Specimen mineral tones derived from palette slots with `color-mix(in oklab, …)`: highlight, face, band, deep band. Nothing off-palette. |
| motion | `lift` (spring, 320ms) for hover rise, `sink` (90ms) for press, `rise` entrance keyframe, `drift` for terrain. |

Band tones for neutral stone are palette mixes: talus into basalt and scree into basalt.

## 4. Icons

### 4.1 Glyphs (every icon, every size)

The single swap point stays `src/components/icons/index.tsx`, and its contract stays `size`,
`class`, `currentColor`. The `icon()` factory now draws each glyph three times:

1. **depth**: a thicker copy in `color-mix(currentColor, basalt)`, offset down and right. The
   extrusion.
2. **rim**: a firn-tinted copy offset up and left. The lit upper edge.
3. **face**: the glyph in `currentColor` on top.

On hover or parent keyboard focus the face and rim lift toward the viewer while the depth stays,
so the extrusion visibly deepens, and each glyph keeps its existing per-path gesture (arrows
extend, hands turn, meridians narrow), now applied to all layers so the solid moves as one.
Filled glyphs use the same three layers with fills. Path data does not change, so the geometry
tests stay meaningful.

### 4.2 Specimens (large icons)

New `src/components/Specimen.tsx`: a palette-tinted mineral tile holding one glyph. Used for the
New Tab emblem and shortcuts, every interior page's title emblem, empty states, the stop card,
and the 404.

- Tile: top-lit radial gradient of its tint, strata edge in deeper tones of the same tint, grain.
- Glyph: embossed by one shared SVG filter `#civil-emboss` (defined once in `Document.tsx`):
  turbulence-textured specular lighting inside the glyph plus a hard extrusion shadow.
- Hover (on the tile or its parent link): the tile tilts in 3D toward the viewer, the glyph rises
  on its own plane, and a specular sheen sweeps across the face.
- Tints: `cobalt`, `stone` (neutral), and the four mineral tones `juniper`, `calcite`,
  `sandstone`, `wine`. Light minerals carry a basalt inlay glyph, dark and saturated ones a firn
  glyph. Specimens are decorative and labelled; a verdict is never conveyed by a specimen tint
  alone, and on the filter report specimens are only used for their matching verdict.

## 5. Surfaces, component by component

| Area | Treatment |
|---|---|
| Page ground | Stratum, grain, a faint cobalt dawn glow at the top, and the terrain drifting on one fixed composited layer. Applies to New Tab and every Sheet. |
| Chrome | Tab strip is basalt bedrock. Tabs rise from it on hover; the open tab is the top of a terrace that continues into the toolbar and bookmarks shelf. The terrace ends in a strata cliff edge whose shadow falls onto the page below. Toolbar buttons are low keycaps; the address field is a well; suggestions float as a slab. |
| Bookmarks bar, extension icons | Pebbles (chip slabs) that rise on hover. |
| Menus and pickers | Context menu, tab search, suggestions: `float` slabs that rise in; rows lift into small raised chips on hover. |
| New Tab | Embossed wordmark, cobalt globe specimen with an occasional slow sheen, engraved heading, a deep search well with a cobalt Browse key, four specimen shortcuts (cobalt, calcite, juniper, sandstone) that tilt on hover. |
| Interior pages | TitleBlock gains a specimen emblem per page and an engraved title. Fields are wells, buttons keys, list rows chip slabs that lift and show their edge on hover, Unfold regions slide open. |
| Filter check | Result rows are slabs; verdicts keep text plus glyph plus colour, with verdict specimens. Strike gauge becomes a carved channel with a raised fill. |
| Stop card, toasts, Chii panel | `float` slabs. The stop card carries a wine ban specimen. |
| 404 | The numeral is extruded as layered strata text. |
| Loader | Keeps its API; the C mark gains the same extrusion. |

Every interactive element gets hover, press and focus-visible states. Static text does not move.

## 6. Motion

- Hover lift: `translateY(-2px)` plus a deeper edge, spring ease, 320ms. Press: sink, 90ms.
- Entrance: slabs rise 8px and fade in on first paint, staggered 40ms, decelerate only.
- Ambient, calm: terrain drift over minutes; dawn glow breathes over ~18s; the New Tab emblem
  sheen passes rarely. Nothing blinks, loops fast, or moves text.
- Reduced motion: the existing global rule collapses durations, so ambient loops stop and states
  change instantly. Tilts and lifts still show their end state; nothing animates.

## 7. Performance budget (low-end Chromebooks)

- No `backdrop-filter`, no blur on large areas, no filter animation.
- Grain and terrain are static images; the only ambient animation is `transform` and `opacity`
  on one layer per document.
- Box-shadow transitions only on the element under the pointer.
- The SVG lighting filter runs only on specimens, a handful per page at small pixel sizes.

## 8. Accessibility

- Text tokens and contrast pairs are unchanged; key text stays basalt on cobalt.
- The global cobalt focus ring is kept; wells show focus on the row, not the input.
- Decorative layers (depth, rim, specimens, terrain) are `aria-hidden` or CSS-only.
- Touch: everything reachable without hover, as today.

## 9. Documentation

- DESIGN.md: rewrite Elevation and Depth (the material system), Shapes, Components, the icon
  paragraph, and Do's and Don'ts; record why the flat rules were retired so they are not
  reinstated by accident.
- ICONS.md: replace the stale construction notes with the three-layer glyph and specimens.
- PRODUCT.md: drop the benchmarks page from the context and evidence lists.
- `palette.ts`: its header's echarts rationale goes with the route.

## 10. Removing `/benchmarks`

Delete `src/routes/benchmarks.tsx`, `src/components/BenchmarkChart.tsx`,
`src/lib/benchmarkConfig.ts`, `src/styles/BenchmarksPage.css.ts` and `tests/runBenchmarks.js`
(it only produces the route's data). Remove the `echarts` dependency (nothing else imports it),
the `build:benchmarks` script and its `build.sh` step, the `.fallowrc.json` entry, the
`.dockerignore` and `tests/.gitignore` lines, the stale `tests/benchmarks/**` lint ignore, the
Dockerfile comment, the filter-probe route entry, and regenerate `routeTree.gen.ts`. The
`$tests` alias stays because component tests use it; `tslib` stays because the server graph
uses it. `diagram.excalidraw` loses its benchmarks nodes.

## 11. Testing and verification

- Existing suites keep passing: `bun run test`, `bun run lint:check`, `bun run format:check`,
  `fallow dead-code`, and `vite build`.
- New tests: the icon factory draws depth, rim and face layers and stays `aria-hidden`; Specimen
  is `aria-hidden`, carries its tint, and renders its glyph.
- Visual verification in the dev server at 1366×768 and 390×844 on every page, with hover and
  focus states and reduced-motion emulation, and zero new console errors.

## 12. Out of scope

Palette values, the wordmark's geometry, the Patreon mark, backend and API code, and copy.
