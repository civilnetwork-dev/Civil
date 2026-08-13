import { keyframes, style } from "@vanilla-extract/css";
import { ANNO, FONT_MONO, FONT_SANS, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The overlay sheet.
 *
 * Same drawing language as everything behind it: square corners, hairline
 * rules between rows, mono for addresses. What it drops is the depth kit — a
 * 16px radius, a 64px drop shadow and a spring scale-in that together read as
 * a card floating above the app. A sheet laid over the board is separated by
 * its border and by the dimmed ground, not by simulated elevation.
 */

const T_SPRING = "0.2s cubic-bezier(0.22, 1, 0.36, 1)";
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

// Opacity and a short translate only. The spring scale this replaced made the
// panel read as a physical object springing forward, which is the elevation
// metaphor the rest of the system dropped.
const panelIn = keyframes({
    from: { opacity: 0, transform: "translateY(-6px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

const panelOut = keyframes({
    from: { opacity: 1, transform: "translateY(0)" },
    to: { opacity: 0, transform: "translateY(4px)" },
});

export const backdrop = style({
    position: "fixed",
    inset: 0,
    zIndex: 10000,
    // A plain dim, not a blurred one. DESIGN.md forbids `backdrop-filter` and
    // names the reason: the target hardware is low-end school Chromebooks,
    // where compositing a blurred backdrop every frame is among the most
    // expensive things a page can do. A darker scrim separates the panel from
    // the page just as clearly and costs nothing.
    background: `color-mix(in srgb, ${vars.color.void} 78%, transparent)`,
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
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    animation: `${panelIn} ${T_SPRING} both`,
    animationDuration: "0.2s",
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
    borderBottom: RULE.hair,
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
    fontFamily: FONT_SANS,
    fontWeight: 400,
    caretColor: vars.color.sirius,
    selectors: {
        "&::placeholder": { color: vars.color.cinder },
        "&::selection": {
            background: `color-mix(in srgb, ${vars.color.sirius} 28%, transparent)`,
        },
    },
});

export const hint = style({
    fontSize: "11px",
    color: vars.color.ember,
    flexShrink: 0,
    fontFamily: FONT_SANS,
    letterSpacing: "0.02em",
});

export const results = style({
    overflowY: "auto",
    maxHeight: "360px",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 0,
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
    padding: "9px 10px",
    cursor: "pointer",
    transition: `background ${T_EASE}`,
    transitionDuration: "0.18s",
    selectors: {
        "& + &": { borderTop: RULE.hair },
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
    objectFit: "contain",
    flexShrink: 0,
});

export const faviconFallback = style({
    width: "16px",
    height: "16px",
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
    fontFamily: FONT_SANS,
});

export const resultUrl = style({
    ...ANNO,
    color: vars.color.starlight,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const matchMark = style({
    color: vars.color.sirius,
    fontWeight: 700,
    background: `color-mix(in srgb, ${vars.color.sirius} 14%, transparent)`,
    padding: "0 1px",
});

export const tabBadge = style({
    ...ANNO,
    fontSize: "11px",
    padding: "1px 6px",
    flexShrink: 0,
    border: `0.5px solid color-mix(in srgb, ${vars.color.sirius} 45%, transparent)`,
    color: vars.color.sirius,
    textTransform: "uppercase",
});

export const emptyState = style({
    padding: "28px 16px",
    textAlign: "center",
    color: vars.color.cinder,
    fontSize: "13px",
    fontFamily: FONT_SANS,
});

export const footer = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "16px",
    padding: "8px 16px",
    borderTop: RULE.hair,
});

export const footerKey = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    color: vars.color.cinder,
    fontFamily: FONT_SANS,
});

export const kbd = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: `0.5px solid ${vars.color.haze}`,
    padding: "1px 5px",
    fontSize: "11px",
    fontFamily: FONT_MONO,
    color: vars.color.halo,
    lineHeight: 1.6,
});
