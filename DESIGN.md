---
name: Civil Proxy
description: A calm browser workspace cut from Strata, a layered-stone material on the original palette.
colors:
  basalt: "#0E1119"
  stratum: "#22262F"
  scree: "#2D3039"
  talus: "#434751"
  ash: "#8C919E"
  snowmelt: "#C2C6D2"
  firn: "#EDF1FB"
  cobalt: "#4295E4"
  juniper: "#C3CAA4"
  calcite: "#F2E0C7"
  sandstone: "#E29B69"
  wine: "#C8789B"
typography:
  welcome:
    fontFamily: IBM Plex Sans Variable
    fontSize: 40px
    fontWeight: 450
    lineHeight: 1.15
  welcome-mobile:
    fontFamily: IBM Plex Sans Variable
    fontSize: 30px
  title:
    fontFamily: IBM Plex Sans Variable
    fontSize: 32px
  body:
    fontFamily: IBM Plex Sans Variable
    fontSize: 16px
  label:
    fontFamily: IBM Plex Sans Variable
    fontSize: 14px
  annotation:
    fontFamily: IBM Plex Sans Variable
    fontSize: 12px
  caption:
    fontFamily: IBM Plex Sans Variable
    fontSize: 11px
  chrome:
    fontFamily: IBM Plex Sans Variable
    fontSize: 12.5px
  control:
    fontFamily: IBM Plex Sans Variable
    fontSize: 13px
  lede:
    fontFamily: IBM Plex Sans Variable
    fontSize: 15px
  display:
    fontFamily: IBM Plex Sans Variable
    fontSize: 88px
rounded:
  keycap: 5px
  chip: 8px
  button: 9px
  field: 12px
  menu: 14px
  tablet: 16px
  search: 18px
  specimen: 30%
  pill: 999px
spacing:
  small: 8px
  base: 16px
  section: 32px
---

## Overview

Civil is a browser workspace for people who want to reach a website without learning proxy internals. The interface gives search priority, keeps familiar browser controls visible, and offers clearly labeled destinations.

Its material is Strata. The palette is geological, so the interface is cut from layered stone: anything you can press is a slab whose exposed side shows its sediment bands, anything you can type into is a well carved into the stone, large icons are mineral specimens, and every page stands on a ground of faint survey contours that drift very slowly. Height carries the meaning, which is what keeps a textured interface easy to read: flat is text, raised is pressable, carved is typeable. The palette and the wordmark remain the brand anchors.

## Colors

src/styles/palette.ts is the source of truth. Use theme contract values rather than duplicated hex colors in components; the one exception is SVG attributes that cannot read custom properties (the emboss filter in Document.tsx imports PALETTE). Basalt frames the browser as bedrock and floors every well; stratum is the ground; scree is a slab's face; talus lightens keycaps and hovered rows. Firn is primary text and the light that falls on every lip, snowmelt is supporting text, and ash is muted text. Cobalt is reserved for actions, focus, and active state: the one cobalt key per view, a focused well's meltwater rim, a chosen scope.

Preserve verdict semantics: juniper allowed, calcite warned, sandstone error, wine blocked. Pair every verdict with text and a glyph.

Specimens are tinted with palette tones and nothing else: cobalt, stone (talus), juniper, calcite, sandstone and wine. Each destination keeps one mineral everywhere it appears (Apps cobalt, Bookmarks calcite, History juniper, Extensions sandstone, Filter check stone, Restricted domains wine). A specimen is decorative and always labelled in text beside it, so a tint never carries meaning alone, and on the filter report a verdict tone is only ever used for its own verdict. Every derived tone (bands, highlights, tinted faces) is a `color-mix()` of palette slots. Black appears only inside shadows, which are missing light rather than a surface colour.

The root declares `color-scheme: dark`, so native controls (spinners, checkboxes, autofill) render dark and a web page with no background of its own still gets a white canvas inside a tab.

## Typography

Use the self-hosted IBM Plex family through FONT_SANS and FONT_MONO. Sans serves prose, headings, control labels, and annotations. Mono remains for addresses and technical data where character distinction matters: domain lists, verdict tokens, keycaps. Inputs are sans. The new-tab heading is 40px desktop, 30px mobile; interior page titles and the stop card title are 32px; the 404 numeral is the one display size. Dense browser labels are 12.5px, controls and menus 13px, the annotation tier 12px, captions 11px.

Headings are raised lettering: a one-pixel basalt shadow directly under the glyphs and a short soft one below, lit from the same side as every slab. The 404 numeral is cut as a block of strata, six banded shadows deep.

Every label is sentence case at its natural size: "Add a site", "Filters on this network", "Check this site". No uppercase, tracked-out, or lowercase-fragment labels anywhere, including rule labels, field labels, badges and text buttons. Copy uses periods and commas, never dashes as punctuation.

