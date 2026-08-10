import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import { hitArea } from "./material.css";
import { vars } from "./theme.css";

const T_FAST = "0.1s ease";
const TAB_H = "32px";
// Floating pill at rest; the active tab trades this for a flat-bottomed dock shape.
const TAB_R_PILL = "999px";
const TAB_R_DOCK = "14px 14px 0 0";

const spinAnim = keyframes({ to: { transform: "rotate(360deg)" } });

const suggInAnim = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

// Opacity only: the resting/docked position lives on the plain `transform`
// property below so it can also transition smoothly on every later
// activate/deactivate, independent of this one-time mount animation.
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
    background: vars.color.base,
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    fontSize: "13px",
    color: vars.color.text,
    overflow: "hidden",
});

export const browserChrome = style({
    flexShrink: 0,
    background: vars.color.crust,
    position: "relative",
});

export const browserTabstrip = style({
    display: "flex",
    alignItems: "flex-end",
    gap: "6px",
    padding: "8px 8px 0",
    background: vars.color.crust,
    overflow: "visible",
    position: "relative",
    selectors: {
        "&::after": {
            content: '""',
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "1px",
            background: vars.color.crust,
            zIndex: 3,
            pointerEvents: "none",
        },
    },
});

export const tab = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "0 10px",
    height: TAB_H,
    minWidth: 0,
    // Past the TAB_MIN floor (roughly twenty tabs) the computed widths stop
    // shrinking, so let flex compress them the rest of the way rather than
    // let the row run off the window and take the new-tab button with it.
    flexShrink: 1,
    overflow: "visible",
    userSelect: "none",
    // Detached floating pill at rest: a distinct object sitting one tone
    // above the Crust strip it floats on (see Recede-to-Advance).
    background: vars.color.mantle,
    color: vars.color.overlay0,
    borderRadius: TAB_R_PILL,
    // Floats above the strip's bottom seam; docking (below) resets this to 0.
    // transform, not margin, so the lift/dock motion never triggers layout.
    transform: "translateY(-5px)",
    cursor: "pointer",
    // width intentionally left out of transitionProperty: resizing many tabs
    // at once must stay an instant layout snap, never an animated reflow.
    transitionProperty: "background, color, border-radius, transform",
    transitionTimingFunction: "ease",
    animation: `${tabEnterAnim} 0.16s cubic-bezier(0.22, 1, 0.36, 1) both`,
    animationDuration: "0.16s",
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            background: vars.color.surface0,
            color: vars.color.subtext1,
            zIndex: 4,
        },
    },
});

export const tabActive = style({
    background: vars.color.base,
    color: vars.color.text,
    zIndex: 4,
    // Docks flush with the content plane below: flat bottom corners, no lift.
    borderRadius: TAB_R_DOCK,
    transform: "translateY(0)",
    boxShadow: [
        `inset 0 1px 0 0 color-mix(in srgb, ${vars.color.surface1} 35%, transparent)`,
        `0 -1px 0 0 ${vars.color.surface0}`,
        `-1px 0 0 0 ${vars.color.surface0}`,
        `1px 0 0 0 ${vars.color.surface0}`,
    ].join(", "),
    selectors: {
        "&::before": {
            content: '""',
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "-2px",
            height: "3px",
            background: vars.color.base,
            zIndex: 10,
            pointerEvents: "none",
        },
    },
});

globalStyle(`.${tab}:focus-visible`, {
    outline: "none",
    boxShadow: `0 0 0 2px ${vars.color.base}, 0 0 0 4px color-mix(in srgb, ${vars.color.lavender} 55%, transparent)`,
});

export const tabIconActive = style({
    width: "14px",
    height: "14px",
    color: vars.color.lavender,
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
    background: `color-mix(in srgb, ${vars.color.lavender} 14%, ${vars.color.mantle})`,
    color: vars.color.text,
    boxShadow: [
        // top edge
        `inset 0 1.5px 0 0 color-mix(in srgb, ${vars.color.lavender} 65%, transparent)`,
        // left edge
        `inset 1.5px 0 0 0 color-mix(in srgb, ${vars.color.lavender} 65%, transparent)`,
        // right edge
        `inset -1.5px 0 0 0 color-mix(in srgb, ${vars.color.lavender} 65%, transparent)`,
    ].join(", "),
});

export const tabFavicon = style({
    width: "14px",
    height: "14px",
    flexShrink: 0,
    borderRadius: "3px",
    objectFit: "contain",
});

