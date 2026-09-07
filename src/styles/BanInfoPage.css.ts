import { style, styleVariants } from "@vanilla-extract/css";

import { DUR, EASE } from "./material.css";
import { ANNO, FONT_MONO, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The tally and the roll.
 *
 * Two things sit on this page and they answer different questions: "where do I
 * stand" and "what is on the list". The tally is a small, dense block at the
 * top; the roll below it is a printed index — thousands of hostnames, set in
 * columns rather than one per row, because a single-column list of 500 domains
 * is a kilometre of scrolling that tells you nothing a column set does not.
 */

/* -------------------------------------------------------------------- */
/* Status                                                                */
/* -------------------------------------------------------------------- */

export const statusBlock = style({
    margin: "20px 0 0",
    padding: "18px 0 0",
    borderTop: RULE.major,
});

export const banned = style({
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    alignItems: "start",
    gap: "14px",
    padding: "16px",
    border: `0.5px solid color-mix(in srgb, ${vars.color.wine} 45%, transparent)`,
    background: `color-mix(in srgb, ${vars.color.wine} 10%, transparent)`,
});

export const bannedIcon = style({
    color: vars.color.wine,
    flexShrink: 0,
});

export const bannedInfo = style({
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    minWidth: 0,
});

export const bannedTitle = style({
    fontSize: "14.5px",
    fontWeight: 600,
    color: vars.color.firn,
});

export const bannedDetail = style({
    ...ANNO,
    color: vars.color.snowmelt,
});

/* -------------------------------------------------------------------- */
/* Controls                                                              */
/* -------------------------------------------------------------------- */

export const controls = style({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    margin: "24px 0 0",
    paddingBottom: "8px",
    borderBottom: RULE.hair,
    transitionProperty: "border-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.base,
    selectors: {
        "&:focus-within": { borderBottomColor: vars.color.cobalt },
    },
});

export const controlLabel = style({
    ...ANNO,
    flexShrink: 0,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
});

export const controlInput = style({
    width: "8ch",
    border: "none",
    background: "transparent",
    outline: "none",
    color: vars.color.firn,
    fontFamily: FONT_MONO,
    fontSize: "13px",
    fontVariantNumeric: "tabular-nums",
    caretColor: vars.color.cobalt,
});

export const stats = style({
    ...ANNO,
    marginLeft: "auto",
    color: vars.color.snowmelt,
});

/* -------------------------------------------------------------------- */
/* Roll                                                                  */
/* -------------------------------------------------------------------- */

/**
 * Column count is left to the browser: `column-width` fills the available
 * measure with as many columns as fit, so the same rule serves a phone and a
 * wide monitor without a single breakpoint.
 */
export const roll = style({
    columnWidth: "220px",
    columnGap: "28px",
    margin: "14px 0 0",
});

export const domain = style({
    fontFamily: FONT_MONO,
    fontSize: "11.5px",
    lineHeight: 1.9,
    color: vars.color.snowmelt,
    // Keeps a hostname from being split across a column boundary, which would
    // read as two different domains.
    breakInside: "avoid",
    overflowWrap: "anywhere",
});

export const sentinel = style({
    height: "1px",
});

export const note = styleVariants({
    loading: {
        ...ANNO,
        display: "flex",
        alignItems: "center",
        gap: "9px",
        margin: "22px 0 0",
        color: vars.color.snowmelt,
    },
    end: {
        ...ANNO,
        display: "block",
        margin: "22px 0 0",
        paddingTop: "10px",
        borderTop: RULE.hair,
        color: vars.color.snowmelt,
        textTransform: "uppercase",
    },
    error: {
        ...ANNO,
        display: "block",
        margin: "22px 0 0",
        paddingTop: "10px",
        borderTop: RULE.hair,
        color: vars.color.wine,
    },
});

export const spin = style({
    color: vars.color.ash,
    flexShrink: 0,
});
