import { globalStyle, style } from "@vanilla-extract/css";

import {
    BAND,
    blend,
    elevation,
    GROUND,
    KEY_COBALT,
    LIFT,
    PEBBLE,
    RISE,
} from "./material.css";
import { FONT_SANS } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The start page. Header and footer take their own height; everything else
 * centres in what is left, with paddings small enough that a 768px laptop
 * inside the browser chrome shows the whole page without scrolling.
 *
 * It stands on the same drifting ground as every page. What it adds is the
 * cast: a cobalt globe specimen that catches the light now and then, and one
 * mineral per destination below the search well.
 */

export const page = style(
    blend(GROUND, {
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        padding: "24px 40px 18px",
        color: vars.color.firn,
        fontFamily: FONT_SANS,
        "@media": { "(max-width: 600px)": { padding: "20px 20px 16px" } },
    }),
);

export const header = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    animation: RISE,
});

export const brand = style({
    display: "inline-flex",
    borderRadius: "6px",
});

export const utilities = style({
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "10px",
});

// The lockup is cut from the same stone: two bands of sediment under the
// letters and a contact shadow. drop-shadow follows the letter shapes, and
// the mark is static, so the filter paints once. On hover the mark rises
// inside the link; the link itself stays put, so its hit box cannot slide
// out from under the pointer.
globalStyle(`.${brand} svg`, {
    filter: [
        `drop-shadow(0 1px 0 ${BAND.light})`,
        `drop-shadow(0 1px 0 ${BAND.dark})`,
        "drop-shadow(0 6px 6px color-mix(in srgb, black 40%, transparent))",
    ].join(" "),
    translate: `0 ${elevation}`,
    transition: LIFT,
});
globalStyle(`.${brand}:is(:hover, :focus-visible) svg`, {
    vars: { [elevation]: "-2px" },
});

export const utilityLink = style(
    blend(PEBBLE, {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        minHeight: "34px",
        padding: "0 12px",
        color: vars.color.snowmelt,
        textDecoration: "none",
        fontSize: "13px",
        borderRadius: "10px",
        selectors: {
            "&:hover": { color: vars.color.firn },
        },
    }),
);

export const content = style({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    maxWidth: "720px",
    margin: "0 auto",
    padding: "24px 0",
});

export const welcome = style({ textAlign: "center", animation: RISE });

export const emblem = style({
    display: "flex",
    justifyContent: "center",
    marginBottom: "24px",
    "@media": { "(max-width: 600px)": { marginBottom: "18px" } },
});

// Raised lettering, lit from the same side as every slab.
export const heading = style({
    fontSize: "40px",
    lineHeight: 1.15,
    fontWeight: 450,
    letterSpacing: "-0.035em",
    textWrap: "balance",
    textShadow: `0 1px 0 ${vars.color.basalt}, 0 4px 12px color-mix(in srgb, black 40%, transparent)`,
    "@media": { "(max-width: 600px)": { fontSize: "30px" } },
});

export const description = style({
    marginTop: "12px",
    fontSize: "16px",
    lineHeight: 1.6,
    color: vars.color.snowmelt,
    textWrap: "balance",
    "@media": {
        "(max-width: 600px)": {
            fontSize: "14px",
            maxWidth: "32ch",
            marginLeft: "auto",
            marginRight: "auto",
        },
    },
});

export const searchSeat = style({
    width: "100%",
    maxWidth: "600px",
    marginTop: "30px",
    animation: RISE,
    animationDelay: "80ms",
    "@media": { "(max-width: 600px)": { marginTop: "24px" } },
});

export const openBrowser = style(
    blend(KEY_COBALT, {
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        marginTop: "30px",
        padding: "14px 20px",
        borderRadius: "12px",
        textDecoration: "none",
    }),
);

export const shortcuts = style({
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
    width: "100%",
    marginTop: "40px",
    animation: RISE,
    animationDelay: "160ms",
    "@media": {
        "(max-width: 600px)": {
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "8px",
            maxWidth: "380px",
            marginTop: "28px",
        },
    },
});

// The destination's contents rise a little on hover while its specimen tilts
// toward the reader, and the label brightens. The link itself stays put: it
// is the hover target, and a target that moves can slide off the pointer.
export const shortcut = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "14px 8px 16px",
    borderRadius: "16px",
    color: vars.color.snowmelt,
    textDecoration: "none",
    textAlign: "center",
    transition: LIFT,
    "@media": { "(max-width: 600px)": { padding: "12px 6px" } },
    selectors: {
        "&:hover, &:focus-visible": { color: vars.color.firn },
    },
});

globalStyle(`.${shortcut} > *`, {
    translate: `0 ${elevation}`,
    transition: LIFT,
});
globalStyle(`.${shortcut}:is(:hover, :focus-visible) > *`, {
    vars: { [elevation]: "-2px" },
});

export const shortcutMark = style({ marginBottom: "14px" });

export const shortcutTitle = style({ fontSize: "14px", fontWeight: 500 });

export const shortcutDescription = style({
    marginTop: "4px",
    fontSize: "11px",
    lineHeight: 1.5,
    color: vars.color.ash,
});

export const footer = style({
    textAlign: "center",
    fontSize: "11px",
    lineHeight: 1.6,
    color: vars.color.ash,
});
