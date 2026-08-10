---
name: Civil Proxy
description: A stealth-cockpit browser chrome for getting past school filters without drawing a glance
colors:
  crust: "#181926"
  mantle: "#1e2030"
  base: "#24273a"
  surface0: "#363a4f"
  surface1: "#494d64"
  surface2: "#5b6078"
  overlay0: "#6e738d"
  overlay1: "#8087a2"
  subtext0: "#a5adcb"
  subtext1: "#b8c0e0"
  text: "#cad3f5"
  lavender: "#b7bdf8"
  mauve: "#c6a0f6"
  blue: "#8aadf4"
  sky: "#91d7e3"
  green: "#a6da95"
  yellow: "#eed49f"
  red: "#ed8796"
  maroon: "#ee99a0"
typography:
  display:
    fontFamily: '"Rubik", sans-serif'
    fontSize: "35px"
    fontWeight: 500
    lineHeight: 1.1
  headline:
    fontFamily: '"Rubik", ui-sans-serif, sans-serif'
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: '"Rubik", ui-sans-serif, sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  chrome:
    fontFamily: '"Rubik", ui-sans-serif, sans-serif'
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: "normal"
  label:
    fontFamily: '"Rubik", ui-sans-serif, sans-serif'
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "normal"
    letterSpacing: "0.06em"
rounded:
  circular: "50%"
  pill: "20px"
  omnibox: "14px"
  panel: "12px"
  control: "8px"
  tabPill: "999px"
  tabDock: "14px 14px 0 0"
  cartridge: "18px"
spacing:
  xxs: "4px"
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  xxxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.mauve}"
    textColor: "{colors.crust}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 28px"
  button-primary-hover:
    backgroundColor: "{colors.lavender}"
    textColor: "{colors.crust}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.overlay1}"
    rounded: "{rounded.circular}"
    size: "30px"
  input-primary:
    backgroundColor: "{colors.base}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  tab:
    backgroundColor: "{colors.mantle}"
    textColor: "{colors.overlay0}"
    rounded: "{rounded.tabPill}"
    height: "32px"
  tab-active:
    backgroundColor: "{colors.base}"
    textColor: "{colors.text}"
    rounded: "{rounded.tabDock}"
    height: "32px"
  badge-status:
    backgroundColor: "{colors.surface0}"
    textColor: "{colors.lavender}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  omnibox:
    backgroundColor: "{colors.surface0}"
    textColor: "{colors.text}"
    rounded: "{rounded.omnibox}"
    height: "28px"
---

# Design System: Civil Proxy

## Overview

**Creative North Star: "The Stealth Cockpit"**

Civil looks like an instrument panel built for someone who already knows where every control is, not a product introducing itself to a first-time visitor. The interface runs dense and precise — 30px circular icon buttons, 12.5px chrome text, exact hit targets — but it's rendered entirely in the low-saturation, cafe-warm Catppuccin Macchiato palette instead of harsh utilitarian grey, so precision reads as calm rather than clinical. Nothing about the surface performs for an onlooker: colors are muted, most decorative motion is switched off by default, and the whole system is built to sit open on a shared screen without inviting a second look.

That restraint is deliberate. Motion is earned per-component, never ambient: only **functional** motion (spinners, loading states — the thing itself needs to convey progress) and **interactive feedback** motion (entrance, hover, focus, active-state transitions on a control the user just touched) are allowed. Anything that would animate at rest, on a timer, or without a user action behind it stays off. Durations and easings come from the `DUR` / `EASE` tokens in `material.css.ts`, so the whole system moves at the same three speeds instead of the six that had drifted across the codebase.

> **Note on how this used to be enforced.** A blanket `transition-duration: 0s !important` on `*` in `global.css.ts` killed all 57 transitions, 14 animations and 20 keyframes in the codebase. Every component that wanted legitimate feedback had to fight its way back out with its own `!important` duration — 101 such opt-ins had accumulated across 20 files — and because those outranked any media query, `prefers-reduced-motion` could never be honoured. The blanket rule is gone; the discipline it protected is now a convention, and reduced-motion is respected properly.

