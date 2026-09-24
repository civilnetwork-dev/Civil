import { globalStyle, keyframes, style } from "@vanilla-extract/css";

import { FONT_SANS, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * A small menu laid over the page: a 12px sheet with 6px inset rows, entering
 * by opacity and a short translate. Rows are left-aligned on a fixed icon
 * gutter so labels line up whether or not a row carries a glyph.
 */

const T_FAST = "0.1s ease";

const menuIn = keyframes({
    from: { opacity: 0, transform: "translateY(-4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const iframeCover = style({
    position: "fixed",
    inset: 0,
    zIndex: 9998,
    background: "transparent",
    pointerEvents: "all",
});

const sheet = {
    background: vars.color.basalt,
    border: RULE.major,
    borderRadius: "12px",
    padding: "6px",
    fontFamily: FONT_SANS,
    fontSize: "13px",
    color: vars.color.firn,
    userSelect: "none",
} as const;

export const menu = style({
    ...sheet,
    position: "fixed",
    zIndex: 9999,
    width: "220px",
    animation: `${menuIn} 0.12s cubic-bezier(0.22, 1, 0.36, 1) both`,
    animationDuration: "0.12s",
});

export const menuItem = style({
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
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": { background: vars.color.scree },
        "&:active": { background: vars.color.talus },
    },
});

export const menuItemDanger = style({
    color: vars.color.wine,
    selectors: {
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.wine} 14%, transparent)`,
        },
        "&:active": {
            background: `color-mix(in srgb, ${vars.color.wine} 22%, transparent)`,
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

export const separator = style({
    height: "1px",
    margin: "5px 4px",
    background: vars.color.scree,
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

export const subMenu = style({
    ...sheet,
    display: "none",
    position: "absolute",
    top: "-7px",
    left: "100%",
    marginLeft: "4px",
    width: "200px",
    zIndex: 10000,
});

export const subMenuWrap = style({
    position: "relative",
    width: "100%",
});

globalStyle(`.${subMenuWrap}:hover > .${subMenu}`, {
    display: "block",
});
