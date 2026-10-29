# Icons

How Civil icon set built, rules new glyph must follow.
All here = what `src/components/icons/index.tsx`,
`src/styles/icons.css.ts`, `src/components/Specimen.tsx` actually do.

## Why a custom set

App once borrowed from four vendor families (Tabler, Boxicons, Font
Awesome, CG); agreed neither with each other nor product. One set, drawn
on app's own grid, replaced them. `components/icons` = single swap point:
every component imports named glyphs from there, nothing imports icon package.

## The grid

Icons render 13–17px in chrome, 24–36px in specimens. Drawn on **16-unit
grid** so dominant sizes sit near native scale, not 24-unit drawing halved.

- **Grid:** 16 × 16, ink centred on 8,8. `geometry.test.tsx` checks each
  glyph's centre vs own box; only exemption Patreon mark.
- **Stone:** every glyph solid, cut from same stone as Doorway logo. Bars
  2.2 units (1.8 rings, frames, rays), ends square, joins mitred, no
  round caps. Corners square or quadrant like logo door head (`IconCheck`
  and `IconSpinnerFilled` tiles, `IconApps`). Overlapping pieces knocked
  out even-odd, logo's XOR rule: `IconClose` diamond (same as wordmark X),
  interlocked `IconLink`. `IconLock` keyhole = tiny Doorway;
  `IconTrash` lid ajar.
- **Paths:** fills only, absolute M/L/C/Z (geometry test reads no arcs). One
  `<path>` per moving part, so gestures move lid, hand, knob alone.
- **Verdicts:** each verdict glyph distinct by shape, not fill:
  check tile, ban, alert, close, empty-socket tile (`IconSpinnerFilled`).
  Bookmark state reads by mass: `IconBookmarkFilled` solid,
  `IconBookmarkOutline` hollow rim.
- **Colour:** never baked in. Context tints: ash rest, firn hover,
  cobalt active, verdict tone in filter report.
- **Mirrors:** back/forward = one drawing reflected; test enforces.

## Depth: every glyph is a small solid

`icon()` factory draws each glyph three times from one path source, layers
never drift out of register:

1. **Extrusion**: heavier copy (shape + hairline outline) in
   `currentColor` sunk toward basalt, offset 0.45 right, 0.7 down.
2. **Rim**: firn-warmed copy at 55%, offset 0.35 left, 0.45 up. Shows
   upper-left edges only, where light comes from.
3. **Face**: glyph in `currentColor` on top.

On glyph hover, control hover, or control keyboard focus, face and rim lift
further 0.35 up-left, extrusion stays; solid deepens (260ms). Each glyph
plays own act once (`gestures` in `icons.css.ts`) on all three layers:
arrows dash, close blades snip (diamond stretches to slit), tick wipes and
redraws, socket blinks, bookmark loads and snaps like trap, lid flips,
shackle unlocks, knob pops, globe meridians turn, apps tiles iris round,
faders ripple, dots wave, out-arrow leaves via its corner, returns via
opposite. Rim runs 90ms behind face, extrusion 30ms behind, so copies part
mid-act like exposures of one motion, restack on landing. Hover waits 80ms
first, so pointer crossing toolbar starts nothing. Once started, act plays
to end: `lib/acts.ts` latches `data-act` on glyph at first frame, clears
when last part ends; stylesheet matches latch like hover, so leaving
mid-act never snaps to rest. Every act starts/ends at rest: part shows
drawing while waiting and after end; reduced motion keeps only last frame.
Rotations end on turn mapping glyph onto itself. Reduced-motion users get
stationary glyphs. Safari lacks CSS `d`, drops morph keyframes (snip,
tick, socket, ribbon); there `lib/acts.ts` replays each as SMIL from
`glyphMorphs` exported by `icons.css.ts` (`styles/morph.ts`).

## Specimens: large icons

`Specimen` sets one glyph in mineral tile. Tile = palette tone lit from
upper left, grained, banded down side in same tone sunk toward basalt.
Inside, glyph extrusion and rim hidden; face lit by `#civil-emboss`
(Document.tsx): fractal grain folded into glyph's softened alpha as height
map, specular light upper left, hard basalt drop. Hovering tile, or its
control, tilts it toward reader, lifts glyph on own plane, sweeps sheen
across face.

Tints: `cobalt`, `stone`, `juniper`, `calcite`, `sandstone`, `wine`.
Every tile takes firn glyph: emboss's hard basalt drop draws edge even on
light minerals, where basalt glyph, solid since Stone set, read as black
hole. Each destination keeps mineral everywhere: Apps cobalt, Bookmarks
calcite, History juniper, Extensions sandstone, Filter check stone, Restricted
domains wine. Empty states use stone specimen of page glyph. Specimen
always decorative, labelled in text beside it.

## Adding a glyph

- Draw on grid above in Affinity Designer, one 160px artboard per glyph
  (grid ×10), each part own layer; expand strokes, export SVG, divide by 10.
  Name `Icon<Thing>`, export from `components/icons/index.tsx` via
  `icon(name, body)`.
- Give act in `icons.css.ts` `gestures` under its `data-icon` name,
  addressed by path order (`"1"`, `"2"`, …). Animate drawing, never box;
  keyframes start/end at rest. `d` morphs need same commands, same order,
  as path replaced, so variants with different paths need own `data-icon`
  name (bookmark, bookmark-filled, bookmark-outline). Morph frames land in
  `glyphMorphs` for Safari replay automatically; give them `cubic-bezier()`
  timing only, which SMIL takes. `lib/acts.test.tsx` holds every morph to
  one structure starting and ending on drawing.
- Every icon accepts `size` (number) and `class`, paints with
  `currentColor`. That = whole contract app depends on.

## Wordmark

Civil Proxy lockup (Doorway: two stone slabs XOR into lit door, then
CIVIL PROXY in grown Plex Bold caps, X knocked out by same XOR) lives in
`components/Wordmark.tsx`, `public/assets/civil-wordmark.*`, favicon,
loader mark. Mark on same 16-unit grid as glyphs: one cell = one favicon
pixel, so 16px favicon draws without grooves, stays crisp.

In `Wordmark.tsx` each course, door, letter = own `<path>`, so lockup plays
own act (`Wordmark.css.ts`) on hover/focus: tall slab strains, sticks,
slips into short slab, ratchets home; door, being their overlap, widens by
right jamb alone (zero-length `H` in path), so every held pose stays exact
XOR. Jolt then crosses CIVIL PROXY by each cap's distance from door, feet
kick forward, tops lean back (forward lean fuses tops at I|V and V|I). X
drawn as two bars filled even-odd, so it swings them upright onto each
other, vanishes an instant (A xor A), springs back. Y whips. Hover and
focus wait 120ms; act plays to end through same latch as glyphs, door and
X replayed as SMIL in Safari. Static copies (`civil-wordmark.*`, favicon)
keep combined outlines; render same.