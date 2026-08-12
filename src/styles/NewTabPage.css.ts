import { style } from "@vanilla-extract/css";
import { ANNO, FONT_MONO, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * New Tab is the only sheet whose title block sits at the bottom, so its layout
 * is a three-row grid: empty headroom, the omnibox on the centre rule, then the
 * title block and margin note pinned to the base.
 */

export const newtabSheet = style({
    display: "grid",
    gridTemplateRows: "1fr auto",
    minHeight: "100vh",
});

export const omniboxZone = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

export const omniboxWrap = style({
    width: "min(560px, 100%)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
});

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
