---
name: Civil Proxy
description: An alpine-lake star chart you can browse from — schematic drawing language, night-sky palette, one grammar across every surface
colors:
  void: "#071620"
  night: "#0C1F2B"
  dusk: "#122834"
  horizon: "#1B3543"
  haze: "#264556"
  dust: "#35596D"
  ember: "#5B7F94"
  cinder: "#7FA0B3"
  starlight: "#9FBACA"
  moonlight: "#C0D2DD"
  halo: "#D6E3EB"
  daylight: "#E6EFF4"
  sirius: "#71AFF7"
  vega: "#95CAFF"
  rigel: "#4895E0"
  aurora: "#7FD4D8"
  nebula: "#79BFB4"
  airglow: "#BAC48F"
  sol: "#E6D6A9"
  corona: "#E9C79B"
  arcturus: "#D69967"
  antares: "#D77679"
typography:
  display:
    fontFamily: '"Rubik", ui-sans-serif, sans-serif'
    fontSize: "clamp(28px, 4vw, 35px)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  title:
    fontFamily: '"Rubik", ui-sans-serif, sans-serif'
    fontSize: "clamp(24px, 3.4vw, 31px)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  body:
    fontFamily: '"Rubik", ui-sans-serif, sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  chrome:
    fontFamily: '"Rubik", ui-sans-serif, sans-serif'
    fontSize: "12.5px"
    fontWeight: 500
  annotation:
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.02em"
    fontVariantNumeric: "tabular-nums"
rules:
  hair: "0.5px solid {colors.horizon}"
  major: "1px solid {colors.haze}"
  accent: "1px solid {colors.sirius}"
fieldDensity:
  fine: "8px"
  base: "16px"
  coarse: "32px"
motion:
  easing:
    standard: "cubic-bezier(0.4, 0, 0.2, 1)"
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)"
    enter: "cubic-bezier(0.22, 1, 0.36, 1)"
  duration:
    fast: "0.11s"
    base: "0.18s"
    slow: "0.28s"
spacing:
  xxs: "4px"
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  xxxl: "48px"
---

# Design System: Civil Proxy

## Direction contract

**THESIS.** Civil is a star chart you can browse from. Every surface is a
measured drawing of one thing — a sky, a plate of parts, a run of time, a test
report — rendered in the palette of an alpine lake after dark. It refuses the
arrangement this category always ships: a dark dashboard of rounded cards on a
flat ground, with a neon accent doing the work that structure should do.

**OWN-WORLD.** Hairline rules on a ruled field, corner registration marks,
monospace annotations in the margins, and content seated on a sheet rather than
inside boxes. Surfaces descend into atmospheric depth (`void` → `dust`); accents
are stellar (`sirius`, `vega`, `rigel`) with status drawn from meadow, sun and
warm granite. Recognizable with every word removed: you would know it by the
rules, the registration marks, and the mono margin.

**STORY.** A student opens Civil behind a school filter, sees instrument-grade
precision rather than a toy, and trusts it with the thing they actually want —
reaching the open web. Depth is available but never in the way.

**FIRST VIEWPORT.** New Tab: a ruled sheet under a static star field, the
omnibox seated on the horizon rule at the vertical centre with dimension caps
marking its span, one catalogued star annotated with the live proxy engine, and
the wordmark set as a drawing's title block bottom-left.

**FORM.** Technical drawing / star chart. A chart *is* a drawing, which is what
lets the schematic grammar and the night-sky palette be one thing rather than
two competing ideas.

## Provenance

The palette is derived from a photograph of an alpine lake — granite, conifer,
glacial water under a deep sky — and re-voiced at night. The photograph supplies
the hues; the dark tones are ours. Each traces to a measured region of that image
via HCT tonal ramps: surfaces from the lake's shadowed water (H 239.5),
`sirius`/`vega`/`rigel` from the sky (H 270.4), `airglow` from the meadow
(H 115.1), `aurora`/`nebula` from the shallows (H 204), and the warm accents
from sunlit granite (H 82).

## Overview

**Creative north star: "The star chart."**

