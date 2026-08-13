# Icon and logo brief

Working brief for the custom Civil icon set and wordmark, drawn in Affinity.
Everything here is measured from the shipped app, not assumed.

## Why a custom set at all

The app currently borrows from four vendor families — Tabler (24 icons),
Boxicons, Font Awesome and CG — and they do not agree with each other or with
the product.

The specific conflict is geometric, not stylistic. DESIGN.md's chrome rule is
absolute: *"no border radius anywhere; corners are square."* Tabler draws round
caps and round joins. So every icon in the app currently contradicts the one
rule the interface is most consistent about. A custom set does not need to be
more decorative than Tabler to be better — it needs to be square.

## The size problem, which decides the grid

Measured across the codebase, by frequency:

| size | uses |
|---|---|
| 13px | 18 |
| 14px | 15 |
| 15px | 8 |
| 17px | 3 |
| 16px | 2 |
| 12px | 2 |
| 11px, 10px | 1 each |
| 20 / 24 / 40px | 1 each (avatar, empty state) |

**Icons in Civil render at 13–15px.** That is small. Tabler is drawn on a 24px
grid with a 2px stroke, so at 13px the stroke lands at ~1.08px — it never sits
on a whole pixel, which is why the current icons read slightly soft against a
UI built from crisp 0.5px and 1px rules.

Draw on a **16px grid with a 1.25px stroke**, not 24/2. At the dominant 13–15px
render sizes the geometry stays near its native scale instead of being reduced
by nearly half, and the stroke resolves close to a whole pixel.

## Spec

- **Grid:** 16 × 16, 1px safe margin, 14 × 14 live area.
- **Stroke:** 1.25px, centre-aligned, expanded to outline on export.
- **Caps:** butt. **Joins:** miter. No rounded terminals anywhere.
- **Corners:** square. A 90° corner stays 90°.
- **Angles:** 0 / 45 / 90 only. Anything else has to earn it.
- **Fill:** none by default. Three icons are deliberately filled and keep it —
  `IconSpinnerFilled`, `IconAlert`, `IconCheck` — because they are verdict
  glyphs in the filter report where filled/hollow is a channel.
- **Colour:** never baked. Everything inherits `currentColor`; the app tints
  with `ember` for resting glyphs and `sirius` for active. Export monochrome.
- **Optical sizing:** a circle and a square of the same bounding box do not read
  the same size. Let circles overshoot the live area by ~0.5px.

## The set — 31 icons

Grouped by where they appear, because that is what makes them consistent.

**Chrome and navigation (8)** — the drawing border
`IconArrowLeft` `IconArrowRight` `IconForward` `IconRefresh` `IconPlus`
`IconClose` `IconChevronDown` `IconSearch`

**Address and state (4)** — the identification strip
`IconLock` `IconWorld` `IconLink` `IconArrowUpRight`

**Verdicts (5)** — filter report, ban pages; filled/hollow is meaningful
`IconCheck` `IconAlert` `IconBan` `IconSpinner` `IconSpinnerFilled`

**Objects (6)** — the things pages are lists of
`IconBookmark` `IconBookmarkFilled` `IconBookmarkOutline` `IconPuzzle`
`IconClock` `IconTrash`

**Panels (4)** — devtools docking
`IconLayoutNavbar` `IconLayoutSidebar` `IconLayoutSidebarRight`
`IconLayoutBottom`

**Transfer (2)**
`IconUpload` `IconLoader` (+ `IconLoaderDots`)

**Third-party (1)** — `IconPatreon`. Keep the recognisable mark; it is a brand
asset, not ours to redraw. Only the container was restyled.

## Wordmark

Currently the word "Civil" set in IBM Plex Sans 600 at `clamp(24px, 3.4vw, 31px)`,
sitting bottom-left of the New Tab sheet under a major rule, as a drawing's
title block. That placement works and should survive.

Direction worth trying, from the product's own material:

- The name is *Civil* — plain, civic, unspectacular on purpose. The mark should
  not look like a VPN shield or a lightning bolt; the whole positioning is that
  the competition shouts and Civil states.
- The palette is an alpine lake at night, and the New Tab is a star chart. A
  mark built from the drawing vocabulary already on screen — a registration
  corner, a horizon rule, a catalogued point — would be continuous with the
  product rather than applied to it.
- It has to survive 16px as a favicon and monochrome on a filter's block page.
  Test both before falling in love with anything.

## Integration

`src/components/icons/index.ts` is the single swap point, and it exists for
exactly this. Every component imports named icons from there; nothing imports
`solid-icons` directly. When the set lands, that one file changes and the
`declare module "solid-icons"` augmentation in `src/global.d.ts` comes out with
it.

Each icon must accept `size` (number) and `class`, and paint with
`currentColor`. That is the whole contract the app depends on.
