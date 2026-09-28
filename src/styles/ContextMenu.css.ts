import { globalStyle, keyframes, style } from "@vanilla-extract/css";

import { blend, edge, PLATE, ROW_LIFT, SHADE } from "./material.css";
import { FONT_SANS } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * A small menu laid over the page: a slab that settles into place, with 6px
 * inset rows that lift under the pointer. Rows are left-aligned on a fixed
 * icon gutter so labels line up whether or not a row carries a glyph.
 */

const menuIn = keyframes({
    from: { opacity: 0, transform: "translateY(-6px) scale(0.98)" },
    to: { opacity: 1, transform: "translateY(0) scale(1)" },
});

export const iframeCover = style({
    position: "fixed",
    inset: 0,
    zIndex: 9998,
    background: "transparent",
    pointerEvents: "all",
});

const sheet = blend(PLATE, {
    borderRadius: "14px",
    padding: "6px",
    fontFamily: FONT_SANS,
    fontSize: "13px",
    color: vars.color.firn,
    userSelect: "none",
});

export const menu = style(
    blend(sheet, {
        position: "fixed",
        zIndex: 9999,
        width: "220px",
        transformOrigin: "top left",
        animation: `${menuIn} 0.16s cubic-bezier(0.22, 1, 0.36, 1) both`,
        animationDuration: "0.16s",
    }),
);

export const menuItem = style(
    blend(ROW_LIFT, {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        boxSizing: "border-box",
        padding: "7px 10px",
        borderRadius: "8px",
        border: "none",
        background: "transparent",
        color: vars.color.firn,
        cursor: "pointer",
        selectors: {
            // Pressed, the chip settles back into the slab: its bands tuck
            // under it (same two slots as the hover, so it slides, not pops).
            "&:active": {
                boxShadow: `${SHADE.lip}, ${edge(0, undefined, undefined, SHADE.near, 2)}`,
                transitionDuration: "90ms",
            },
        },
    }),
);

const WINE_ROW = `color-mix(in oklab, ${vars.color.wine} 18%, ${vars.color.scree})`;

export const menuItemDanger = style({
    color: vars.color.wine,
    selectors: {
        "&:hover, &:focus-within": {
            backgroundColor: WINE_ROW,
            backgroundImage: "none",
        },
    },
});

// Always rendered, so a row without a glyph keeps its label on the gutter.
export const menuItemIcon = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "16px",
    height: "16px",
    flexShrink: 0,
    color: vars.color.ash,
    selectors: {
        [`.${menuItem}:hover &`]: { color: "inherit" },
        [`.${menuItemDanger} &`]: { color: "inherit" },
    },
});

export const menuItemLabel = style({
    flex: 1,
    minWidth: 0,
    color: "inherit",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
});

export const menuItemShortcut = style({
    fontSize: "12px",
    color: vars.color.ash,
    marginLeft: "auto",
    paddingLeft: "16px",
    flexShrink: 0,
});

// A groove across the slab: shadowed above, lit below.
export const separator = style({
    height: 0,
    margin: "5px 4px 6px",
    borderTop: `1px solid color-mix(in srgb, ${vars.color.basalt} 60%, transparent)`,
    boxShadow: `0 1px 0 color-mix(in srgb, ${vars.color.firn} 6%, transparent)`,
    pointerEvents: "none",
    flexShrink: 0,
});

export const subMenuArrow = style({
    fontSize: "12px",
    color: vars.color.ash,
    marginLeft: "auto",
    paddingLeft: "16px",
    flexShrink: 0,
    lineHeight: 1,
});

export const subMenu = style(
    blend(sheet, {
        display: "none",
        position: "absolute",
        top: "-7px",
        left: "100%",
        marginLeft: "6px",
        width: "200px",
        zIndex: 10000,
    }),
);

export const subMenuWrap = style({
    position: "relative",
    width: "100%",
});

globalStyle(`.${subMenuWrap}:hover > .${subMenu}`, {
    display: "block",
});
