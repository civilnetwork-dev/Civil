import { keyframes, style } from "@vanilla-extract/css";

import {
    blend,
    edge,
    KEYCAP_FACE,
    LIT,
    PLATE,
    ROW_LIFT,
    SHADE,
    WELL,
} from "./material.css";
import { ANNO, FONT_MONO, FONT_SANS } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The tab switcher: a slab that rises over a dimmed page, with its search
 * carved into the top of it. Each tab is a row on the slab that lifts under
 * the pointer; the keyboard hints in the footer are real little keycaps.
 * Addresses stay in the annotation tier.
 */

const T_SPRING = "0.2s cubic-bezier(0.22, 1, 0.36, 1)";
const T_POOF = "0.22s cubic-bezier(0.55, 0, 1, 0.45)";

const backdropIn = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

const backdropOut = keyframes({
    from: { opacity: 1 },
    to: { opacity: 0 },
});

// The slab rises into place from just below where it settles.
const panelIn = keyframes({
    from: { opacity: 0, transform: "translateY(10px)" },
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
    background: `color-mix(in srgb, ${vars.color.basalt} 78%, transparent)`,
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

export const panel = style(
    blend(PLATE, {
        width: "min(580px, 92vw)",
        borderRadius: "16px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        animation: `${panelIn} ${T_SPRING} both`,
        animationDuration: "0.2s",
    }),
);

export const panelLeaving = style({
    animation: `${panelOut} ${T_POOF} forwards`,
    animationDuration: "0.22s",
});

export const inputRow = style(
    blend(WELL, {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        margin: "10px 10px 6px",
        padding: "12px 14px",
        borderRadius: "12px",
    }),
);

export const searchIcon = style({
    color: vars.color.cobalt,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
});

export const input = style({
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: vars.color.firn,
    fontSize: "15px",
    fontFamily: FONT_SANS,
    fontWeight: 400,
    caretColor: vars.color.cobalt,
    selectors: {
        // The panel is the focused control; a second ring inside its header
        // row reads as a box within a box.
        "&:focus-visible": { outline: "none" },
        "&::placeholder": { color: vars.color.ash },
        "&::selection": {
            background: `color-mix(in srgb, ${vars.color.cobalt} 28%, transparent)`,
        },
    },
});

export const hint = style({
    fontSize: "12px",
    color: vars.color.ash,
    flexShrink: 0,
    fontFamily: FONT_SANS,
    letterSpacing: "0.02em",
});

export const results = style({
    overflowY: "auto",
    maxHeight: "360px",
    padding: "4px 8px 10px",
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

export const resultItem = style(
    blend(ROW_LIFT, {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "9px 10px",
        cursor: "pointer",
    }),
);

const COBALT_ROW = `color-mix(in oklab, ${vars.color.cobalt} 22%, ${vars.color.scree})`;

// The keyboard's row is lifted and tinted cobalt, so the selection reads as a
// raised chip whether or not the pointer is anywhere near it.
export const resultItemActive = style({
    backgroundColor: COBALT_ROW,
    backgroundImage: LIT,
    boxShadow: `${SHADE.lip}, ${edge(2)}`,
    selectors: {
        "&:hover": {
            backgroundColor: COBALT_ROW,
            backgroundImage: LIT,
        },
    },
});

export const resultItemCurrent = style({
    background: `color-mix(in srgb, ${vars.color.basalt} 35%, transparent)`,
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
    color: vars.color.ash,
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
    color: vars.color.firn,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: FONT_SANS,
});

export const resultUrl = style({
    ...ANNO,
    color: vars.color.snowmelt,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const matchMark = style({
    color: vars.color.cobalt,
    fontWeight: 700,
    background: `color-mix(in srgb, ${vars.color.cobalt} 14%, transparent)`,
    padding: "0 1px",
});

export const tabBadge = style({
    ...ANNO,
    padding: "1px 7px",
    flexShrink: 0,
    border: `0.5px solid color-mix(in srgb, ${vars.color.cobalt} 45%, transparent)`,
    borderRadius: "999px",
    color: vars.color.cobalt,
    boxShadow: SHADE.lip,
});

export const emptyState = style({
    padding: "28px 16px",
    textAlign: "center",
    color: vars.color.ash,
    fontSize: "13px",
    fontFamily: FONT_SANS,
});

export const footer = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "16px",
    padding: "10px 16px 12px",
    borderTop: `1px solid color-mix(in srgb, ${vars.color.basalt} 55%, transparent)`,
    boxShadow: `inset 0 1px 0 color-mix(in srgb, ${vars.color.firn} 5%, transparent)`,
});

export const footerKey = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    color: vars.color.ash,
    fontFamily: FONT_SANS,
});

// Not pressable, but drawn as the key it names: a keycap one band high.
export const kbd = style(
    blend(KEYCAP_FACE, {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "5px",
        padding: "0 6px 1px",
        fontSize: "12px",
        fontFamily: FONT_MONO,
        color: vars.color.firn,
        lineHeight: 1.6,
    }),
);
