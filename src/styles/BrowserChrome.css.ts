import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

const T_FAST = "0.1s ease";
const T_MID = "0.18s cubic-bezier(0.4, 0, 0.2, 1)";
const TAB_H = "34px";
const TAB_R = "10px";

const spinAnim = keyframes({ to: { transform: "rotate(360deg)" } });

export const suggInAnim = keyframes({
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
    padding: "6px 8px 0",
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
    padding: "0 8px 0 10px",
    height: TAB_H,
    minWidth: 0,
    flexShrink: 0,
    overflow: "visible",
    userSelect: "none",
    background: vars.color.crust,
    color: vars.color.overlay0,
    borderRadius: `${TAB_R} ${TAB_R} 0 0`,
    cursor: "pointer",
    transition: `background ${T_FAST}, color ${T_FAST}, width ${T_MID}`,
    selectors: {
        "& + &::after": {
            content: '""',
            position: "absolute",
            left: "-1px",
            top: "20%",
            height: "60%",
            width: "1px",
            background: vars.color.surface1,
            pointerEvents: "none",
        },
        "&:hover": {
            background: vars.color.mantle,
            color: vars.color.subtext1,
            zIndex: 4,
        },
        "&:hover::before": {
            content: '""',
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "-2px",
            height: "3px",
            background: vars.color.mantle,
            zIndex: 10,
            pointerEvents: "none",
        },
    },
});

export const tabActive = style({
    background: vars.color.base,
    color: vars.color.text,
    zIndex: 4,
    boxShadow: `0 -1px 0 0 ${vars.color.surface0}, -1px 0 0 0 ${vars.color.surface0}, 1px 0 0 0 ${vars.color.surface0}`,
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

globalStyle(`.${tabActive} + .${tab}::after, .${tab} + .${tabActive}::after`, {
    display: "none",
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
    borderRadius: "2px",
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
    transition: `opacity ${T_FAST}, background ${T_FAST}, color ${T_FAST}`,
    selectors: {
        [`.${tab}:hover &`]: { opacity: 1 },
        [`.${tabActive} &`]: { opacity: 1 },
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
    padding: "0 8px 0 10px",
    overflow: "hidden",
    background: vars.color.mantle,
    color: vars.color.text,
    borderRadius: `${TAB_R} ${TAB_R} 0 0`,
    boxShadow: `0 -1px 0 0 ${vars.color.surface1}, -1px 0 0 0 ${vars.color.surface1}, 1px 0 0 0 ${vars.color.surface1}, 0 8px 24px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.3)`,
    pointerEvents: "none",
    cursor: "grabbing",
    willChange: "transform",
    transition: "none",
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    fontSize: "13px",
});

export const spin = style({
    animation: `${spinAnim} 0.75s linear infinite`,
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
    display: "flex",
    alignItems: "center",
    gap: "6px",
    height: "28px",
    background: vars.color.surface0,
    border: "1.5px solid transparent",
    borderRadius: "14px",
    padding: "0 8px 0 10px",
    transition: `border-color ${T_FAST}, background ${T_FAST}, box-shadow ${T_FAST}`,
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
    selectors: {
        "&::selection": {
            background: `color-mix(in srgb, ${vars.color.lavender} 28%, transparent)`,
        },
        "&::placeholder": { color: vars.color.overlay0 },
        "&[placeholder]:not(:focus)::placeholder": { opacity: 1 },
    },
});

export const urlbarGoBtn = style({
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
    selectors: {
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.lavender} 15%, transparent)`,
            color: vars.color.lavender,
        },
    },
});

export const urlbarSuggestions = style({
    position: "absolute",
    top: "100%",
    left: "-1.5px",
    right: "-1.5px",
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
});

export const urlbarSuggestionRow = style({
    padding: "7px 12px",
    fontSize: "12.5px",
    fontFamily: "inherit",
    color: vars.color.subtext0,
    cursor: "pointer",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    transition: `background ${T_FAST}, color ${T_FAST}`,
    selectors: {
        "& + &": { borderTop: `1px solid ${vars.color.surface0}` },
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
    display: "none",
    background: "#fff",
});

export const browserFrameActive = style({ display: "block" });

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
});

globalStyle(`.${browserEmpty} button:hover`, {
    opacity: 0.88,
    boxShadow: `0 2px 12px color-mix(in srgb, ${vars.color.lavender} 35%, transparent)`,
});
