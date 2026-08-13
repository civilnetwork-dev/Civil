import { style, styleVariants } from "@vanilla-extract/css";
import { ANNO, FONT_MONO, RULE, SHEET_VPAD_VAR } from "./schematic.css";
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
 * Grid rather than flex so the horizon rule and the omnibox wrap can occupy
 * the exact same cell — that is what pins the rule to "the omnibox's
 * baseline" without hand-measured offsets. `position: relative` promotes
 * this into its own stacking layer so the star field (painted first, see
 * `starLayer` below) reads as behind it rather than on top.
 */
/**
 * Three rows in reading order — dimension line + omnibox, the horizon rule,
 * then the session readout — vertically centred as a block.
 *
 * They are rows, not two stacked items in one cell. Stacking them meant the
 * full-width rule centred on the whole stack rather than on the omnibox, so it
 * emerged through the middle of the input, crossing the placeholder and the
 * UNBLOCK divider. Anything that reintroduces `gridArea: 1 / 1` here brings
 * that back.
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
    display: "flex",
    flexDirection: "column",
    gap: "10px",
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

export const omniboxBelow = style({
    width: "min(560px, 100%)",
    marginTop: "10px",
});

/** The dimension line above the field, marking the span it occupies. */
export const omniboxRule = style({
    opacity: 0.7,
});

export const statusStrip = style({
    display: "flex",
    flexWrap: "wrap",
    gap: "18px",
    margin: 0,
});

export const statusPair = style({
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
});

// starlight (7.27:1 against dusk) is the muted annotation tier used
// elsewhere in the schematic language (see schematic.css.ts); cinder
// (4.82:1) would also clear the 4.5:1 WCAG AA small-text minimum, but
// starlight keeps this label visually consistent with that tier.
export const statusKey = style({
    ...ANNO,
    color: vars.color.starlight,
    textTransform: "uppercase",
});

export const statusValue = style({
    ...ANNO,
    margin: 0,
    color: vars.color.daylight,
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

export const wordmark = style({
    margin: 0,
    fontSize: "clamp(28px, 4vw, 35px)",
    fontWeight: 500,
    lineHeight: 1.1,
    letterSpacing: "-0.015em",
    color: vars.color.daylight,
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
/* Star field                                                            */
/* -------------------------------------------------------------------- */

/**
 * Covers `pageGrid` edge to edge — reliable because `pageGrid` has a real,
 * definite height (see its comment above), unlike `sheetBody` on its own.
 * The percentage-based catalogue label below shares this same box as its
 * positioning reference, which is what keeps it lined up with the leader
 * line drawn inside the SVG. Placed first in DOM order among the sheet's
 * real content (see NewTabPage.tsx) so it paints behind the omnibox and
 * title zones, both of which are `position: relative` for exactly that
 * reason.
 */
export const starLayer = style({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
});

export const starField = style({
    display: "block",
    width: "100%",
    height: "100%",
});

/**
 * Brightness tiers, dimmest to brightest. `daylight` is reserved for the one
 * catalogued star — every field star stays at or below `moonlight` so the
 * catalogued object is unambiguously the brightest thing in the sky.
 */
export const starTier = styleVariants({
    cinder: { fill: vars.color.cinder },
    starlight: { fill: vars.color.starlight },
    moonlight: { fill: vars.color.moonlight },
    daylight: { fill: vars.color.daylight },
});

export const leaderLine = style({
    stroke: vars.color.cinder,
    strokeWidth: 0.5,
});

/**
 * Position is hardcoded to match the leader line's endpoint in
 * NewTabPage.tsx (`CATALOGUE_LEADER`) — both describe the same static point,
 * so a change to one must be mirrored in the other.
 */
export const catalogueLabel = style({
    position: "absolute",
    top: "18%",
    left: "77%",
    whiteSpace: "nowrap",
});
