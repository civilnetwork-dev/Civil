import { style, styleVariants } from "@vanilla-extract/css";
import { DUR, EASE, hitArea } from "./material.css";
import { ANNO, FONT_MONO, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The index register.
 *
 * History's axis is time, so it draws hour meters under day rules. A bookmark
 * has no interesting time axis — it is an address someone chose to keep — so
 * this page is a register instead: a sequential call number, a stamped
 * favicon, the title, and the host as its own aligned column. The call numbers
 * give the page its vertical rhythm and make "how many, and where am I in
 * them" answerable without counting rows.
 *
 * Call numbers are positional, not identity. They renumber when the scope or
 * the search changes, because they describe the current view — which is the
 * question a register answers.
 */

/* -------------------------------------------------------------------- */
/* Title block actions                                                   */
/* -------------------------------------------------------------------- */

export const titleActions = style({
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
});

/**
 * The scope selector, which replaced a full-height sidebar holding two links.
 * A sidebar is a lot of structure to spend on a binary, and it was the only
 * page in the app not built from Sheet + TitleBlock.
 */
export const scopeSwitch = style({
    display: "flex",
    alignItems: "stretch",
    border: `0.5px solid ${vars.color.scree}`,
});

const scopeBtnBase = style({
    ...ANNO,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "5px 10px",
    background: "none",
    border: "none",
    cursor: "pointer",
    textTransform: "uppercase",
    transitionProperty: "color, background-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&:not(:first-child)": { borderLeft: RULE.hair },
    },
});

/**
 * The selected scope is carried by `aria-pressed` for assistive tech, and here
 * by both a colour shift and a filled ground — two visual channels, so the
 * state does not rest on colour alone (DESIGN.md's Redundant-Channel Rule).
 */
export const scopeBtn = styleVariants({
    off: [scopeBtnBase, { color: vars.color.ash }],
    on: [
        scopeBtnBase,
        {
            color: vars.color.firn,
            background: `color-mix(in srgb, ${vars.color.cobalt} 14%, transparent)`,
        },
    ],
});

