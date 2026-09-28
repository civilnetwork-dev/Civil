import { keyframes, style } from "@vanilla-extract/css";

import { BAND, blend, edge, KEYCAP, LIT, SHADE } from "./material.css";
import { FONT_MONO } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * Extension buttons in the identification strip: keycaps like every other
 * control on the terrace.
 *
 * The popup renders an extension's own HTML on a white ground, which no
 * palette tone should paint over, so its stone is underneath: it floats on
 * the same sediment edge as every menu.
 */

const popupIn = keyframes({
    from: { opacity: 0, transform: "translateY(-4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const bar = style({
    display: "flex",
    alignItems: "center",
    gap: "1px",
    flexShrink: 0,
});

export const extBtn = style(
    blend(KEYCAP, {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "30px",
        height: "30px",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        padding: "2px",
        flexShrink: 0,
        selectors: {
            "&:focus-visible": {
                outline: `1px solid ${vars.color.cobalt}`,
                outlineOffset: "1px",
            },
        },
    }),
);

export const extIcon = style({
    width: "18px",
    height: "18px",
    objectFit: "contain",
    display: "block",
});

export const extIconFallback = style({
    width: "18px",
    height: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.color.snowmelt,
    backgroundColor: vars.color.talus,
    backgroundImage: LIT,
    boxShadow: SHADE.lip,
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
    fontFamily: FONT_MONO,
    userSelect: "none",
});

export const popup = style({
    position: "fixed",
    zIndex: 99999,
    background: "#fff",
    border: `1px solid ${vars.color.talus}`,
    borderRadius: "12px",
    boxShadow: edge(6, BAND.light, BAND.dark, SHADE.far),
    overflow: "hidden",

    animation: `${popupIn} 0.12s cubic-bezier(0.22,1,0.36,1) both`,
    animationDuration: "0.12s",
});

export const popupFrame = style({
    display: "block",
    border: "none",
    width: "100%",
    height: "100%",
    background: "#fff",
});
