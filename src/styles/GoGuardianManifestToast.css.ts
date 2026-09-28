import { keyframes, style } from "@vanilla-extract/css";

import {
    blend,
    KEY_COBALT,
    KEY_STONE,
    KEYCAP,
    PLATE,
    WELL,
} from "./material.css";
import { FONT_SANS } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The vendor toasts (GoGuardian manifest, iboss gateway): a slab that rises
 * into the corner, with its fields carved into it and stone keys to answer.
 */

const groove = {
    content: '""',
    flex: 1,
    height: 0,
    borderTop: `1px solid color-mix(in srgb, ${vars.color.basalt} 60%, transparent)`,
    boxShadow: `0 1px 0 color-mix(in srgb, ${vars.color.firn} 6%, transparent)`,
} as const;

const slideUp = keyframes({
    from: { opacity: 0, transform: "translateY(24px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const toast = style(
    blend(PLATE, {
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9999,
        width: "360px",
        maxWidth: "calc(100vw - 48px)",
        borderRadius: "16px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        animation: `${slideUp} 0.36s cubic-bezier(0.22, 1, 0.36, 1) both`,
        animationDuration: "0.36s",
        fontFamily: FONT_SANS,
    }),
);

export const header = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "8px",
});

export const titleGroup = style({
    display: "flex",
    flexDirection: "column",
    gap: "2px",
});

export const title = style({
    margin: 0,
    fontSize: "14px",
    fontWeight: 600,
    color: vars.color.cobalt,
});

export const districtName = style({
    fontSize: "12px",
    color: vars.color.snowmelt,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "260px",
});

export const dismissBtn = style(
    blend(KEYCAP, {
        display: "grid",
        placeItems: "center",
        border: "none",
        cursor: "pointer",
        color: vars.color.ash,
        padding: "4px",
        borderRadius: "7px",
        fontSize: "16px",
        lineHeight: 1,
        flexShrink: 0,
        selectors: {
            "&:hover": { color: vars.color.firn },
        },
    }),
);

export const description = style({
    fontSize: "12px",
    color: vars.color.snowmelt,
    lineHeight: 1.5,
    margin: 0,
});

export const dropZone = style(
    blend(WELL, {
        border: `1.5px dashed ${vars.color.talus}`,
        borderRadius: "10px",
        padding: "12px",
        textAlign: "center",
        fontSize: "12px",
        color: vars.color.ash,
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
        transitionDuration: "0.15s",
        selectors: {
            "&[data-active='true']": {
                borderColor: vars.color.cobalt,
                backgroundColor: `color-mix(in srgb, ${vars.color.cobalt} 10%, ${vars.color.basalt})`,
                color: vars.color.cobalt,
            },
        },
    }),
);

export const orDivider = style({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "11px",
    color: vars.color.ash,
    "::before": groove,
    "::after": groove,
});

export const textarea = style(
    blend(WELL, {
        width: "100%",
        minHeight: "72px",
        border: "none",
        borderRadius: "9px",
        color: vars.color.firn,
        fontSize: "11px",
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        padding: "8px 10px",
        boxSizing: "border-box",
        outline: "none",
        "::placeholder": {
            color: vars.color.ash,
        },
    }),
);

export const actions = style({
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
});

export const cancelBtn = style(
    blend(KEY_STONE, {
        padding: "7px 14px",
        borderRadius: "9px",
        fontSize: "13px",
        fontWeight: 500,
        cursor: "pointer",
        border: "none",
        color: vars.color.snowmelt,
        selectors: {
            "&:hover": { color: vars.color.firn },
        },
    }),
);

export const submitBtn = style(
    blend(KEY_COBALT, {
        padding: "7px 16px",
        borderRadius: "9px",
        fontSize: "13px",
        cursor: "pointer",
        border: "none",
        selectors: {
            "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
        },
    }),
);

export const errorText = style({
    fontSize: "11px",
    color: vars.color.wine,
    margin: 0,
});
