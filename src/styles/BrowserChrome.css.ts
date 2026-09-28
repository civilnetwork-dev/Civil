import { globalStyle, keyframes, style } from "@vanilla-extract/css";

import {
    BAND,
    blend,
    edge,
    GRAIN,
    GROUND,
    hitArea,
    KEY_COBALT,
    KEYCAP,
    LIFT,
    LIT,
    PLATE,
    ROW_LIFT,
    SHADE,
    WELL,
    WELL_FOCUS,
} from "./material.css";
import { ANNO, FONT_SANS, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The chrome is a terrace of stone above the page. The tab strip is basalt
 * bedrock; the open tab rises out of it as the top of the terrace, which runs
 * on through the address row and the bookmarks shelf as one scree plane, so
 * the active tab reads as part of the toolbar rather than a pill above it.
 * The terrace ends in a cliff: sediment bands along its bottom edge and a
 * shadow that falls onto the page below. The address field is a well carved
 * into the terrace, and the toolbar buttons are low keycaps standing on it.
 */

const T_FAST = "0.1s ease";
const TAB_H = "36px";

const spinAnim = keyframes({ to: { transform: "rotate(360deg)" } });

// Suggestions drop out of the well and settle a few pixels below it.
const suggInAnim = keyframes({
    from: { opacity: 0, transform: "translateY(-4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

// A new tab rises up out of the bedrock.
const tabEnterAnim = keyframes({
    from: { opacity: 0, transform: "translateY(6px)" },
});

const alpha = (color: string, pct: number) =>
    `color-mix(in srgb, ${color} ${pct}%, transparent)`;

export const browser = style({
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100dvh",
    minHeight: 0,
    background: vars.color.stratum,
    fontFamily: FONT_SANS,
    fontSize: "13px",
    color: vars.color.firn,
    overflow: "hidden",
});

// Above the frames, so the cliff's shadow lands on the page rather than
// under it.
export const browserChrome = style({
    flexShrink: 0,
    backgroundColor: vars.color.basalt,
    backgroundImage: GRAIN,
    position: "relative",
    zIndex: 3,
    boxShadow: edge(4, BAND.light, BAND.dark, SHADE.far),
});

export const browserTabstrip = style({
    display: "flex",
    alignItems: "stretch",
    gap: "6px",
    padding: "8px 12px 0",
    overflow: "visible",
    position: "relative",
});

export const tab = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "7px",
    padding: "0 11px",
    height: TAB_H,
    borderRadius: "10px 10px 0 0",
    minWidth: 0,
    flexShrink: 1,
    overflow: "visible",
    userSelect: "none",
    background: "transparent",
    color: vars.color.ash,
    borderTop: "1px solid transparent",
    borderLeft: "1px solid transparent",
    borderRight: "1px solid transparent",
    cursor: "pointer",
    transitionProperty: "background, color, border-color, box-shadow",
    transitionTimingFunction: "ease",
    animation: `${tabEnterAnim} 0.32s cubic-bezier(0.22, 1, 0.36, 1) backwards`,
    animationDuration: "0.32s",
    transitionDuration: "0.16s",
    selectors: {
        "& + &::before": {
            content: '""',
            position: "absolute",
            left: "-1px",
            top: "7px",
            bottom: "7px",
            width: 0,
            borderLeft: RULE.hair,
        },
        // A resting tab is bedrock; under the pointer it catches the light
        // along its top edge, the first step of rising.
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.scree} 55%, ${vars.color.basalt})`,
            boxShadow: `inset 0 1px 0 ${alpha(vars.color.firn, 7)}`,
            color: vars.color.firn,
        },
    },
});

const TERRACE_TOP = [
    `inset 1px 0 0 ${alpha(vars.color.firn, 5)}`,
    `inset -1px 0 0 ${alpha(vars.color.basalt, 45)}`,
].join(", ");

// The top of the terrace: a lit scree face with a bright lip along the top
// and shaded flanks, flowing without a seam into the address row below.
export const tabActive = style({
    backgroundColor: vars.color.scree,
    backgroundImage: LIT,
    color: vars.color.firn,
    zIndex: 4,
    boxShadow: `inset 0 1px 0 ${alpha(vars.color.firn, 11)}, ${TERRACE_TOP}`,
    selectors: {
        "&:hover": {
            backgroundColor: vars.color.scree,
            backgroundImage: LIT,
            boxShadow: `inset 0 1px 0 ${alpha(vars.color.firn, 15)}, ${TERRACE_TOP}`,
        },
        "&::before": { borderLeft: "none" },
        "& + &::before": { borderLeft: "none" },
    },
});

globalStyle(`.${tab}:focus-visible`, {
    outline: `1px solid ${vars.color.cobalt}`,
    outlineOffset: "-1px",
});

export const tabIconActive = style({
    width: "14px",
    height: "14px",
    color: vars.color.cobalt,
});

export const tabTitleActive = style({
    fontWeight: 600,
});

export const tabCloseActive = style({
    opacity: 1,
});

export const tabDragging = style({
    opacity: 0.4,
});

globalStyle(`.${tab}[data-tab-drop-over="true"]`, {
    background: `color-mix(in srgb, ${vars.color.cobalt} 14%, ${vars.color.basalt})`,
    color: vars.color.firn,
    boxShadow: `inset 2px 0 0 0 ${vars.color.cobalt}`,
});

export const tabFavicon = style({
    width: "14px",
    height: "14px",
    flexShrink: 0,
    objectFit: "contain",
});

export const tabIcon = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "14px",
    height: "14px",
    flexShrink: 0,
    color: vars.color.ash,
    transitionProperty: "color",
    transitionDuration: "0.1s",
    transitionTimingFunction: "ease",
    selectors: {
        [`.${tabActive} &`]: { color: vars.color.cobalt },
    },
});

export const tabTitle = style({
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "12.5px",
    fontWeight: 500,
    letterSpacing: "0.01em",
});

export const tabClose = style({
    position: "relative",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    borderRadius: "6px",
    border: "none",
    background: "transparent",
    color: vars.color.ash,
    cursor: "pointer",
    padding: 0,
    opacity: 0,
    pointerEvents: "none",
    transition: `opacity ${T_FAST}, background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&::after": hitArea(),
        [`.${tab}:hover &, .${tab}:focus-within &, &:focus-visible`]: {
            opacity: 1,
            pointerEvents: "auto",
        },
        "&:hover": {
            color: vars.color.wine,
            background: alpha(vars.color.wine, 14),
        },
        "&:focus-visible": {
            outline: `1px solid ${vars.color.cobalt}`,
            outlineOffset: "1px",
        },
    },
});

