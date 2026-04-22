import { style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

const T_FAST = "0.1s ease";

export const panel = style({
    position: "absolute",
    zIndex: 10,
    background: vars.color.mantle,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
});

export const toolbar = style({
    display: "flex",
    alignItems: "center",
    gap: "3px",
    padding: "3px 6px",
    background: vars.color.crust,
    borderBottom: `1px solid ${vars.color.surface0}`,
    flexShrink: 0,
    minHeight: "28px",
});

export const toolbarSpacer = style({
    flex: 1,
});

export const dockBtn = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "22px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    background: vars.color.surface0,
    color: vars.color.subtext1,
    transition: `background ${T_FAST}, color ${T_FAST}`,
    selectors: {
        "&:hover": {
            background: vars.color.surface1,
            color: vars.color.text,
        },
    },
});

export const dockBtnActive = style({
    background: `color-mix(in srgb, ${vars.color.lavender} 20%, transparent)`,
    color: vars.color.lavender,
    selectors: {
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.lavender} 28%, transparent)`,
            color: vars.color.lavender,
        },
    },
});

export const detachBtn = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "22px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    background: vars.color.surface0,
    color: vars.color.subtext1,
    transition: `background ${T_FAST}, color ${T_FAST}`,
    selectors: {
        "&:hover": {
            background: vars.color.surface1,
            color: vars.color.text,
        },
    },
});

export const closeBtn = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "22px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    background: vars.color.surface0,
    color: vars.color.overlay1,
    transition: `background ${T_FAST}, color ${T_FAST}`,
    selectors: {
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.red} 18%, transparent)`,
            color: vars.color.red,
        },
    },
});

export const dividerHoriz = style({
    width: "100%",
    height: "4px",
    flexShrink: 0,
    cursor: "row-resize",
    background: vars.color.surface1,
    transition: `background ${T_FAST}`,
    selectors: {
        "&:hover": {
            background: vars.color.overlay0,
        },
    },
});

export const dividerVert = style({
    width: "4px",
    height: "100%",
    flexShrink: 0,
    cursor: "col-resize",
    background: vars.color.surface1,
    transition: `background ${T_FAST}`,
    selectors: {
        "&:hover": {
            background: vars.color.overlay0,
        },
    },
});

export const dividerDragging = style({
    background: `${vars.color.lavender} !important`,
});

export const devtoolsFrame = style({
    flex: 1,
    border: "none",
    minHeight: 0,
    minWidth: 0,
    display: "block",
});
