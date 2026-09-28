import { style } from "@vanilla-extract/css";

import { alpha, blend, hitArea, PEBBLE, TABLET } from "./material.css";
import { ANNO, FONT_MONO } from "./schematic.css";
import { vars } from "./theme.css";

/** Jump links to each section: pebbles, like bookmarks on the shelf. */
export const jump = style({
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    margin: "0 0 28px",
});

export const jumpLink = style(
    blend(PEBBLE, {
        ...ANNO,
        padding: "6px 11px",
        borderRadius: "8px",
        color: vars.color.snowmelt,
        textDecoration: "none",
        selectors: { "&:hover": { color: vars.color.firn } },
    }),
);

/** What the last action did, read out politely. Holds its height when empty. */
export const status = style({
    ...ANNO,
    minHeight: "18px",
    margin: "-14px 0 18px",
    color: vars.color.snowmelt,
});

export const section = style({
    marginBottom: "36px",
    scrollMarginTop: "24px",
});

export const sectionTitle = style({
    margin: "0 0 12px",
    fontSize: "16px",
    fontWeight: 600,
    color: vars.color.firn,
    textShadow: `0 1px 0 ${vars.color.basalt}`,
});

export const tablet = style(
    blend(TABLET, {
        padding: "4px 20px",
        borderRadius: "16px",
        "@media": { "(max-width: 600px)": { padding: "4px 14px" } },
    }),
);

/** The first line of a section's tablet: where history is right now. */
export const summary = style({
    margin: 0,
    padding: "14px 0",
    fontSize: "13px",
    lineHeight: 1.55,
    color: vars.color.snowmelt,
});

/** A readout between rows: what the location check found. */
export const readout = style({
    padding: "14px 0",
    fontSize: "13px",
    lineHeight: 1.55,
    color: vars.color.snowmelt,
    borderTop: `1px solid ${alpha(vars.color.basalt, 55)}`,
    boxShadow: `inset 0 1px 0 ${alpha(vars.color.firn, 5)}`,
});

export const readoutList = style({
    listStyle: "none",
    margin: "8px 0 10px",
    padding: 0,
    display: "grid",
    gap: "4px",
});

export const readoutName = style({
    color: vars.color.firn,
    fontWeight: 500,
});

export const numbers = style({
    fontVariantNumeric: "tabular-nums",
});

/* Site rules */

export const rules = style({
    padding: "16px 0",
    borderTop: `1px solid ${alpha(vars.color.basalt, 55)}`,
    boxShadow: `inset 0 1px 0 ${alpha(vars.color.firn, 5)}`,
});

export const rulesLabel = style({
    display: "block",
    fontSize: "14px",
    fontWeight: 500,
    color: vars.color.firn,
});

export const rulesHint = style({
    ...ANNO,
    display: "block",
    marginTop: "4px",
    fontWeight: 400,
    lineHeight: 1.5,
});

export const ruleList = style({
    listStyle: "none",
    margin: "12px 0 0",
    padding: 0,
    display: "grid",
    gap: "8px",
});

export const ruleItem = style({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "10px",
});

export const ruleHost = style({
    flex: "1 1 160px",
    minWidth: 0,
    fontFamily: FONT_MONO,
    fontSize: "13px",
    color: vars.color.firn,
    overflowWrap: "anywhere",
});

export const ruleRemove = style({
    position: "relative",
    display: "grid",
    placeItems: "center",
    width: "26px",
    height: "26px",
    padding: 0,
    border: "none",
    borderRadius: "7px",
    background: "none",
    color: vars.color.ash,
    cursor: "pointer",
    selectors: {
        "&::after": hitArea(),
        "&:hover": { color: vars.color.wine },
    },
});

/** Offered after leaving out a site that already has pages saved. */
export const offer = style({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "10px",
    margin: "12px 0 0",
    fontSize: "13px",
    color: vars.color.snowmelt,
});

export const paste = style({
    display: "grid",
    justifyItems: "start",
    gap: "10px",
    padding: "0 0 16px",
});
