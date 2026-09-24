import { style, styleVariants } from "@vanilla-extract/css";

import { ANNO, FONT_MONO, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The parity datum.
 *
 * Every other page draws what it has: bookmarks get call numbers, history gets
 * hour meters, extensions get a state spine. This page is the only one built
 * around a *threshold* — 1.0×, where WebAssembly and JavaScript are equally
 * fast — so the datum line is the drawing. It is stated once as the headline
 * figure, restated as the markLine in the speedup chart, and the raw ledger
 * underneath is what it was derived from.
 *
 * The charts are canvas, so none of this reaches them; see benchmarkConfig.ts,
 * where the same language is restated in echarts' own vocabulary.
 */

export const lede = style({
    maxWidth: "62ch",
    margin: "0 0 26px",
    fontSize: "13.5px",
    lineHeight: 1.55,
    color: vars.color.firn,
});

/* -------------------------------------------------------------------- */
/* Headline                                                              */
/* -------------------------------------------------------------------- */

/**
 * The result, stated at the size the result deserves. The figure is the only
 * thing on any page allowed to be this large; it earns it by being the single
 * number the entire page exists to produce.
 */
export const headline = style({
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    alignItems: "center",
    gap: "20px",
    padding: "20px 0 22px",
    borderBottom: RULE.major,
    margin: "0 0 8px",
});

const figureBase = style({
    fontFamily: FONT_MONO,
    fontSize: "clamp(40px, 8vw, 66px)",
    fontWeight: 600,
    lineHeight: 0.92,
    letterSpacing: "-0.04em",
    fontVariantNumeric: "tabular-nums",
});

/**
 * Faster and slower differ in lightness as well as hue — airglow is a light
 * yellow-green, antares a mid red — so the verdict survives deuteranopia,
 * where the two hues converge. The label beside it says "faster" or "slower"
 * in words regardless, which is the channel that never fails.
 */
export const figure = styleVariants({
    win: [figureBase, { color: vars.color.juniper }],
    loss: [figureBase, { color: vars.color.wine }],
});

export const headlineText = style({
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    minWidth: 0,
});

export const headlineClaim = style({
    fontSize: "14px",
    fontWeight: 500,
    color: vars.color.firn,
    lineHeight: 1.35,
});

export const headlineDatum = style({
    ...ANNO,
    color: vars.color.snowmelt,
});

/* -------------------------------------------------------------------- */
/* Legend                                                                */
/* -------------------------------------------------------------------- */

export const legend = style({
    display: "flex",
    gap: "18px",
    flexWrap: "wrap",
    margin: "18px 0 6px",
});

export const legendItem = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
});

// A 9px square, not a dot: the charts draw flat rectangles, so the key uses
// the same mark the bars do.
export const legendSwatch = style({
    width: "9px",
    height: "9px",
    flexShrink: 0,
});

export const legendName = style({
    ...ANNO,
    color: vars.color.snowmelt,
});

export const legendTag = style({
    ...ANNO,
    color: vars.color.snowmelt,
    paddingLeft: "8px",
    borderLeft: RULE.hair,
});

/* -------------------------------------------------------------------- */
/* Charts                                                                */
/* -------------------------------------------------------------------- */

export const chartPair = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "26px",
    margin: "6px 0 0",
});

export const chartBlock = style({
    minWidth: 0,
});

export const chartCaption = style({
    ...ANNO,
    color: vars.color.snowmelt,
    display: "block",
    margin: "6px 0 2px",
});

export const chartBox = style({
    width: "100%",
    height: "280px",
});

export const chartBoxWide = style({
    width: "100%",
    height: "260px",
});

/* -------------------------------------------------------------------- */
/* Raw ledger                                                            */
/* -------------------------------------------------------------------- */

export const table = style({
    width: "100%",
    borderCollapse: "collapse",
    margin: "6px 0 0",
    fontFamily: FONT_MONO,
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
});

export const th = style({
    ...ANNO,
    padding: "8px 12px 8px 0",
    textAlign: "left",
    whiteSpace: "nowrap",
    borderBottom: RULE.hair,
    color: vars.color.snowmelt,
});

/**
 * Numeric columns are right-aligned so digits line up by place value; that is
 * the whole reason the ledger is monospace and tabular in the first place.
 *
 * `paddingLeft` is what keeps them apart. With only a right padding of zero and
 * the implementation column at `width: 100%`, every numeric column collapsed to
 * its content and butted straight against its neighbour: the shipped table read
 * `0.34792874.1  2874.1`, three separate figures fused into one run of digits.
 * A right-aligned column needs its gutter on the left.
 */
export const thNum = style([
    th,
    { textAlign: "right", paddingRight: 0, paddingLeft: "20px" },
]);

const td = style({
    padding: "9px 12px 9px 0",
    borderBottom: RULE.hair,
    color: vars.color.firn,
    whiteSpace: "nowrap",
});

export const tdNum = style([
    td,
    {
        textAlign: "right",
        paddingRight: 0,
        paddingLeft: "20px",
        color: vars.color.snowmelt,
    },
]);

export const tdImpl = style([td, { width: "100%", whiteSpace: "normal" }]);

export const implCell = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "9px",
    color: vars.color.firn,
});

export const tdLead = style([
    tdNum,
    { fontWeight: 600, color: vars.color.firn },
]);

// Wide content scrolls inside its own container rather than making the page
// scroll sideways.
export const tableScroll = style({
    overflowX: "auto",
});

export const footer = style({
    ...ANNO,
    display: "block",
    margin: "30px 0 0",
    paddingTop: "8px",
    borderTop: RULE.hair,
    color: vars.color.snowmelt,
});
