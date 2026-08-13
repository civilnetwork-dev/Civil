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
    fontFamily: '"IBM Plex Sans Variable", ui-sans-serif, system-ui, sans-serif'
    fontSize: "clamp(28px, 4vw, 35px)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  title:
    fontFamily: '"IBM Plex Sans Variable", ui-sans-serif, system-ui, sans-serif'
    fontSize: "clamp(24px, 3.4vw, 31px)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  lede:
    fontFamily: '"IBM Plex Sans Variable", ui-sans-serif, system-ui, sans-serif'
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: '"IBM Plex Sans Variable", ui-sans-serif, system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  chrome:
    fontFamily: '"IBM Plex Sans Variable", ui-sans-serif, system-ui, sans-serif'
    fontSize: "12.5px"
    fontWeight: 500
  readout:
    fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
    fontSize: "15px"
    fontWeight: 600
    fontVariantNumeric: "tabular-nums"
  annotation:
    fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
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
- **Catppuccin Macchiato + "backlit instrumentation" (retired, and now fully
  removed).** `atmosphere()`, `edgeLit`, `machined()`, `lit()`, `SHADOW` and
  `focusRing` belong to that world. They are not compatible with flat ink on
  paper and must not return.

  This is no longer aspirational: those exports are **deleted**, not merely
  unused. `Select` was the last consumer, and a dead export is an invitation —
  it kept pulling `SHADOW.attached` long after everything else had moved on.
  `material.css.ts` now holds only `EASE`, `DUR`, `microLabel`, `hairline` and
  `hitArea`, which are language-neutral. `layout.css.ts`, the old `masthead`
  pattern, is gone with it.

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

**One superfamily, two cuts.** IBM Plex Sans carries everything a person reads
as language. IBM Plex Mono carries everything that is data: numerals, hostnames,
timings, scores, IDs, dimensions, coordinates.

Plex replaced Rubik because Rubik is a rounded geometric face and this language
is hairlines, square corners and measured rules — the type was arguing with the
drawing. Plex was cut for technical documentation, and its two members share a
skeleton, so prose and data sit on one rhythm instead of reading as two
products.

The One-Family Rule of the previous system is **retired**. The mono tier is not
decoration — a schematic drawing annotates in mono, and `tabular-nums` is what
makes columns of figures align.

**Both stacks are defined once**, in `schematic.css.ts` as `FONT_SANS` and
`FONT_MONO`. They were previously written out as string literals in twelve
files, which is exactly how one surface ends up a font behind the rest. Nothing
should ever name a font family inline again.

**The stack must survive the font never arriving.** These load from
`@fontsource`, and a school network blocking an unfamiliar font request is an
ordinary Tuesday. What has to survive that is the *category*: ledgers, hour
meters and call numbers align because their glyphs are fixed-width, so a mono
stack that falls through to a proportional face silently breaks every aligned
column in the app. Each stack therefore ends in its generic family, and
`tests/schematic.test.ts` pins that.

**11px is the floor**, not a target. Nothing renders below it — not kbd hints,
not badges, not stamps. Six styles had drifted to 10px and were raised.

**`readout` is the one emphasis step above body**, for a data figure that has to
carry a tooltip or a callout. It exists because the benchmark tooltips had
invented two sizes of their own (16px and 20px) rather than one; they now share
this step. It is not a licence for a third.

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

| surface | signature | why this one |
|---|---|---|
| New Tab | **title sheet** — star field, horizon rule, catalogued star, title block bottom-left | it is the cover of the drawing set |
| Apps | **parts plate** — numbered positions on a ruled field | an app is a part in a position |
| Filter Checker | **test report** — a ledger of aligned mono columns | the question is comparative: which of these blocks me |
| History | **measured time rule** — day rules over 24-bar hour meters | its axis is time, so the drawing is time |
| Bookmarks | **index register** — zero-padded call numbers, favicon stamps, host column | position means nothing, identity means everything |
| Extensions | **state spine** — a gutter node per extension, filled when live | the only page whose every row carries a binary |
| Benchmarks | **parity datum** — a headline ratio against the 1.0× line | the only page built around a threshold |
| Ban | **stop plate** — one centred block that refuses to fill the viewport | the one page nobody chooses to open |
| Ban Info | **tally and roll** — segmented strike gauge over a column-set index | two questions: where do I stand, what is on the list |
| Chrome | **drawing border** — index tabs on a sheet set | it is the binding every sheet sits in |

### One row grammar across the three list pages

History, Bookmarks and Extensions all render a list of things with a name and
some state, so they share one row: **ruled apart by a hairline, identity on the
left, state right-aligned into true columns.** No page wraps its rows in a
`Plate` — a plate draws corner ticks at the full width of the sheet, and with
content clustered left that leaves an orphan tick floating in empty space on
every row.

The right-hand columns are what make the row worth its width. History carries
host and time, Bookmarks the date it was saved, Extensions the format stamp,
switch and remove. Before those columns existed each page put a single short
string on the left and left two-thirds of the sheet blank, which reads as an
unfinished page rather than a spare one. Any new list page joins this grammar.

Long values use `minmax(0, 1fr)` on the flexible track. A grid track's default
minimum is its content, so without it a long title pushes the state columns off
the sheet instead of ellipsing.

