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
    background: `color-mix(in srgb, ${vars.color.dusk} 55%, transparent)`,
    backdropFilter: "blur(12px) saturate(1.4)",
    WebkitBackdropFilter: "blur(12px) saturate(1.4)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: "15vh",
    animation: `${backdropIn} 0.18s ease both`,
    animationDuration: "0.18s",
});

export const backdropLeaving = style({
    animation: `${backdropOut} ${T_POOF} forwards`,
    animationDuration: "0.22s",
});

export const panel = style({
    width: "min(580px, 92vw)",
    background: vars.color.night,
    border: `1px solid ${vars.color.haze}`,
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: `
        0 0 0 1px ${vars.color.horizon},
        0 24px 64px rgba(0,0,0,0.55),
        0 8px 24px rgba(0,0,0,0.35)
    `,
    display: "flex",
    flexDirection: "column",
    animation: `${panelIn} ${T_SPRING} both`,
    animationDuration: "0.28s",
});

export const panelLeaving = style({
    animation: `${panelOut} ${T_POOF} forwards`,
    animationDuration: "0.22s",
});

export const inputRow = style({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px 16px",
    borderBottom: `1px solid ${vars.color.horizon}`,
});

export const searchIcon = style({
    color: vars.color.sirius,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
});

export const input = style({
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: vars.color.daylight,
    fontSize: "15px",
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    fontWeight: 400,
    caretColor: vars.color.sirius,
    selectors: {
        "&::placeholder": { color: vars.color.ember },
        "&::selection": {
            background: `color-mix(in srgb, ${vars.color.sirius} 28%, transparent)`,
        },
    },
});

export const hint = style({
    fontSize: "11px",
    color: vars.color.ember,
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
    // The list rarely ends on a row boundary, so the overflow used to slice a
    // row cleanly in half against the footer - and with the scrollbar hidden
    // there was nothing to read as "this scrolls" either. Fading the last few
    // pixels turns that cut into an intentional edge and hints at more below.
    maskImage:
        "linear-gradient(to bottom, #000 calc(100% - 24px), transparent 100%)",
    WebkitMaskImage:
        "linear-gradient(to bottom, #000 calc(100% - 24px), transparent 100%)",
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
    transitionDuration: "0.18s",
    selectors: {
        "&:hover": { background: vars.color.horizon },
    },
});

export const resultItemActive = style({
    background: `color-mix(in srgb, ${vars.color.sirius} 14%, transparent)`,
    selectors: {
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.sirius} 18%, transparent)`,
        },
    },
});

export const resultItemCurrent = style({
    background: `color-mix(in srgb, ${vars.color.horizon} 60%, transparent)`,
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
    color: vars.color.cinder,
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
    color: vars.color.daylight,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
});

export const resultUrl = style({
    fontSize: "11.5px",
    color: vars.color.moonlight,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
});

export const matchMark = style({
    color: vars.color.sirius,
    fontWeight: 700,
    background: `color-mix(in srgb, ${vars.color.sirius} 14%, transparent)`,
    borderRadius: "2px",
    padding: "0 1px",
});

export const tabBadge = style({
    fontSize: "10px",
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: "20px",
    flexShrink: 0,
    background: `color-mix(in srgb, ${vars.color.sirius} 15%, transparent)`,
    color: vars.color.sirius,
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    letterSpacing: "0.04em",
});

export const emptyState = style({
    padding: "28px 16px",
    textAlign: "center",
    color: vars.color.cinder,
    fontSize: "13px",
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
});

export const footer = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "16px",
    padding: "8px 16px",
    borderTop: `1px solid ${vars.color.horizon}`,
});

export const footerKey = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    color: vars.color.cinder,
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
});

export const kbd = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: vars.color.horizon,
    border: `1px solid ${vars.color.haze}`,
    borderRadius: "4px",
    padding: "1px 5px",
    fontSize: "10px",
    fontFamily: '"Rubik", monospace, ui-monospace',
    color: vars.color.halo,
    lineHeight: 1.6,
});