Every page shares one token system (colors, type, motion, radii) but earns its own silhouette: the browser chrome's floating tab pills, the Apps grid's game-cartridge tiles, the Extensions list's settings-panel rows, History's timeline rail, Bookmarks' ribbon-tagged rows, Ban's stripe-field atmosphere, New Tab's HUD corner brackets. The goal is a system where no two pages share a structural silhouette by coincidence — same brand, same materials, different shape for the job each page is actually doing.

**Key Characteristics:**
- Dense instrument-panel component sizing (18–30px controls, 12–13px UI text) rendered in a muted pastel-dark palette, not clinical grey.
- Tonal layering carries depth, but every surface is *lit*: a hairline highlight along its top edge and a matching shadow beneath, so a panel reads as a machined face rather than a filled rectangle.
- Full-page surfaces sit in an `atmosphere()` backdrop — one soft accent bloom, one cooler counter-bloom, and a 2%-opacity grain — so large dark areas read as a room with a light source instead of a void. Entirely static.
- Motion is limited to functional and interactive-feedback categories, drawn from three shared durations and three shared easings.
- A consistent five-color status recipe (green/red/yellow/neutral/maroon) reused everywhere a filter or ban state is shown.
- Two accent lanes: lavender for browser-chrome navigation, mauve for the standalone Filter Checker tool — never mixed within one context except as a deliberate gradient pairing.
- Each page carries one signature structural motif (see Components → Per-Page Signature Motifs) built from the same tokens, so the system reads as one product without every screen defaulting to the same generic list-of-cards template.

## Colors

Every hue is a low-saturation Catppuccin Macchiato tone; nothing in the system reaches full-saturation "alert" red or "go" green — even status colors stay muted so the interface never shouts.

### Primary
- **Cockpit Lavender** (`#b7bdf8`): the browser-chrome accent — active tab icon color, omnibox focus border and caret, focus-ring glow, extensions/nav-button hover state, primary-button hover fill. This is the accent for in-browser navigation contexts.

### Secondary
- **Signal Mauve** (`#c6a0f6`): the accent for the standalone Filter Checker tool — input focus border/ring, primary CTA fill, and the gradient partner to Lavender on the page's headline text. Mauve marks "you are inside a dedicated tool," distinct from Lavender's "you are navigating the browser."

### Tertiary
- **Quiet Sky** (`#91d7e3`): rare link-hover accent on the shared status-page template (ban/new-tab), paired with the neutral **Blue** (`#8aadf4`) used for the Select component's focus/open state. Both are minor, low-frequency accents — do not promote either to a primary role.

### Neutral (surface tiers, darkest to lightest)
- **Crust** (`#181926`): the darkest tier — browser chrome frame, tabstrip background, inactive tabs, floating menu background. Recedes.
- **Mantle** (`#1e2030`): one step up — dropdowns, tab drag-clone, filter-check status panels.
- **Base** (`#24273a`): the active content plane — active tab fill, active viewport background, focused input fill. The "you are here" tone.
- **Surface 0 / 1 / 2** (`#363a4f` / `#494d64` / `#5b6078`): interactive surface tiers, lightest closest to the hand — default omnibox fill, hover backgrounds, borders, dividers. Surface 2 is reserved for the lightest hover/border state.
- **Overlay 0 / 1** (`#6e738d` / `#8087a2`): muted icon and secondary-text color at rest.
- **Subtext 0 / 1** (`#a5adcb` / `#b8c0e0`): body and label text one step below full-contrast text.
- **Text** (`#cad3f5`): primary foreground, reserved for active/focused content, not decoration.

### Status (used identically wherever a filter/ban verdict is shown)
- **Allowed** — Green (`#a6da95`)
- **Blocked** — Red (`#ed8796`)
- **Warned** — Yellow (`#eed49f`)
- **Unknown** — Overlay 1 (`#8087a2`, neutral)
- **Error** — Maroon (`#ee99a0`)