Civil reads as a measured drawing of the night sky. Dense and precise, but
rendered in low-saturation alpine tones rather than clinical grey, so precision
reads as calm. Depth is layered behind intent: surfaces are spare at rest and
expand on hover, focus or keypress, so the first glance is quiet and the fifth
minute is deep.

Every surface shares one grammar — one sheet system, one type scale, one motion
set, one rule vocabulary — but each earns a signature structure from the job it
actually does. Consistent to use, never monotonous.

### Superseded north stars

Two earlier directions are recorded here so nobody reinstates them by accident:

- **"The Stealth Cockpit" (retired).** The original brief was a chrome that could
  sit open on a shared screen "without drawing a glance." The owner has since
  chosen to redesign the browser chrome into this language. **That trade is
  deliberate and its cost is real:** Civil is now more conspicuous on a shared
  school screen than a plain browser would be. Anyone reopening the stealth
  question is reopening a settled decision, not discovering an oversight.
- **Catppuccin Macchiato + "backlit instrumentation" (retired).** `atmosphere()`,
  `edgeLit`, and the bloom/grain backdrop belong to that world. They are not
  compatible with flat ink on paper and must not return. Remaining exports in
  `material.css.ts` survive only until the last unmigrated page stops importing
  them.

## Colors

Twelve neutral tiers and ten accents. Contrast below is measured against `dusk`,
the active content plane.

### Surfaces, descending into depth

| token | hex | on dusk | role |
|---|---|---|---|
| `void` | `#071620` | 1.20 | outermost frame |
| `night` | `#0C1F2B` | 1.11 | panels, dropdowns, menus |
| `dusk` | `#122834` | 1.00 | the active content plane |
| `horizon` | `#1B3543` | 1.19 | raised surface, hairline rules |
| `haze` | `#264556` | 1.50 | hover, major rules |
| `dust` | `#35596D` | 2.03 | strongest border |

### Text, and the one tier that is not text

| token | hex | on dusk | use |
|---|---|---|---|
| `ember` | `#5B7F94` | 3.56 | **non-text only** — icons, rules, ticks |
| `cinder` | `#7FA0B3` | 5.50 | muted annotation |
| `starlight` | `#9FBACA` | 7.51 | annotation |
| `moonlight` | `#C0D2DD` | 9.79 | body |
| `halo` | `#D6E3EB` | 11.64 | emphasis |
| `daylight` | `#E6EFF4` | 13.07 | primary text |

### Accents

`sirius` 6.66 (chrome), `vega` 8.83 (tools), `rigel` 4.82, `aurora` 8.93,
`nebula` 7.20.

### Status

| verdict | token | hex | on dusk |
|---|---|---|---|
| allowed | `airglow` | `#BAC48F` | 8.25 |
| warned | `sol` | `#E6D6A9` | 10.56 |
| error | `arcturus` | `#D69967` | 6.25 |
| blocked | `antares` | `#D77679` | 4.90 |

### Named rules

**The Measured Contrast Rule.** Every value above is measured, not estimated.
Text at 11px uses `starlight` or `cinder`; nothing dimmer. `ember` fails AA for
small text at 3.56 and is reserved for glyphs and rules, where WCAG 1.4.11's 3:1
non-text threshold applies instead.

**The Lightness-Separated Status Rule.** The four verdicts are separated by
*lightness*, not hue: 8.25 / 10.56 / 6.25 / 4.90. Hue separation is worthless to
the ~1% of people with deuteranopia — an earlier palette put allowed and blocked
at ΔE 4.9 under that simulation, indistinguishable, which is the worst pair in a
verdict system to confuse. They now read as clearly different greys even under
achromatopsia.

**The Redundant-Channel Rule.** Colour is never the only carrier of a verdict.
Every status appears as text, as a distinct glyph, and as colour — three
channels. Collapsing two statuses onto one glyph is a WCAG 1.4.1 regression even
when the colours differ.

**No pure black, no pure white.** The deepest surface is `#071620` and primary
text is `#E6EFF4` at 13.07:1, where pure white would be 15.23:1. Pure black
against light text causes halation; pure white is needlessly harsh on a dark
ground at night.

