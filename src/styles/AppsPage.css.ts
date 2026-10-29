import { style } from "@vanilla-extract/css";

import {
    alpha,
    BAND,
    blend,
    DUR,
    EASE,
    edge,
    elevation,
    KEY_COBALT,
    KEYCAP,
    LIFT,
    SHADE,
    skirt,
    TABLET,
    WELL,
} from "./material.css";
import { vars } from "./theme.css";

export const addingNote = style({ display: "block", marginTop: "6px" });

export const sectionTitle = style({
    margin: "34px 0 14px",
    fontSize: "16px",
    fontWeight: 600,
    color: vars.color.firn,
});

// The page's one cobalt key: a signature moment, so it keeps its stone depth.
export const randomKey = style(
    blend(KEY_COBALT, {
        display: "inline-flex",
        alignItems: "center",
        height: "38px",
        padding: "0 18px",
        border: "none",
        borderRadius: "10px",
        font: "inherit",
        fontSize: "14px",
        fontWeight: 600,
        cursor: "pointer",
    }),
);

export const shelf = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "10px",
});

/** A shelf entry lies flat; pinning it is what turns it to stone. */
export const card = style({
    position: "relative",
    borderRadius: "12px",
    backgroundColor: alpha(vars.color.scree, 45),
    boxShadow: `inset 0 0 0 1px ${alpha(vars.color.talus, 50)}`,
    transition: `background-color ${DUR.fast} ${EASE.standard}`,
    selectors: { "&:hover": { backgroundColor: vars.color.scree } },
});

export const cardOpen = style({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    padding: "12px 46px 12px 12px",
    border: "none",
    borderRadius: "12px",
    background: "none",
    color: "inherit",
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
    selectors: {
        "&:focus-visible": {
            outline: `2px solid ${vars.color.cobalt}`,
            outlineOffset: "-2px",
        },
    },
});

export const cardIcon = style({
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    backgroundColor: alpha(vars.color.basalt, 70),
});

export const cardText = style({
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
});

export const cardName = style({
    fontSize: "14px",
    fontWeight: 600,
    color: vars.color.firn,
});

export const cardNote = style({
    fontSize: "12.5px",
    color: vars.color.snowmelt,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const pinBtn = style({
    position: "absolute",
    top: "50%",
    right: "10px",
    translate: "0 -50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    padding: 0,
    border: "none",
    borderRadius: "8px",
    background: "none",
    color: vars.color.ash,
    cursor: "pointer",
    selectors: {
        "&:hover, &:focus-visible": {
            color: vars.color.firn,
            backgroundColor: alpha(vars.color.talus, 45),
        },
        "&:focus-visible": { outline: `2px solid ${vars.color.cobalt}` },
    },
});

export const grid = style({
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
    gap: "18px",
});

/**
 * One tile, one primary action. The whole face of the tile is the open
 * button; remove is a small corner control revealed on hover and focus.
 *
 * Each tile is a slab standing on the ground. Under the pointer or keyboard
 * focus it rises clear of it, with a skirt below covering the ground the lift
 * uncovered. A press settles its shadow but does not move it: the open button
 * inside must still be under the pointer when the press is released, or the
 * click would land on the tile instead.
 */
const TILE_LIFT = 3;
const tileShadow = (bands: number, drop: string) =>
    `${SHADE.lip}, ${edge(bands, BAND.light, BAND.dark, drop, 4 + TILE_LIFT)}`;

export const position = style(
    blend(TABLET, {
        borderRadius: "16px",
        position: "relative",
        translate: `0 ${elevation}`,
        boxShadow: tileShadow(4, SHADE.near),
        transition: LIFT,
        selectors: {
            "&:hover, &:focus-within": {
                vars: { [elevation]: `-${TILE_LIFT}px` },
                boxShadow: tileShadow(4 + TILE_LIFT, SHADE.far),
            },
            "&:hover::before": skirt(TILE_LIFT),
            "&:active": {
                boxShadow: tileShadow(4 + TILE_LIFT - 2, SHADE.near),
                transitionDuration: "90ms",
            },
        },
    }),
);

export const openBtn = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    width: "100%",
    padding: "20px 12px",
    background: "none",
    border: "none",
    borderRadius: "16px",
    cursor: "pointer",
    color: "inherit",
    font: "inherit",
});

/**
 * Revealed on row hover, row focus-within, and unconditionally where there is
 * no hover to trigger it. `display: none` until hover would remove it from
 * the tab order outright: the keyboard-trap failure DESIGN.md records.
 */
export const removeBtn = style(
    blend(KEYCAP, {
        position: "absolute",
        top: "6px",
        right: "6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "24px",
        height: "24px",
        padding: 0,
        border: "none",
        borderRadius: "7px",
        cursor: "pointer",
        color: vars.color.ash,
        opacity: 0,
        pointerEvents: "none",
        transition: `${LIFT}, opacity ${DUR.fast} ${EASE.standard}`,
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
    }),
);

// The favicon sits in a small socket carved into the tile's face.
export const iconStage = style(
    blend(WELL, {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "46px",
        height: "46px",
        marginBottom: "4px",
        borderRadius: "13px",
    }),
);

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
    fontSize: "14px",
    fontWeight: 500,
    color: vars.color.firn,
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
});

export const empty = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "14px",
    margin: "18px 0 0",
});
