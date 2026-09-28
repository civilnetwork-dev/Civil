import { keyframes, style } from "@vanilla-extract/css";

import { blend, EASE, GROUND } from "./material.css";
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
 * The loading screen is the favicon, animated: the C stands still and the route
 * arrives through its mouth.
 *
 * This is the wordmark's own idea at glyph scale. There, one route runs *behind*
 * five letters and is visible only where a letter opens for it. Here the nodes
 * are painted **before** the C, so the letter's own material occludes them and
 * they surface only in the mouth and the counter — the occlusion is paint order,
 * not a clip path or a mask. Each node then slides under the stem and is
 * absorbed, which is what "routed through" looks like when you draw it.
 *
 * What this replaced, in order: a Lottie canvas playing artwork from the retired
 * design through a WASM player and a network fetch, and then a strata core log
 * that was on-palette but said nothing about what the app does.
 *
 * Only `transform` and `opacity` animate. Target hardware is low-end school
 * Chromebooks and DESIGN.md permits those two plus `grid-template-rows` —
 * nothing here blurs, blends, or draws to a canvas. `prefers-reduced-motion` is
 * handled globally in `global.css.ts`, which collapses the duration rather than
 * disabling the animation, so this still reaches its final frame.
 *
 * DESIGN.md forbids motion at rest or on a timer. A loader is the explicit
 * exception: progress must be conveyed.
 */
const arrive = keyframes({
    // Outside the glyph entirely, and invisible while it is.
    "0%": { transform: "translateX(3.6px)", opacity: 0 },
    // At rest the node spans the mouth exactly, 11.24 → 14.74, the depth of the
    // C's cut terminals. Sized to the opening rather than to a round number: a
    // shorter node reads as a dot passing a gap instead of the route filling it.
    "20%": { transform: "translateX(0)", opacity: 1 },
    // Crossing the counter.
    "70%": { transform: "translateX(-6.1px)", opacity: 1 },
    // Absorbed into the stem, whose inner edge is at 4.19.
    "88%, 100%": { transform: "translateX(-7.05px)", opacity: 0 },
});

/** The mark's own 16-unit grid, blown up. */
export const loadingMark = style({
    width: "132px",
    height: "132px",
    display: "block",
    overflow: "visible",
});

export const loadingMarkC = style({
    fill: vars.color.cobalt,
});

/**
 * The C is a solid like every glyph: a copy sunk toward basalt sits a
 * fraction down and right of the face, painted after the nodes so the
 * letter's thickness hides the route too. Static, so it costs one path.
 */
export const loadingMarkDepth = style({
    fill: `color-mix(in oklab, ${vars.color.cobalt} 40%, ${vars.color.basalt})`,
    transform: "translate(0.3px, 0.5px)",
});

/**
 * `translateX` values in the keyframes are in the SVG's own user units, not
 * screen pixels — the element sits inside a `viewBox`, so `px` in a transform
 * resolves against the user coordinate system. That is why 6.1 moves a node
 * most of the way across a 16-wide glyph rather than six screen pixels.
 */
export const loadingMarkNode = style({
    fill: vars.color.firn,
    animationName: arrive,
    animationDuration: "2.4s",
    animationIterationCount: "infinite",
    animationTimingFunction: EASE.standard,
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
