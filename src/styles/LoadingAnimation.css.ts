import { keyframes, style } from "@vanilla-extract/css";

import { blend, GROUND } from "./material.css";
import { FONT_SANS } from "./schematic.css";
import { vars } from "./theme.css";

export const loadingContainer = style(
    blend(GROUND, {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        padding: "1.5rem 2rem",
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        zIndex: 100,
        opacity: 1,
        transition: "opacity 600ms cubic-bezier(0.86, 0, 0.07, 1)",
        transitionDuration: "600ms",
    }),
);

/* -------------------------------------------------------------------- */
/* The mark, arriving                                                    */
/* -------------------------------------------------------------------- */

/**
 * The loading screen is the favicon, animated: the stone stands still and
 * traffic crosses its lit door.
 *
 * The nodes are painted **after** the door's light and **before** the stone, so
 * the stone's own material occludes them and they surface only in the door:
 * the occlusion is paint order, not a clip path or a mask. Each node leaves
 * from behind the left pier, crosses the light as a silhouette and goes behind
 * the right pier, which is what "through the wall" looks like when you draw
 * it. The nodes run at the height of the third course, between two joints, so
 * the joints never show a node passing behind the stone.
 *
 * What this replaced, in order: a Lottie canvas playing artwork from the retired
 * design through a WASM player and a network fetch, a strata core log that was
 * on-palette but said nothing about what the app does, and a route arriving
 * through the mouth of the retired lockup's C.
 *
 * Only `transform` and `opacity` animate. Target hardware is low-end school
 * Chromebooks and DESIGN.md permits those two plus `grid-template-rows`:
 * nothing here blurs, blends, or draws to a canvas. `prefers-reduced-motion` is
 * handled globally in `global.css.ts`, which collapses the duration rather than
 * disabling the animation, so this still reaches its final frame.
 *
 * DESIGN.md forbids motion at rest or on a timer. A loader is the explicit
 * exception: progress must be conveyed.
 */
const cross = keyframes({
    // Hidden behind the left pier, which spans 2 → 6.
    "0%": { transform: "translateX(0)" },
    // Hidden behind the right pier, 10 → 14, having crossed the door between.
    "100%": { transform: "translateX(9.5px)" },
});

/** The mark's own 16-unit grid, blown up. */
export const loadingMark = style({
    width: "132px",
    height: "132px",
    display: "block",
    overflow: "visible",
});

export const loadingMarkStone = style({
    fill: vars.color.firn,
});

/** The light beyond the wall, painted first so the traffic crosses it. */
export const loadingMarkDoor = style({
    fill: vars.color.cobalt,
});

/**
 * The stone is a solid like every glyph: a copy sunk toward basalt sits a
 * fraction down and right of the face, painted after the nodes so the
 * stone's thickness hides the traffic too. Static, so it costs one path.
 */
export const loadingMarkDepth = style({
    fill: `color-mix(in oklab, ${vars.color.firn} 40%, ${vars.color.basalt})`,
    transform: "translate(0.3px, 0.5px)",
});

/**
 * `translateX` values in the keyframes are in the SVG's own user units, not
 * screen pixels: the element sits inside a `viewBox`, so `px` in a transform
 * resolves against the user coordinate system. That is why 9.5 carries a node
 * across most of a 16-wide mark rather than nine screen pixels.
 *
 * Basalt, so each node crosses the light as a silhouette. Linear, so three
 * staggered nodes read as one steady stream rather than three separate pulses.
 */
export const loadingMarkNode = style({
    fill: vars.color.basalt,
    animationName: cross,
    animationDuration: "2.4s",
    animationIterationCount: "infinite",
    animationTimingFunction: "linear",
});

/* -------------------------------------------------------------------- */
/* Status readout                                                        */
/* -------------------------------------------------------------------- */

export const loadingStatusWrapper = style({
    fontFamily: FONT_SANS,
    fontWeight: 500,
    fontSize: "0.9rem",
    letterSpacing: "0.01em",
    color: vars.color.firn,
    textAlign: "center",
    minWidth: "260px",
});

export const loadingStatus = style({
    transition: "opacity 400ms cubic-bezier(0.86, 0, 0.07, 1)",
    transitionDuration: "400ms",
});

export const loadingStatusShown = style({ opacity: 1 });
export const loadingStatusHidden = style({ opacity: 0 });
