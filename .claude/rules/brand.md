---
paths:
  - "src/components/Wordmark.tsx"
  - "src/components/LoadingAnimation.tsx"
  - "public/assets/civil-wordmark.*"
  - "public/favicon.ico"
---
# Logo and wordmark

Logo = the Doorway (owner approved, 2026-10-25). Change every copy together: `src/components/Wordmark.tsx` (two-tone, viewBox 1729.44x226.6), `public/assets/civil-wordmark.svg` and `.png` (mono cobalt, door as hole), `public/favicon.ico` (16 px no grooves, 32 and 48 px banded, full-bleed tile), and `MARK_STONE` plus `MARK_DOOR` in `src/components/LoadingAnimation.tsx` (16-unit grid).

- Symbol on 256 grid of 16-unit cells: tall square slab L (32,16, 128x224) XOR shorter slab R (96,80, 128x160, r64 top-left corner) gives 64x160 door with quadrant head, lintel, one "kiss" point at (160,80). Stone firn, door cobalt, basalt tile. Courses split by 8-unit grooves at y 72, 128, 184.
- Wordmark: IBM Plex Sans Bold (wght 700) outlines grown 20 units (skia-pathops stroke union), tracked 44. PROXY's X = its two bars XOR'd into diamond knockout. Slabs stand on baseline; R's top at cap height.
- No .ai or Affinity source. Regenerate letterforms with `py -3.13`, fontTools, brotli, skia-pathops: instantiate `node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2` at wght 700, draw glyphs through SVGPathPen with y flipped, embolden, bake transforms. Pack favicon from per-size PNGs (PNG-entry ICO).