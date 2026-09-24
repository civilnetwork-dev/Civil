import { style, styleVariants } from "@vanilla-extract/css";

import { DUR, EASE, hitArea } from "./material.css";
import { ANNO, FONT_SANS, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The state spine.
 *
 * Extensions is the only page in the app where every row carries a binary the
 * reader actually scans for — enabled or not. So that binary becomes the
 * drawing: a vertical spine down the left of each section with a node per
 * extension, filled when the extension is live and hollow when it is not.
 * "What is running right now" is answerable from the gutter alone, without
 * reading a single name.
 *
 * This is why the page does not reuse Bookmarks' call numbers or History's
 * hour meters: an extension's position in a list means nothing, and its
 * install time means almost nothing. Its state means everything.
 */

/* -------------------------------------------------------------------- */
/* Title block actions                                                   */
/* -------------------------------------------------------------------- */

export const titleActions = style({
    display: "flex",
    alignItems: "center",
    gap: "14px",
    flexWrap: "wrap",
});

const textBtnBase = style({
    ...ANNO,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "none",
    border: "none",
    borderBottom: RULE.hair,
    padding: "2px",
    cursor: "pointer",
    transitionProperty: "color, border-color, opacity",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&:disabled": { opacity: 0.45, cursor: "default" },
    },
});

export const textBtn = style([
    textBtnBase,
    {
        color: vars.color.snowmelt,
        selectors: {
            "&:not(:disabled):hover": {
                color: vars.color.firn,
                borderBottomColor: vars.color.cobalt,
            },
        },
    },
]);

/* -------------------------------------------------------------------- */
/* Intake                                                                */
/* -------------------------------------------------------------------- */

export const intake = style({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    margin: "20px 0 8px",
    padding: "12px 16px",
    border: RULE.major,
    borderRadius: "10px",
    background: vars.color.basalt,
    transitionProperty: "border-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.base,
    selectors: {
        "&:focus-within": { borderBottomColor: vars.color.cobalt },
    },
});

export const intakeLabel = style({
    ...ANNO,
    flexShrink: 0,
    whiteSpace: "nowrap",
});

export const intakeInput = style({
    flex: "1 1 260px",
    minWidth: 0,
    border: "none",
    background: "transparent",
    outline: "none",
    color: vars.color.firn,
    fontFamily: FONT_SANS,
    fontSize: "14px",
    caretColor: vars.color.cobalt,
    selectors: {
        "&::placeholder": { color: vars.color.ash },
        "&:focus-visible": { outline: "none" },
    },
});

/**
 * The file picker is a <label> wrapping a hidden <input type="file">, which is
 * the only way to restyle one. A label is not focusable, so the input keeps
 * its own focus ring rather than being `display: none` — that would drop it
 * out of the tab order and leave upload keyboard-unreachable.
 */
export const uploadLabel = style([
    textBtnBase,
    {
        position: "relative",
        color: vars.color.snowmelt,
        selectors: {
            "&:hover": {
                color: vars.color.firn,
                borderBottomColor: vars.color.cobalt,
            },
            "&:focus-within": {
                color: vars.color.firn,
                outline: `1px solid ${vars.color.cobalt}`,
                outlineOffset: "2px",
            },
        },
    },
]);

export const uploadInput = style({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    opacity: 0,
    cursor: "pointer",
});

/**
 * Install and update both run async against the network. Their outcome was
 * previously two bare <p>s with inline colours pointing at CSS variables that
 * do not exist (`--civil-color-red`, `--civil-color-text-muted`), so the text
 * rendered unstyled or off-palette — and nothing announced it, which on a
 * page whose only feedback is this line meant a screen reader user learned
 * nothing about whether an install worked.
 */
export const status = style({
    ...ANNO,
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    margin: "10px 0 0",
    minHeight: "15px",
});

export const statusTone = styleVariants({
    info: { color: vars.color.snowmelt },
    error: { color: vars.color.wine },
});

// The leading mark is decorative; the tone is already carried by the text
// itself and by colour, so this is a third channel rather than the only one.
export const statusMark = style({
    flexShrink: 0,
    width: "10px",
    height: "1px",
    marginTop: "7px",
    background: "currentColor",
});

/* -------------------------------------------------------------------- */
/* Section + spine                                                       */
/* -------------------------------------------------------------------- */

export const section = style({
    margin: "26px 0 0",
});

/**
 * The spine itself. It is drawn on the list rather than on each row so it runs
 * continuously between nodes instead of breaking at every gap, and it is inset
 * to sit under the centre of the node column.
 */
export const list = style({
    position: "relative",
    listStyle: "none",
    margin: "4px 0 0",
    padding: 0,
    selectors: {
        "&::before": {
            content: '""',
            position: "absolute",
            left: "5px",
            top: "16px",
            bottom: "16px",
            width: 0,
            borderLeft: RULE.hair,
        },
    },
});

export const row = style({
    position: "relative",
    display: "grid",
    gridTemplateColumns: "11px 26px 1fr auto auto auto",
    alignItems: "center",
    gap: "12px",
    padding: "12px 0",
    borderBottom: RULE.hair,
});