export const tabNew = style(
    blend(KEYCAP, {
        borderRadius: "8px",
        flexShrink: 0,
        alignSelf: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "30px",
        height: "30px",
        marginLeft: "4px",
        marginBottom: "3px",
        border: "none",
        color: vars.color.snowmelt,
        cursor: "pointer",
        selectors: {
            "&:hover": { color: vars.color.firn },
            "&:focus-visible": {
                outline: `1px solid ${vars.color.cobalt}`,
                outlineOffset: "1px",
            },
        },
    }),
);

// The tab in hand is a slab lifted clear of the strip.
export const tabDragClone = style({
    display: "flex",
    alignItems: "center",
    gap: "7px",
    padding: "0 11px",
    overflow: "hidden",
    backgroundColor: vars.color.scree,
    backgroundImage: LIT,
    boxShadow: `${SHADE.lip}, ${edge(4, BAND.light, BAND.dark, SHADE.far)}`,
    color: vars.color.firn,
    border: "none",
    borderRadius: "10px",
    pointerEvents: "none",
    cursor: "grabbing",
    willChange: "transform",
    transition: "none",
    fontFamily: FONT_SANS,
    fontSize: "13px",
});

export const spin = style({
    animation: `${spinAnim} 0.75s linear infinite`,
    animationDuration: "0.75s",
    transformOrigin: "center",
});

/* Identification strip                                                  */

export const urlbarRow = style({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "5px 8px 6px",
    backgroundColor: vars.color.scree,
    backgroundImage: GRAIN,
    position: "relative",
    zIndex: 2,
});

export const urlbar = style({
    display: "flex",
    alignItems: "center",
    gap: "2px",
    height: "40px",
    flex: 1,
    minWidth: 0,
});

// A low keycap standing on the terrace. A disabled one (no history to go back
// to) stays seated and dim rather than rising.
const chromeBtn = blend(KEYCAP, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: "9px",
    border: "none",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
    color: vars.color.snowmelt,
    selectors: {
        "&:hover:not(:disabled)": { color: vars.color.firn },
        "&:focus-visible": {
            outline: `1px solid ${vars.color.cobalt}`,
            outlineOffset: "1px",
        },
    },
});

export const extensionsBtn = style(chromeBtn);

export const urlbarNavBtn = style(chromeBtn);

export const urlbarNavBtnDim = style({
    opacity: 0.35,
    cursor: "default",
});

globalStyle(`.${urlbarNavBtn}:disabled`, { opacity: 0.35, cursor: "default" });

