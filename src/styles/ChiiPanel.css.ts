import { style } from "@vanilla-extract/css";

import { blend, GRAIN, KEYCAP, LIT } from "./material.css";
import { vars } from "./theme.css";

const T_FAST = "0.1s ease";

const alpha = (color: string, pct: number) =>
    `color-mix(in srgb, ${color} ${pct}%, transparent)`;

/**
 * The docked devtools: basalt bedrock with a scree toolbar ledge along its
 * edge, keycaps for the dock controls, and resize grips carved as grooves.
 */
export const panel = style({
    position: "absolute",
    zIndex: 10,
    backgroundColor: vars.color.basalt,
    backgroundImage: GRAIN,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
});

export const toolbar = style({
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 6px",
    backgroundColor: vars.color.scree,
    backgroundImage: LIT,
    boxShadow: `inset 0 1px 0 ${alpha(vars.color.firn, 8)}, 0 1px 0 ${alpha(vars.color.basalt, 80)}`,
    flexShrink: 0,
    minHeight: "30px",
});

export const toolbarSpacer = style({
    flex: 1,
});

const dockKey = blend(KEYCAP, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "26px",
    height: "22px",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    color: vars.color.firn,
});

export const dockBtn = style(dockKey);

const DOCK_ON = `color-mix(in oklab, ${vars.color.cobalt} 26%, ${vars.color.scree})`;

export const dockBtnActive = style({
    backgroundColor: DOCK_ON,
    backgroundImage: LIT,
    color: vars.color.cobalt,
    selectors: {
        "&:hover:not(:disabled)": {
            backgroundColor: DOCK_ON,
            backgroundImage: LIT,
            color: vars.color.cobalt,
        },
    },
});

export const detachBtn = style(dockKey);

export const closeBtn = style(
    blend(dockKey, {
        color: vars.color.ash,
        selectors: {
            "&:hover:not(:disabled)": { color: vars.color.wine },
        },
    }),
);

// Resize grips are grooves: a shadowed line beside a lit one, brightening to
// talus under the pointer.
const grip = {
    flexShrink: 0,
    backgroundColor: vars.color.scree,
    transition: `background-color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": { backgroundColor: vars.color.talus },
    },
} as const;

export const dividerHoriz = style({
    ...grip,
    width: "100%",
    height: "5px",
    cursor: "row-resize",
    boxShadow: `inset 0 1px 0 ${alpha(vars.color.firn, 8)}, inset 0 -1px 0 ${alpha(vars.color.basalt, 70)}`,
});

export const dividerVert = style({
    ...grip,
    width: "5px",
    height: "100%",
    cursor: "col-resize",
    boxShadow: `inset 1px 0 0 ${alpha(vars.color.firn, 8)}, inset -1px 0 0 ${alpha(vars.color.basalt, 70)}`,
});

export const dividerDragging = style({
    background: `${vars.color.cobalt} !important`,
});

export const devtoolsFrame = style({
    flex: 1,
    border: "none",
    minHeight: 0,
    minWidth: 0,
    display: "block",
});