/**
 * The node on the spine. Filled means enabled. The fill is not the only signal
 * — the switch beside it carries the same state, and the row's own accessible
 * name does too — but it is the one that reads at a glance down the gutter.
 */
const nodeBase = style({
    width: "11px",
    height: "11px",
    borderRadius: "50%",
    // Punches the spine out from behind the node so the line appears to pass
    // between nodes rather than through them.
    boxShadow: `0 0 0 3px ${vars.color.stratum}`,
    transitionProperty: "background-color, border-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.base,
});

export const node = styleVariants({
    on: [
        nodeBase,
        {
            background: vars.color.cobalt,
            border: `1px solid ${vars.color.cobalt}`,
        },
    ],
    off: [
        nodeBase,
        {
            background: vars.color.stratum,
            border: `1px solid ${vars.color.talus}`,
        },
    ],
});

export const iconPlate = style({
    borderRadius: "8px",
    width: "26px",
    height: "26px",
    display: "grid",
    placeItems: "center",
    border: `0.5px solid ${vars.color.scree}`,
    color: vars.color.ash,
    overflow: "hidden",
});

export const iconImg = style({
    width: "18px",
    height: "18px",
    objectFit: "contain",
});

export const info = style({
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
});

export const name = style({
    fontSize: "13.5px",
    fontWeight: 500,
    color: vars.color.firn,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const meta = style({
    ...ANNO,
    color: vars.color.snowmelt,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

/**
 * The packaging format, as a stamp. crx and xpi differ in tone rather than
 * only in hue — aurora is lighter than arcturus — so they stay distinguishable
 * under deuteranopia, where the two would otherwise converge.
 */
const stampBase = style({
    ...ANNO,
    flexShrink: 0,
    padding: "2px 6px",
    fontSize: "12px",
});

export const stamp = styleVariants({
    crx: [
        stampBase,
        {
            color: vars.color.cobalt,
            border: `0.5px solid color-mix(in srgb, ${vars.color.cobalt} 45%, transparent)`,
        },
    ],
    xpi: [
        stampBase,
        {
            color: vars.color.sandstone,
            border: `0.5px solid color-mix(in srgb, ${vars.color.sandstone} 45%, transparent)`,
        },
    ],
});

/* -------------------------------------------------------------------- */
/* Switch                                                                */
/* -------------------------------------------------------------------- */

/**
 * A native checkbox drives this, kept in the tab order and merely made
 * transparent. The visible track and thumb are siblings that read its state
 * through `:checked`, so keyboard, assistive tech and forms all behave without
 * any of it being reimplemented in script.
 */
export const toggle = style({
    position: "relative",
    flexShrink: 0,
    display: "inline-grid",
    alignItems: "center",
    width: "34px",
    height: "18px",
    cursor: "pointer",
});

export const toggleInput = style({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    margin: 0,
    opacity: 0,
    cursor: "pointer",
});

export const toggleTrack = style({
    borderRadius: "20px",
    position: "absolute",
    inset: 0,
    border: `0.5px solid ${vars.color.talus}`,
    background: "transparent",
    transitionProperty: "border-color, background-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.base,
    selectors: {
        [`${toggleInput}:checked ~ &`]: {
            borderColor: vars.color.cobalt,
            background: `color-mix(in srgb, ${vars.color.cobalt} 18%, transparent)`,
        },
        // The ring has to live on the track: the input it belongs to is
        // transparent, so its own outline would be invisible.
        [`${toggleInput}:focus-visible ~ &`]: {
            outline: `1px solid ${vars.color.cobalt}`,
            outlineOffset: "2px",
        },
    },
});

export const toggleThumb = style({
    borderRadius: "50%",
    position: "absolute",
    top: "3px",
    left: "3px",
    width: "12px",
    height: "12px",
    background: vars.color.talus,
    transitionProperty: "transform, background-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.base,
    selectors: {
        [`${toggleInput}:checked ~ &`]: {
            transform: "translateX(16px)",
            background: vars.color.cobalt,
        },
    },
});

/* -------------------------------------------------------------------- */
/* Uninstall                                                             */
/* -------------------------------------------------------------------- */

export const removeBtn = style({
    position: "relative",
    flexShrink: 0,
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
    transitionProperty: "color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&::after": hitArea(),
        "&:hover, &:focus-visible": { color: vars.color.wine },
    },
});

// The armed state is a word, not a colour on an X. Uninstalling deletes the
// extension's stored files, and an icon cannot say "click again".
export const removeArmed = style([
    textBtnBase,
    {
        color: vars.color.firn,
        borderBottomColor: vars.color.wine,
        background: `color-mix(in srgb, ${vars.color.wine} 16%, transparent)`,
        padding: "2px 6px",
        whiteSpace: "nowrap",
    },
]);

/* -------------------------------------------------------------------- */
/* Empty                                                                 */
/* -------------------------------------------------------------------- */

export const empty = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "10px",
    padding: "34px 0 8px",
});
