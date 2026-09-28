import { globalStyle, style } from "@vanilla-extract/css";

import { blend, GRAIN, hitArea, KEYCAP, PEBBLE } from "./material.css";
import { ANNO, FONT_SANS } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The bookmarks shelf: the last band of the terrace, holding a row of
 * pebbles. It shares the address row's scree plane; the chrome's cliff edge
 * below it is what separates toolbar from page, so it draws no rule of its
 * own.
 */

export const bar = style({
    display: "flex",
    alignItems: "center",
    gap: "4px",
    height: "34px",
    padding: "0 8px 4px",
    backgroundColor: vars.color.scree,
    backgroundImage: GRAIN,
    overflowX: "auto",
    overflowY: "hidden",
    flexShrink: 0,
    selectors: {
        "&::-webkit-scrollbar": { display: "none" },
    },
});

export const bookmark = style(
    blend(PEBBLE, {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "0 9px",
        height: "24px",
        borderRadius: "8px",
        cursor: "pointer",
        color: vars.color.firn,
        border: "none",
        fontSize: "12px",
        fontFamily: FONT_SANS,
        fontWeight: 400,
        whiteSpace: "nowrap",
        flexShrink: 0,
        maxWidth: "170px",
        selectors: {
            // The chip is shorter than a comfortable target, so the pointer
            // target is expanded without changing how the chip looks.
            "&::after": hitArea(),
            "&:focus-visible": {
                outline: `1px solid ${vars.color.cobalt}`,
                outlineOffset: "1px",
            },
        },
    }),
);

export const bookmarkFavicon = style({
    width: "12px",
    height: "12px",
    objectFit: "contain",
    flexShrink: 0,
});

export const bookmarkFaviconFallback = style({
    width: "12px",
    height: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: vars.color.ash,
});

export const bookmarkLabel = style({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
    minWidth: 0,
});

/**
 * Hidden until the chip is hovered or holds focus — but with opacity, not
 * `display: none`. Display-none removes an element from the tab order
 * outright, so this control was unreachable by keyboard entirely: there was no
 * sequence of keys that could delete a bookmark from the bar. `pointer-events`
 * is what stops an invisible button from swallowing clicks meant for the chip.
 */
export const bookmarkRemove = style({
    // Sits above the chip's expanded hit-area overlay, which would otherwise
    // paint over it and swallow the click.
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "14px",
    height: "14px",
    background: "transparent",
    border: "none",
    color: vars.color.ash,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    opacity: 0,
    pointerEvents: "none",
    transition: "color 0.1s ease, opacity 0.1s ease",
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": { color: vars.color.wine },
        "&:focus-visible": {
            opacity: 1,
            pointerEvents: "auto",
            outline: `1px solid ${vars.color.cobalt}`,
            outlineOffset: "1px",
        },
    },
});

globalStyle(
    `.${bookmark}:hover .${bookmarkRemove}, .${bookmark}:focus-within .${bookmarkRemove}`,
    { opacity: 1, pointerEvents: "auto" },
);

// Touch has no hover to reveal the control, so it is always available there.
globalStyle(`.${bookmarkRemove}`, {
    "@media": {
        "(hover: none)": { opacity: 1, pointerEvents: "auto" },
    },
});

// A groove cut into the shelf: shadowed on one side, lit on the other.
export const separator = style({
    width: 0,
    height: "14px",
    borderLeft: `1px solid color-mix(in srgb, ${vars.color.basalt} 60%, transparent)`,
    boxShadow: `1px 0 0 color-mix(in srgb, ${vars.color.firn} 6%, transparent)`,
    flexShrink: 0,
    margin: "0 4px",
});

export const addBookmarkBtn = style(
    blend(KEYCAP, {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "24px",
        height: "24px",
        border: "none",
        borderRadius: "7px",
        color: vars.color.snowmelt,
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
        selectors: {
            "&:hover": { color: vars.color.firn },
            "&:focus-visible": {
                outline: `1px solid ${vars.color.cobalt}`,
                outlineOffset: "1px",
            },
        },
    }),
);

export const emptyHint = style({
    ...ANNO,
    fontWeight: 400,
    color: vars.color.ash,
    paddingLeft: "6px",
    userSelect: "none",
});
