import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

const T = "0.1s ease";
const T_MID = "0.18s cubic-bezier(0.4, 0, 0.2, 1)";

const blurBackground = `color-mix(in srgb, ${vars.color.surface0} 65%, transparent)`;
const blurBorder = `color-mix(in srgb, ${vars.color.surface1} 55%, transparent)`;
const blurFilter = "blur(20px) saturate(1.5)";

export const sbHost = style({
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    pointerEvents: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

export const sbRoot = style({
    pointerEvents: "all",
    position: "relative",
    fontFamily: '"Rubik", sans-serif',
    width: "min(640px, 90vw)",
});

const dropdownIn = keyframes({
    from: { opacity: 0, transform: "translateY(-4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const sbDropdown = style({
    position: "absolute",
    top: "100%",
    left: 0,
    width: "100%",
    zIndex: 10000,
    background: vars.color.surface0,
    border: `1px solid ${vars.color.surface1}`,
    borderTop: "none",
    borderRadius: "0 0 12px 12px",
    overflow: "hidden",
    listStyle: "none",
    margin: 0,
    padding: 0,
    boxSizing: "border-box",
    animation: `${dropdownIn} 0.18s ${T_MID} both`,
});

export const sbDropdownBlur = style({
    background: blurBackground,
    backdropFilter: blurFilter,
    borderColor: blurBorder,
});

export const sbRow = style({
    cursor: "pointer",
    padding: "10px 16px",
    color: vars.color.subtext0,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "14px",
    fontWeight: 400,
    transition: `background ${T}, color ${T}`,
    selectors: {
        "& + &": { borderTop: `1px solid ${vars.color.surface1}` },
        "&:hover": { background: vars.color.surface1, color: vars.color.text },
    },
});

export const sbInputWrapper = style({
    display: "flex",
    alignItems: "stretch",
    height: "48px",
    background: vars.color.surface0,
    border: `1px solid ${vars.color.surface1}`,
    borderRadius: "12px",
    overflow: "hidden",
    transition: `border-color ${T_MID}, border-radius ${T_MID}, background ${T_MID}`,
});

globalStyle(`.${sbRoot}:has(.${sbDropdown}) .${sbInputWrapper}`, {
    borderRadius: "12px 12px 0 0",
    borderBottomColor: "transparent",
});
export const sbInputWrapperBlur = style({
    background: blurBackground,
    backdropFilter: blurFilter,
    borderColor: blurBorder,
});

export const sbInput = style({
    flex: 1,
    minWidth: 0,
    border: "none",
    background: "transparent",
    color: vars.color.text,
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    fontSize: "15px",
    fontWeight: 400,
    padding: "0 16px",
    outline: "none",
    caretColor: vars.color.lavender,
    selectors: {
        "&::placeholder": { color: vars.color.overlay0 },
        "&::selection": {
            background: `color-mix(in srgb, ${vars.color.lavender} 28%, transparent)`,
        },
    },
});

export const sbHostInline = style({
    display: "flex",
    justifyContent: "center",
    width: "100%",
    pointerEvents: "all",
});

export const sbButton = style({
    flexShrink: 0,
    border: "none",
    borderLeft: `1px solid ${vars.color.surface1}`,
    background: "transparent",
    color: vars.color.overlay1,
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    fontSize: "13px",
    fontWeight: 500,
    letterSpacing: "0.02em",
    padding: "0 20px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: `background ${T}, color ${T}, border-color ${T}`,
    selectors: {
        "&:hover": {
            background: vars.color.surface1,
            color: vars.color.lavender,
        },
        "&:active": {
            background: `color-mix(in srgb, ${vars.color.surface1} 70%, ${vars.color.lavender} 30%)`,
            color: vars.color.lavender,
        },
    },
});