### Named Rules
**The Recede-to-Advance Rule.** Depth is expressed by lightness, not shadow: chrome and inactive surfaces sit in the darkest tones (Crust), the active content plane and focused controls step up to Base, and anything meant to feel touchable steps up again through Surface 0 → 1 → 2. Darker means "frame," lighter means "closer to the hand."

**The Two-Lane Accent Rule.** Lavender is the browser-chrome accent; Mauve is the standalone-tool accent. They appear together only as the intentional 135° headline gradient on the Filter Checker page — never mixed as competing accents within the same component.

**The Status Triad Recipe.** Every filter/ban status card follows one recipe: background = `color-mix(accent 8%, mantle)`, border = `color-mix(accent 30%, transparent)`, icon/label = solid accent at full value. This recipe is what makes five different verdicts read as one system.

## Typography

**Body/UI Font:** "Rubik", ui-sans-serif, sans-serif (single font family for the entire system — no serif or mono pairing)

**Character:** Rubik's rounded, slightly soft geometry keeps the dense instrument-panel sizing from feeling cold. There is no second typeface anywhere in the system; hierarchy comes entirely from size, weight, and letter-spacing.

### Hierarchy
- **Display** (500, 35px, line-height 1.1): the shared status-page headline (`h1` on New Tab / Ban / Ban Info) — plain text color, not gradient-filled.
- **Headline** (600, 28px, line-height 1.2, -0.01em): the Filter Checker page title only — the one place a gradient text-fill (Lavender → Mauve, 135°) is used.
- **Body** (400, 14px): form labels, filter-check body copy, dropdown options.
- **Chrome** (500, 12.5px): all in-browser-chrome UI text — tab titles, omnibox input, history rows, URL bar suggestions. This is a distinct size tier from Body; don't collapse the two.
- **Label** (600, 12px, 0.06em tracking, uppercase): status labels, "detected filters" caption, category chips.

### Named Rules
**The One-Family Rule.** Rubik is the only typeface in the system. Hierarchy is built from size/weight/tracking, never a second font.

## Layout

Standalone tool pages (Filter Checker, Ban, New Tab) center a single column, `max-width: 640px`, with generous outer padding (`48px 24px`) and a `32px` gap between major blocks — the composition breathes and reads as one focused task, unlike the dense browser-chrome layer above it.

The browser chrome itself is edge-to-edge with almost no outer padding: tabstrip padding is `6px 8px 0`, the omnibox row padding is `0 8px`. Density is high on purpose — this layer is muscle memory, not a page to read.

Spacing scale actually used: `4px, 6px, 8px, 10px, 14px, 16px, 20px, 24px, 32px, 48px`. Small gaps (4–8px) govern icon-to-label spacing inside a single control; large gaps (24–48px) govern space between whole page sections. There is no mid-range 12px/18px step in use — don't introduce one.

## Elevation & Depth

**Flat by default, lifted on demand.** At rest, every surface is tonal layering (see Recede-to-Advance) with no shadow at all. A real `box-shadow` appears only on things that float above the page's normal stacking: context menus, the Select dropdown, the dragged-tab clone, and the Filter Checker's result cards and form panel.

### Shadow Vocabulary
- **Floating menu** (`0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.18)`): context menu and its submenus.
- **Dropdown** (`0 4px 12px rgba(0,0,0,0.15)`): the Select component's open list.
- **Panel** (`0 4px 24px rgba(0,0,0,0.18)`): the Filter Checker form card.
- **Card hover-lift** (`0 6px 20px rgba(0,0,0,0.2)`, paired with `translateY(-2px)`): filter-check result cards on hover.
- **Drag clone** (`0 8px 24px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.3)`): the tab being dragged, on top of its normal 3-sided border-shadow.
- **Accent glow** (`0 4px 16px color-mix(in srgb, {accent} 40%, transparent)`): reserved for accent-colored CTA hover states — a colored glow instead of a black shadow, so it reads as "interactive light," not "structural depth."