## Typography

**One family plus one mono.** Rubik carries everything a person reads as
language. A system monospace stack carries everything that is data: numerals,
hostnames, timings, scores, IDs, dimensions, coordinates.

The One-Family Rule of the previous system is **retired**. The mono tier is not
decoration — a schematic drawing annotates in mono, and `tabular-nums` is what
makes columns of figures align.

## The sheet model

Every interior surface is a **sheet**: a bounded plane carrying a ruled field,
corner registration marks, a title block, and a margin for annotations.

Registration marks default to **three** corners — top-left, top-right,
bottom-right. Bottom-left is left unmarked because that is where a drawing puts
its title block, and leaving it open is what seats the block on the sheet rather
than floating it.

## Primitives

Seven, in `src/components/schematic/`. Pages compose these; pages do not invent
their own equivalents.

| primitive | job |
|---|---|
| `Sheet` | the page plane — ruled field, registration marks |
| `TitleBlock` | eyebrow, title, mono meta row |
| `Rule` | a **labelled** hairline with optional dimension caps |
| `Plate` | a bounded region — corner ticks, not a border box |
| `Anno` | mono annotation, tabular numerals |
| `Unfold` | the depth-on-demand container |
| `Field` | labelled input on a rule, no box |

### `Unfold` is the only reveal mechanism

Do not hand-roll hover reveals. Its state machine is deliberate and was fixed
after real defects: `pinned` (explicit, click/Enter/Space, cleared by a second
activation or Escape) OR `hovered` (**mouse only**, gated on
`pointerType === "mouse"`) OR `focusHeld` (a hold, never an opener).

Touch must never set `hovered`: mobile browsers synthesise a `mouseenter` before
every tap's `click` and fire no `mouseleave` until the user touches elsewhere, so
treating touch as hover leaves the toggle dead on the second tap. Focus must
never open: it made `aria-expanded` read true before any keypress, so activation
gave no feedback. Collapsing refocuses the trigger first, because collapsed
content becomes `inert` and cannot hold focus.

## Per-page signatures

One grammar, distinct silhouettes. Each is earned by the job the page does.

| surface | signature |
|---|---|
| New Tab | title sheet — star field, horizon rule, catalogued star, title block bottom-left |
| Apps | parts plate — numbered positions on a ruled field |
| Filter Checker | test report — a ledger of aligned mono columns |
| History | measured time rule |
| Bookmarks | index sheet |
| Extensions | specification rows |
| Benchmarks | instrument plate |
| Ban / Ban Info | notice sheet |
| Chrome | the frame of the drawing |

## Motion

Only two categories are permitted: **functional** (progress must be conveyed)
and **interactive feedback** (the user just touched this control). Nothing
animates at rest, on a timer, or without a user action behind it. The star field
is static — a twinkling sky would be ambient motion and would also defeat the
page's calm.

Durations and easings come from the tokens above. Three speeds, three easings,
system-wide.

`prefers-reduced-motion` collapses durations rather than disabling animation, so
transitions still reach their final frame and completion handlers still fire.

## Performance

Target hardware is low-end school Chromebooks.

No `backdrop-filter`. No `blur()`. No animated `box-shadow`. Only `transform`,
`opacity` and `grid-template-rows` animate. A ruled field is one repeating
gradient on one element, never per-cell DOM.

## Do's and Don'ts

**Do** compose the seven primitives. **Do** measure contrast before committing a
colour. **Do** give every status three channels. **Do** keep star fields and any
generated decoration deterministic — this app server-side renders, and
`Math.random()` produces a hydration mismatch and a visible flicker.

**Don't** reintroduce `atmosphere()`, `edgeLit`, or bloom. **Don't** use
`ember` for text. **Don't** hand-roll a reveal. **Don't** import `solid-icons`
directly — everything goes through `~/components/icons` so the pending custom
set is a one-file swap. **Don't** export a bare function from a `.css.ts` module:
vanilla-extract cannot serialize it and the production build fails the first time
a real page imports it.
