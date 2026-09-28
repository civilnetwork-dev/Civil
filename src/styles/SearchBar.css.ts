import { style } from "@vanilla-extract/css";

import { blend, KEY_COBALT, PLATE, ROW_LIFT, WELL } from "./material.css";
import { FONT_SANS } from "./schematic.css";
import { vars } from "./theme.css";

export const sbRoot = style({
    position: "relative",
    fontFamily: FONT_SANS,
    width: "100%",
});

// A deep well cut into the ground, with the Browse key seated inside it. The
// form carries the focus rim for the whole control; the input inside draws
// none of its own.
export const sbInputWrapper = style(
    blend(WELL, {
        display: "flex",
        alignItems: "center",
        gap: "14px",
        minHeight: "64px",
        padding: "8px 10px 10px 22px",
        borderRadius: "18px",
        "@media": {
            "(max-width: 600px)": {
                minHeight: "60px",
                gap: "10px",
                paddingLeft: "16px",
            },
        },
    }),
);

export const sbSearchIcon = style({ color: vars.color.ash, flexShrink: 0 });

export const sbInput = style({
    flex: 1,
    minWidth: 0,
    width: "100%",
    border: "none",
    background: "transparent",
    color: vars.color.firn,
    fontFamily: FONT_SANS,
    fontSize: "16px",
    outline: "none",
    caretColor: vars.color.cobalt,
    selectors: {
        "&::placeholder": { color: vars.color.ash },
        "&:focus-visible": { outline: "none" },
    },
});

export const sbButton = style(
    blend(KEY_COBALT, {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        minHeight: "44px",
        minWidth: "46px",
        padding: "0 16px",
        flexShrink: 0,
        border: "none",
        borderRadius: "12px",
        fontSize: "14px",
        cursor: "pointer",
        "@media": { "(max-width: 600px)": { padding: "0 12px" } },
    }),
);

export const sbButtonLabel = style({
    "@media": { "(max-width: 600px)": { display: "none" } },
});

export const sbDropdown = style(
    blend(PLATE, {
        position: "absolute",
        top: "calc(100% + 10px)",
        left: 0,
        width: "100%",
        maxHeight: "280px",
        overflowY: "auto",
        zIndex: 10000,
        borderRadius: "14px",
        listStyle: "none",
        padding: "6px",
    }),
);

export const sbRow = style(
    blend(ROW_LIFT, {
        display: "block",
        width: "100%",
        border: "none",
        background: "transparent",
        textAlign: "left",
        cursor: "pointer",
        padding: "12px 14px",
        color: vars.color.snowmelt,
        fontSize: "14px",
        selectors: {
            "&:hover, &:focus-within": { color: vars.color.firn },
        },
    }),
);
