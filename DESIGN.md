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
    fontSize: 26px
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

Civil = browser workspace for people wanting reach website without learning proxy internals. Interface prioritize search, keep familiar browser controls visible, offer clearly labeled destinations.

Material = Strata. Palette geological, so interface cut from layered stone: pressable = slab, exposed side show sediment bands; typeable = well carved in stone; large icons = mineral specimens; every page stand on ground of faint survey contours drifting very slowly. Height carry meaning, keep textured interface readable: flat = text, raised = pressable, carved = typeable. Palette and wordmark stay brand anchors.

## Colors

src/styles/palette.ts = source of truth. Use theme contract values, no duplicated hex in components; one exception: SVG attributes that can't read custom properties (emboss filter in Document.tsx imports PALETTE). Basalt frame browser as bedrock, floor every well; stratum = ground; scree = slab face; talus lighten keycaps, hovered rows. Firn = primary text + light on every lip, snowmelt = supporting text, ash = muted text. Cobalt reserved for actions, focus, active state: one cobalt key per view, focused well meltwater rim, chosen scope.

Keep verdict semantics: juniper allowed, calcite warned, sandstone error, wine blocked. Pair every verdict with text + glyph.

Specimens tinted palette tones only: cobalt, stone (talus), juniper, calcite, sandstone, wine. Each destination keep one mineral everywhere (Apps cobalt, Bookmarks calcite, History juniper, Extensions sandstone, Filter check stone, Restricted domains wine). Specimen decorative, always labelled in text beside, so tint never carry meaning alone; on filter report, verdict tone only for own verdict. Every derived tone (bands, highlights, tinted faces) = `color-mix()` of palette slots. Black only inside shadows (missing light, not surface colour).

Root declare `color-scheme: dark`, so native controls (spinners, checkboxes, autofill) render dark; web page without own background still get white canvas in tab.

## Typography

Self-hosted IBM Plex via FONT_SANS and FONT_MONO. Sans: prose, headings, control labels, annotations. Mono: addresses, technical data where character distinction matter: domain lists, verdict tokens, keycaps. Inputs sans. New-tab heading 40px desktop, 30px mobile; interior page titles 26px; stop card title 32px; 404 numeral one display size. Dense browser labels 12.5px, controls/menus 13px, annotation 12px, captions 11px.

Headings = raised lettering: one-pixel basalt shadow directly under glyphs + short soft one below, lit same side as every slab. 404 numeral cut as strata block, six banded shadows deep. Calm Strata exception: interior page titles and section titles in app shell = flat lettering at app size; raised lettering stay on new-tab heading, stop card, setup, 404.

Every label sentence case, natural size: "Add a site", "Filters on this network", "Check this site". No uppercase, tracked-out, or lowercase-fragment labels anywhere, incl rule labels, field labels, badges, text buttons. Copy use periods, commas, never dashes as punctuation.

## Layout

New-tab page: in app shell, centered search group, four labeled shortcuts, ad-support disclosure. Content max 720px; search max 600px. ≤600px: shortcuts two columns, Browse label yield to arrow with accessible name. Small screens may scroll vertically; controls never overflow horizontally.

Civil's own pages (new tab, apps, bookmarks, history, extensions, filter check, settings, restricted domains) share AppShell (components/AppShell.tsx): 236px left sidebar on basalt wash, one talus hairline, wordmark top, icon-and-label rows on 38px pitch, Settings at foot. Lit cobalt door, cut from logo's doorway, slide to active row by transform only; travel = row pitch, so both change together. ≤720px sidebar fold into one horizontally scrolling row above page. Browser chrome (`/`) keep own layout, no sidebar. Framed shell links use civil:navigate messages, standalone ones plain links.

Interior pages share Sheet and TitleBlock in shell. Shell paint ground, Sheet sit on it; TitleBlock set page's specimen beside title. Content 24px min horizontal padding, 1040px max measure. Titles: more room above content than between name and supporting text. Lists sit on tablet, not bare ground.

## Elevation & Depth

Every recipe in src/styles/material.css.ts, spread into component's own `style()` via `blend()`. Recipes = style objects, not classes: composed classes yield class list, which can't stand in `.${cls}` selector in `globalStyle` or test.

