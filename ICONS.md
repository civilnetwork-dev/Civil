# Icons

How Civil's icon set is built, and the rules a new glyph has to follow.
Everything here is what `src/components/icons/index.tsx`,
`src/styles/icons.css.ts` and `src/components/Specimen.tsx` actually do.

## Why a custom set

The app once borrowed from four vendor families (Tabler, Boxicons, Font
Awesome and CG) that agreed neither with each other nor with the product. One
set, drawn on the app's own grid, replaced them. `components/icons` is the
single swap point: every component imports named glyphs from there and nothing
imports an icon package.

## The grid

Icons in Civil render at 13 to 17px in the chrome and at 24 to 36px inside
specimens. They are drawn on a **16-unit grid** so the dominant sizes sit near
the native scale instead of a 24-unit drawing reduced by half.

- **Grid:** 16 × 16, ink centred on 8,8. `geometry.test.tsx` checks every
  glyph's centre against its own box; the only exemption is the Patreon mark.
- **Stroke:** 1.35 units, round caps and joins, `currentColor`.
- **Fill:** none by default. Verdict glyphs whose filled or hollow state is a
  channel (`IconCheck`, `IconAlert`, `IconSpinnerFilled`) and a few solid marks
  are filled.
- **Colour:** never baked into a glyph. Context tints it: ash at rest, firn on
  hover, cobalt when active, a verdict tone in the filter report.
- **Mirrors:** back and forward are one drawing reflected; a test holds them to
  it.

## Depth: every glyph is a small solid

The `icon()` factory draws each glyph three times from the one path source, so
the layers can never drift out of register:

1. **Extrusion**: a heavier copy (2.1 stroke, or the shape plus a hairline for
   filled glyphs) in `currentColor` sunk toward basalt, offset 0.45 right and
   0.7 down.
2. **Rim**: a firn-warmed copy at 55% offset 0.35 left and 0.45 up. It shows
   on the upper-left edges only, which is where the light comes from.
3. **Face**: the glyph in `currentColor` on top.

On the glyph's own hover, its control's hover, or its control's keyboard
focus, the face and rim lift a further 0.35 up-left while the extrusion stays,
so the solid visibly deepens (260ms). Each glyph also has its own gesture in
`icons.css.ts`, applied to all three layers so the solid moves as one piece:
meridians narrow, hands turn, panel dividers slide, arrows extend, on the same
260ms decelerating curve as the lift and as the slab the glyph sits on.
Reduced-motion users get stationary glyphs.

## Specimens: large icons

`Specimen` sets one glyph in a mineral tile. The tile is a palette tone lit
from the upper left, grained, and banded down its side in the same tone sunk
toward basalt. Inside it the glyph's extrusion and rim layers are hidden and
its face is lit by `#civil-emboss` (Document.tsx): fractal grain folded into
the glyph's softened alpha as a height map, specular light from the upper left,
and a hard basalt drop. Hovering the tile, or the control it sits in, tilts it
toward the reader, lifts the glyph on its own plane and sweeps a sheen across
the face.

Tints are `cobalt`, `stone`, `juniper`, `calcite`, `sandstone` and `wine`.
Light minerals take a basalt glyph, dark and saturated ones a firn glyph. Each
destination keeps its mineral everywhere: Apps cobalt, Bookmarks calcite,
History juniper, Extensions sandstone, Filter check stone, Restricted domains
wine. Empty states use a stone specimen of the page's glyph. A specimen is
always decorative and labelled in text beside it.

## Adding a glyph

- Draw it on the grid above, name it `Icon<Thing>`, and export it from
  `components/icons/index.tsx` through `icon(name, body, fill?)`.
- Give it a gesture in `icons.css.ts` under its `data-icon` name, addressed by
  path order (`"1"`, `"2"`, …). Animate the drawing, never its box.
- Every icon accepts `size` (number) and `class`, and paints with
  `currentColor`. That is the whole contract the app depends on.

## Wordmark

The Civil Proxy lockup (CIVIL stepping down into PROXY, the L's foot as the
P's roof) lives in `components/Wordmark.tsx`, `public/assets/civil-wordmark.*`,
the favicon and the loader's C. On the New Tab page it stands on two sediment
bands and a contact shadow, drawn with `drop-shadow` so the extrusion follows
the letter shapes.
