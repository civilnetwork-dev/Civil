import { style } from "@vanilla-extract/css";
import { DUR, EASE, hitArea } from "./material.css";
import { ANNO, FONT_MONO, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The measured time rule.
 *
 * Each day is introduced by a labelled `Rule` — the same dimension-callout
 * motif the rest of the language uses for a section break, here reused as a
 * day divider. The hour histogram and the entry count sit underneath it as a
 * measured readout of what the rule spans, rather than being folded into the
 * rule itself.
 */

export const titleActions = style({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
});

// Text-button recipe shared with Apps' detailBtnDanger: antares is the
// system's "blocked"/destructive tier, reused here as the clear-all accent.
export const clearBtn = style({
    ...ANNO,
    background: "none",
    border: "none",
    borderBottom: RULE.hair,
    padding: "2px 2px",
    cursor: "pointer",
    color: vars.color.antares,
    textTransform: "uppercase",
    transitionProperty: "color, border-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&:hover": { borderBottomColor: vars.color.antares },
    },
});

// Armed state for the second click — stated plainly in the label already;
// the colour shift is the redundant, not the only, channel.
export const clearBtnArmed = style({
    color: vars.color.daylight,
    borderBottomColor: vars.color.antares,
    background: `color-mix(in srgb, ${vars.color.antares} 16%, transparent)`,
    padding: "2px 6px",
});

/**
 * The scope row states what's currently in view. It sits directly under the
 * title block because the filter doesn't only hide rows — the day rules and
 * their hour readouts below recompute from it too.
 */
export const scopeRow = style({
    display: "flex",
    alignItems: "center",
    gap: "18px",
    flexWrap: "wrap",
    margin: "22px 0 28px",
});

export const filterField = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: "1 1 260px",
    maxWidth: "420px",
    paddingBottom: "6px",
    borderBottom: RULE.hair,
    transitionProperty: "border-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.base,
    selectors: {
        "&:focus-within": { borderBottomColor: vars.color.sirius },
    },
});

// ember deliberately: this colours a glyph, not text, so the non-text 3:1
// threshold applies rather than 4.5:1.
export const filterIcon = style({
    flexShrink: 0,
    color: vars.color.ember,
    transition: `color ${DUR.base} ${EASE.standard}`,
    selectors: {
        [`${filterField}:focus-within &`]: { color: vars.color.sirius },
    },
});

export const filterInput = style({
    flex: 1,
    minWidth: 0,
    border: "none",
    background: "transparent",
    outline: "none",
    color: vars.color.daylight,
    fontFamily: FONT_MONO,
    fontSize: "13px",
    caretColor: vars.color.sirius,
    selectors: {
        "&::placeholder": { color: vars.color.cinder },
    },
});

// The shortcut is advertised on the control it operates, and steps aside as
// soon as there's a query to clear.
export const filterHint = style({
    ...ANNO,
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: "16px",
    height: "16px",
    border: `0.5px solid ${vars.color.haze}`,
    fontSize: "10px",
    transition: `opacity ${DUR.base} ${EASE.standard}`,
    selectors: {
        [`${filterField}:focus-within &`]: { opacity: 0 },
    },
});

export const filterClear = style({
    position: "relative",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: "20px",
    height: "20px",
    padding: 0,
    border: "none",
    background: "none",
    color: vars.color.starlight,
    cursor: "pointer",
    transitionProperty: "color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&::after": hitArea(),
        "&:hover": { color: vars.color.daylight },
    },
});

/** A readout, not a sentence: figures carry tabular digits via ANNO. */
export const scopeStat = style({
    ...ANNO,
    display: "flex",
    alignItems: "baseline",
    gap: "5px",
});

export const scopeStatNum = style({
    fontWeight: 600,
    color: vars.color.daylight,
});

export const scopeStatWord = style({
    color: vars.color.starlight,
});

export const scopeStatSep = style({
    alignSelf: "center",
    width: "3px",
    height: "3px",
    margin: "0 3px",
    background: vars.color.dust,
});

export const list = style({
    display: "flex",
    flexDirection: "column",
    gap: "32px",
});

export const dayGroup = style({
    display: "flex",
    flexDirection: "column",
    gap: "10px",
});