export const urlbarOmniboxWrap = style({
    flex: 1,
    minWidth: 0,
    position: "relative",
    margin: "0 6px",
});

export const urlbarOmnibox = style(
    blend(WELL, {
        flex: 1,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: "7px",
        height: "34px",
        borderRadius: "10px",
        padding: "0 10px",
    }),
);

// Stays lit while its suggestions are open, not only while the input has
// focus, so the well and the list read as one open control.
export const urlbarOmniboxFocus = style({ boxShadow: WELL_FOCUS });

export const urlbarLock = style({
    display: "flex",
    alignItems: "center",
    color: vars.color.juniper,
    flexShrink: 0,
});

export const urlbarInput = style({
    flex: 1,
    minWidth: 0,
    border: "none",
    background: "transparent",
    color: vars.color.firn,
    fontSize: "12.5px",
    fontFamily: FONT_SANS,
    outline: "none",
    caretColor: vars.color.cobalt,
    padding: "0 2px",
    selectors: {
        "&::selection": {
            background: `color-mix(in srgb, ${vars.color.cobalt} 28%, transparent)`,
        },
        "&::placeholder": { color: vars.color.ash },
        "&[placeholder]:not(:focus)::placeholder": { opacity: 1 },
        "&:focus-visible": { outline: "none" },
    },
});

export const urlbarGoBtn = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    color: vars.color.ash,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&::after": hitArea(),
        "&:hover": { color: vars.color.cobalt },
        "&:focus-visible": {
            outline: `1px solid ${vars.color.cobalt}`,
            outlineOffset: "1px",
        },
    },
});

export const urlbarSuggestions = style(
    blend(PLATE, {
        position: "absolute",
        boxSizing: "border-box",
        top: "calc(100% + 8px)",
        borderRadius: "14px",
        left: 0,
        right: 0,
        listStyle: "none",
        margin: 0,
        padding: "6px",
        zIndex: 100,
        animation: `${suggInAnim} 0.18s cubic-bezier(0.22, 1, 0.36, 1) both`,
        animationDuration: "0.18s",
    }),
);

export const urlbarSuggestionRow = style(
    blend(ROW_LIFT, {
        padding: "8px 10px",
        fontSize: "12.5px",
        color: vars.color.snowmelt,
        cursor: "pointer",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        selectors: {
            "&:hover, &:focus-within": { color: vars.color.firn },
        },
    }),
);

export const urlbarHistoryRow = style(
    blend(ROW_LIFT, {
        display: "flex",
        alignItems: "center",
        gap: "9px",
        padding: "6px 10px",
        fontSize: "12.5px",
        fontFamily: "inherit",
        cursor: "pointer",
    }),
);

export const urlbarHistoryFavicon = style({
    width: "14px",
    height: "14px",
    objectFit: "contain",
    flexShrink: 0,
    color: vars.color.ash,
});

export const urlbarHistoryInfo = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "1px",
});

export const urlbarHistoryTitle = style({
    color: vars.color.firn,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: "12.5px",
});

export const urlbarHistoryUrl = style({
    ...ANNO,
    color: vars.color.snowmelt,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "block",
});

export const urlbarSuggestionDivider = style({
    height: 0,
    margin: "5px 4px",
    borderTop: RULE.hair,
});

/* Viewport                                                              */

export const browserViewport = style({
    flex: 1,
    minHeight: 0,
    position: "relative",
    background: vars.color.stratum,
});

// Dark so an internal page does not flash white before it paints. A web page
// with no background of its own still gets a white canvas: :root declares
// color-scheme dark (global.css.ts), and the browser paints an opaque canvas
// in any frame whose document scheme differs from the embedder.
export const browserFrame = style({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    border: "none",
    visibility: "hidden",
    pointerEvents: "none",
    background: vars.color.stratum,
});

export const browserFrameActive = style({
    visibility: "visible",
    pointerEvents: "auto",
});

export const browserEmpty = style(
    blend(GROUND, {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "16px",
        color: vars.color.ash,
        fontSize: "14px",
    }),
);

globalStyle(`.${browserEmpty} p`, { margin: 0, color: vars.color.snowmelt });

export const browserEmptyButton = style(
    blend(KEY_COBALT, {
        padding: "10px 18px",
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        fontFamily: FONT_SANS,
        fontSize: "13px",
        transition: LIFT,
    }),
);

globalStyle(`.${tabClose}`, {
    "@media": { "(hover: none)": { opacity: 1, pointerEvents: "auto" } },
});

globalStyle(`.${urlbarNavBtn}`, {
    "@media": { "(max-width: 600px)": { width: "28px", height: "36px" } },
});
