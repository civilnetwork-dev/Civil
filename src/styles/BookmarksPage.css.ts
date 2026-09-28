import { style, styleVariants } from "@vanilla-extract/css";

import {
    blend,
    DUR,
    EASE,
    edge,
    hitArea,
    KEY_STONE,
    LIFT,
    LIT,
    ROW_LIFT,
    SHADE,
    TABLET,
    WELL,
} from "./material.css";
import { ANNO } from "./schematic.css";
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
// A two-way switch carved as a track, with the chosen scope standing up out
// of it as a raised key.
export const scopeSwitch = style(
    blend(WELL, {
        display: "flex",
        alignItems: "stretch",
        gap: "3px",
        padding: "3px",
        borderRadius: "12px",
    }),
);

const scopeBtnBase = style({
    ...ANNO,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "7px 12px",
    background: "none",
    border: "none",
    borderRadius: "9px",
    cursor: "pointer",
    transition: LIFT,
    selectors: {
        "&:hover": { color: vars.color.firn },
    },
});

const SCOPE_ON = `color-mix(in oklab, ${vars.color.cobalt} 24%, ${vars.color.scree})`;

/**
 * The selected scope is carried by `aria-pressed` for assistive tech, and here
 * by a colour shift, a filled face and its height: three visual channels, so
 * the state does not rest on colour alone (DESIGN.md's Redundant-Channel
 * Rule).
 */
export const scopeBtn = styleVariants({
    off: [scopeBtnBase, { color: vars.color.ash }],
    on: [
        scopeBtnBase,
        {
            color: vars.color.firn,
            backgroundColor: SCOPE_ON,
            backgroundImage: LIT,
            boxShadow: `${SHADE.lip}, ${edge(2)}`,
        },
    ],
});

/* -------------------------------------------------------------------- */
/* Lookup                                                                */
/* -------------------------------------------------------------------- */

/**
 * Search is the primary control on a register — the whole point of numbering
 * and aligning entries is to find one — so it gets a labelled full-width row
 * rather than History's compact inline filter.
 */
export const lookup = style(
    blend(WELL, {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        margin: "22px 0 12px",
        padding: "12px 16px",
        borderRadius: "12px",
    }),
);

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

// The register is a tablet the rows are cut into. The list is always in the
// DOM, so with nothing to hold it would stand as a bare slab: it leaves the
// page instead.
export const register = style(
    blend(TABLET, {
        listStyle: "none",
        margin: "8px 0 0",
        padding: "6px",
        borderRadius: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        selectors: { "&:empty": { display: "none" } },
    }),
);

/**
 * The `28px` end column holds the remove control; the rest is the open
 * target. The call-number column went in the minimal pass — fake catalogue
 * numbers were decoration pretending to be data.
 */
export const row = style(
    blend(ROW_LIFT, {
        display: "grid",
        gridTemplateColumns: "1fr 28px",
        alignItems: "center",
        gap: "12px",
        paddingRight: "6px",
    }),
);

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
    padding: "10px 10px",
    background: "none",
    border: "none",
    borderRadius: "10px",
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

// Each favicon sits in a small carved socket.
export const stamp = style(
    blend(WELL, {
        width: "24px",
        height: "24px",
        display: "grid",
        placeItems: "center",
        borderRadius: "7px",
        overflow: "hidden",
    }),
);

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
    borderRadius: "6px",
    background: "none",
    color: vars.color.ash,
    cursor: "pointer",
    opacity: 0,
    transitionProperty: "opacity, color, background-color",
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
        "&:hover, &:focus-visible": {
            color: vars.color.wine,
            background: `color-mix(in srgb, ${vars.color.wine} 16%, transparent)`,
        },
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
