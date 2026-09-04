import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import { FONT_SANS } from "./schematic.css";
import { vars } from "./theme.css";

const T_FAST = "0.1s ease";

const menuIn = keyframes({
    from: { opacity: 0, transform: "scale(0.96) translateY(-4px)" },
    to: { opacity: 1, transform: "scale(1) translateY(0)" },
});

export const iframeCover = style({
    position: "fixed",
    inset: 0,
    zIndex: 9998,
    background: "transparent",
    pointerEvents: "all",
});

export const menu = style({
    position: "fixed",
    zIndex: 9999,
    width: "220px",
    background: vars.color.basalt,
    border: `1px solid ${vars.color.scree}`,
    borderRadius: "10px",
    overflow: "hidden",
    boxShadow: `0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.18)`,
    fontFamily: FONT_SANS,
    fontSize: "13px",
    color: vars.color.firn,
    userSelect: "none",
    animation: `${menuIn} 0.12s cubic-bezier(0.22, 1, 0.36, 1) both`,
    animationDuration: "0.12s",
    transformOrigin: "top left",
    padding: 0,
});

export const menuItem = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    boxSizing: "border-box",
    padding: "8px 16px",
    borderRadius: 0,
    border: "none",
    background: "transparent",
    color: vars.color.firn,
    cursor: "pointer",
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            background: vars.color.scree,
            color: vars.color.firn,
        },
        "&:active": {
            background: vars.color.talus,
        },
    },
});

export const menuItemDanger = style({
    color: vars.color.wine,
    selectors: {
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.wine} 14%, transparent)`,
            color: vars.color.wine,
        },
        "&:active": {
            background: `color-mix(in srgb, ${vars.color.wine} 22%, transparent)`,
        },
    },
});

export const menuItemIcon = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "16px",
    height: "16px",
    flexShrink: 0,
    color: "inherit",
});

export const menuItemLabel = style({
    fontSize: "13px",
    color: "inherit",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
});

export const menuItemShortcut = style({
    fontSize: "11px",
    color: vars.color.ash,
    marginLeft: "auto",
    paddingLeft: "16px",
    flexShrink: 0,
});

export const separator = style({
    width: "100%",
    height: "1px",
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
    display: "none",
    position: "absolute",
    top: "-1px",
    left: "100%",
    marginLeft: "4px",
    width: "200px",
    background: vars.color.basalt,
    border: `1px solid ${vars.color.scree}`,
    borderRadius: "10px",
    overflow: "hidden",
    padding: 0,
    boxShadow: `0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.18)`,
    zIndex: 10000,
});

export const subMenuWrap = style({
    position: "relative",
    width: "100%",
});

globalStyle(`.${subMenuWrap}:hover > .${subMenu}`, {
    display: "block",
});
