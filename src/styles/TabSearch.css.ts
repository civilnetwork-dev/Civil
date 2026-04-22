import { keyframes, style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

const T_SPRING = "0.28s cubic-bezier(0.34, 1.56, 0.64, 1)";
const T_EASE = "0.18s cubic-bezier(0.4, 0, 0.2, 1)";
const T_POOF = "0.22s cubic-bezier(0.55, 0, 1, 0.45)";

const backdropIn = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

const backdropOut = keyframes({
    from: { opacity: 1 },
    to: { opacity: 0 },
});

const panelIn = keyframes({
    from: { opacity: 0, transform: "scale(0.92) translateY(-10px)" },
    to: { opacity: 1, transform: "scale(1) translateY(0)" },
});

const panelOut = keyframes({
    from: { opacity: 1, transform: "scale(1) translateY(0)" },
    to: { opacity: 0, transform: "scale(0.88) translateY(6px)" },
});

export const backdrop = style({
    position: "fixed",
    inset: 0,
    zIndex: 10000,
    background: `color-mix(in srgb, ${vars.color.base} 55%, transparent)`,
    backdropFilter: "blur(12px) saturate(1.4)",
    WebkitBackdropFilter: "blur(12px) saturate(1.4)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: "15vh",
    animation: `${backdropIn} 0.18s ease both`,
});

export const backdropLeaving = style({
    animation: `${backdropOut} ${T_POOF} forwards`,
});

export const panel = style({
    width: "min(580px, 92vw)",
    background: vars.color.mantle,
    border: `1px solid ${vars.color.surface1}`,
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: `
        0 0 0 1px ${vars.color.surface0},
        0 24px 64px rgba(0,0,0,0.55),
        0 8px 24px rgba(0,0,0,0.35)
    `,
    display: "flex",
    flexDirection: "column",
    animation: `${panelIn} ${T_SPRING} both`,
});

export const panelLeaving = style({
    animation: `${panelOut} ${T_POOF} forwards`,
});

export const inputRow = style({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px 16px",
    borderBottom: `1px solid ${vars.color.surface0}`,
});

export const searchIcon = style({
    color: vars.color.lavender,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
});

export const input = style({
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: vars.color.text,
    fontSize: "15px",
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    fontWeight: 400,
    caretColor: vars.color.lavender,
    selectors: {
        "&::placeholder": { color: vars.color.overlay0 },
        "&::selection": {
            background: `color-mix(in srgb, ${vars.color.lavender} 28%, transparent)`,
        },
    },
});

export const hint = style({
    fontSize: "11px",
    color: vars.color.overlay0,
    flexShrink: 0,
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    letterSpacing: "0.02em",
});

export const results = style({
    overflowY: "auto",
    maxHeight: "360px",
    padding: "6px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    selectors: {
        "&:empty": { display: "none" },
        "&::-webkit-scrollbar": { display: "none" },
    },
});

export const resultItem = style({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 10px",
    borderRadius: "10px",
    cursor: "pointer",
    transition: `background ${T_EASE}`,
    selectors: {
        "&:hover": { background: vars.color.surface0 },
    },
});

export const resultItemActive = style({
    background: `color-mix(in srgb, ${vars.color.lavender} 14%, transparent)`,
    selectors: {
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.lavender} 18%, transparent)`,
        },
    },
});

export const resultItemCurrent = style({
    background: `color-mix(in srgb, ${vars.color.surface0} 60%, transparent)`,
});

export const favicon = style({
    width: "16px",
    height: "16px",
    borderRadius: "3px",
    objectFit: "contain",
    flexShrink: 0,
});

export const faviconFallback = style({
    width: "16px",
    height: "16px",
    borderRadius: "3px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: vars.color.overlay1,
});

export const resultText = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "1px",
});

export const resultTitle = style({
    fontSize: "13px",
    fontWeight: 500,
    color: vars.color.text,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
});

export const resultUrl = style({
    fontSize: "11.5px",
    color: vars.color.subtext0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
});

export const matchMark = style({
    color: vars.color.lavender,
    fontWeight: 700,
    background: `color-mix(in srgb, ${vars.color.lavender} 14%, transparent)`,
    borderRadius: "2px",
    padding: "0 1px",
});

export const tabBadge = style({
    fontSize: "10px",
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: "20px",
    flexShrink: 0,
    background: `color-mix(in srgb, ${vars.color.lavender} 15%, transparent)`,
    color: vars.color.lavender,
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    letterSpacing: "0.04em",
});

export const emptyState = style({
    padding: "28px 16px",
    textAlign: "center",
    color: vars.color.overlay1,
    fontSize: "13px",
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
});

export const footer = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "16px",
    padding: "8px 16px",
    borderTop: `1px solid ${vars.color.surface0}`,
});

export const footerKey = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    color: vars.color.overlay1,
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
});

export const kbd = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: vars.color.surface0,
    border: `1px solid ${vars.color.surface1}`,
    borderRadius: "4px",
    padding: "1px 5px",
    fontSize: "10px",
    fontFamily: '"Rubik", monospace, ui-monospace',
    color: vars.color.subtext1,
    lineHeight: 1.6,
});
