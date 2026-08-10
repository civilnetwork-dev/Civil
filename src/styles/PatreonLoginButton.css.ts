import { style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

export const PATREON = "#FF424D";
export const T = "0.12s ease";

// Tinted-accent recipe (same shape as the system's Status Triad): a solid
// brand-red block would clash against the muted Macchiato palette everywhere
// else, so Patreon's red is toned into a background tint + accent text/icon
// instead of a full-saturation fill.
export const button = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    padding: "7px 14px",
    borderRadius: "8px",
    border: `1px solid color-mix(in srgb, ${PATREON} 35%, transparent)`,
    background: `color-mix(in srgb, ${PATREON} 12%, ${vars.color.surface0})`,
    color: `color-mix(in srgb, ${PATREON} 75%, ${vars.color.text})`,
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1,
    cursor: "pointer",
    userSelect: "none",
    transition: `background ${T}, border-color ${T}, box-shadow ${T}`,
    transitionDuration: "0.12s",
    selectors: {
        "&:hover": {
            background: `color-mix(in srgb, ${PATREON} 20%, ${vars.color.surface0})`,
            borderColor: `color-mix(in srgb, ${PATREON} 55%, transparent)`,
            boxShadow: `0 0 0 3px color-mix(in srgb, ${PATREON} 18%, transparent)`,
        },
        "&:active": {
            opacity: 0.85,
        },
        "&:disabled": {
            opacity: 0.45,
            cursor: "not-allowed",
            boxShadow: "none",
        },
    },
});

export const loggedIn = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "5px 10px",
    borderRadius: "8px",
    border: `1px solid ${vars.color.surface1}`,
    background: vars.color.surface0,
    color: vars.color.text,
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    fontSize: "13px",
    userSelect: "none",
    transition: `border-color ${T}`,
    transitionDuration: "0.12s",
    selectors: {
        "&:hover": {
            borderColor: vars.color.surface2,
        },
    },
});

export const avatar = style({
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
});

export const avatarFallback = style({
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: PATREON,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "10px",
    fontWeight: 700,
    flexShrink: 0,
});

export const userName = style({
    color: vars.color.subtext1,
    maxWidth: "140px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const divider = style({
    width: "1px",
    height: "14px",
    background: vars.color.surface2,
    flexShrink: 0,
});

export const signOutBtn = style({
    padding: "2px 6px",
    borderRadius: "4px",
    border: "none",
    background: "transparent",
    color: vars.color.overlay1,
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    fontSize: "11px",
    cursor: "pointer",
    transition: `color ${T}, background ${T}`,
    transitionDuration: "0.12s",
    selectors: {
        "&:hover": {
            background: vars.color.surface1,
            color: vars.color.text,
        },
        "&:active": {
            opacity: 0.7,
        },
    },
});
