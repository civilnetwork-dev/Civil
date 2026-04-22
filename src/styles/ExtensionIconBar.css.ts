import { keyframes, style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

const T_FAST = "0.1s ease";

const popupIn = keyframes({
    from: { opacity: 0, transform: "scale(0.96) translateY(-4px)" },
    to: { opacity: 1, transform: "scale(1) translateY(0)" },
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
    borderRadius: "7px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "2px",
    flexShrink: 0,
    position: "relative",
    transition: `background ${T_FAST}`,
    selectors: {
        "&:hover": {
            background: vars.color.surface0,
        },
    },
});

export const extIcon = style({
    width: "18px",
    height: "18px",
    borderRadius: "3px",
    objectFit: "contain",
    display: "block",
});

export const extIconFallback = style({
    width: "18px",
    height: "18px",
    borderRadius: "3px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.color.overlay1,
    background: vars.color.surface0,
    fontSize: "10px",
    fontWeight: 600,
    fontFamily: "monospace",
    userSelect: "none",
});

export const popup = style({
    position: "fixed",
    zIndex: 99999,
    background: "#fff",
    border: `1px solid ${vars.color.surface1}`,
    borderRadius: "10px",
    boxShadow: `0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.14)`,
    overflow: "hidden",
    animation: `${popupIn} 0.12s cubic-bezier(0.22,1,0.36,1) both`,
});

export const popupFrame = style({
    display: "block",
    border: "none",
    width: "100%",
    height: "100%",
    background: "#fff",
});