- **Ground** (`GROUND`): stratum; terrain tile (public/assets/terrain.svg, from periodic noise, seamless) on one fixed layer at 7%, drifting 180 by 120 pixels over four minutes; grain under cobalt dawn at top edge breathing over eighteen seconds. Both layers pseudo-elements, no added DOM.
- **Slab edge** (`edge(px, …, slots)`): `px` one-pixel hard offsets alternating two sediment tones, then contact shadow. Levels: pebble 1, keycap 2, key 3, tablet 4, plate 6. Every state of one element emit same slot count (spare bands tucked under last), since browsers interpolate shadow lists by position; unequal lists morph soft shadow into hard band mid-hover.
- **Face** (`LIT`): grain over 10% firn wash at top edge, independent of face colour, plus firn lip on top. Faces change colour via `background-color` only, so no image swap mid-hover.
- **Pressable** (`KEY_COBALT`, `KEYCAP`, `PEBBLE`): hover rise 2px while edge grow two bands, so slab foot stay planted; press sink face into bed, one band left. Still versions (`KEYCAP_FACE`, `PEBBLE_FACE`) draw keyboard hints and detected-filter chips; not pressable, never rise.
- **Stone key** (`KEY_STONE`): secondary buttons, text actions on Civil's own pages. Flat: scree fill + one inset talus hairline, answer pointer and press via fill only.
- **Tablet** (`TABLET`) and **plate** (`PLATE`): content beds and floating slabs (menus, pickers, toasts, stop card). Don't move. Tablet flat: fill + one inset hairline, no bands.
- **Row** (`ROW_LIFT`): flat at rest so long lists calm; under pointer/focus rise in light, not space: face lighten, lip + two bands appear.
- **Motion**: every lift and glyph layer share one decelerating curve and duration (`LIFT`, 260ms, no overshoot), so key, edge, glyph travel together. Glyph and wordmark acts = short keyframe sequences on top (ICONS.md), played once per hover/focus after brief hover intent, start and end at rest; once started, act finish even if pointer leave; Safari replay shape morphs as SMIL.
- **Hover never strobes.** Anything moving on hover must not slide own hit box off pointer, else hover drop, element settle, catch pointer again, cursor flicker hand/arrow. Three rules: rows and small icon buttons don't move; moving slab get hit band (own pseudo-element) only in moved state, covering ground motion uncovered, never at rest, so nothing outside element can start its hover; where whole region react (New Tab destination, wordmark, specimen) element under pointer stay still, move its contents. Press never move container holding button, so click released at edge still land.
- **Well** (`WELL`): basalt with grain, shadowed upper wall, lit lower rim; hover rim in talus, focus flood rim with cobalt meltwater (`WELL_FOCUS`). Row carry focus; input inside draw no ring.
- **Rules** = grooves: shadowed line, firn lip beneath.
- **Entrance**: sections rise 10px + fade in, 560ms decelerating, staggered 50ms (`RISE`, backwards fill so hover transforms still apply after).

Performance = design constraint; primary reader on low-end school Chromebook. No `backdrop-filter`, no blur on large areas, no filter animation. Grain and terrain static images rasterised once. Hard offset edges paint once. Only element under pointer transition shadow. Only ambient animations: transform + opacity on ground's two layers, one occasional sheen on New Tab emblem.

Retired earlier rule: flat palette surfaces, fine borders, no animated shadows, no ambient movement. Owner asked depth, texture, alive pages; chose Strata over frosted-ice and soft-clay from live mockup (docs/superpowers/specs/2026-09-25-strata-3d-design.md). Don't reinstate flat rules by accident; keep their performance reasons.