### The chrome is the border, not a toolbar

Tabs are index tabs: square, ruled apart by a single hairline rather than
separated by gaps, and the open one takes the content plane's own colour and
loses its bottom edge so tab and viewport read as one continuous surface. The
accent rule along its top is the only accent in the chrome.

What this replaced is worth naming so it does not return: 999px stadium tabs
that lifted 5px off the strip at rest and "docked" into a 14px flat-bottomed
shape when active, with drop shadows, inset highlights and a glow ring on focus.

Concretely, across chrome, bookmarks bar, tab switcher, New Tab omnibox,
extension icon bar and `Select`:

- no border radius anywhere; corners are square
- no `box-shadow` used to imply light, depth or elevation
- focus is a **1px `sirius` outline**, never a glow
- separation is a rule, never a gradient or a shadow
- addresses are set in mono wherever they appear — omnibox, suggestion rows,
  tab switcher, ledgers — because an address is data, and telling `rn` from `m`
  matters on a proxy

## The voice

The copy is the drawing in words: **measured, not marketed.**

This has a specific target. The filtering industry Civil exists alongside
describes itself in soft nouns — *visibility*, *insights*, *oversight*,
*wellbeing*, students being *observed*, monitoring shown as *indicators* — for
systems that record screens minute by minute, log search queries, and flag
students for reading college, LGBTQ and therapy pages. The euphemism is the
house style of the entire category.

So Civil's voice is the inverse, and the rules follow from that:

1. **Name the mechanism.** Say what the thing does, not how it feels.
2. **State the number.** Never "lots", "powerful", "blazing". `429,935 on file`,
   `2 of 3 enabled`, `1 of 5 shown`.
3. **Say where the data is.** History and bookmarks are `localStorage` or
   `IndexedDB` and the copy says so, because that is the whole difference.
4. **Claim nothing that is not built.** Civil serves ads on its landing route
   and says so in `note 01`. Blanket "we never track you" copy would be false,
   and one false line spends the credibility every other line depends on.
5. **Lower-case annotations, sentence-case titles.** The mono tier is a margin
   note, not a headline.

One house line per page, in the `lede` tier, directly under the title block —
and only one. A drawing that explains itself in a paragraph on every sheet has
stopped being a drawing.

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

**Don't** reintroduce `atmosphere()`, `edgeLit`, `machined()`, `lit()`,
`SHADOW`, `focusRing`, or bloom. **Don't** use `ember` for text. **Don't**
hand-roll a reveal. **Don't** import `solid-icons` directly — everything goes
through `~/components/icons` so the pending custom set is a one-file swap.
**Don't** export a bare function from a `.css.ts` module: vanilla-extract cannot
serialize it and the production build fails the first time a real page imports
it. **Don't** name a font family inline; use `FONT_SANS` / `FONT_MONO`.

### Four failure modes that ship green

Each of these passed every gate — types, lint, and the full test suite — and was
only ever caught in a browser. They are recorded because the next one will look
just as harmless.

**Dead CSS custom properties fail silently and forever.** The theme contract
generates `--civil-color-<palette-slot>`. Three pages styled from
`--civil-color-red`, `--civil-color-yellow`, `--civil-color-maroon` and
`--civil-color-text-muted`, none of which are slots. CSS drops an unresolvable
`var()` and moves on, so the strike gauge rendered with **no colour at all** on
both pages that drew it. Grep for `civil-color-` outside `styles/`; any hit is
suspect, because components should reference a class, never a raw variable name.

**A spread carrying `color` must come first.** `...ANNO` includes `color`.
Written *after* an explicit `color:`, it silently overwrites it and drops the
element to the muted tier. `tsc` catches this as TS2783 only when both are
literal keys in the same object literal — it will not catch it across a
`style([base, {...}])` composition.

**A live region over column markup announces mush.** History's scope line sets
its numbers and words as separate spans so each can be sized independently.
There is no whitespace between them in the DOM, and a live region announces
`textContent`, so it read "3pages2days" — the visual spacing came from flex
`gap`, which the accessibility tree cannot see. Fix: mark the visual arrangement
`aria-hidden`, put `aria-live` on an `srOnly` sibling, and derive both from the
same memo. Better still, as Bookmarks does: make the count one text node.

**`display: none` until hover is a keyboard trap.** It removes the element from
the tab order outright, so the bookmarks bar had no key sequence that could
delete a bookmark. Reveal with `opacity` plus `pointer-events`, on `:hover`, on
row `:focus-within`, and unconditionally under `(hover: none)` where there is no
hover to trigger it.

### Verifying in a browser

The preview pane does not composite frames. A transition in flight always
measures at its start value, which is indistinguishable from a reveal that never
opens — this produced two false positives before it was understood. Inject
`* { transition: none !important }` **before** measuring, not after forming a
hypothesis. It applies to any transitioned property, opacity included, not just
transforms.

Two more traps: a scripted `el.focus()` does not match `:focus-visible`, so a
focus ring will read as missing when it is correct — drive real `Tab` presses.
And vanilla-extract hashes class names, so `[class*="browser"]` selects nothing;
probe by structure, computed style, or the CSSOM.
