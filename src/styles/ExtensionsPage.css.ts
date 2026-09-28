import { style, styleVariants } from "@vanilla-extract/css";

import {
    blend,
    GLINT,
    DUR,
    EASE,
    hitArea,
    KEY_STONE,
    LIT,
    ROW_LIFT,
    SHADE,
    TABLET,
    WELL,
} from "./material.css";
import { ANNO, FONT_SANS } from "./schematic.css";
import { vars } from "./theme.css";

const alpha = (color: string, pct: number) =>
    `color-mix(in srgb, ${color} ${pct}%, transparent)`;
const mix = (a: string, pct: number, b: string) =>
    `color-mix(in oklab, ${a} ${pct}%, ${b})`;

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

// Every text action on the page is a stone key.
const textBtnBase = style(
    blend(KEY_STONE, {
        ...ANNO,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        border: "none",
        borderRadius: "9px",
        padding: "6px 11px",
        cursor: "pointer",
        selectors: {
            "&:disabled": { opacity: 0.45, cursor: "default" },
        },
    }),
);

export const textBtn = style([
    textBtnBase,
    {
        color: vars.color.snowmelt,
        selectors: {
            "&:not(:disabled):hover": { color: vars.color.firn },
        },
    },
]);

/* -------------------------------------------------------------------- */
/* Intake                                                                */
/* -------------------------------------------------------------------- */

export const intake = style(
    blend(WELL, {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
        margin: "20px 0 8px",
        padding: "10px 12px 10px 16px",
        borderRadius: "14px",
    }),
);

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
            "&:hover": { color: vars.color.firn },
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

const TABLET_FACE = mix(vars.color.scree, 70, vars.color.stratum);

/**
 * The spine itself. It is drawn on the list rather than on each row so it runs
 * continuously between nodes instead of breaking at every gap, and it is inset
 * to sit under the centre of the node column. The list is a tablet, so the
 * spine is a groove cut down its face.
 */
export const list = style(
    blend(TABLET, {
        position: "relative",
        listStyle: "none",
        margin: "8px 0 0",
        padding: "6px",
        borderRadius: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        selectors: {
            "&::before": {
                content: '""',
                position: "absolute",
                left: "21px",
                top: "24px",
                bottom: "24px",
                width: 0,
                borderLeft: `1px solid ${alpha(vars.color.basalt, 60)}`,
                boxShadow: `1px 0 0 ${alpha(vars.color.firn, 6)}`,
            },
        },
    }),
);

export const row = style(
    blend(ROW_LIFT, {
        display: "grid",
        gridTemplateColumns: "11px 26px 1fr auto auto auto",
        alignItems: "center",
        gap: "12px",
        padding: "12px 10px",
    }),
);

/**
 * The node on the spine. Filled means enabled. The fill is not the only signal
 * — the switch beside it carries the same state, and the row's own accessible
 * name does too — but it is the one that reads at a glance down the gutter.
 *
 * A live extension is a polished cobalt gem set in the groove; a disabled one
 * is the empty socket it would sit in.
 */
const nodeBase = style({
    width: "11px",
    height: "11px",
    borderRadius: "50%",
    backgroundImage: GLINT,
    transitionProperty: "background-color, box-shadow",
    transitionTimingFunction: EASE.enter,
    transitionDuration: DUR.lift,
});

// Punches the spine out from behind the node so the line appears to pass
// between nodes rather than through them. Both states carry the same four
// layers (punch, drop, socket shade, socket rim) so the change fades.
const PUNCH = `0 0 0 3px ${TABLET_FACE}`;
const nodeShadow = (drop: number, socket: number) =>
    [
        PUNCH,
        `0 2px 3px ${alpha(vars.color.basalt, drop)}`,
        `inset 0 1px 2px color-mix(in srgb, black ${socket * 0.6}%, transparent)`,
        `inset 0 0 0 1px ${alpha(vars.color.talus, socket * 0.7)}`,
    ].join(", ");

export const node = styleVariants({
    on: [
        nodeBase,
        { backgroundColor: vars.color.cobalt, boxShadow: nodeShadow(80, 0) },
    ],
    off: [
        nodeBase,
        { backgroundColor: vars.color.basalt, boxShadow: nodeShadow(0, 100) },
    ],
});

// The extension's icon sits in a small carved socket.
export const iconPlate = style(
    blend(WELL, {
        borderRadius: "8px",
        width: "26px",
        height: "26px",
        display: "grid",
        placeItems: "center",
        color: vars.color.ash,
        overflow: "hidden",
    }),
);

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
    padding: "2px 7px",
    fontSize: "12px",
    borderRadius: "6px",
    boxShadow: SHADE.lip,
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

// The switch moved to the shared kit (schematic.css.ts) once Settings
// needed it too; these names stay so the page's markup is unchanged.
export { toggle, toggleInput, toggleThumb, toggleTrack } from "./schematic.css";

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
    transitionProperty: "color, background-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&::after": hitArea(),
        "&:hover, &:focus-visible": {
            color: vars.color.wine,
            background: alpha(vars.color.wine, 16),
        },
    },
});

const ARMED = mix(vars.color.wine, 30, vars.color.scree);

// The armed state is a word, not a colour on an X. Uninstalling deletes the
// extension's stored files, and an icon cannot say "click again".
export const removeArmed = style([
    textBtnBase,
    {
        color: vars.color.firn,
        backgroundColor: ARMED,
        backgroundImage: LIT,
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