### Named Rules
**The Colored-Glow-vs-Black-Shadow Rule.** Structural elevation (menus, dropdowns, cards) always uses neutral black shadows. Interactive accent feedback (button hover, focus rings) always uses a `color-mix` glow in the relevant accent color. Never substitute one for the other.

## Shapes

Four deliberate radius tiers, chosen by what the shape needs to do:
- **Circular** (`50%`): every icon-only control — tab-close, new-tab, extensions, nav buttons. Sized 18–30px.
- **Pill** (`14px` omnibox / `20px` badges & chips / `999px` floating tabs): anything meant to feel soft and grabbable — the omnibox, status badges, category chips, and the browser tab pills at rest.
- **Panel** (`10–14px`): context menu, dropdown, cards, the Filter Checker form panel. The **docked** tab shape (`14px 14px 0 0`) is this tier's flat-bottomed variant — see Tabs.
- **Control** (`8px`): rectangular buttons and text inputs — the one place a harder corner is intentional, signaling "this is a form control, not chrome."
- **Cartridge** (`18px`): the Apps grid tile — the single roundest, most object-like shape in the system, reserved for that one tile-launcher surface.

Borders are thin (`1–1.5px`), almost always drawn in a Surface tier or, at focus, in the active accent color. No component uses a border heavier than 1.5px.

### Named Rules
**The Pill-to-Dock Rule.** A tab is never one fixed shape. At rest it's a full stadium pill (Pill tier); active, it flattens its bottom corners and drops to meet the content plane (Panel tier's docked variant). The shape itself communicates state — don't freeze it at one radius.

## Components

### Buttons
- **Shape:** `8px` radius (Control tier).
- **Primary:** Mauve→Lavender 135° gradient fill, Crust text, `10px 28px` padding, 600 weight, 0.02em tracking — used for the Filter Checker's single primary CTA.
- **Ghost/Icon:** transparent background, Overlay 0/1 icon color, `50%` radius, hover fills to Surface 0 with Lavender icon color — used throughout browser chrome (nav, extensions, tab-new).
- **Hover / Focus:** primary buttons lift `-1px` and gain an accent-colored glow shadow; ghost buttons simply fill with Surface 0. No underline or outline states.

### Tabs (signature component)
The browser tabstrip is Civil's most distinctive surface, and its shape now carries meaning. At rest, every tab is a fully **detached floating pill** (`999px` radius) in Mantle, sitting one tone above the Crust strip it floats on with a real gap beneath it (a `translateY(-5px)` lift, not a margin, so the float never triggers layout). The active tab **docks**: it drops to `translateY(0)`, its background steps to Base, its bottom corners flatten to `14px 14px 0 0`, and it welds into the content plane below via a 3-sided Surface-0 inset border plus a subtle Surface-1 top highlight. The dock/float transition is a smooth, explicit interactive-feedback opt-in (background, color, border-radius, transform), not a hard cut.

Beyond shape, the active tab carries a 600-weight title and a 14px Lavender icon (vs. Overlay-0 at rest). Favicon radius is unified to 3px across the system. The close button stays hidden at rest, peeks at 0.35 opacity on the active tab, and reaches full opacity on hover of the tab or the button itself — a graduated affordance, not a snap. Keyboard focus shows a two-layer ring (Base moat + Lavender glow). Dragging produces a dedicated floating clone — the pill fully detached, full stadium radius on every corner, heavier layered shadow — while the origin tab dims to 0.4 opacity: dragging is just the floating state made explicit. New tabs fade in over 160ms (opacity only, so it never fights the pill/dock transform). Tab-resize itself (width, when the strip recalculates) is never animated: it's excluded from the transition list on purpose, so adding/closing tabs stays an instant layout snap rather than an animated reflow across every open tab.

