import { keyframes, style } from "@vanilla-extract/css";
import { FONT_MONO } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * Extension buttons in the identification strip. Square, like every other
 * control in the chrome.
 *
 * The popup keeps its border but loses the 32px drop shadow: it renders an
 * extension's own HTML on a white ground, so it is already unmistakably a
 * separate surface without simulating elevation underneath it.
 */

const T_FAST = "0.1s ease";

const popupIn = keyframes({
    from: { opacity: 0, transform: "translateY(-4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const bar = style({
    display: "flex",
    alignItems: "center",
    gap: "1px",
    flexShrink: 0,
});

export const extBtn = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "2px",
    flexShrink: 0,
    position: "relative",
    transition: `background ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            background: vars.color.scree,
        },
        "&:focus-visible": {
            outline: `1px solid ${vars.color.cobalt}`,
            outlineOffset: "-1px",
        },
    },
});

export const extIcon = style({
    width: "18px",
    height: "18px",
    objectFit: "contain",
    display: "block",
});

export const extIconFallback = style({
    width: "18px",
    height: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.color.ash,
    background: vars.color.scree,
    fontSize: "11px",
    fontWeight: 600,
    fontFamily: FONT_MONO,
    userSelect: "none",
});

export const popup = style({
    position: "fixed",
    zIndex: 99999,
    background: "#fff",
    border: `1px solid ${vars.color.talus}`,
    overflow: "hidden",
    animation: `${popupIn} 0.12s cubic-bezier(0.22,1,0.36,1) both`,
    animationDuration: "0.12s",
});

export const popupFrame = style({
    display: "block",
    border: "none",
    width: "100%",
    height: "100%",
    background: "#fff",
});
