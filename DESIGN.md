---
name: Civil Proxy
description: A calm browser workspace, using the original Strata palette.
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
    fontSize: 72px
rounded:
  keycap: 4px
  chip: 6px
  button: 8px
  field: 10px
  menu: 12px
  search: 16px
  pill: 999px
spacing:
  small: 8px
  base: 16px
  section: 32px
---

## Overview

Civil is a browser workspace for people who want to reach a website without learning proxy internals. The interface gives search priority, keeps familiar browser controls visible, and offers clearly labeled destinations. This replaces the technical-drawing visual language. The palette and existing wordmark remain the brand anchors.

## Colors

src/styles/palette.ts is the source of truth. Use theme contract values rather than duplicated hex colors in components. Basalt frames the browser and search field; stratum is the content plane. Scree provides quiet grouping and hover backgrounds. Talus separates controls. Firn is primary text, snowmelt is supporting text, and ash is muted text. Cobalt is reserved for actions, focus, and active state.

Preserve verdict semantics: juniper allowed, calcite warned, sandstone error, wine blocked. Pair every verdict with text and a glyph.

The root declares `color-scheme: dark`, so native controls (spinners, checkboxes, autofill) render dark and a web page with no background of its own still gets a white canvas inside a tab.

## Typography

Use the self-hosted IBM Plex family through FONT_SANS and FONT_MONO. Sans serves prose, headings, control labels, and annotations. Mono remains for addresses and technical data where character distinction matters: domain lists, verdict tokens, keycaps, benchmark figures. Inputs are sans. The new-tab heading is 40px desktop, 30px mobile; interior page titles and the stop card title are 32px; the 404 numeral is the one display size. Dense browser labels are 12.5px, controls and menus 13px, the annotation tier 12px, captions 11px.

Every label is sentence case at its natural size: "Add a site", "Filters on this network", "Check this site". No uppercase, tracked-out, or lowercase-fragment labels anywhere, including rule labels, field labels, badges and text buttons. Copy uses periods and commas, never dashes as punctuation.

## Layout

The new-tab page has a compact header, a centered search group, four labeled shortcuts, and an ad-support disclosure. The content max width is 720px; search max width is 600px. At 600px and below, shortcuts form two columns and the Browse label yields to its arrow with an accessible name. Small screens may scroll vertically; controls must not overflow horizontally.

Interior pages share Sheet and TitleBlock. Sheet retains its API but hides the old ruled field and registration marks. Page content has 24px minimum horizontal padding and a 1040px maximum measure. Titles have more room above their content than between their name and supporting text.

## Elevation & Depth

Use flat palette surfaces and fine borders. No blur, backdrop filters, glowing borders, or animated shadows. Preserve low-end Chromebook performance.

## Shapes

One radius scale: 4px keycaps and small stamps, 6px chips and close buttons, 8px buttons and menu rows, 10px fields and tabs, 12px menus, panels and dropdowns, 16px the main search, shortcut tiles, emblem and the stop card, and a full pill only for status badges. The wordmark keeps its own established geometry. Icons share a 16-unit viewBox, 1.35-unit rounded stroke, and currentColor.

## Components

The main search has an explicit accessible label, Browse action, and keyboard-operable suggestion buttons. The form boundary carries search focus; avoid a second ring inside the text input. The same applies to every boxed field: the row shows focus, the input inside draws no ring.

Browser chrome is one continuous toolbar surface. The tab strip is basalt; the open tab, the address row and the bookmarks shelf share the scree plane, so the active tab reads as part of the toolbar rather than a pill above it. The address field is a basalt well inside that toolbar, bordered only on focus. Inactive tabs are transparent with ash text; hover fills sit one step lighter than the surface they are on (scree on basalt, talus on scree). Chrome preserves new-tab, back, forward, reload, tab search, extensions, and bookmarks. Menus and the tab switcher are 12px sheets with 6px inset rows, left-aligned on a fixed icon gutter.

Empty states are one plain sentence that says what will appear and how to make it appear: "No history yet. Pages you visit will show up here."

Every UI icon is exported from components/icons. Each has a data-icon motion profile in styles/icons.css.ts. Animate individual SVG paths on hover or parent keyboard focus: meridians narrow, hands turn, divider lines move, arrows extend. Timing is 220ms with exponential ease-out. Reduced-motion users get stationary glyphs. No ambient decorative movement.

Standalone /newtab offers a browser-entry link. Framed new-tab shortcuts use civil:navigate messages so parent tab history and title remain correct. Modified clicks retain native link behavior.

## Do's and Don'ts

- Keep the palette unchanged and semantic statuses redundant.
- Preserve visible keyboard focus, accessible control names, and reduced-motion support.
- Keep technical implementation labels out of the beginner's start screen.
- Do not add animation dependencies for CSS path transforms.
- In Solid 2 onSettled callbacks, return cleanup functions; never call onCleanup inside them.
- Do not export bare functions from .css.ts files; vanilla-extract requires serializable exports.
- Keep interactive controls reachable by keyboard and touch when hover is unavailable.

