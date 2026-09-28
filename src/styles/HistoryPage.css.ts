import { style } from "@vanilla-extract/css";

import {
    blend,
    DUR,
    EASE,
    hitArea,
    KEY_STONE,
    KEYCAP_FACE,
    ROW_LIFT,
    TABLET,
    WELL,
} from "./material.css";
import { ANNO } from "./schematic.css";
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

export const filterField = style(
    blend(WELL, {
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flex: "1 1 260px",
        maxWidth: "420px",
        padding: "12px 16px",
        borderRadius: "12px",
    }),
);

// The shortcut is advertised on the control it operates, drawn as the key it
// names, and steps aside as soon as there's a query to clear.
export const filterHint = style(
    blend(KEYCAP_FACE, {
        ...ANNO,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        width: "18px",
        height: "18px",
        borderRadius: "5px",
        fontSize: "12px",
        transition: `opacity ${DUR.base} ${EASE.standard}`,
        selectors: {
            [`${filterField}:focus-within &`]: { opacity: 0 },
        },
    }),
);

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
            // Each hour is a small raised column: lit along its top edge.
            borderRadius: "2px 2px 0 0",
            boxShadow: `inset 0 1px 0 color-mix(in srgb, ${vars.color.firn} 22%, transparent)`,
            transitionProperty: "background, transform",
            transitionTimingFunction: EASE.standard,
            transitionDuration: DUR.fast,
            transformOrigin: "bottom",
        },
    },
});

// ember is non-text — this bar is a tick, not a label — so it clears the
// 3:1 threshold rather than needing 4.5:1.
export const dayMeterBarOn = style({
    selectors: {
        "&::after": { background: vars.color.ash },
        "&:hover::after": {
            background: vars.color.cobalt,
            transform: "scaleY(1.12)",
        },
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

// A day's pages sit on one tablet; each row lifts out of it under the pointer.
export const entries = style(
    blend(TABLET, {
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        padding: "6px",
        borderRadius: "16px",
    }),
);

/**
 * A ruled row, not a `Plate`.
 *
 * The plate drew corner ticks at the full width of the sheet while the row's
 * content sat in the left third, so each entry left an orphan tick floating in
 * empty space on the right. Bookmarks and Extensions already rule their rows
 * apart; this is the same grammar, which is the point of having one.
 */
export const entry = style(
    blend(ROW_LIFT, {
        display: "grid",
        gridTemplateColumns: "1fr 28px",
        alignItems: "center",
        gap: "8px",
        padding: "0 6px 0 10px",
    }),
);

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
    borderRadius: "6px",
    cursor: "pointer",
    color: vars.color.ash,
    opacity: 0,
    pointerEvents: "none",
    transition: `opacity ${DUR.fast} ${EASE.standard}, background-color ${DUR.fast} ${EASE.standard}`,
    selectors: {
        "&::after": hitArea(),
        [`${entry}:hover &, ${entry}:focus-within &`]: {
            opacity: 1,
            pointerEvents: "auto",
        },
        "&:hover, &:focus-visible": {
            color: vars.color.wine,
            background: `color-mix(in srgb, ${vars.color.wine} 16%, transparent)`,
        },
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
export const emptyAction = style(
    blend(KEY_STONE, {
        ...ANNO,
        border: "none",
        borderRadius: "9px",
        padding: "6px 11px",
        cursor: "pointer",
        color: vars.color.cobalt,
    }),
);
