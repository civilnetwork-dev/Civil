import { style, styleVariants } from "@vanilla-extract/css";
import { FONT_MONO, RULE, SHEET_VPAD_VAR } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * New Tab is the only sheet whose title block sits at the bottom, so its layout
 * is a three-row grid: empty headroom, the omnibox on the centre rule, then the
 * title block and margin note pinned to the base.
 */

export const newtabSheet = style({
    minHeight: "100vh",
});

/**
 * The three-row grid the file comment above describes. `Sheet`'s own root
 * sets `display: grid` too, but that grid only ever has one real item —
 * `sheetBody`, the sole non-absolutely-positioned child — so it can't
 * distribute headroom/omnibox/title the way this page needs. This wrapper,
 * placed inside `sheetBody` where the actual page content lives, is what
 * makes "1fr auto" do real work.
 *
 * A viewport-relative min-height rather than `height: 100%`: `sheetBody`
 * visually fills the sheet (it is the sole item in the outer grid's `1fr`
 * track), but that stretch is a layout-time resolution, not a definite
 * computed height a percentage-height descendant can resolve against —
 * confirmed against a rendered page, where `height: 100%` here collapsed to
 * the content's own ~180px instead of the sheet's ~680px. Viewport units
 * reproduce the sheet's own sizing approach one level in, so `titleZone` gets
 * a real bottom row to pin to instead of stacking directly under
 * `omniboxZone` with the remaining space dangling unused beneath it.
 *
 * The sheet's own vertical padding is subtracted because this element sits
 * *inside* it: a bare `100vh` here stacks on top of that padding and runs the
 * page exactly 108px past the fold, which is what made New Tab scroll.
 */
export const pageGrid = style({
    position: "relative",
    display: "grid",
    gridTemplateRows: "1fr auto",
    // One viewport MINUS the sheet's own vertical padding. A bare `100vh` here
    // stacks on top of that padding and pushes the page 108px past the fold,
    // which is why New Tab briefly scrolled.
    minHeight: `calc(100vh - var(${SHEET_VPAD_VAR}))`,
});

/**
 * Two rows in reading order — the omnibox, then the horizon rule it sits on —
 * vertically centred as a block. `position: relative` promotes this above the
 * section layer, which paints first.
 *
 * They are rows, not two stacked items in one cell. Stacking them meant the
 * full-width rule centred on the whole stack rather than on the omnibox, so it
 * emerged through the middle of the input, crossing the placeholder and the
 * UNBLOCK divider. Anything that reintroduces `gridArea: 1 / 1` here brings
 * that back.
 *
 * The dimension rule that used to sit above the field, and the session readout
 * (engine / transport / wisp) that hung below it, are gone: the first was
 * drafting ornament, the second was a developer diagnostic. This page has one
 * job — take an address — and now shows exactly one control.
 */
export const omniboxZone = style({
    position: "relative",
    display: "grid",
    gridTemplateColumns: "1fr",
    alignContent: "center",
    justifyItems: "center",
    width: "100%",
});

export const omniboxSeat = style({
    width: "min(560px, 100%)",
});

/**
 * Fills the row edge-to-edge so its `Rule` spans the sheet.
 *
 * The -1px is what seats the omnibox *on* this rule rather than above it: the
 * input carries its own hairline underline, and pulling the full-width rule up
 * by one pixel lands the two on the same line. The result reads as one rule
 * crossing the sheet with the omnibox sitting on it, which is the arrangement
 * DESIGN.md's FIRST VIEWPORT describes.
 */
export const horizonRuleTrack = style({
    width: "100%",
    marginTop: "-1px",
});

export const titleZone = style({
    // Positioned (see omniboxZone above) so the star field, painted first in
    // DOM order, stays a layer behind the title block and ad note rather
    // than on top of them.
    position: "relative",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "20px",
});

export const titleBlockCorner = style({
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    minWidth: "220px",
});

export const titleRule = style({
    marginBottom: "3px",
});

/**
 * The wordmark is drawn art now, not type, so the heading carries no font
 * properties — only the box. `Wordmark` renders an `<svg role="img">` with its
 * own accessible name, and the `h1` is what puts that name in the document
 * outline; an `srOnly` duplicate here would announce "Civil" twice.
 */
export const wordmark = style({
    margin: 0,
    lineHeight: 0,
    color: vars.color.firn,
});

export const adNote = style({
    margin: 0,
    maxWidth: "260px",
    textAlign: "right",
    paddingTop: "6px",
    borderTop: RULE.hair,
    fontFamily: FONT_MONO,
});

/* -------------------------------------------------------------------- */
/* The strata section                                                    */
/* -------------------------------------------------------------------- */

/**
 * Bands of stone descending the page, ruled apart — pure ground. The depth
 * log and the sample callout that used to annotate this layer were cut in the
 * minimal pass: numbers that look like information are worse than no numbers,
 * and this layer's whole job now is to sit quietly behind one input.
 *
 * Nine flat divs and a hairline each. Target hardware is low-end school
 * Chromebooks; nothing here blurs, blends or casts a shadow.
 *
 * Covers `pageGrid` edge to edge — reliable because `pageGrid` has a real,
 * definite height (see its comment above), unlike `sheetBody` on its own.
 * Placed first in DOM order among the sheet's real content so it paints behind
 * the omnibox and title zones, both of which are `position: relative` for
 * exactly that reason.
 */
export const sectionLayer = style({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    display: "flex",
    flexDirection: "column",
});

/**
 * One bed. Flex-grow carries the band's thickness so the section always fills
 * the viewport exactly, at any height, without a single computed pixel.
 */
export const band = style({
    position: "relative",
    borderBottom: RULE.hair,
    selectors: { "&:last-child": { borderBottom: "none" } },
});

/**
 * Density by tone, not by hue. Every bed is the same `scree`, held at a
 * different opacity, so the section reads as one rock face lit unevenly rather
 * than as nine coloured stripes.
 */
export const bandTone = styleVariants({
    0: { background: vars.color.scree, opacity: 0.16 },
    1: { background: vars.color.scree, opacity: 0.3 },
    2: { background: vars.color.scree, opacity: 0.44 },
    3: { background: vars.color.talus, opacity: 0.26 },
});