export const dayRuleEl = style({ margin: 0 });

export const dayMetrics = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    "@media": {
        "screen and (max-width: 560px)": { flexWrap: "wrap" },
    },
});

/**
 * A day's browsing plotted against its own 24 hours — the page already holds
 * every timestamp, and this is the one place that shape becomes visible.
 */
export const dayMeter = style({
    position: "relative",
    flex: "0 1 216px",
    display: "flex",
    alignItems: "flex-end",
    gap: "1px",
    height: "21px",
    paddingBottom: "5px",
    cursor: "default",
    "@media": {
        "screen and (max-width: 560px)": {
            order: 1,
            flexBasis: "100%",
        },
    },
    selectors: {
        "&::after": {
            content: '""',
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "4px",
            height: "0.5px",
            background: vars.color.haze,
        },
    },
});

export const dayMeterBar = style({
    position: "relative",
    flex: 1,
    minWidth: "2px",
    height: "100%",
    selectors: {
        "&:hover::after": { background: vars.color.ember },
        "&::after": {
            content: '""',
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "max(2px, var(--fill, 0%))",
            background: `color-mix(in srgb, ${vars.color.haze} 55%, transparent)`,
            transitionProperty: "background",
            transitionTimingFunction: EASE.standard,
            transitionDuration: DUR.fast,
        },
    },
});

// ember is non-text — this bar is a tick, not a label — so it clears the
// 3:1 threshold rather than needing 4.5:1.
export const dayMeterBarOn = style({
    selectors: {
        "&::after": { background: vars.color.ember },
        "&:hover::after": { background: vars.color.sirius },
    },
});

// Faint guides at 00:00 / 06:00 / 12:00 / 18:00 so the strip reads as a
// clock rather than an abstract sparkline.
export const dayMeterBarTick = style({
    selectors: {
        "&::before": {
            content: '""',
            position: "absolute",
            left: 0,
            bottom: "-4px",
            height: "3px",
            width: "0.5px",
            background: vars.color.haze,
        },
    },
});

export const dayCount = style({
    ...ANNO,
    flexShrink: 0,
    display: "flex",
    alignItems: "baseline",
    gap: "4px",
    color: vars.color.daylight,
});

export const dayCountUnit = style({
    color: vars.color.starlight,
});

export const entries = style({
    display: "flex",
    flexDirection: "column",
    gap: "6px",
});

export const entry = style({
    transition: `background ${DUR.fast} ${EASE.standard}`,
    selectors: {
        "&:hover, &:focus-within": { background: vars.color.horizon },
    },
});

export const entrySummary = style({
    display: "flex",
    alignItems: "center",
    gap: "10px",
});

export const favicon = style({
    width: "16px",
    height: "16px",
    objectFit: "contain",
    flexShrink: 0,
    color: vars.color.ember,
});

export const entryTitle = style({
    flex: 1,
    minWidth: 0,
    fontSize: "13px",
    fontWeight: 500,
    color: vars.color.daylight,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const entryDetail = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "10px",
});

export const entryUrl = style({
    flex: "1 1 200px",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const entryDetailActions = style({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexShrink: 0,
});

export const entryTime = style({ color: vars.color.starlight });

export const deleteBtn = style({
    ...ANNO,
    position: "relative",
    background: "none",
    border: "none",
    borderBottom: RULE.hair,
    padding: "2px 2px",
    cursor: "pointer",
    color: vars.color.antares,
    textTransform: "uppercase",
    selectors: {
        "&::after": hitArea(),
        "&:hover": { borderBottomColor: vars.color.antares },
    },
});

export const empty = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "10px",
    marginTop: "8px",
});

export const emptyText = style({
    ...ANNO,
    color: vars.color.starlight,
});

// The way back out of a filter that matched nothing, offered where the user
// is already looking.
export const emptyAction = style({
    ...ANNO,
    background: "none",
    border: "none",
    borderBottom: RULE.hair,
    padding: "2px 0",
    cursor: "pointer",
    color: vars.color.sirius,
    textTransform: "uppercase",
    selectors: {
        "&:hover": { color: vars.color.vega },
    },
});