export const tabIcon = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "14px",
    height: "14px",
    flexShrink: 0,
    color: vars.color.overlay0,
    transitionProperty: "color",
    transitionDuration: "0.1s",
    transitionTimingFunction: "ease",
    selectors: {
        [`.${tabActive} &`]: { color: vars.color.lavender },
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
    width: "18px",
    height: "18px",
    border: "none",
    background: "transparent",
    color: vars.color.overlay0,
    borderRadius: "50%",
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
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.red} 22%, transparent)`,
            color: vars.color.red,
        },
    },
});

export const tabNew = style({
    flexShrink: 0,
    alignSelf: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "26px",
    height: "26px",
    marginLeft: "4px",
    border: "none",
    background: "transparent",
    color: vars.color.overlay0,
    borderRadius: "50%",
    cursor: "pointer",
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            background: vars.color.surface0,
            color: vars.color.lavender,
        },
    },
});

export const tabDragClone = style({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "0 10px",
    overflow: "hidden",
    background: vars.color.mantle,
    color: vars.color.text,
    // A dragged tab is the pill fully detached from the strip: full stadium
    // radius on every corner, not the docked flat-bottom shape.
    borderRadius: TAB_R_PILL,
    boxShadow: `0 0 0 1px ${vars.color.surface1}, 0 8px 24px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.3)`,
    pointerEvents: "none",
    cursor: "grabbing",
    willChange: "transform",
    transition: "none",
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    fontSize: "13px",
});

export const spin = style({
    animation: `${spinAnim} 0.75s linear infinite`,
    animationDuration: "0.75s",
    transformOrigin: "center",
});

export const urlbarRow = style({
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "0 8px",
    background: vars.color.crust,
    borderTop: `1px solid ${vars.color.surface0}`,
    borderBottom: `1px solid ${vars.color.surface0}`,
    position: "relative",
    zIndex: 2,
});

export const urlbar = style({
    display: "flex",
    alignItems: "center",
    gap: "2px",
    height: "44px",
    flex: 1,
    minWidth: 0,
});

export const extensionsBtn = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "30px",
    height: "30px",
    border: "none",
    background: "transparent",
    color: vars.color.overlay1,
    borderRadius: "50%",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            background: vars.color.surface0,
            color: vars.color.lavender,
        },
    },
});

export const urlbarNavBtn = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "30px",
    height: "30px",
    border: "none",
    background: "transparent",
    color: vars.color.subtext0,
    borderRadius: "50%",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover:not(:disabled)": {
            background: vars.color.surface0,
            color: vars.color.text,
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

export const urlbarOmnibox = style({
    flex: 1,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    height: "28px",
    background: vars.color.surface0,
    border: "1.5px solid transparent",
    borderRadius: "14px",
    padding: "0 8px 0 10px",
    transition: `border-color ${T_FAST}, background ${T_FAST}, box-shadow ${T_FAST}`,
    transitionDuration: "0.1s",
});

export const urlbarOmniboxFocus = style({
    borderColor: vars.color.lavender,
    background: vars.color.mantle,
    boxShadow: `0 0 0 3px color-mix(in srgb, ${vars.color.lavender} 18%, transparent)`,
});

export const urlbarLock = style({
    display: "flex",
    alignItems: "center",
    color: vars.color.green,
    flexShrink: 0,
    opacity: 0.85,
});

export const urlbarInput = style({
    flex: 1,
    minWidth: 0,
    border: "none",
    background: "transparent",
    color: vars.color.text,
    fontSize: "12.5px",
    fontFamily: "inherit",
    outline: "none",
    caretColor: vars.color.lavender,
    // With no padding the text box starts exactly at the content edge, so a
    // glyph with any left side bearing - the "g" in github.com, for one - gets
    // its first pixel column clipped by the field, and the 14px corner radius
    // crowds it further. Two pixels is enough to clear both and is invisible
    // as indentation.
    padding: "0 2px",
    selectors: {
        "&::selection": {
            background: `color-mix(in srgb, ${vars.color.lavender} 28%, transparent)`,
        },
        "&::placeholder": { color: vars.color.overlay0 },
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
    color: vars.color.overlay1,
    borderRadius: "50%",
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&::after": hitArea(),
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.lavender} 15%, transparent)`,
            color: vars.color.lavender,
        },
    },
});

