import { style } from "@vanilla-extract/css";

import { FONT_SANS } from "./schematic.css";
import { vars } from "./theme.css";

const PATREON = "#FF424D";
const T = "0.12s ease";

// Tinted-accent recipe: a solid brand-red block would clash against the muted
// alpine palette everywhere else, so Patreon's red is toned into a background
// tint plus accent text and icon rather than a full-saturation fill.
//
// Square, like every other control. This was the one rounded element left in an
// app with no border radius anywhere, which made a third-party button read as
// pasted on rather than as part of the page. The mark and the wordmark carry
// the brand recognition; the corner radius was never doing that work.
export const button = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    padding: "7px 14px",
    border: `1px solid color-mix(in srgb, ${PATREON} 35%, transparent)`,
    background: `color-mix(in srgb, ${PATREON} 12%, ${vars.color.scree})`,
    color: `color-mix(in srgb, ${PATREON} 75%, ${vars.color.firn})`,
    fontFamily: FONT_SANS,
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1,
    cursor: "pointer",
    userSelect: "none",
    transition: `background ${T}, border-color ${T}, box-shadow ${T}`,
    transitionDuration: "0.12s",
    selectors: {
        "&:hover": {
            background: `color-mix(in srgb, ${PATREON} 20%, ${vars.color.scree})`,
            borderColor: `color-mix(in srgb, ${PATREON} 55%, transparent)`,
            boxShadow: `0 0 0 3px color-mix(in srgb, ${PATREON} 18%, transparent)`,
        },
        "&:active": {
            opacity: 0.85,
        },
        "&:disabled": {
            opacity: 0.45,
            cursor: "not-allowed",
            boxShadow: "none",
        },
    },
});

export const loggedIn = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "5px 10px",
    border: `1px solid ${vars.color.talus}`,
    background: vars.color.scree,
    color: vars.color.firn,
    fontFamily: FONT_SANS,
    fontSize: "13px",
    userSelect: "none",
    transition: `border-color ${T}`,
    transitionDuration: "0.12s",
    selectors: {
        "&:hover": {
            borderColor: vars.color.talus,
        },
    },
});

export const avatar = style({
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
});

/**
 * The initial shown when a supporter has no Patreon avatar.
 *
 * White on full-strength Patreon red measures 3.42:1 — below the 4.5:1 floor
 * for text this size, and pure white is barred by the palette anyway. Dropping
 * the ground toward `void` keeps the red unmistakably Patreon's while lifting
 * the initial to 6.88:1 against `daylight`.
 */
export const avatarFallback = style({
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: `color-mix(in srgb, ${PATREON} 55%, ${vars.color.basalt})`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.color.firn,
    fontSize: "11px",
    fontWeight: 700,
    flexShrink: 0,
});

export const userName = style({
    color: vars.color.firn,
    maxWidth: "140px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const divider = style({
    width: "1px",
    height: "14px",
    background: vars.color.talus,
    flexShrink: 0,
});

export const signOutBtn = style({
    padding: "2px 6px",
    border: "none",
    background: "transparent",
    color: vars.color.ash,
    fontFamily: FONT_SANS,
    fontSize: "11px",
    cursor: "pointer",
    transition: `color ${T}, background ${T}`,
    transitionDuration: "0.12s",
    selectors: {
        "&:hover": {
            background: vars.color.talus,
            color: vars.color.firn,
        },
        "&:active": {
            opacity: 0.7,
        },
    },
});
