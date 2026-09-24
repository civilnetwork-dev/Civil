import { globalStyle, keyframes, style } from "@vanilla-extract/css";

import { hitArea } from "./material.css";
import { ANNO, FONT_SANS, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The chrome is one continuous toolbar surface: the open tab, the address row
 * and the bookmarks shelf share the scree plane, so the active tab reads as
 * part of the toolbar rather than a pill floating above it. The tab strip
 * behind them is basalt, and the address field is basalt again - a dark well
 * cut into the toolbar, the way every mainstream browser draws it.
 */

const T_FAST = "0.1s ease";
const TAB_H = "36px";

const spinAnim = keyframes({ to: { transform: "rotate(360deg)" } });

const suggInAnim = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

const tabEnterAnim = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

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

export const browserChrome = style({
    flexShrink: 0,
    background: vars.color.basalt,
    position: "relative",
});

export const browserTabstrip = style({
    display: "flex",
    alignItems: "stretch",
    gap: "6px",
    padding: "8px 12px 0",
    background: vars.color.basalt,
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
    transitionProperty: "background, color, border-color",
    transitionTimingFunction: "ease",
    animation: `${tabEnterAnim} 0.16s cubic-bezier(0.22, 1, 0.36, 1) both`,
    animationDuration: "0.16s",
    transitionDuration: "0.1s",
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
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.scree} 55%, ${vars.color.basalt})`,
            color: vars.color.firn,
        },
    },
});

export const tabActive = style({
    background: vars.color.scree,
    color: vars.color.firn,
    zIndex: 4,
    borderTop: `1px solid ${vars.color.talus}`,
    borderLeft: `1px solid ${vars.color.talus}`,
    borderRight: `1px solid ${vars.color.talus}`,
    selectors: {
        "&:hover": { background: vars.color.scree },
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
        "&:hover": { color: vars.color.wine },
        "&:focus-visible": {
            outline: `1px solid ${vars.color.cobalt}`,
            outlineOffset: "1px",
        },
    },
});

export const tabNew = style({
    borderRadius: "8px",
    flexShrink: 0,
    alignSelf: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    marginLeft: "2px",
    border: "none",
    background: "transparent",
    color: vars.color.ash,
    cursor: "pointer",
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            background: vars.color.scree,
            color: vars.color.firn,
        },
        "&:focus-visible": {
            outline: `1px solid ${vars.color.cobalt}`,
            outlineOffset: "1px",
        },
    },
});

export const tabDragClone = style({
    display: "flex",
    alignItems: "center",
    gap: "7px",
    padding: "0 11px",
    overflow: "hidden",
    background: vars.color.scree,
    color: vars.color.firn,
    border: `1px solid ${vars.color.talus}`,
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
    gap: "4px",
    padding: "4px 8px",
    background: vars.color.scree,
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

const chromeBtn = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "34px",
    height: "34px",
    borderRadius: "8px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
} as const;

export const extensionsBtn = style({
    ...chromeBtn,
    color: vars.color.snowmelt,
    selectors: {
        "&:hover": {
            background: vars.color.talus,
            color: vars.color.firn,
        },
        "&:focus-visible": {
            outline: `1px solid ${vars.color.cobalt}`,
            outlineOffset: "-1px",
        },
    },
});

export const urlbarNavBtn = style({
    ...chromeBtn,
    color: vars.color.snowmelt,
    selectors: {
        "&:hover:not(:disabled)": {
            background: vars.color.talus,
            color: vars.color.firn,
        },
        "&:focus-visible": {
            outline: `1px solid ${vars.color.cobalt}`,
            outlineOffset: "-1px",
        },
    },
});

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

export const urlbarOmnibox = style({
    flex: 1,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: "7px",
    height: "34px",
    background: vars.color.basalt,
    border: "1px solid transparent",
    borderRadius: "10px",
    padding: "0 10px",
    transition: `border-color ${T_FAST}, background ${T_FAST}`,
    transitionDuration: "0.1s",
});

export const urlbarOmniboxFocus = style({
    borderColor: vars.color.cobalt,
});

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

export const urlbarSuggestions = style({
    position: "absolute",
    boxSizing: "border-box",
    top: "calc(100% + 6px)",
    borderRadius: "12px",
    left: 0,
    right: 0,
    background: vars.color.basalt,
    border: `1px solid ${vars.color.talus}`,
    overflow: "hidden",
    listStyle: "none",
    margin: 0,
    padding: "6px",
    zIndex: 100,
    animation: `${suggInAnim} 0.12s cubic-bezier(0.4, 0, 0.2, 1) both`,
    animationDuration: "0.12s",
});

export const urlbarSuggestionRow = style({
    position: "relative",
    padding: "8px 10px",
    borderRadius: "8px",
    fontSize: "12.5px",
    color: vars.color.snowmelt,
    cursor: "pointer",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            background: vars.color.scree,
            color: vars.color.firn,
        },
    },
});

export const urlbarHistoryRow = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "9px",
    padding: "6px 10px",
    borderRadius: "8px",
    fontSize: "12.5px",
    fontFamily: "inherit",
    cursor: "pointer",
    transition: `background ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": { background: vars.color.scree },
    },
});

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

export const browserEmpty = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: "16px",
    color: vars.color.ash,
    fontSize: "14px",
});

export const browserEmptyIcon = style({
    color: vars.color.talus,
});

globalStyle(`.${browserEmpty} p`, { margin: 0, color: vars.color.snowmelt });

globalStyle(`.${browserEmpty} button`, {
    padding: "9px 18px",
    background: vars.color.cobalt,
    color: vars.color.basalt,
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontFamily: FONT_SANS,
    fontSize: "13px",
    fontWeight: 600,
    transition: `background ${T_FAST}`,
    transitionDuration: "0.1s",
});

globalStyle(`.${browserEmpty} button:hover`, {
    background: `color-mix(in srgb, ${vars.color.cobalt} 85%, ${vars.color.firn})`,
});

globalStyle(`.${tabClose}`, {
    "@media": { "(hover: none)": { opacity: 1, pointerEvents: "auto" } },
});

globalStyle(`.${urlbarNavBtn}`, {
    "@media": { "(max-width: 600px)": { width: "28px", height: "36px" } },
});
