import { style } from "@vanilla-extract/css";

import {
    alpha,
    BAND,
    blend,
    DUR,
    EASE,
    GROUND,
    KEY_COBALT,
    KEY_STONE,
    mix,
    PEBBLE_FACE,
    PLATE,
    RISE,
} from "./material.css";
import { ANNO, FONT_SANS } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * First-run setup: the ground, the wordmark, and one plate in the middle
 * holding one question at a time. The plate is the stop card's slab (18px,
 * six bands), because setup is the one screen that stands between a visitor
 * and the browser.
 */
export const page = style(
    blend(GROUND, {
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        padding: "24px 40px 40px",
        color: vars.color.firn,
        fontFamily: FONT_SANS,
        "@media": { "(max-width: 600px)": { padding: "20px 16px 28px" } },
    }),
);

export const top = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    width: "100%",
    maxWidth: "720px",
    margin: "0 auto",
    animation: RISE,
});

export const textKey = style({
    ...ANNO,
    padding: "6px 4px",
    border: "none",
    background: "none",
    color: vars.color.snowmelt,
    textDecoration: "underline",
    textUnderlineOffset: "3px",
    cursor: "pointer",
    selectors: { "&:hover": { color: vars.color.firn } },
});

export const plate = style(
    blend(PLATE, {
        width: "100%",
        maxWidth: "640px",
        margin: "32px auto 0",
        padding: "32px",
        borderRadius: "18px",
        animation: RISE,
        animationDelay: "50ms",
        "@media": {
            "(max-width: 600px)": { padding: "22px 18px", marginTop: "20px" },
        },
    }),
);

/** One groove per step, cobalt up to the current one. */
export const progress = style({
    display: "flex",
    gap: "6px",
    margin: "0 0 24px",
    padding: 0,
    listStyle: "none",
});

export const progressStep = style({
    flex: 1,
    height: "4px",
    borderRadius: "2px",
    backgroundColor: vars.color.basalt,
    boxShadow: `0 1px 0 ${alpha(vars.color.firn, 7)}`,
    transition: `background-color ${DUR.lift} ${EASE.enter}`,
});

export const progressDone = style({
    backgroundColor: vars.color.cobalt,
});

export const head = style({
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "18px",
});

export const stepLabel = style({ ...ANNO, color: vars.color.snowmelt });

export const title = style({
    margin: 0,
    fontSize: "30px",
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "-0.015em",
    textWrap: "balance",
    textShadow: `0 1px 0 ${vars.color.basalt}, 0 3px 8px color-mix(in srgb, black 35%, transparent)`,
    "@media": { "(max-width: 600px)": { fontSize: "24px" } },
});

export const lede = style({
    margin: "10px 0 22px",
    maxWidth: "58ch",
    fontSize: "15px",
    lineHeight: 1.55,
    color: vars.color.snowmelt,
});

/* Choices */

export const group = style({
    margin: "0 0 20px",
    padding: 0,
    border: "none",
    minWidth: 0,
});

export const groupLegend = style({
    marginBottom: "10px",
    padding: 0,
    fontSize: "14px",
    fontWeight: 500,
    color: vars.color.firn,
});

export const cards = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "10px",
});

export const card = style({
    position: "relative",
    display: "block",
    cursor: "pointer",
});

/** The real radio: invisible, still focusable and still the thing checked. */
export const cardInput = style({
    position: "absolute",
    opacity: 0,
    width: "1px",
    height: "1px",
    margin: 0,
    pointerEvents: "none",
});

const CHOSEN = mix(vars.color.cobalt, 24, vars.color.scree);

// A card is a stone key: raised because it is pressable. Choosing one floods
// its face with cobalt through background-color alone, so its sediment and
// shadow keep the same layers in every state.
export const cardFace = style(
    blend(KEY_STONE, {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        height: "100%",
        padding: "12px 14px",
        borderRadius: "12px",
        textAlign: "left",
        selectors: {
            [`${cardInput}:checked + &`]: { backgroundColor: CHOSEN },
            [`${cardInput}:focus-visible + &`]: {
                outline: `2px solid ${vars.color.cobalt}`,
                outlineOffset: "3px",
            },
        },
    }),
);

export const cardTitle = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    fontSize: "14px",
    fontWeight: 500,
    color: vars.color.firn,
});

export const cardNote = style({
    ...ANNO,
    fontWeight: 400,
    lineHeight: 1.45,
});

export const cardMark = style({
    flexShrink: 0,
    color: vars.color.cobalt,
    opacity: 0,
    transition: `opacity ${DUR.base} ${EASE.standard}`,
    selectors: { [`${cardInput}:checked + ${cardFace} &`]: { opacity: 1 } },
});

/** "Suggested": a still chip, since it is a label and not a control. */
export const suggested = style(
    blend(PEBBLE_FACE, {
        ...ANNO,
        alignSelf: "flex-start",
        padding: "2px 7px",
        borderRadius: "6px",
        color: vars.color.firn,
    }),
);

export const why = style({
    ...ANNO,
    margin: "10px 0 0",
    fontWeight: 400,
    lineHeight: 1.5,
});

/* Advanced */

export const advanced = style({
    marginTop: "8px",
    borderTop: `1px solid ${alpha(vars.color.basalt, 55)}`,
    boxShadow: `inset 0 1px 0 ${alpha(vars.color.firn, 5)}`,
});

export const advancedSummary = style({
    ...ANNO,
    padding: "14px 0 6px",
    color: vars.color.snowmelt,
    cursor: "pointer",
    listStylePosition: "inside",
    selectors: { "&:hover": { color: vars.color.firn } },
});

/* Footer */

export const footer = style({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginTop: "26px",
});

export const keys = style({
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
});

export const footerEnd = style({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "14px",
    marginLeft: "auto",
});

const KEY_TEXT = {
    fontFamily: FONT_SANS,
    fontSize: "14px",
    border: "none",
    borderRadius: "10px",
    padding: "10px 18px",
    cursor: "pointer",
} as const;

export const back = style(
    blend(KEY_STONE, { ...KEY_TEXT, color: vars.color.firn }),
);

export const next = style(blend(KEY_COBALT, KEY_TEXT));

/* Summary */

export const summary = style({
    margin: "0 0 4px",
    display: "grid",
    gap: 0,
});

export const summaryRow = style({
    display: "grid",
    gridTemplateColumns: "minmax(120px, 190px) 1fr",
    gap: "4px 16px",
    padding: "11px 0",
    selectors: {
        "& + &": {
            borderTop: `1px solid ${alpha(vars.color.basalt, 55)}`,
            boxShadow: `inset 0 1px 0 ${alpha(vars.color.firn, 5)}`,
        },
    },
    "@media": {
        "(max-width: 600px)": { gridTemplateColumns: "1fr" },
    },
});

export const summaryName = style({ ...ANNO, paddingTop: "2px" });

export const summaryValue = style({
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    fontSize: "14px",
    color: vars.color.firn,
});

export const busy = style({
    ...ANNO,
    color: vars.color.snowmelt,
    borderLeft: `2px solid ${BAND.light}`,
    paddingLeft: "10px",
});
