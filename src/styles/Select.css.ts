import { keyframes, style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

const T = "0.12s ease";

const fadeDown = keyframes({
    from: { opacity: 0, transform: "translateY(-4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const root = style({
    position: "relative",
    display: "inline-block",
});

export const trigger = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 10px 6px 12px",
    backgroundColor: vars.color.surface0,
    color: vars.color.text,
    border: `1px solid ${vars.color.surface1}`,
    borderRadius: "8px",
    fontSize: "14px",
    fontFamily: "inherit",
    cursor: "pointer",
    outline: "none",
    transition: `border-color ${T}`,
    whiteSpace: "nowrap",
    selectors: {
        "&:hover": { borderColor: vars.color.overlay1 },
    },
});

export const triggerOpen = style({
    borderColor: vars.color.blue,
    borderRadius: "8px 8px 0 0",
    borderBottomColor: "transparent",
});

export const chevron = style({
    display: "flex",
    alignItems: "center",
    transition: `transform ${T}`,
    color: vars.color.subtext0,
});

export const chevronOpen = style({
    transform: "rotate(180deg)",
});

export const dropdown = style({
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: vars.color.surface0,
    border: `1px solid ${vars.color.blue}`,
    borderTop: "none",
    borderRadius: "0 0 8px 8px",
    overflow: "hidden",
    zIndex: 200,
    animation: `${fadeDown} 0.12s ease both`,
    listStyle: "none",
    margin: 0,
    padding: 0,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
});

export const option = style({
    padding: "7px 12px",
    fontSize: "14px",
    fontFamily: "inherit",
    color: vars.color.subtext0,
    cursor: "pointer",
    transition: `background ${T}, color ${T}`,
    selectors: {
        "&:hover": {
            background: vars.color.surface1,
            color: vars.color.text,
        },
    },
});

export const optionActive = style({
    color: vars.color.text,
    fontWeight: 500,
});
