import { style, styleVariants } from "@vanilla-extract/css";
import { DUR, EASE } from "./material.css";
import { ANNO, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The stop plate.
 *
 * This is the one page a reader does not choose to visit, so it does the
 * opposite of every other page in the app: it holds a single centred block and
 * refuses to fill the viewport with structure. No ruled field, no ledger, no
 * controls beyond the one link out. The registration marks and the rule
 * weights are what tie it to the rest of the system.
 *
 * The severity band across the top is the only place in the app where colour
 * spans the full width, which is the point — it is the page saying "stop"
 * before any word is read.
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
    border: `0.5px solid ${vars.color.scree}`,
    background: vars.color.basalt,
});

// Severity as a full-width band rather than a tinted card: at 3px it is a
// non-text mark, so the 3:1 threshold applies and both tones clear it.
export const band = styleVariants({
    restricted: {
        height: "3px",
        margin: "-34px -32px 26px",
        background: vars.color.sandstone,
    },
    banned: {
        height: "3px",
        margin: "-34px -32px 26px",
        background: vars.color.wine,
    },
});

export const eyebrow = style({
    ...ANNO,
    display: "flex",
    alignItems: "center",
    gap: "9px",
    textTransform: "uppercase",
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
    fontSize: "clamp(25px, 4vw, 33px)",
    fontWeight: 600,
    lineHeight: 1.05,
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
    textTransform: "uppercase",
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