### Per-Page Signature Motifs
Every page below shares the system's tokens (color, type, motion, radii) but is built around one distinct structural idea, so no two surfaces default to the same generic "list of cards" template:

- **Apps (game-cartridge tiles):** a `18px`-radius Cartridge tile with a big centered icon stage over a Crust-tinted caption bar — icon fill and caption sit in one square object, not a small-icon-plus-label stack. Hover lifts the whole tile `-3px` with a Lavender glow (not a black shadow — this is an interactive launcher tile, not a structural card) while the icon itself scales to `1.06`; press settles to `0.97` for a tactile "insert the cartridge" squeeze.
- **Extensions (settings-panel rows):** dense, full-width rows with a small enabled/disabled status dot (Green when on, Overlay-0 when off) instead of a colored border strip, a smooth spring-eased toggle switch (`cubic-bezier(0.34, 1.56, 0.64, 1)`), and a rule under each "Chrome/Firefox Extensions" section header — reads as a real preferences panel, deliberately more utilitarian than Apps' tile grid.
- **History (timeline rail + day chart):** entries group under day headers (Today / Yesterday / full date) and connect down a thin Surface-1 rail with a small dot per entry — the page reads as a chronological record, not a flat list, which is what actually differentiates it from Bookmarks. Each day header is itself a plot: a 24-column chart of *that day's* visits by hour, scaled to the day's own busiest hour, sitting on a baseline that continues out of the date as the section rule, with notches hanging below it at 00/06/12/18. Lit hours start at 35% of the plot height so a one-visit hour is still clearly taller than an empty one, and every column carries an `HH:00 — n pages` tooltip. The charts are right-anchored against a fixed-width count so they line up in a column across days; below `560px` the chart drops onto its own full-width line, which keeps every day on an identical scale instead of letting the date's length decide the chart's width. The filter above feeds the charts as well as the list, so typing a domain turns the whole page into "when did I visit this" — the single reason this page is worth more than a reverse-chronological list.
- **Bookmarks (ribbon tag):** each row carries a literal bookmark-ribbon silhouette (a small clipped-flag shape, Overlay-1 at rest, Lavender on hover) on its leading edge — a direct, on-the-nose visual pun on what a bookmark is, instead of a plain favicon-row.
- **Ban (stripe-field atmosphere):** a muted maroon-tinted diagonal stripe field (reusing 404's stripe-background language, different tint) fills the page behind the centered message — gives the blocked moment real visual weight without ever reaching alarm-red.
- **New Tab (the reticle):** the page is an aiming moment. A tracked `CIVIL` wordmark over an etched rule carries the identity, and the search field sits inside a real viewfinder — four thin Lavender brackets plus centre-axis ticks on the left and right edges — which brightens *and tightens inward* on focus-within, so the whole frame closes on the field being aimed. A soft pool of light beneath the field seats it on the panel.
- **Ban Info (the strike gauge):** strikes are discrete and capped, so the meter is five separate cells rather than a percentage bar — unused cells recessed, used cells lit from within, colour escalating with the count. The reader's actual question is "how many do I have left", and a segmented gauge answers it without arithmetic.

### Omnibox / Inputs
- **Style:** Surface 0 fill, `14px` pill radius for the omnibox, `8px` radius for standalone form inputs; 1–1.5px transparent or Surface 1 border at rest.
- **Focus:** border shifts to the context's accent (Lavender in chrome, Mauve in Filter Checker), background steps to Mantle or Crust, and a 3px accent glow ring appears at 18–20% opacity.
- **Suggestions/history dropdown:** attaches directly under the omnibox with matching pill-bottom radius and a 3-sided accent-tinted glow shadow instead of a black one.

### Context Menu / Select (shared floating-surface language)
- **Style:** Mantle background, 1px Surface 0 border, 10px radius, black floating-menu shadow, 0.12s scale+translate pop-in easing `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Items:** transparent at rest, Surface 0 on hover, Surface 1 on active/press; a danger variant (delete/close) tints hover/active with a Red color-mix instead of Surface.

### Status Cards (Filter Checker results)
- **Corner Style:** `12px`.
- **Background/Border:** Status Triad Recipe (see Colors) — 8% accent-tinted Mantle fill, 30% accent-tinted border.
- **Hover:** lifts `-2px` with a neutral black shadow (structural, not accent glow — this is a content card, not a button).
- **Icon + Label:** solid accent color, label uppercase at 11px/600/0.08em tracking.

### Badges / Chips
- **Style:** Surface 0 background, Lavender (detected-filter badges) or Subtext 1 (category chips) text, `20px` pill radius, 1px Surface 1 border.

## Do's and Don'ts

### Do:
- **Do** keep decorative transitions off by default; only add motion for one of two reasons: it's functional (a loader), or it's direct interactive feedback (entrance, hover, focus, active-state change) on a control the user just touched. Use the `DUR` and `EASE` tokens rather than typing a duration.
- **Do** put every full-page surface in `atmosphere()` and give every raised surface `lit()` — a page with neither reads as flat and unfinished next to the ones that have both.
- **Do** open every full-page panel with the shared masthead (`eyebrow` + `pageTitle` + `mastheadRule` from `layout.css.ts`). The eyebrow naming the panel's role — Launcher, Preferences, Record, Collection — is what makes a list of links read as an instrument readout.
- **Do** scope motion opt-ins to paint/composite properties (`background`, `color`, `opacity`, `transform`) and keep layout properties (`width`, `height`, `top`/`left`) out of the transition list, so a state change on one control never becomes an animated reflow across its neighbors (see Tabs: width is deliberately excluded so tab-resize stays an instant snap).
- **Do** use the Status Triad Recipe (8% background tint / 30% border tint / solid accent icon+label) for any new filter/ban/verdict UI — this is the system's most load-bearing repeatable pattern.
- **Do** keep Lavender scoped to browser-chrome/navigation contexts and Mauve scoped to standalone-tool contexts; only combine them as the established headline gradient.
- **Do** size in-chrome UI text at 12.5px (Chrome tier), distinct from the 14px Body tier used on standalone pages.
- **Do** give every interactive chrome control a visible keyboard focus state (see Tabs' two-layer focus ring) — mouse-only affordances are an accessibility gap, not a stylistic choice.
- **Do** give each page one real structural signature (see Components → Per-Page Signature Motifs) built from the shared tokens, rather than reaching for the same icon-plus-label card recipe on every list page.

### Don't:
- **Don't** give the system a sketchy free-proxy-site look — no pop-up-style CTAs, no aggressive ad framing competing with the product chrome (ad placements must sit outside the browser-chrome/tool surfaces, not dressed up to look like part of them).
- **Don't** default to generic unstyled browser chrome — every chrome element (tabs, omnibox, nav buttons) carries the Macchiato palette and the pill/circular shape language; a flat grey Chrome-clone look is a regression.
- **Don't** introduce loud gamer-aesthetic treatments (neon, RGB gradients, aggressive angular shapes) anywhere in the system — the palette stays muted Catppuccin even in high-attention UI like status cards or CTAs.
- **Don't** add ambient motion — anything that animates at rest, on a timer, or without a user action behind it stays off. A pulsing indicator is exactly the kind of thing that draws a second glance on a shared screen, which is the one thing this product cannot afford. Interactive feedback (entrance, hover, focus) is the one allowed category.
- **Don't** reintroduce a blanket `!important` motion override. If something animates when it shouldn't, fix that component.
- **Don't** use a black structural shadow for accent-interactive feedback (buttons, focus) or a colored glow for structural elevation (menus, cards) — the two shadow vocabularies are not interchangeable.
- **Don't** reach for a same-size icon+heading+text card as the default page structure — it's the generic "AI slop" tell this system explicitly avoids. Every list page in Components → Per-Page Signature Motifs earned a different shape because the content is actually different (a launcher tile isn't a settings row isn't a timeline entry).
