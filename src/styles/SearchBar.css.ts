import { style } from "@vanilla-extract/css";

import { FONT_SANS } from "./schematic.css";
import { vars } from "./theme.css";

export const sbRoot = style({
    position: "relative",
    fontFamily: FONT_SANS,
    width: "100%",
});

// The form carries the focus ring for the whole control; the input inside
// draws none of its own.
export const sbInputWrapper = style({
    display: "flex",
    alignItems: "center",
    gap: "14px",
    minHeight: "64px",
    padding: "8px 8px 8px 22px",
    background: vars.color.basalt,
    border: `1px solid ${vars.color.talus}`,
    borderRadius: "16px",
    transition: "border-color 180ms ease-out",
    selectors: { "&:focus-within": { borderColor: vars.color.cobalt } },
    "@media": {
        "(max-width: 600px)": {
            minHeight: "60px",
            gap: "10px",
            paddingLeft: "16px",
        },
    },
});

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

export const sbButton = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    minHeight: "46px",
    minWidth: "46px",
    padding: "0 16px",
    flexShrink: 0,
    border: "none",
    borderRadius: "10px",
    background: vars.color.cobalt,
    color: vars.color.basalt,
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 180ms ease-out",
    selectors: {
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.cobalt} 85%, ${vars.color.firn})`,
        },
        "&:active": {
            background: `color-mix(in srgb, ${vars.color.cobalt} 85%, ${vars.color.basalt})`,
        },
    },
    "@media": { "(max-width: 600px)": { padding: "0 12px" } },
});

export const sbButtonLabel = style({
    "@media": { "(max-width: 600px)": { display: "none" } },
});

export const sbDropdown = style({
    position: "absolute",
    top: "calc(100% + 8px)",
    left: 0,
    width: "100%",
    maxHeight: "280px",
    overflowY: "auto",
    zIndex: 10000,
    background: vars.color.basalt,
    border: `1px solid ${vars.color.talus}`,
    borderRadius: "12px",
    listStyle: "none",
    padding: "6px",
});

export const sbRow = style({
    display: "block",
    width: "100%",
    border: "none",
    background: "transparent",
    textAlign: "left",
    borderRadius: "8px",
    cursor: "pointer",
    padding: "12px 14px",
    color: vars.color.snowmelt,
    fontSize: "14px",
    selectors: {
        "&:hover, &:focus-visible": {
            background: vars.color.scree,
            color: vars.color.firn,
        },
    },
});
