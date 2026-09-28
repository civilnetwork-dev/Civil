import { globalStyle, style } from "@vanilla-extract/css";

import {
    alpha,
    blend,
    DUR,
    EASE,
    KEY_STONE,
    LIFT,
    PLATE,
    ROW_UP,
    TABLET,
    WELL,
} from "./material.css";
import { ANNO, FONT_MONO, FONT_SANS, toggle } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * One setting per row: what it is and what it does on the left, the control
 * on the right. Rows are separated by grooves, the same carved line as a rule,
 * so a section reads as one bed of stone with its settings engraved into it.
 * Below 600px the control drops under its text rather than squeezing it.
 */
export const row = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px 28px",
    padding: "16px 0",
    selectors: {
        // After anything else in the bed: another row, a readout, a list.
        "* + &": {
            borderTop: `1px solid ${alpha(vars.color.basalt, 55)}`,
            boxShadow: `inset 0 1px 0 ${alpha(vars.color.firn, 5)}`,
        },
    },
    "@media": {
        "(max-width: 600px)": {
            flexDirection: "column",
            alignItems: "stretch",
        },
    },
});

export const rowText = style({
    flex: "1 1 auto",
    minWidth: 0,
});

export const rowLabel = style({
    display: "block",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: 1.4,
    color: vars.color.firn,
});

export const rowHint = style({
    ...ANNO,
    display: "block",
    maxWidth: "62ch",
    marginTop: "4px",
    fontWeight: 400,
    lineHeight: 1.5,
});

export const rowControl = style({
    flexShrink: 0,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "10px",
    "@media": {
        "(max-width: 600px)": { justifyContent: "flex-start" },
    },
});

export const rowError = style({
    ...ANNO,
    display: "block",
    marginTop: "6px",
    color: vars.color.wine,
});

/** Dimmed, still readable: a setting that has no effect right now. */
export const rowOff = style({ opacity: 0.55 });

// A switch's name is plain text, so only the switch takes clicks. Its
// transparent input reaches past the 34 by 18 channel to a 44 by 40 target.
export const switchHit = style({
    selectors: {
        [`${toggle} &`]: {
            top: "-11px",
            left: "-5px",
            width: "calc(100% + 10px)",
            height: "calc(100% + 22px)",
        },
    },
});

// A select is a carved well like any field. The well carries focus; the
// native control inside draws no ring of its own.
export const well = style(
    blend(WELL, {
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        minWidth: "230px",
        borderRadius: "12px",
        "@media": { "(max-width: 600px)": { width: "100%" } },
    }),
);

const CONTROL = {
    width: "100%",
    minWidth: 0,
    padding: "10px 14px",
    background: "none",
    border: "none",
    outline: "none",
    appearance: "none",
    fontFamily: FONT_SANS,
    fontSize: "13px",
    color: vars.color.firn,
    caretColor: vars.color.cobalt,
    "::placeholder": { color: vars.color.ash },
    selectors: {
        "&:focus-visible": { outline: "none" },
        "&:disabled": { cursor: "not-allowed" },
    },
} as const;

export const control = style(CONTROL);

// csstype doesn't list base-select yet.
const BASE_SELECT = "base-select" as unknown as "auto";

export const selectControl = style({
    ...CONTROL,
    // A customizable select where the browser has one (Chromium 135+,
    // Safari 27+), so the rules below draw its open list. Firefox keeps
    // `none`: the chevron stays ours and the list stays its own dark one.
    appearance: ["none", BASE_SELECT],
    paddingRight: "36px",
    cursor: "pointer",
});

// The open list is a plate like the context menu: 6px inset rows that rise
// under the pointer or keyboard, and a cobalt check on the gutter beside the
// chosen one.
globalStyle(`${selectControl}::picker(select)`, {
    ...PLATE,
    appearance: BASE_SELECT,
    border: "none",
    borderRadius: "14px",
    padding: "6px",
    marginBlock: "6px",
    color: vars.color.firn,
});

const OPTION = `${selectControl} option`;

globalStyle(OPTION, {
    gap: "10px",
    padding: "7px 10px",
    borderRadius: "8px",
    cursor: "pointer",
    transition: LIFT,
});

globalStyle(`${OPTION}:hover, ${OPTION}:focus-visible`, ROW_UP);

globalStyle(`${OPTION}::checkmark`, { color: vars.color.cobalt });

// The well draws its own chevron.
globalStyle(`${selectControl}::picker-icon`, { display: "none" });

export const selectMark = style({
    position: "absolute",
    right: "12px",
    color: vars.color.ash,
    pointerEvents: "none",
    transition: `color ${DUR.base} ${EASE.standard}`,
    selectors: { [`${well}:focus-within &`]: { color: vars.color.cobalt } },
});

export const key = style(
    blend(KEY_STONE, {
        fontFamily: FONT_SANS,
        fontSize: "13px",
        fontWeight: 500,
        color: vars.color.firn,
        border: "none",
        borderRadius: "9px",
        padding: "8px 14px",
        cursor: "pointer",
        whiteSpace: "nowrap",
    }),
);

export const hostForm = style({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "10px",
    marginTop: "12px",
});

/** Several lines of text: pasted settings. */
export const area = style(
    blend(WELL, {
        display: "block",
        width: "100%",
        minHeight: "120px",
        padding: "10px 14px",
        border: "none",
        borderRadius: "12px",
        fontFamily: FONT_MONO,
        fontSize: "12px",
        lineHeight: 1.5,
        color: vars.color.firn,
        caretColor: vars.color.cobalt,
        outline: "none",
    }),
);

// The note left when history storage ran out: a tablet strip with a calcite
// glyph (the warned verdict), always with the sentence beside it.
export const notice = style(
    blend(TABLET, {
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        padding: "12px 16px",
        margin: "0 0 20px",
        borderRadius: "14px",
    }),
);

export const noticeMark = style({
    flexShrink: 0,
    marginTop: "2px",
    color: vars.color.calcite,
});

export const noticeText = style({
    flex: 1,
    margin: 0,
    fontSize: "13px",
    lineHeight: 1.5,
    color: vars.color.snowmelt,
});

export const noticeDismiss = style(
    blend(KEY_STONE, {
        ...ANNO,
        flexShrink: 0,
        border: "none",
        borderRadius: "8px",
        padding: "5px 10px",
        color: vars.color.firn,
        cursor: "pointer",
    }),
);
