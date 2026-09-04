import { style } from "@vanilla-extract/css";
import { DUR, EASE } from "./material.css";
import { ANNO } from "./schematic.css";
import { vars } from "./theme.css";

export const addingNote = style({ display: "block", marginTop: "6px" });

export const gridRule = style({ margin: "26px 0 14px" });

export const grid = style({
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
    gap: "10px",
});

/**
 * One tile, one primary action. The whole face of the tile is the open
 * button; remove is a small corner control revealed on hover and focus.
 */
export const position = style({
    position: "relative",
    transition: `background ${DUR.fast} ${EASE.standard}`,
    selectors: {
        "&:hover, &:focus-within": {
            background: vars.color.scree,
        },
    },
});

export const openBtn = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    width: "100%",
    padding: "12px 8px",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "inherit",
    font: "inherit",
});

/**
 * Revealed on row hover, row focus-within, and unconditionally where there is
 * no hover to trigger it. `display: none` until hover would remove it from
 * the tab order outright — the keyboard-trap failure DESIGN.md records.
 */
export const removeBtn = style({
    position: "absolute",
    top: "4px",
    right: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    padding: 0,
    background: "none",
    border: "none",
    cursor: "pointer",
    color: vars.color.ash,
    opacity: 0,
    pointerEvents: "none",
    transition: `opacity ${DUR.fast} ${EASE.standard}`,
    selectors: {
        [`${position}:hover &, ${position}:focus-within &`]: {
            opacity: 1,
            pointerEvents: "auto",
        },
        "&:hover, &:focus-visible": {
            color: vars.color.wine,
        },
    },
    "@media": {
        "(hover: none)": {
            opacity: 1,
            pointerEvents: "auto",
        },
    },
});

export const iconStage = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "34px",
    height: "34px",
});

export const icon = style({
    width: "26px",
    height: "26px",
    objectFit: "contain",
});

export const iconFallback = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    // Colours a glyph, not text, so WCAG 1.4.11's 3:1 non-text threshold
    // applies rather than 4.5:1; ash clears it with room.
    color: vars.color.ash,
});

export const name = style({
    fontSize: "12.5px",
    fontWeight: 500,
    color: vars.color.firn,
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
});

export const empty = style({
    ...ANNO,
    display: "block",
    margin: "14px 0 0",
});
