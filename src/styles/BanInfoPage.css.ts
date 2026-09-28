import { style, styleVariants } from "@vanilla-extract/css";

import { blend, edge, LIT, SHADE, WELL } from "./material.css";
import { ANNO, FONT_MONO, RULE } from "./schematic.css";
import { vars } from "./theme.css";

const WINE_FACE = `color-mix(in oklab, ${vars.color.wine} 14%, ${vars.color.scree})`;

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

// A ban is a slab of wine-stained stone, its sediment banded in wine.
export const banned = style({
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    alignItems: "start",
    gap: "14px",
    padding: "16px",
    borderRadius: "14px",
    backgroundColor: WINE_FACE,
    backgroundImage: LIT,
    boxShadow: `${SHADE.lip}, ${edge(
        4,
        `color-mix(in oklab, ${vars.color.wine} 40%, ${vars.color.basalt})`,
        `color-mix(in oklab, ${vars.color.wine} 22%, ${vars.color.basalt})`,
    )}`,
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
});

export const controlLabel = style({
    ...ANNO,
    flexShrink: 0,
    whiteSpace: "nowrap",
});

export const controlInput = style(
    blend(WELL, {
        width: "10ch",
        padding: "7px 10px",
        border: "none",
        borderRadius: "9px",
        outline: "none",
        color: vars.color.firn,
        fontFamily: FONT_MONO,
        fontSize: "13px",
        fontVariantNumeric: "tabular-nums",
        caretColor: vars.color.cobalt,
    }),
);

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
// The roll is printed into a long carved well.
export const roll = style(
    blend(WELL, {
        columnWidth: "220px",
        columnGap: "28px",
        margin: "14px 0 0",
        padding: "16px 18px",
        borderRadius: "14px",
    }),
);

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
