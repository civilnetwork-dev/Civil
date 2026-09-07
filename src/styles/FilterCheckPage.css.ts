import { keyframes, style, styleVariants } from "@vanilla-extract/css";

import { ANNO, FONT_MONO, RULE } from "./schematic.css";
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

export const rescan = style({
    ...ANNO,
    background: "none",
    border: "none",
    borderBottom: RULE.hair,
    cursor: "pointer",
    color: vars.color.cobalt,
});

export const specimenRow = style({
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    margin: "10px 0 22px",
});

export const specimenChip = style({
    ...ANNO,
    padding: "2px 8px",
    border: RULE.hair,
    color: vars.color.snowmelt,
});

export const unsupported = style({
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginBottom: "18px",
});

/**
 * The rate-limit notice. Carried on a left rule in the error tier rather than
 * as a filled banner: it is a condition of the page, not an alarm, and the
 * sheet has no other filled surfaces to sit beside.
 */
export const rateLimit = style({
    borderLeft: `2px solid ${vars.color.sandstone}`,
    paddingLeft: "10px",
    margin: "18px 0 0",
    maxWidth: "520px",
});

export const form = style({
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxWidth: "520px",
});

export const submit = style({
    ...ANNO,
    alignSelf: "flex-start",
    marginTop: "4px",
    padding: "7px 18px",
    background: vars.color.cobalt,
    color: vars.color.basalt,
    border: "none",
    cursor: "pointer",
    textTransform: "uppercase",
    selectors: {
        "&:disabled": { opacity: 0.6, cursor: "default" },
    },
});

export const resultsRule = style({ margin: "30px 0 12px" });

export const ledger = style({ marginTop: "4px" });

export const ledgerHead = style({
    ...ANNO,
    display: "grid",
    gridTemplateColumns: LEDGER_COLUMNS,
    gap: "10px",
    paddingBottom: "6px",
    color: vars.color.snowmelt,
    textTransform: "uppercase",
});

export const ledgerBody = style({ listStyle: "none", margin: 0, padding: 0 });

export const ledgerRow = style({ borderTop: RULE.hair });

export const rowGrid = style({
    display: "grid",
    gridTemplateColumns: LEDGER_COLUMNS,
    gap: "10px",
    alignItems: "center",
    padding: "7px 0",
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
    fontSize: "11px",
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
    paddingBottom: "8px",
});

export const catRow = style({ display: "flex", flexWrap: "wrap", gap: "6px" });

export const spinner = style({
    display: "inline-block",
    animation: `${spin} 0.8s linear infinite`,
    animationDuration: "0.8s",
});

// Category chip on a ledger row detail (Badges/Chips tier in DESIGN.md).
export const catChip = style({
    padding: "2px 8px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: 500,
    background: vars.color.scree,
    color: vars.color.firn,
    border: `1px solid ${vars.color.talus}`,
});

/** Groups the Patreon sign-in and re-scan controls in the title block. */
export const titleActions = style({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
});