export const urlbarSuggestions = style({
    position: "absolute",
    boxSizing: "border-box",
    top: "calc(100% - 1.5px)",
    left: 0,
    right: 0,
    background: vars.color.mantle,
    border: `1.5px solid ${vars.color.lavender}`,
    borderTop: "none",
    borderRadius: "0 0 14px 14px",
    overflow: "hidden",
    listStyle: "none",
    margin: 0,
    padding: 0,
    zIndex: 100,
    boxShadow: `3px 0 0 0 color-mix(in srgb, ${vars.color.lavender} 18%, transparent), -3px 0 0 0 color-mix(in srgb, ${vars.color.lavender} 18%, transparent), 0 3px 0 0 color-mix(in srgb, ${vars.color.lavender} 18%, transparent)`,
    animation: `${suggInAnim} 0.12s cubic-bezier(0.4, 0, 0.2, 1) both`,
    animationDuration: "0.12s",
});

export const urlbarSuggestionRow = style({
    position: "relative",
    padding: "7px 12px",
    fontSize: "12.5px",
    fontFamily: "inherit",
    color: vars.color.subtext0,
    cursor: "pointer",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        // Inset divider that fades at both ends, matching the New Tab
        // search menu: the list is one surface, not stacked cells.
        "& + &::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: "12px",
            right: "12px",
            height: "1px",
            background: `linear-gradient(90deg, transparent, ${vars.color.surface0} 15%, ${vars.color.surface0} 85%, transparent)`,
        },
        "&:hover": { background: vars.color.surface0, color: vars.color.text },
    },
});

globalStyle(
    `.${urlbarOmniboxWrap}:has(.${urlbarSuggestions}) .${urlbarOmnibox}`,
    {
        borderRadius: "14px 14px 0 0",
        borderBottomColor: "transparent",
        boxShadow: `3px 0 0 0 color-mix(in srgb, ${vars.color.lavender} 18%, transparent), -3px 0 0 0 color-mix(in srgb, ${vars.color.lavender} 18%, transparent), 0 -3px 0 0 color-mix(in srgb, ${vars.color.lavender} 18%, transparent)`,
    },
);

export const urlbarHistoryRow = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 12px",
    fontSize: "12.5px",
    fontFamily: "inherit",
    cursor: "pointer",
    transition: `background ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        // Same inset, fading divider the search rows below use - the two
        // halves of this one menu were drawing different rules.
        "& + &::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: "12px",
            right: "12px",
            height: "1px",
            background: `linear-gradient(90deg, transparent, ${vars.color.surface0} 15%, ${vars.color.surface0} 85%, transparent)`,
        },
        "&:hover": { background: vars.color.surface0 },
    },
});

export const urlbarHistoryFavicon = style({
    width: "14px",
    height: "14px",
    borderRadius: "3px",
    objectFit: "contain",
    flexShrink: 0,
    color: vars.color.overlay1,
});

export const urlbarHistoryInfo = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "1px",
});

export const urlbarHistoryTitle = style({
    color: vars.color.text,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: "12.5px",
});

export const urlbarHistoryUrl = style({
    color: vars.color.subtext0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: "11px",
});

// Separates the history block from the search-suggestion block. Inset and
// fading like the row dividers, just one tone brighter so it reads as the
// stronger break of the two.
export const urlbarSuggestionDivider = style({
    height: "1px",
    margin: "3px 12px",
    background: `linear-gradient(90deg, transparent, ${vars.color.surface1} 12%, ${vars.color.surface1} 88%, transparent)`,
});

export const browserViewport = style({
    flex: 1,
    minHeight: 0,
    position: "relative",
    background: vars.color.base,
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
    gap: "14px",
    color: vars.color.overlay0,
    fontSize: "14px",
});

export const browserEmptyIcon = style({
    color: vars.color.surface2,
    opacity: 0.5,
});

globalStyle(`.${browserEmpty} p`, { margin: 0, color: vars.color.subtext0 });

globalStyle(`.${browserEmpty} button`, {
    padding: "8px 20px",
    background: vars.color.lavender,
    color: vars.color.crust,
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "13px",
    fontWeight: 600,
    transition: `opacity ${T_FAST}, box-shadow ${T_FAST}`,
    transitionDuration: "0.1s",
});

globalStyle(`.${browserEmpty} button:hover`, {
    opacity: 0.88,
    boxShadow: `0 2px 12px color-mix(in srgb, ${vars.color.lavender} 35%, transparent)`,
});
