import { style } from "@vanilla-extract/css";

import { FONT_SANS } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The start page. Header and footer take their own height; everything else
 * centres in what is left, with paddings small enough that a 768px laptop
 * inside the browser chrome shows the whole page without scrolling.
 */

export const page = style({
    minHeight: "100svh",
    display: "flex",
    flexDirection: "column",
    padding: "24px 40px 18px",
    background: vars.color.stratum,
    color: vars.color.firn,
    fontFamily: FONT_SANS,
    "@media": { "(max-width: 600px)": { padding: "20px 20px 16px" } },
});

export const header = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
});

export const brand = style({ display: "inline-flex", borderRadius: "6px" });

export const utilityLink = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "36px",
    padding: "0 10px",
    marginRight: "-10px",
    color: vars.color.snowmelt,
    textDecoration: "none",
    fontSize: "13px",
    borderRadius: "8px",
    transition: "background 180ms ease-out, color 180ms ease-out",
    selectors: {
        "&:hover": { background: vars.color.scree, color: vars.color.firn },
    },
});

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

export const welcome = style({ textAlign: "center" });

export const emblem = style({
    display: "grid",
    placeItems: "center",
    width: "56px",
    height: "56px",
    margin: "0 auto 20px",
    border: `1px solid ${vars.color.talus}`,
    borderRadius: "16px",
    color: vars.color.snowmelt,
    "@media": {
        "(max-width: 600px)": {
            width: "48px",
            height: "48px",
            marginBottom: "16px",
            borderRadius: "16px",
        },
    },
});

export const heading = style({
    fontSize: "40px",
    lineHeight: 1.15,
    fontWeight: 450,
    letterSpacing: "-0.035em",
    textWrap: "balance",
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
    marginTop: "28px",
    "@media": { "(max-width: 600px)": { marginTop: "24px" } },
});

export const openBrowser = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "28px",
    padding: "14px 20px",
    borderRadius: "10px",
    color: vars.color.basalt,
    background: vars.color.cobalt,
    textDecoration: "none",
    fontWeight: 600,
    transition: "background 180ms ease-out",
    selectors: {
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.cobalt} 85%, ${vars.color.firn})`,
        },
    },
});

export const shortcuts = style({
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
    width: "100%",
    marginTop: "36px",
    "@media": {
        "(max-width: 600px)": {
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "8px",
            maxWidth: "380px",
            marginTop: "28px",
        },
    },
});

export const shortcut = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "14px 8px 16px",
    borderRadius: "16px",
    color: vars.color.snowmelt,
    textDecoration: "none",
    textAlign: "center",
    transition: "background 180ms ease-out, color 180ms ease-out",
    "@media": { "(max-width: 600px)": { padding: "12px 6px" } },
    selectors: {
        "&:hover, &:focus-visible": {
            background: vars.color.scree,
            color: vars.color.firn,
        },
    },
});

export const shortcutIcon = style({
    display: "grid",
    placeItems: "center",
    width: "48px",
    height: "48px",
    marginBottom: "12px",
    borderRadius: "16px",
    background: vars.color.scree,
    color: vars.color.snowmelt,
    transition: "background 180ms ease-out, color 180ms ease-out",
    selectors: {
        [`.${shortcut}:hover &, .${shortcut}:focus-visible &`]: {
            background: vars.color.talus,
            color: vars.color.firn,
        },
    },
});

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
