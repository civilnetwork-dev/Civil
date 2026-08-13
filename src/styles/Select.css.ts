import { keyframes, style } from "@vanilla-extract/css";
import { ANNO, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The last shared control still built from the superseded material language:
 * 8px corners and `SHADOW.attached` under the menu. Square and ruled now, to
 * match the fields and menus in the chrome and on every sheet.
 */

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
    padding: "5px 8px 5px 10px",
    ...ANNO,
    backgroundColor: "transparent",
    // After the spread, not before: ANNO carries its own `color` and would
    // otherwise overwrite this one.
    color: vars.color.daylight,
    border: `0.5px solid ${vars.color.horizon}`,
    textTransform: "uppercase",
    cursor: "pointer",
    outline: "none",
    transition: `border-color ${T}`,
    transitionDuration: "0.12s",
    whiteSpace: "nowrap",
    selectors: {
        "&:hover": { borderColor: vars.color.cinder },
        "&:focus-visible": {
            outline: `1px solid ${vars.color.sirius}`,
            outlineOffset: "-1px",
        },
    },
});

// Lavender, not Blue: the system only ever uses Blue as a subtle focus tint,
// never as a bold outline (see the note on AppsPage's addBtn).
export const triggerOpen = style({
    borderColor: vars.color.sirius,
    borderBottomColor: "transparent",
    selectors: {
        // `trigger`'s own :hover rule sets borderColor and would otherwise
        // repaint the bottom edge, drawing a line across the join.
        "&:hover": {
            borderColor: vars.color.sirius,
            borderBottomColor: "transparent",
        },
    },
});

export const chevron = style({
    display: "flex",
    alignItems: "center",
    transition: `transform ${T}`,
    transitionDuration: "0.12s",
    color: vars.color.moonlight,
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
    backgroundColor: vars.color.night,
    border: `1px solid ${vars.color.sirius}`,
    borderTop: "none",
    overflow: "hidden",
    zIndex: 200,
    animation: `${fadeDown} 0.12s ease both`,
    animationDuration: "0.12s",
    listStyle: "none",
    margin: 0,
    padding: 0,
});

export const option = style({
    padding: "7px 10px",
    ...ANNO,
    color: vars.color.moonlight,
    cursor: "pointer",
    transition: `background ${T}, color ${T}`,
    transitionDuration: "0.12s",
    selectors: {
        "& + &": { borderTop: RULE.hair },
        "&:hover": {
            background: vars.color.horizon,
            color: vars.color.daylight,
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
    color: vars.color.daylight,
    fontWeight: 500,
});