**Calm Strata** (owner's call, 2026-10-25 and 26, from Obsidian store and Stellite settings references): on Civil's own pages everyday surfaces lie flat, thin hairlines over palette fills: tablets, stone keys, filter chips, sidebar rows, catalog cards, titles. Stone depth kept where meaningful: logo, specimens (pinned apps incl), one main action per view (`KEY_COBALT`), shell's lit door. Browser chrome keep terrace, raised keycaps, pebbles. Strata still material; flat page surfaces = deliberate quiet, not return of retired flat rules, so don't flatten chrome or pressables beyond this list.

## Shapes

One radius scale: 5px keycaps drawn as `kbd`, 7–9px small keys, chips, menu rows, 10px rows and tabs, 12px fields and wells, 14px menus and pickers, 16px tablets, tiles, toasts, 18px main search well and stop card, 30% specimens, full pill only status badges and filter chips. Wordmark keep own geometry.

## Components

Main search = deep well, explicit accessible label, cobalt Browse key seated inside, keyboard-operable suggestion buttons lifting as rows on floating plate. Form boundary carry search focus; no second ring inside text input. Same for every well: row show focus, input draw no ring.

Browser chrome = stone terrace above page. Tab strip = basalt bedrock; inactive tabs rest on it, ash text, catch lit lip under pointer; new tab rise out of bedrock. Open tab = terrace top, lit scree face running seamless into address row and bookmarks shelf. Terrace end in cliff: four sediment bands along chrome bottom edge + shadow onto page. Address field = well; back, forward, reload, tab search, extensions = low keycaps (disabled stay seated, dim); bookmarks = pebbles. Menus and tab switcher = plates, 6px inset rows on fixed icon gutter; tab switcher search carved into top, keyboard hints real keycaps.

Empty states = one plain sentence under stone specimen of page glyph, saying what appear and how: "No history yet. Pages you visit will show up here."

Every UI icon exported from components/icons, drawn three times from one path source: extrusion (heavier copy sunk toward basalt, offset down-right), lit rim (firn-warmed copy offset up-left), face in `currentColor`. On hover or parent keyboard focus face + rim lift while extrusion stay, so solid deepen, on slabs' 260ms decelerating curve; each glyph play own act once on all layers: morphs (close blades snip, tick redraws, bookmark snaps), waves (faders, dots), turns (refresh, globe, apps iris), moves (arrows dash, lid flips, shackle unlocks). Rim trail face 90ms, so layers part like exposures of one motion, then restack. Wordmark own act: slabs slam together, door widen as overlap, jolt run down caps, X vanish as two bars coincide. Reduced-motion users get stationary glyphs.

Large icons = Specimens (components/Specimen.tsx): palette-tinted tile, strata edge in own tone + grain, holding one glyph embossed by `#civil-emboss` filter declared once per document in Document.tsx. Hover specimen, or its link/button: tile tilt toward reader, glyph lift on own plane, sheen sweep once across face; keyboard focus same. Tile sit in still mount = actual hover target; at rest carry same transform functions as tilt at zero, so tilt interpolate smooth from first frame. Leaving, sheen snap out of view, no backward sweep.

Standalone /newTab offer browser-entry link. Framed new-tab shortcuts use civil:navigate messages so parent tab history and title stay correct. Modified clicks keep native link behavior.

Filter chips (`chips`, `chip` in schematic.css.ts) = flat pills, talus hairline, one wrapping row under page lede; chosen chip (`aria-pressed="true"`) take scree face. Used by Apps catalog categories, History ranges (All time, Today, Last 7 days), Bookmarks scope (All, Recent), Settings jump links; links may.

Apps = store: built-in catalog shelf of flat cards under category chips, cobalt Random key picking one and opening it, then user's pinned apps as stone tiles (pinning turn site to stone). Apps, bookmarks, history open via civil:navigate (lib/openInBrowser.ts): apps in current or new tab per "Open apps in" setting, bookmarks/history in new tab, reusing tab already showing that address.

Settings = one sheet of sections, each tablet of rows, filter-chip jump links above. History section carry storage meter under summary: one 8px bar, track = pale step of fill's own hue, cobalt, calcite at 80% full. Label above state location + amount in words ("Nearly full" when so), bar aria-hidden, so state never colour alone. Row = setting name + one sentence on what it do, control right: switch carved as channel flooding cobalt when on, or select in well whose open list = plate like menu (customizable select; Firefox, lacking one, keep own dark list). Select/field name = its label. Switch name = plain text via aria-labelledby, so selecting or double-clicking words never flip it; only switch take clicks, via 44 by 40px hit area around channel. Rows separated by grooves; below 600px control drop under text. Site lists (connection rules, sites left out of history) = mono hostnames with remove glyph, well + key to add. Anything deleting/resetting = armed wine key, label say what second press do. Shared rows in components/SettingControls.tsx; setup use same. No textarea has resize grip: each rest at own min-height, grow with typed/pasted content.

First-run setup = one plate on ground, stop card's slab, one question at a time under row of progress grooves. Choices = stone keys over native radios: chosen key face flood cobalt via background-color only + gain check glyph, so sediment never change. Detected choice wear still "Suggested" chip, reason under group. Technical options behind "More options", so beginner's first screen has no implementation labels; summary mark every Civil-picked value with reason.

When history storage full, History page and Settings show tablet strip with calcite alert glyph + one sentence saying what Civil did, until dismissed.

## Do's and Don'ts

- Keep palette unchanged, semantic statuses redundant.
- Keep visible keyboard focus, accessible control names, reduced-motion support. Global rule in global.css.ts collapse durations, so every loop stop and every state still reach end.
- Keep technical implementation labels off beginner start screen.
- Spread material recipes with `blend()`; don't compose as classes.
- Give pressables hover, press, focus state; static text stay still.
- No `backdrop-filter`, large blurs, animated filters, or second ambient animation per page.
- No animation dependencies for CSS path transforms.
- In Solid 2 onSettled callbacks, return cleanup functions; never call onCleanup inside.
- Don't export bare functions from .css.ts files components import; vanilla-extract need serializable exports. material.css.ts imported only by other .css.ts files, so it may.
- Keep interactive controls reachable by keyboard and touch when hover unavailable.