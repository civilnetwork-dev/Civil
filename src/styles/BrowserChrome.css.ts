import { globalStyle, keyframes, style } from "@vanilla-extract/css";

import { hitArea } from "./material.css";
import { ANNO, FONT_MONO, FONT_SANS, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The drawing border.
 *
 * Every interior page is a sheet; the chrome is the border those sheets are
 * bound into. Tabs are index tabs on a set of drawings — square, hairline
 * ruled, the open one continuous with the plane below it — and the address row
 * is the identification strip that names what is currently on the board.
 *
 * This replaces a floating-pill metaphor: 999px stadium tabs that lifted 5px
 * off the strip at rest and "docked" into a 14px flat-bottomed shape when
 * active, with drop shadows, inset highlights and a glow ring on focus. That
 * was the backlit language the rest of the app dropped, and the chrome is what
 * frames every page, so it was the single loudest contradiction left.
 *
 * What that means concretely, and is worth not undoing:
 *   - no border radius anywhere; corners are square
 *   - no box-shadow used to imply light, depth or elevation
 *   - focus is a 1px sirius outline, never a glow
 *   - separation is a rule, never a gradient or a shadow
 */

const T_FAST = "0.1s ease";
const TAB_H = "30px";

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
    height: "100vh",
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
    gap: 0,
    padding: "6px 8px 0",
    background: vars.color.basalt,
    overflow: "visible",
    position: "relative",
});

/**
 * An index tab. Square, and separated from its neighbour by a single hairline
 * rather than by a gap — a row of detached pills reads as a toolbar, a row of
 * ruled tabs reads as a set of sheets.
 */
export const tab = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "7px",
    padding: "0 11px",
    height: TAB_H,
    minWidth: 0,
    // Past the TAB_MIN floor (roughly twenty tabs) the computed widths stop
    // shrinking, so let flex compress them the rest of the way rather than
    // let the row run off the window and take the new-tab button with it.
    flexShrink: 1,
    overflow: "visible",
    userSelect: "none",
    background: "transparent",
    color: vars.color.ash,
    borderTop: "1px solid transparent",
    borderLeft: "1px solid transparent",
    borderRight: "1px solid transparent",
    cursor: "pointer",
    // width intentionally left out of transitionProperty: resizing many tabs
    // at once must stay an instant layout snap, never an animated reflow.
    transitionProperty: "background, color, border-color",
    transitionTimingFunction: "ease",
    animation: `${tabEnterAnim} 0.16s cubic-bezier(0.22, 1, 0.36, 1) both`,
    animationDuration: "0.16s",
    transitionDuration: "0.1s",
    selectors: {
        // The divider between adjacent inactive tabs. It retracts next to the
        // active tab, whose own border takes over.
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
            background: vars.color.basalt,
            color: vars.color.firn,
        },
    },
});

/**
 * The open sheet. It takes the content plane's own colour and loses its bottom
 * edge, so tab and viewport read as one continuous surface; the accent rule
 * along its top is the only accent in the chrome.
 */
