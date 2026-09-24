import { style, styleVariants } from "@vanilla-extract/css";

import { DUR, EASE } from "./material.css";
import { ANNO, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The stop card.
 *
 * This is the one page a reader does not choose to visit, so it does the
 * opposite of every other page in the app: it holds a single centred card and
 * refuses to fill the viewport with structure. The severity band across its
 * top is the only place in the app where colour spans a whole edge, which is
 * the point: the page says "stop" before any word is read.
 */

export const root = style({
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "40px 24px",
    background: vars.color.stratum,
});

export const plate = style({
    position: "relative",
    width: "100%",
    maxWidth: "580px",
    padding: "34px 32px 30px",
    border: `1px solid ${vars.color.talus}`,
    borderRadius: "16px",
    overflow: "hidden",
    background: vars.color.basalt,
});

// Severity as a full-width band rather than a tinted card: at 3px it is a
// non-text mark, so the 3:1 threshold applies and both tones clear it.
export const band = styleVariants({
    restricted: {
        height: "3px",
        margin: "-35px -33px 27px",
        background: vars.color.sandstone,
    },
    banned: {
        height: "3px",
        margin: "-35px -33px 27px",
        background: vars.color.wine,
    },
});

export const eyebrow = style({
    ...ANNO,
    display: "flex",
    alignItems: "center",
    gap: "9px",
});

export const eyebrowMark = styleVariants({
    restricted: {
        width: "16px",
        height: "2px",
        background: vars.color.sandstone,
    },
    banned: { width: "16px", height: "2px", background: vars.color.wine },
});

export const title = style({
    margin: "10px 0 0",
    fontSize: "32px",
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "-0.015em",
    color: vars.color.firn,
});

export const reason = style({
    margin: "14px 0 0",
    paddingTop: "14px",
    borderTop: RULE.hair,
    fontSize: "14px",
    lineHeight: 1.6,
    color: vars.color.firn,
});

export const gaugeSlot = style({
    margin: "22px 0 0",
    paddingTop: "18px",
    borderTop: RULE.hair,
});

export const actions = style({
    display: "flex",
    alignItems: "center",
    gap: "14px",
    margin: "26px 0 0",
    paddingTop: "16px",
    borderTop: RULE.major,
});

// The house line on the one page a reader did not choose to open, so it stays
// quiet: annotation tier, no accent, sitting after the link rather than above.
export const note = style({
    ...ANNO,
    color: vars.color.snowmelt,
    marginLeft: "auto",
});

export const link = style({
    ...ANNO,
    color: vars.color.cobalt,
    textDecoration: "none",
    borderBottom: `0.5px solid ${vars.color.cobalt}`,
    paddingBottom: "2px",
    transitionProperty: "color, border-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&:hover": {
            color: vars.color.firn,
            borderBottomColor: vars.color.firn,
        },
    },
});
