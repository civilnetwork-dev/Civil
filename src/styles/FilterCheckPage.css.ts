import { keyframes, style, styleVariants } from "@vanilla-extract/css";

import {
    blend,
    edge,
    KEY_COBALT,
    KEY_STONE,
    LIT,
    PEBBLE_FACE,
    ROW_LIFT,
    SHADE,
    TABLET,
    WELL,
} from "./material.css";
import { ANNO, FONT_MONO } from "./schematic.css";
import { vars } from "./theme.css";

const spin = keyframes({
    from: { transform: "rotate(0deg)" },
    to: { transform: "rotate(360deg)" },
});

const STATUS_COLOR = {
    allowed: vars.color.juniper,
    blocked: vars.color.wine,
    warned: vars.color.calcite,
    unknown: vars.color.snowmelt,
    error: vars.color.sandstone,
} as const;

const LEDGER_COLUMNS = "minmax(0, 1fr) 96px 40px";

export const rescan = style(
    blend(KEY_STONE, {
        ...ANNO,
        border: "none",
        borderRadius: "9px",
        padding: "6px 11px",
        cursor: "pointer",
        color: vars.color.cobalt,
    }),
);

export const specimenRow = style({
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    margin: "10px 0 22px",
});

// A detected filter, set down as a pebble.
export const specimenChip = style(
    blend(PEBBLE_FACE, {
        ...ANNO,
        borderRadius: "8px",
        padding: "3px 9px",
        color: vars.color.snowmelt,
    }),
);

export const unsupported = style({
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginBottom: "18px",
});

/**
 * The rate-limit notice. A carved note with a sandstone rim on its leading
 * edge rather than a filled banner: it is a condition of the page, not an
 * alarm.
 */
export const rateLimit = style(
    blend(WELL, {
        borderLeft: `3px solid ${vars.color.sandstone}`,
        borderRadius: "12px",
        padding: "12px 14px",
        margin: "18px 0 0",
        maxWidth: "520px",
    }),
);

export const form = style({
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxWidth: "520px",
});

export const submit = style(
    blend(KEY_COBALT, {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        alignSelf: "flex-start",
        marginTop: "4px",
        padding: "11px 20px",
        border: "none",
        borderRadius: "10px",
        fontSize: "13px",
        cursor: "pointer",
        selectors: {
            "&:disabled": { opacity: 0.6, cursor: "default" },
        },
    }),
);

export const resultsRule = style({ margin: "30px 0 12px" });

// The report is a tablet; each vendor is a row cut into it.
export const ledger = style(
    blend(TABLET, {
        marginTop: "6px",
        padding: "10px 8px 8px",
        borderRadius: "16px",
    }),
);

export const ledgerHead = style({
    ...ANNO,
    display: "grid",
    gridTemplateColumns: LEDGER_COLUMNS,
    gap: "10px",
    padding: "0 10px 8px",
    color: vars.color.snowmelt,
});

export const ledgerBody = style({
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
});

export const ledgerRow = style(blend(ROW_LIFT, {}));

export const rowGrid = style({
    display: "grid",
    gridTemplateColumns: LEDGER_COLUMNS,
    gap: "10px",
    alignItems: "center",
    padding: "8px 10px",
});

export const rowVendor = style({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12.5px",
    fontWeight: 500,
    color: vars.color.firn,
});

export const rowVerdict = styleVariants(STATUS_COLOR, color => ({
    fontFamily: FONT_MONO,
    fontSize: "12px",
    letterSpacing: "0.02em",
    color,
}));

export const markIcon = styleVariants(STATUS_COLOR, color => ({ color }));

export const rowCat = style({
    ...ANNO,
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
});

export const rowDetail = style({
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "0 10px 10px",
});

export const catRow = style({ display: "flex", flexWrap: "wrap", gap: "6px" });

export const spinner = style({
    display: "inline-block",
    animation: `${spin} 0.8s linear infinite`,
    animationDuration: "0.8s",
});

// Category chip on a ledger row detail (Badges/Chips tier in DESIGN.md): a
// small rounded pebble, one band high.
export const catChip = style({
    padding: "2px 9px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 500,
    backgroundColor: vars.color.scree,
    backgroundImage: LIT,
    boxShadow: `${SHADE.lip}, ${edge(1)}`,
    color: vars.color.firn,
});
