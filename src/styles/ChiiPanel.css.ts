import { style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

const T_FAST = "0.1s ease";

export const panel = style({
    position: "absolute",
    zIndex: 10,
    background: vars.color.night,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
});

export const toolbar = style({
    display: "flex",
    alignItems: "center",
    gap: "3px",
    padding: "3px 6px",
    background: vars.color.void,
    borderBottom: `1px solid ${vars.color.horizon}`,
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
    background: vars.color.horizon,
    color: vars.color.halo,
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            background: vars.color.haze,
            color: vars.color.daylight,
        },
    },
});

export const dockBtnActive = style({
    background: `color-mix(in srgb, ${vars.color.sirius} 20%, transparent)`,
    color: vars.color.sirius,
    selectors: {
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.sirius} 28%, transparent)`,
            color: vars.color.sirius,
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
    background: vars.color.horizon,
    color: vars.color.halo,
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            background: vars.color.haze,
            color: vars.color.daylight,
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
    background: vars.color.horizon,
    color: vars.color.cinder,
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.antares} 18%, transparent)`,
            color: vars.color.antares,
        },
    },
});

export const dividerHoriz = style({
    width: "100%",
    height: "4px",
    flexShrink: 0,
    cursor: "row-resize",
    background: vars.color.haze,
    transition: `background ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            background: vars.color.ember,
        },
    },
});

export const dividerVert = style({
    width: "4px",
    height: "100%",
    flexShrink: 0,
    cursor: "col-resize",
    background: vars.color.haze,
    transition: `background ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            background: vars.color.ember,
        },
    },
});

export const dividerDragging = style({
    background: `${vars.color.sirius} !important`,
});

export const devtoolsFrame = style({
    flex: 1,
    border: "none",
    minHeight: 0,
    minWidth: 0,
    display: "block",
});
