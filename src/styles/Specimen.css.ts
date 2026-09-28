import {
    createVar,
    globalStyle,
    keyframes,
    style,
    styleVariants,
} from "@vanilla-extract/css";

import * as layer from "./icons.css";
import { alpha, EASE, edge, GRAIN, mix, SHADE } from "./material.css";
import { vars } from "./theme.css";

/**
 * A mineral specimen: one glyph raised out of a polished, grained tile.
 *
 * The tile is a palette tone lit from the upper left, banded down its side in
 * the same tone sunk toward basalt, so a cobalt specimen reads as one piece of
 * cobalt stone rather than as a coloured square with a shadow. The glyph is
 * not drawn in layers here: `#civil-emboss` (declared in Document.tsx) lights
 * it with textured specular relief and a hard drop instead.
 *
 * Hovering the tile, or the link or button it sits in, turns the tile to face
 * the pointer (Specimen.tsx follows it), lifts the glyph on its own plane and
 * sweeps a sheen across the face. Keyboard focus on that control does the
 * same, turned toward the lower right.
 */

const hi = createVar();
const face = createVar();
const band = createVar();
const deep = createVar();
const ink = createVar();

const { basalt, firn } = vars.color;

const SHEEN = `linear-gradient(115deg, transparent 38%, ${alpha(firn, 32)} 50%, transparent 62%)`;
const LIT = `radial-gradient(120% 95% at 28% 12%, ${hi}, ${face} 48%, ${band})`;

const polish = [
    `inset 0 1.5px 0 ${alpha(firn, 38)}`,
    `inset 0 -2px 5px ${alpha(basalt, 30)}`,
];

const SHEEN_REST = "130% 0, 0 0, 0 0";
const SHEEN_SWEPT = "-30% 0, 0 0, 0 0";

const TILT_MS = 420;
const EDGE_SLOTS = 7;

/**
 * The hover target. It is never transformed, so the tile tilting inside it
 * cannot pull the hit box out from under the pointer; a tile that tilted
 * under its own :hover would lose the pointer at its receding edge, settle,
 * catch it again, and shudder. Tint and size are set here and inherited.
 */
export const mount = style({
    display: "inline-grid",
    flexShrink: 0,
});

export const specimen = style({
    position: "relative",
    display: "inline-grid",
    placeItems: "center",
    width: "var(--specimen-size, 56px)",
    height: "var(--specimen-size, 56px)",
    borderRadius: "30%",
    color: ink,
    backgroundColor: face,
    backgroundImage: `${SHEEN}, ${GRAIN}, ${LIT}`,
    backgroundSize: "260% 100%, auto, auto",
    backgroundPosition: SHEEN_REST,
    backgroundRepeat: "no-repeat, repeat, no-repeat",
    boxShadow: [...polish, edge(5, band, deep, SHADE.near, EDGE_SLOTS)].join(
        ", ",
    ),
    transformStyle: "preserve-3d",
    // At rest the transform carries the same functions as the tilt, at zero,
    // so the two interpolate function by function. Tilting out of `none`
    // makes the browser interpolate perspective from infinity, which jumps.
    transform: "perspective(360px) translateY(0) rotateX(0deg) rotateY(0deg)",
    // Leaving a hover, the sheen snaps back off the tile (it is out of view at
    // both ends) instead of sweeping backwards across it.
    transition: [
        `transform ${TILT_MS}ms ${EASE.enter}`,
        `box-shadow ${TILT_MS}ms ${EASE.enter}`,
        "background-position 0s",
    ].join(", "),
});

// The emboss sits on the glyph's own <svg>, where it works in CSS pixels. On
// a group inside it, it worked in the glyph's 16-unit grid, and while the
// glyph's paths moved on hover in a tilted tile, Chrome rastered that group
// at about one device pixel per unit: the glyph turned to blocks until the
// motion settled.
export const glyph = style({
    transform: "translateZ(0)",
    filter: "url(#civil-emboss)",
    transition: `transform ${TILT_MS}ms ${EASE.enter}`,
});

// --tilt-x and --tilt-y come from Specimen.tsx while a pointer is over the
// host. Without one (keyboard focus, touch, reduced motion) the tile turns
// toward the lower right.
const tilted = {
    transform:
        "perspective(360px) translateY(-3px) rotateX(var(--tilt-x, 12deg)) rotateY(var(--tilt-y, -12deg))",
    backgroundPosition: SHEEN_SWEPT,
    boxShadow: [
        ...polish,
        edge(EDGE_SLOTS, band, deep, SHADE.far, EDGE_SLOTS),
    ].join(", "),
    transition: [
        `transform ${TILT_MS}ms ${EASE.enter}`,
        `box-shadow ${TILT_MS}ms ${EASE.enter}`,
        `background-position 900ms ${EASE.enter}`,
    ].join(", "),
};
const risen = { transform: "translateZ(10px)" };

// Hosts: the mount itself, or the link or button a specimen sits in.
const HOVER = `.${mount}:hover .${specimen}, :is(a, button):hover .${specimen}`;
const FOCUS = `:is(a, button):focus-visible .${specimen}`;

globalStyle(HOVER, { "@media": { "(hover: hover)": tilted } });
globalStyle(FOCUS, tilted);
globalStyle(
    `.${mount}:hover .${glyph}, :is(a, button):hover .${specimen} .${glyph}`,
    { "@media": { "(hover: hover)": risen } },
);
globalStyle(`${FOCUS} .${glyph}`, risen);

// The emboss filter supplies the glyph's relief, so the small-glyph layers
// would only double it.
globalStyle(`.${specimen} .${layer.depth}, .${specimen} .${layer.rim}`, {
    display: "none",
});

/**
 * A sheen that passes on its own now and then, for the one specimen a page
 * leads with. It rests for most of the cycle, so the page stays calm.
 */
const pass = keyframes({
    "0%, 80%": { backgroundPosition: SHEEN_REST },
    "100%": { backgroundPosition: SHEEN_SWEPT },
});

export const idle = style({
    animation: `${pass} 14s ${EASE.standard} infinite`,
});

/**
 * Tints are palette tones, never new colours. Light minerals take a basalt
 * inlay for their glyph; dark and saturated ones a firn glyph.
 */
const tone = (color: string, glyphInk: string) => ({
    vars: {
        [hi]: mix(color, 58, firn),
        [face]: color,
        [band]: mix(color, 62, basalt),
        [deep]: mix(color, 36, basalt),
        [ink]: glyphInk,
    },
});

export const tint = styleVariants({
    cobalt: tone(vars.color.cobalt, firn),
    stone: tone(vars.color.talus, firn),
    juniper: tone(vars.color.juniper, basalt),
    calcite: tone(vars.color.calcite, basalt),
    sandstone: tone(vars.color.sandstone, basalt),
    wine: tone(vars.color.wine, firn),
});