export const tabActive = style({
    background: vars.color.stratum,
    color: vars.color.firn,
    zIndex: 4,
    borderTop: RULE.accent,
    borderLeft: `1px solid ${vars.color.talus}`,
    borderRight: `1px solid ${vars.color.talus}`,
    selectors: {
        // Bridges the 1px seam between the tab and the row below it so the two
        // surfaces meet with no line between them.
        "&::after": {
            content: '""',
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "-1px",
            height: "1px",
            background: vars.color.stratum,
            zIndex: 10,
            pointerEvents: "none",
        },
        // Suppresses the neighbouring divider on both sides.
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
    opacity: 0.35,
});

export const tabDragging = style({
    opacity: 0.4,
});

globalStyle(`.${tab}[data-tab-drop-over="true"]`, {
    background: `color-mix(in srgb, ${vars.color.cobalt} 14%, ${vars.color.basalt})`,
    color: vars.color.firn,
    // A drop target is marked by a solid accent edge on the side the tab will
    // land against, not by a glow.
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
    width: "16px",
    height: "16px",
    border: "none",
    background: "transparent",
    color: vars.color.ash,
    cursor: "pointer",
    padding: 0,
    opacity: 0,
    // A hidden close button that still takes clicks would let a tap near the
    // tab's trailing edge close it instead of selecting it.
    pointerEvents: "none",
    transition: `opacity ${T_FAST}, background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&::after": hitArea(),
        [`.${tab}:hover &, &:focus-visible`]: {
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
    flexShrink: 0,
    alignSelf: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    marginLeft: "6px",
    border: `0.5px solid ${vars.color.scree}`,
    background: "transparent",
    color: vars.color.ash,
    cursor: "pointer",
    transition: `background ${T_FAST}, color ${T_FAST}, border-color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            color: vars.color.cobalt,
            borderColor: vars.color.cobalt,
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
    background: vars.color.basalt,
    color: vars.color.firn,
    border: `1px solid ${vars.color.talus}`,
    // No lift shadow: a dragged tab is distinguished by its accent border and
    // by moving, which is signal enough without simulating a light source.
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

/* -------------------------------------------------------------------- */
/* Identification strip                                                  */
/* -------------------------------------------------------------------- */

export const urlbarRow = style({
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "0 8px",
    background: vars.color.basalt,
    borderBottom: RULE.major,
    position: "relative",
    zIndex: 2,
});

export const urlbar = style({
    display: "flex",
    alignItems: "center",
    gap: "2px",
    height: "42px",
    flex: 1,
    minWidth: 0,
});

const chromeBtn = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
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
    color: vars.color.ash,
    selectors: {
        "&:hover": {
            background: vars.color.scree,
            color: vars.color.cobalt,
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
            background: vars.color.scree,
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
    position: "relative",
    margin: "0 6px",
});

/**
 * The address field, ruled rather than boxed. A single bottom hairline that
 * turns sirius on focus is the same field treatment every page-level input
 * uses, so the chrome and the sheets agree on what an input looks like.
 */
export const urlbarOmnibox = style({
    flex: 1,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: "7px",
    height: "26px",
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${vars.color.talus}`,
    padding: "0 4px 0 2px",
    transition: `border-color ${T_FAST}, background ${T_FAST}`,
    transitionDuration: "0.1s",
});

export const urlbarOmniboxFocus = style({
    borderBottomColor: vars.color.cobalt,
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
    // An address is data, not prose, and the rest of the app sets data in
    // mono. It also makes a lookalike domain easier to read character by
    // character, which on a proxy is not a cosmetic concern.
    fontFamily: FONT_MONO,
    outline: "none",
    caretColor: vars.color.cobalt,
    padding: "0 2px",
    selectors: {
        "&::selection": {
            background: `color-mix(in srgb, ${vars.color.cobalt} 28%, transparent)`,
        },
        "&::placeholder": { color: vars.color.ash },
        "&[placeholder]:not(:focus)::placeholder": { opacity: 1 },
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
    top: "100%",
    left: 0,
    right: 0,
    background: vars.color.basalt,
    border: `1px solid ${vars.color.talus}`,
    borderTop: `1px solid ${vars.color.cobalt}`,
    overflow: "hidden",
    listStyle: "none",
    margin: 0,
    padding: 0,
    zIndex: 100,
    animation: `${suggInAnim} 0.12s cubic-bezier(0.4, 0, 0.2, 1) both`,
    animationDuration: "0.12s",
});

export const urlbarSuggestionRow = style({
    position: "relative",
    padding: "7px 12px",
    fontSize: "12.5px",
    fontFamily: FONT_MONO,
    color: vars.color.snowmelt,
    cursor: "pointer",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        // A plain full-bleed hairline. The gradient-faded inset rule this
        // replaced was trying to make the list read as one soft surface; the
        // schematic language wants the opposite, so cells are ruled apart.
        "& + &::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 0,
            borderTop: RULE.hair,
        },
        "&:hover": {
            background: vars.color.scree,
            color: vars.color.firn,
        },
    },
});

globalStyle(
    `.${urlbarOmniboxWrap}:has(.${urlbarSuggestions}) .${urlbarOmnibox}`,
    { borderBottomColor: vars.color.cobalt },
);

export const urlbarHistoryRow = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "9px",
    padding: "6px 12px",
    fontSize: "12.5px",
    fontFamily: "inherit",
    cursor: "pointer",
    transition: `background ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "& + &::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 0,
            borderTop: RULE.hair,
        },
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

// Separates the history block from the search-suggestion block: the stronger
// of the two breaks, so it is a major rule against the rows' hairlines.
export const urlbarSuggestionDivider = style({
    height: 0,
    margin: 0,
    borderTop: RULE.major,
});

/* -------------------------------------------------------------------- */
/* Viewport                                                              */
/* -------------------------------------------------------------------- */

export const browserViewport = style({
    flex: 1,
    minHeight: 0,
    position: "relative",
    background: vars.color.stratum,
});

export const browserFrame = style({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    border: "none",
    visibility: "hidden",
    pointerEvents: "none",
    background: "#fff",
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

// The one call to action in the chrome. A ruled text button rather than a
// filled pill, matching the text buttons every sheet uses.
globalStyle(`.${browserEmpty} button`, {
    padding: "5px 14px",
    background: "transparent",
    color: vars.color.cobalt,
    border: `0.5px solid ${vars.color.cobalt}`,
    cursor: "pointer",
    fontFamily: FONT_MONO,
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
});

globalStyle(`.${browserEmpty} button:hover`, {
    background: `color-mix(in srgb, ${vars.color.cobalt} 16%, transparent)`,
    color: vars.color.firn,
});
