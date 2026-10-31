import { style } from "@vanilla-extract/css";

import { blend, KEY_STONE } from "./material.css";
import { ANNO } from "./schematic.css";
import { vars } from "./theme.css";

/** The method the load died on, named in the lede in the house's words. */
export const method = style({
    color: vars.color.firn,
    fontWeight: 500,
});

/** Every method by name: the reader has to pick one, so none is the
 *  cobalt "main" key. */
export const keys = style({
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    margin: "16px 0 28px",
});

export const key = style(
    blend(KEY_STONE, {
        border: "none",
        borderRadius: "9px",
        padding: "8px 14px",
        font: "inherit",
        fontSize: "13px",
        fontWeight: 500,
        color: vars.color.firn,
        cursor: "pointer",
    }),
);

export const hint = style({
    ...ANNO,
    margin: "0 0 12px",
    lineHeight: 1.55,
});