## Layout

The new-tab page has a compact header, a centered search group, four labeled shortcuts, and an ad-support disclosure. The content max width is 720px; search max width is 600px. At 600px and below, shortcuts form two columns and the Browse label yields to its arrow with an accessible name. Small screens may scroll vertically; controls must not overflow horizontally.

Interior pages share Sheet and TitleBlock. Sheet stands on the ground; TitleBlock sets the page's specimen beside its title. Page content has 24px minimum horizontal padding and a 1040px maximum measure. Titles have more room above their content than between their name and supporting text. Lists sit on a tablet rather than straight on the ground.

## Elevation & Depth

Every recipe lives in src/styles/material.css.ts and is spread into a component's own `style()` through `blend()`. Recipes are style objects, not classes: composing classes yields a class list, and a list cannot stand in a `.${cls}` selector in a `globalStyle` or a test.

- **Ground** (`GROUND`): stratum; the terrain tile (public/assets/terrain.svg, generated from periodic noise so it repeats without a seam) on one fixed layer at 7% that drifts 180 by 120 pixels over four minutes; grain under a cobalt dawn at the top edge that breathes over eighteen seconds. Both layers are pseudo-elements, so the page gains no DOM.
- **Slab edge** (`edge(px, …, slots)`): `px` one-pixel hard offsets alternating two sediment tones, then a contact shadow. Levels: pebble 1, keycap 2, key 3, tablet 4, plate 6. Every state of one element emits the same number of slots (spare bands tucked under the last one), because browsers interpolate shadow lists position by position; unequal lists morph a soft shadow into a hard band mid-hover.
- **Face** (`LIT`): grain over a 10% firn wash at the top edge, independent of the face colour, plus a firn lip along the top. Faces change colour through `background-color` only, so nothing swaps an image mid-hover.
- **Pressable** (`KEY_COBALT`, `KEY_STONE`, `KEYCAP`, `PEBBLE`): hover rises 2px while the edge grows by two bands, so the slab's foot stays planted; press sinks the face into its bed with one band left. Still versions (`KEYCAP_FACE`, `PEBBLE_FACE`) draw keyboard hints and detected-filter chips, which are not pressable and never rise.
- **Tablet** (`TABLET`) and **plate** (`PLATE`): content beds and floating slabs (menus, pickers, toasts, the stop card). They do not move.
- **Row** (`ROW_LIFT`): flat at rest so long lists stay calm; under the pointer or focus a row rises in light, not in space: its face lightens and a lip and two bands appear.
- **Motion**: every lift, glyph layer and gesture shares one decelerating curve and duration (`LIFT`, 260ms, no overshoot), so a key, its edge and its glyph travel together.
- **Hover never strobes.** Anything that moves on hover must not slide its own hit box off the pointer, or hover drops, the element settles, catches the pointer again, and the cursor flickers between hand and arrow. Three rules keep that from happening: rows and small icon buttons do not move; a moving slab gets a hit band (its own pseudo-element) only in the state that moved, covering the ground the motion uncovered, and never at rest, so nothing outside an element can start its hover; and where a whole region reacts (a New Tab destination, the wordmark, a specimen) the element under the pointer stays still and moves its contents. A press never moves a container that holds a button, so a click released at the edge still lands on the button.
- **Well** (`WELL`): basalt with grain, a shadowed upper wall, a lit lower rim; hover rims it in talus, focus floods the rim with cobalt meltwater (`WELL_FOCUS`). The row carries focus; the input inside draws no ring.
- **Rules** are grooves: a shadowed line with a firn lip beneath.
- **Entrance**: sections rise 10px and fade in, 560ms decelerating, staggered 50ms (`RISE`, backwards fill so hover transforms still apply afterwards).

Performance is still a design constraint, because the primary reader is on a low-end school Chromebook. No `backdrop-filter`, no blur on large areas, no filter animation. Grain and terrain are static images rasterised once. Hard offset edges paint once. Only the element under the pointer transitions its shadow. The only ambient animations are transform and opacity on the ground's two layers and one occasional sheen on the New Tab emblem.

This retired the earlier rule of flat palette surfaces, fine borders, no animated shadows and no ambient movement. The owner asked for depth, texture and pages that feel alive, and chose Strata over a frosted-ice and a soft-clay direction from a live mockup (docs/superpowers/specs/2026-09-25-strata-3d-design.md). Do not reinstate the flat rules by accident; do keep their performance reasons.

## Shapes

One radius scale: 5px keycaps drawn as `kbd`, 7 to 9px small keys, chips and menu rows, 10px rows and tabs, 12px fields and wells, 14px menus and pickers, 16px tablets, tiles and toasts, 18px the main search well and the stop card, 30% specimens, and a full pill only for status badges. The wordmark keeps its own established geometry.

## Components

