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

// wine is the system's "blocked"/destructive tier, reused as the clear-all
// accent — the same colour every remove control in the app wears.
export const clearBtn = style({
    ...ANNO,
    background: "none",
    border: "none",
    borderBottom: RULE.hair,
    padding: "2px 2px",
    cursor: "pointer",
    color: vars.color.wine,
    textTransform: "uppercase",
    transitionProperty: "color, border-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&:hover": { borderBottomColor: vars.color.wine },
    },
});

// Armed state for the second click — stated plainly in the label already;
// the colour shift is the redundant, not the only, channel.
export const clearBtnArmed = style({
    color: vars.color.firn,
    borderBottomColor: vars.color.wine,
    background: `color-mix(in srgb, ${vars.color.wine} 16%, transparent)`,
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
        "&:focus-within": { borderBottomColor: vars.color.cobalt },
    },
});

// ember deliberately: this colours a glyph, not text, so the non-text 3:1
// threshold applies rather than 4.5:1.
export const filterIcon = style({
    flexShrink: 0,
    color: vars.color.ash,
    transition: `color ${DUR.base} ${EASE.standard}`,
    selectors: {
        [`${filterField}:focus-within &`]: { color: vars.color.cobalt },
    },
});

export const filterInput = style({
    flex: 1,
    minWidth: 0,
    border: "none",
    background: "transparent",
    outline: "none",
    color: vars.color.firn,
    fontFamily: FONT_MONO,
    fontSize: "13px",
    caretColor: vars.color.cobalt,
    selectors: {
        "&::placeholder": { color: vars.color.ash },
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
    border: `0.5px solid ${vars.color.talus}`,
    fontSize: "11px",
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
    color: vars.color.snowmelt,
    cursor: "pointer",
    transitionProperty: "color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&::after": hitArea(),
        "&:hover": { color: vars.color.firn },
    },
});

/**
 * One text node, one style. The previous readout split its numbers and words
 * into separately-styled spans, which left no whitespace between them in the
 * DOM — so the live region announced "3pages2days" and the page needed an
 * `aria-hidden` copy plus a visually-hidden sibling to say one sentence.
 * A sentence set as a sentence needs none of that.
 */
export const scopeStat = style({
    ...ANNO,
    color: vars.color.snowmelt,
    whiteSpace: "nowrap",
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
    // Takes the row's slack rather than sitting at a fixed 216px. Pinned
    // narrow, twenty-four hours were plotted across a fifth of the sheet with
    // the count stranded a thousand pixels away, so the gap read as a layout
    // fault rather than as a chart. Given the width, the bars resolve into a
    // day's actual shape — which is the only reason this chart exists.
    flex: "1 1 auto",
    maxWidth: "640px",
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
            background: vars.color.talus,
        },
    },
});

export const dayMeterBar = style({
    position: "relative",
    flex: 1,
    minWidth: "2px",
    height: "100%",
    selectors: {
        "&:hover::after": { background: vars.color.ash },
        "&::after": {
            content: '""',
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "max(2px, var(--fill, 0%))",
            background: `color-mix(in srgb, ${vars.color.talus} 55%, transparent)`,
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
        "&::after": { background: vars.color.ash },
        "&:hover::after": { background: vars.color.cobalt },
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
            background: vars.color.talus,
        },
    },
});

export const dayCount = style({
    ...ANNO,
    flexShrink: 0,
    display: "flex",
    alignItems: "baseline",
    gap: "4px",
    color: vars.color.firn,
});

export const dayCountUnit = style({
    color: vars.color.snowmelt,
});

export const entries = style({
    display: "flex",
    flexDirection: "column",
    gap: "6px",
});

/**
 * A ruled row, not a `Plate`.
 *
 * The plate drew corner ticks at the full width of the sheet while the row's
 * content sat in the left third, so each entry left an orphan tick floating in
 * empty space on the right. Bookmarks and Extensions already rule their rows
 * apart; this is the same grammar, which is the point of having one.
 */
export const entry = style({
    position: "relative",
    display: "grid",
    gridTemplateColumns: "1fr 28px",
    alignItems: "center",
    gap: "8px",
    borderBottom: RULE.hair,
    transition: `background ${DUR.fast} ${EASE.standard}`,
    selectors: {
        "&:hover, &:focus-within": { background: vars.color.scree },
    },
});

/**
 * Title takes the slack; host and time are fixed columns on the right.
 *
 * `minmax(0, 1fr)` rather than `1fr`: a grid track's default minimum is its
 * content, so a long title would push the two columns past the sheet edge
 * instead of ellipsing.
 */
/** A real button now: clicking a history entry opens the page. */
export const entrySummary = style({
    display: "grid",
    gridTemplateColumns: "16px minmax(0, 1fr) auto auto",
    alignItems: "center",
    gap: "12px",
    padding: "9px 0",
    width: "100%",
    minWidth: 0,
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "inherit",
    font: "inherit",
    textAlign: "inherit",
});

export const entryHost = style({
    ...ANNO,
    color: vars.color.snowmelt,
    justifySelf: "end",
    maxWidth: "22ch",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    "@media": {
        // A host like developer.mozilla.org takes half a phone's width and
        // crushed the title to about twelve characters. In a day-grouped
        // archive the timestamp is the column worth keeping; the full address
        // is the row's hover title.
        "screen and (max-width: 560px)": { display: "none" },
    },
});

/** Fixed width so the timestamps form a true column down the day. */
export const entryStamp = style({
    ...ANNO,
    color: vars.color.ash,
    justifySelf: "end",
    minWidth: "7ch",
    textAlign: "right",
});

export const favicon = style({
    width: "16px",
    height: "16px",
    objectFit: "contain",
    flexShrink: 0,
    color: vars.color.ash,
});

export const entryTitle = style({
    flex: 1,
    minWidth: 0,
    fontSize: "13px",
    fontWeight: 500,
    color: vars.color.firn,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

/**
 * Revealed on row hover, row focus-within, and unconditionally where there is
 * no hover to trigger it — `display: none` until hover would be the keyboard
 * trap DESIGN.md records.
 */
export const deleteBtn = style({
    position: "relative",
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
        "&::after": hitArea(),
        [`${entry}:hover &, ${entry}:focus-within &`]: {
            opacity: 1,
            pointerEvents: "auto",
        },
        "&:hover, &:focus-visible": { color: vars.color.wine },
    },
    "@media": {
        "(hover: none)": { opacity: 1, pointerEvents: "auto" },
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
    color: vars.color.snowmelt,
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
    color: vars.color.cobalt,
    textTransform: "uppercase",
    selectors: {
        "&:hover": { color: vars.color.cobalt },
    },
});
