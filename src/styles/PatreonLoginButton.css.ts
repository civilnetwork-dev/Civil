import { style } from "@vanilla-extract/css";

import { blend, edge, KEY_STONE, KEYCAP, LIT, SHADE } from "./material.css";
import { FONT_SANS } from "./schematic.css";
import { vars } from "./theme.css";

const PATREON = "#FF424D";

const FACE = `color-mix(in oklab, ${PATREON} 14%, ${vars.color.scree})`;
const FACE_HOVER = `color-mix(in oklab, ${PATREON} 22%, ${vars.color.scree})`;

// Tinted-accent recipe: a solid brand-red block would clash against the muted
// alpine palette everywhere else, so Patreon's red is toned into the key's
// stone face plus accent text and icon rather than a full-saturation fill. The
// key itself is cut and pressed like every other key in the app; the mark and
// the wordmark carry the brand recognition, not a shape of its own.
export const button = style(
    blend(KEY_STONE, {
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        padding: "7px 14px",
        borderRadius: "9px",
        border: "none",
        backgroundColor: FACE,
        backgroundImage: LIT,
        color: `color-mix(in srgb, ${PATREON} 75%, ${vars.color.firn})`,
        fontFamily: FONT_SANS,
        fontSize: "13px",
        fontWeight: 500,
        lineHeight: 1,
        cursor: "pointer",
        userSelect: "none",
        selectors: {
            "&:hover:not(:disabled)": {
                backgroundColor: FACE_HOVER,
                backgroundImage: LIT,
            },
            "&:disabled": {
                opacity: 0.45,
                cursor: "not-allowed",
            },
        },
    }),
);

export const loggedIn = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "5px 6px 5px 10px",
    borderRadius: "10px",
    backgroundColor: vars.color.scree,
    backgroundImage: LIT,
    boxShadow: `${SHADE.lip}, ${edge(2)}`,
    color: vars.color.firn,
    fontFamily: FONT_SANS,
    fontSize: "13px",
    userSelect: "none",
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
    fontSize: "12px",
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
    width: 0,
    height: "14px",
    borderLeft: `1px solid color-mix(in srgb, ${vars.color.basalt} 60%, transparent)`,
    boxShadow: `1px 0 0 color-mix(in srgb, ${vars.color.firn} 6%, transparent)`,
    flexShrink: 0,
});

export const signOutBtn = style(
    blend(KEYCAP, {
        padding: "3px 8px",
        border: "none",
        borderRadius: "7px",
        color: vars.color.ash,
        fontFamily: FONT_SANS,
        fontSize: "12px",
        cursor: "pointer",
        selectors: {
            "&:hover": { color: vars.color.firn },
        },
    }),
);