The main search is a deep well with an explicit accessible label, a cobalt Browse key seated inside it, and keyboard-operable suggestion buttons that lift as rows on a floating plate. The form boundary carries search focus; avoid a second ring inside the text input. The same applies to every well: the row shows focus, the input inside draws no ring.

Browser chrome is a terrace of stone above the page. The tab strip is basalt bedrock; inactive tabs rest on it with ash text and catch a lit lip under the pointer; a new tab rises out of the bedrock. The open tab is the top of the terrace, a lit scree face that runs without a seam into the address row and the bookmarks shelf. The terrace ends in a cliff: four sediment bands along the bottom edge of the chrome and a shadow that falls onto the page. The address field is a well; back, forward, reload, tab search and extensions are low keycaps (a disabled one stays seated and dim); bookmarks are pebbles. Menus and the tab switcher are plates with 6px inset rows on a fixed icon gutter; the tab switcher's search is carved into its top and its keyboard hints are real keycaps.

Empty states are one plain sentence under a stone specimen of the page's glyph, saying what will appear and how to make it appear: "No history yet. Pages you visit will show up here."

Every UI icon is exported from components/icons and drawn three times from one path source: an extrusion (a heavier copy sunk toward basalt, offset down and right), a lit rim (a firn-warmed copy offset up and left), and the face in `currentColor`. On hover or parent keyboard focus the face and rim lift while the extrusion stays, so the solid deepens, and each glyph performs its own gesture on all layers at once: meridians narrow, hands turn, divider lines move, arrows extend. Layer lift and gestures share the slabs' 260ms decelerating curve, so a key and its glyph move as one. Reduced-motion users get stationary glyphs.

Large icons are Specimens (components/Specimen.tsx): a palette-tinted tile with a strata edge in its own tone and grain, holding one glyph embossed by the `#civil-emboss` filter declared once per document in Document.tsx. Hovering the specimen, or the link or button it sits in, tilts the tile toward the reader, lifts the glyph on its own plane and sweeps a sheen once across the face; keyboard focus does the same. The tile sits in a still mount that is the actual hover target, and at rest carries the same transform functions as the tilt at zero, so the tilt interpolates smoothly from the first frame. Leaving, the sheen snaps back out of view rather than sweeping backwards.

Standalone /newtab offers a browser-entry link. Framed new-tab shortcuts use civil:navigate messages so parent tab history and title remain correct. Modified clicks retain native link behavior.

Settings is one sheet of sections, each a tablet of rows, with pebble jump links above them. A row is the setting's name and one sentence on what it does, with the control on the right: a switch carved as a channel that floods with cobalt when on, or a select in a well whose open list is a plate like a menu (a customizable select; Firefox, which hasn't shipped one, keeps its own dark list). A select's or field's name is its label. A switch's name is plain text that names it through aria-labelledby, so selecting or double-clicking the words never flips it; the switch alone takes clicks, through a 44 by 40px hit area around its channel. Rows are separated by grooves, and below 600px the control drops under its text. Lists of sites (connection rules, sites left out of history) are mono hostnames with a remove glyph, and a well plus key to add one. Anything that deletes or resets is an armed wine key whose label says what the second press will do. The shared rows live in components/SettingControls.tsx, and setup uses the same ones. No textarea anywhere has a resize grip: each rests at its own min-height and grows with what is typed or pasted into it.

First-run setup is one plate on the ground, the stop card's slab, holding one question at a time under a row of progress grooves. Choices are stone keys over native radios: the chosen key's face floods with cobalt through background-color alone and gains a check glyph, so its sediment never changes. A choice Civil detected wears a still "Suggested" chip, with the reason under the group. Technical options wait behind "More options", so the beginner's first screen carries no implementation labels, and the summary marks every value Civil picked with the reason it picked it.

When history storage fills up, the History page and Settings show a tablet strip with a calcite alert glyph and one sentence saying what Civil did, until dismissed.

## Do's and Don'ts

- Keep the palette unchanged and semantic statuses redundant.
- Preserve visible keyboard focus, accessible control names, and reduced-motion support. The global rule in global.css.ts collapses durations, so every loop stops and every state still reaches its end.
- Keep technical implementation labels out of the beginner's start screen.
- Spread material recipes with `blend()`; do not compose them as classes.
- Give anything pressable a hover, a press and a focus state; leave static text still.
- Do not add `backdrop-filter`, large blurs, animated filters, or a second ambient animation per page.
- Do not add animation dependencies for CSS path transforms.
- In Solid 2 onSettled callbacks, return cleanup functions; never call onCleanup inside them.
- Do not export bare functions from .css.ts files that components import; vanilla-extract requires serializable exports. material.css.ts is imported only by other .css.ts files, which is why it may.
- Keep interactive controls reachable by keyboard and touch when hover is unavailable.
