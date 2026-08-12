import { keyframes, style, styleVariants } from "@vanilla-extract/css";
import {
    atmosphere,
    hairline,
    lit,
    machined,
    microLabel,
    SHADOW,
} from "./material.css";
import { vars } from "./theme.css";

const EASE_STANDARD = "cubic-bezier(0.4, 0, 0.2, 1)";
const T = `0.18s ${EASE_STANDARD}`;

const fadeUp = keyframes({
    from: { opacity: 0, transform: "translateY(10px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

const fadeIn = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

const spin = keyframes({
    from: { transform: "rotate(0deg)" },
    to: { transform: "rotate(360deg)" },
});

export const page = style({
    ...atmosphere(vars.color.vega),
    minHeight: "100vh",
    color: vars.color.daylight,
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    padding: "48px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "32px",
    animation: `${fadeIn} 0.4s ease`,
    animationDuration: "0.4s",
});

export const header = style({
    width: "100%",
    maxWidth: "640px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    paddingBottom: "20px",
    borderBottom: "1px solid transparent",
    borderImage: `${hairline(vars.color.haze)} 1`,
    animationName: fadeUp,
    animationTimingFunction: EASE_STANDARD,
    animationFillMode: "both",
    animationDuration: "0.45s",
});

export const headerTitle = style({
    display: "flex",
    flexDirection: "column",
    gap: "7px",
});

// Matches the masthead eyebrow on the browser-chrome pages, in this page's
// own accent lane so it still reads as "you are inside a dedicated tool".
export const eyebrow = style({
    ...microLabel,
    display: "flex",
    alignItems: "center",
    gap: "8px",
});

export const eyebrowMark = style({
    width: "16px",
    height: "2px",
    borderRadius: "1px",
    background: vars.color.vega,
    opacity: 0.8,
});

export const title = style({
    margin: 0,
    fontSize: "clamp(24px, 3.4vw, 31px)",
    fontWeight: 600,
    lineHeight: 1.05,
    letterSpacing: "-0.015em",
    color: vars.color.daylight,
    background: `linear-gradient(135deg, ${vars.color.sirius} 0%, ${vars.color.vega} 100%)`,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
});

export const subtitle = style({
    margin: 0,
    fontSize: "14px",
    color: vars.color.moonlight,
    fontWeight: 400,
});

// Sits in the same flex row as the re-scan button, so it takes no standalone
// centring or top margin - those left the message sunk to the bottom-left of
// the card while the button floated at the top-right.
export const noFiltersText = style({
    fontSize: "14px",
    color: vars.color.moonlight,
    fontWeight: 400,
    margin: 0,
    cursor: "default",
});

export const unsupportedNotice = style({
    width: "100%",
    maxWidth: "640px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "12px 16px",
    borderRadius: "10px",
    fontSize: "13px",
    lineHeight: 1.5,
    color: vars.color.sol,
    background: `color-mix(in srgb, ${vars.color.sol} 10%, ${vars.color.night})`,
    border: `1px solid color-mix(in srgb, ${vars.color.sol} 35%, transparent)`,
    animationName: fadeUp,
    animationTimingFunction: EASE_STANDARD,
    animationDelay: "0.08s",
    animationFillMode: "both",
    animationDuration: "0.45s",
});

export const detectedBadges = style({
    width: "100%",
    maxWidth: "640px",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    padding: "13px 16px",
    borderRadius: "10px",
    background: machined(vars.color.horizon, vars.color.night),
    border: `1px solid ${vars.color.haze}`,
    boxShadow: lit(SHADOW.resting),
    animationName: fadeUp,
    animationTimingFunction: EASE_STANDARD,
    animationDelay: "0.05s",
    animationFillMode: "both",
    animationDuration: "0.45s",
});

export const detectedLabel = style({
    fontSize: "12px",
    fontWeight: 500,
    color: vars.color.halo,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    flexShrink: 0,
});

export const badge = style({
    padding: "3px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: 500,
    background: vars.color.horizon,
    color: vars.color.sirius,
    border: `1px solid ${vars.color.haze}`,
    transition: `background ${T}`,
    transitionDuration: "0.18s",
});

export const form = style({
    width: "100%",
    maxWidth: "640px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "24px",
    borderRadius: "14px",
    background: vars.color.night,
    border: `1px solid ${vars.color.horizon}`,
    boxShadow: `0 4px 24px rgba(0,0,0,0.18)`,
    animationName: fadeUp,
    animationTimingFunction: EASE_STANDARD,
    animationDelay: "0.1s",
    animationFillMode: "both",
    animationDuration: "0.45s",
});

export const label = style({
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    fontSize: "13px",
    fontWeight: 500,
    color: vars.color.halo,
    letterSpacing: "0.01em",
});

export const input = style({
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: `1.5px solid ${vars.color.haze}`,
    background: vars.color.dusk,
    color: vars.color.daylight,
    fontSize: "14px",
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    outline: "none",
    transition: `border-color ${T}, box-shadow ${T}, background ${T}`,
    transitionDuration: "0.18s",
    boxSizing: "border-box",
    selectors: {
        "&::placeholder": {
            color: vars.color.ember,
        },
        "&:focus": {
            borderColor: vars.color.vega,
            boxShadow: `0 0 0 3px color-mix(in srgb, ${vars.color.vega} 20%, transparent)`,
            background: vars.color.void,
        },
        "&:hover:not(:focus)": {
            borderColor: vars.color.dust,
        },
    },
});

export const checkBtn = style({
    alignSelf: "flex-end",
    padding: "10px 28px",
    borderRadius: "8px",
    border: "none",
    background: `linear-gradient(135deg, ${vars.color.vega} 0%, ${vars.color.sirius} 100%)`,
    color: vars.color.void,
    fontSize: "14px",
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    fontWeight: 600,
    cursor: "pointer",
    transition: `opacity ${T}, box-shadow ${T}, transform ${T}`,
    transitionDuration: "0.18s",
    letterSpacing: "0.02em",
    selectors: {
        "&:hover:not(:disabled)": {
            opacity: 0.9,
            boxShadow: `0 4px 16px color-mix(in srgb, ${vars.color.vega} 40%, transparent)`,
            transform: "translateY(-1px)",
        },
        "&:active:not(:disabled)": {
            opacity: 0.8,
            transform: "translateY(0)",
        },
        "&:disabled": {
            opacity: 0.5,
            cursor: "not-allowed",
        },
    },
});

export const results = style({
    width: "100%",
    maxWidth: "640px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    animationName: fadeUp,
    animationTimingFunction: EASE_STANDARD,
    animationFillMode: "both",
    animationDuration: "0.4s",
});

const resultCardBase = style({
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "14px 18px",
    borderRadius: "12px",
    border: "1.5px solid",
    transition: `transform ${T}, box-shadow ${T}`,
    transitionDuration: "0.18s",
    animationName: fadeUp,
    animationTimingFunction: EASE_STANDARD,
    animationFillMode: "both",
    animationDuration: "0.35s",
    selectors: {
        "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
        },
    },
});

export const resultCard = styleVariants({
    allowed: [
        resultCardBase,
        {
            background: `color-mix(in srgb, ${vars.color.airglow} 8%, ${vars.color.night})`,
            borderColor: `color-mix(in srgb, ${vars.color.airglow} 30%, transparent)`,
        },
    ],
    blocked: [
        resultCardBase,
        {
            background: `color-mix(in srgb, ${vars.color.antares} 8%, ${vars.color.night})`,
            borderColor: `color-mix(in srgb, ${vars.color.antares} 30%, transparent)`,
        },
    ],
    warned: [
        resultCardBase,
        {
            background: `color-mix(in srgb, ${vars.color.sol} 8%, ${vars.color.night})`,
            borderColor: `color-mix(in srgb, ${vars.color.sol} 30%, transparent)`,
        },
    ],
    unknown: [
        resultCardBase,
        {
            background: `color-mix(in srgb, ${vars.color.ember} 8%, ${vars.color.night})`,
            borderColor: `color-mix(in srgb, ${vars.color.ember} 25%, transparent)`,
        },
    ],
    error: [
        resultCardBase,
        {
            background: `color-mix(in srgb, ${vars.color.arcturus} 8%, ${vars.color.night})`,
            borderColor: `color-mix(in srgb, ${vars.color.arcturus} 30%, transparent)`,
        },
    ],
});

export const resultIcon = style({
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

export const resultIconColor = styleVariants({
    allowed: { color: vars.color.airglow },
    blocked: { color: vars.color.antares },
    warned: { color: vars.color.sol },
    unknown: { color: vars.color.cinder },
    error: { color: vars.color.arcturus },
});

export const resultBody = style({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    minWidth: 0,
});

export const resultName = style({
    fontSize: "14px",
    fontWeight: 600,
    color: vars.color.daylight,
});

export const resultDetail = style({
    fontSize: "12px",
    color: vars.color.moonlight,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const categories = style({
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    marginTop: "4px",
});

export const resultStatus = styleVariants({
    allowed: {
        fontSize: "11px",
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.08em",
        color: vars.color.airglow,
        flexShrink: 0,
    },
    blocked: {
        fontSize: "11px",
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.08em",
        color: vars.color.antares,
        flexShrink: 0,
    },
    warned: {
        fontSize: "11px",
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.08em",
        color: vars.color.sol,
        flexShrink: 0,
    },
    unknown: {
        fontSize: "11px",
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.08em",
        color: vars.color.cinder,
        flexShrink: 0,
    },
    error: {
        fontSize: "11px",
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.08em",
        color: vars.color.arcturus,
        flexShrink: 0,
    },
});

export const spinner = style({
    display: "inline-block",
    animation: `${spin} 0.8s linear infinite`,
    animationDuration: "0.8s",
});

export const rescanBtn = style({
    marginLeft: "auto",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "5px 14px",
    borderRadius: "8px",
    border: `1px solid ${vars.color.haze}`,
    background: vars.color.horizon,
    color: vars.color.daylight,
    fontSize: "12px",
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    fontWeight: 500,
    cursor: "pointer",
    transition: `background ${T}, border-color ${T}, opacity ${T}`,
    transitionDuration: "0.18s",
    selectors: {
        "&:hover:not(:disabled)": {
            background: vars.color.haze,
            borderColor: vars.color.dust,
        },
        "&:disabled": {
            opacity: 0.6,
            cursor: "not-allowed",
        },
    },
});

// Category chip on a result card (Badges/Chips tier in DESIGN.md).
export const catChip = style({
    padding: "2px 8px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: 500,
    background: vars.color.horizon,
    color: vars.color.halo,
    border: `1px solid ${vars.color.haze}`,
});
