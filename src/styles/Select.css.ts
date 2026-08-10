import { keyframes, style } from "@vanilla-extract/css";
import { SHADOW } from "./material.css";
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
    transitionDuration: "0.12s",
    whiteSpace: "nowrap",
    selectors: {
        "&:hover": { borderColor: vars.color.overlay1 },
    },
});

// Lavender, not Blue: the system only ever uses Blue as a subtle focus tint,
// never as a bold outline (see the note on AppsPage's addBtn).
export const triggerOpen = style({
    borderColor: vars.color.lavender,
    borderRadius: "8px 8px 0 0",
    borderBottomColor: "transparent",
    selectors: {
        // `trigger`'s own :hover rule sets borderColor and would otherwise
        // repaint the bottom edge, drawing a line across the join.
        "&:hover": {
            borderColor: vars.color.lavender,
            borderBottomColor: "transparent",
        },
    },
});

export const chevron = style({
    display: "flex",
    alignItems: "center",
    transition: `transform ${T}`,
    transitionDuration: "0.12s",
    color: vars.color.subtext0,
});

export const chevronOpen = style({
    transform: "rotate(180deg)",
});

export const dropdown = style({
    position: "absolute",
    // Sits over the trigger's (transparent) bottom border instead of below
    // it, so the two read as one continuous surface with no hairline seam.
    top: "calc(100% - 1px)",
    left: 0,
    right: 0,
    backgroundColor: vars.color.surface0,
    border: `1px solid ${vars.color.lavender}`,
    borderTop: "none",
    borderRadius: "0 0 8px 8px",
    overflow: "hidden",
    zIndex: 200,
    animation: `${fadeDown} 0.12s ease both`,
    animationDuration: "0.12s",
    listStyle: "none",
    margin: 0,
    padding: 0,
    // A 0.15-alpha shadow is invisible against a dark surface; a menu needs
    // to read as floating above the page, so this goes deeper and softer.
    boxShadow: SHADOW.attached,
});

export const option = style({
    padding: "7px 12px",
    fontSize: "14px",
    fontFamily: "inherit",
    color: vars.color.subtext0,
    cursor: "pointer",
    transition: `background ${T}, color ${T}`,
    transitionDuration: "0.12s",
    selectors: {
        "&:hover": {
            background: vars.color.surface1,
            color: vars.color.text,
        },
        // These options are keyboard-focusable and sit flush against the
        // menu's edges, which are clipped by `overflow: hidden`. The global
        // focus ring draws 2px outside an element, so on the first and last
        // option it would be cut off. Draw it inside instead.
        "&:focus-visible": {
            outlineOffset: "-2px",
        },
    },
});

export const optionActive = style({
    color: vars.color.text,
    fontWeight: 500,
});