// Text-button recipe shared with History's clearBtn: antares is the system's
// destructive tier.
export const clearBtn = style({
    ...ANNO,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "none",
    border: "none",
    borderBottom: RULE.hair,
    padding: "2px",
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

export const clearBtnArmed = style({
    color: vars.color.firn,
    borderBottomColor: vars.color.wine,
    background: `color-mix(in srgb, ${vars.color.wine} 16%, transparent)`,
    padding: "2px 6px",
});

/* -------------------------------------------------------------------- */
/* Lookup                                                                */
/* -------------------------------------------------------------------- */

/**
 * Search is the primary control on a register — the whole point of numbering
 * and aligning entries is to find one — so it gets a labelled full-width row
 * rather than History's compact inline filter.
 */
export const lookup = style({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    margin: "22px 0 10px",
    paddingBottom: "8px",
    borderBottom: RULE.hair,
    transitionProperty: "border-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.base,
    selectors: {
        "&:focus-within": { borderBottomColor: vars.color.cobalt },
    },
});

// ember colours a glyph, not text, so 1.4.11's non-text 3:1 applies rather
// than 1.4.3's 4.5:1.
export const lookupIcon = style({
    flexShrink: 0,
    color: vars.color.ash,
    transition: `color ${DUR.base} ${EASE.standard}`,
    selectors: {
        [`${lookup}:focus-within &`]: { color: vars.color.cobalt },
    },
});

export const lookupInput = style({
    flex: 1,
    minWidth: 0,
    border: "none",
    background: "transparent",
    outline: "none",
    color: vars.color.firn,
    fontFamily: FONT_MONO,
    fontSize: "14px",
    caretColor: vars.color.cobalt,
    selectors: {
        "&::placeholder": { color: vars.color.ash },
    },
});

export const lookupClear = style({
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
 * The count is one text node, not a row of separately-styled number and word
 * spans. Splitting it would leave no whitespace between the parts in the DOM,
 * and a live region announces `textContent` — History shipped exactly that bug
 * and now needs a hidden sibling to work around it.
 */
export const lookupCount = style({
    ...ANNO,
    flexShrink: 0,
    color: vars.color.snowmelt,
    whiteSpace: "nowrap",
});

/* -------------------------------------------------------------------- */
/* Register                                                              */
/* -------------------------------------------------------------------- */

export const register = style({
    listStyle: "none",
    margin: "6px 0 0",
    padding: 0,
});

/**
 * The `28px` end column holds the remove control; the rest is the open
 * target. The call-number column went in the minimal pass — fake catalogue
 * numbers were decoration pretending to be data.
 */
export const row = style({
    position: "relative",
    display: "grid",
    gridTemplateColumns: "1fr 28px",
    alignItems: "center",
    gap: "12px",
    borderBottom: RULE.hair,
});

/**
 * The open target is a real `<button>`, and the remove control is its sibling
 * rather than its child. The previous card was a `<div>` with an `onClick` and
 * two biome suppressions: unreachable by keyboard, invisible to assistive tech,
 * and it could not have nested the remove button legally anyway.
 */
export const openBtn = style({
    display: "grid",
    // minmax(0, 1fr) so a long title ellipses instead of pushing the date
    // column off the sheet — a grid track's default minimum is its content.
    gridTemplateColumns: "22px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    minWidth: 0,
    padding: "11px 0",
    background: "none",
    border: "none",
    textAlign: "left",
    cursor: "pointer",
    outline: "none",
    selectors: {
        // The row mark is the hover affordance; focus needs its own visible
        // indicator that does not depend on the pointer being anywhere.
        "&:focus-visible": {
            outline: `1px solid ${vars.color.cobalt}`,
            outlineOffset: "2px",
        },
    },
});

export const stamp = style({
    width: "22px",
    height: "22px",
    display: "grid",
    placeItems: "center",
    border: `0.5px solid ${vars.color.scree}`,
    overflow: "hidden",
});

export const stampImg = style({
    width: "14px",
    height: "14px",
    objectFit: "contain",
});

export const stampFallback = style([stamp, { color: vars.color.ash }]);

export const entry = style({
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
});

export const entryTitle = style({
    fontSize: "13.5px",
    fontWeight: 500,
    color: vars.color.firn,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    transition: `color ${DUR.fast} ${EASE.standard}`,
    selectors: {
        [`${openBtn}:hover &`]: { color: vars.color.cobalt },
    },
});

export const entryUrl = style({
    ...ANNO,
    color: vars.color.snowmelt,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const entryAdded = style({
    ...ANNO,
    color: vars.color.snowmelt,
    justifySelf: "end",
    whiteSpace: "nowrap",
    paddingLeft: "16px",
});

export const removeBtn = style({
    position: "relative",
    display: "grid",
    placeItems: "center",
    width: "24px",
    height: "24px",
    padding: 0,
    border: "none",
    background: "none",
    color: vars.color.ash,
    cursor: "pointer",
    opacity: 0,
    transitionProperty: "opacity, color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&::after": hitArea(),
        // Revealed on hover for tidiness, but never hidden from keyboard users
        // or from touch, where there is no hover state to trigger it.
        //
        // `:focus-within` on the row is what covers the keyboard, and it has to
        // be here rather than only `&:focus-visible`: with just the latter the
        // control stays invisible while focus sits on the open button beside
        // it, so the next Tab lands on something the user never saw.
        [`${row}:hover &, ${row}:focus-within &, &:focus-visible`]: {
            opacity: 1,
        },
        "&:hover, &:focus-visible": { color: vars.color.wine },
    },
    // Touch has no hover state to reveal the control, so it is always shown
    // there. Keyboard is covered by the :focus-visible selector above.
    "@media": {
        "(hover: none)": { opacity: 1 },
    },
});

/* -------------------------------------------------------------------- */
/* Empty                                                                 */
/* -------------------------------------------------------------------- */

export const empty = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "12px",
    padding: "34px 0 8px",
});

export const emptyAction = style({
    ...ANNO,
    background: "none",
    border: "none",
    borderBottom: `0.5px solid ${vars.color.cobalt}`,
    padding: "2px",
    cursor: "pointer",
    color: vars.color.cobalt,
    textTransform: "uppercase",
});
