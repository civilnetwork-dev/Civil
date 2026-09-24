/**
 * Shared low-level tokens: motion, one type recipe, and two geometry helpers.
 *
 * This module used to be the "Backlit Instrumentation" material language —
 * `edgeLit`, `SHADOW`, `glow()`, `focusRing()`, `lit()`, `machined()`,
 * `atmosphere()` and a grain wash, all built to make flat fills read as
 * machined objects under a light source.
 *
 * That metaphor is retired. The system draws hairlines on a ruled field now,
 * where depth comes from rules and alignment rather than from simulated light,
 * and DESIGN.md records the two as incompatible. Everything specific to it has
 * been deleted rather than left importable, because a dead export is an
 * invitation — `Select` was still pulling `SHADOW.attached` long after the rest
 * of the app had moved on.
 *
 * What survives is language-neutral and used everywhere:
 *
 *   - `EASE` / `DUR` — motion tokens. The codebase had 0.1/0.12/0.15/0.16/
 *     0.2/0.3s and four different easings scattered across twenty files with
 *     no rule; unevenness at that scale reads as sloppiness even when no
 *     single value is wrong.
 *   - `hairline()` — a rule that fades at both ends.
 *   - `hitArea()` — WCAG 2.5.8 target expansion without changing the visuals.
 */

import { vars } from "./theme.css";

/* -------------------------------------------------------------------- */
/* Motion                                                                */
/* -------------------------------------------------------------------- */

/**
 * Two easings, each with a job.
 * `standard` for state changes; `spring` for anything that should feel
 * physically seated when it lands (toggles, tiles, pop-ins).
 */
export const EASE = {
    standard: "cubic-bezier(0.4, 0, 0.2, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    /** Decelerate-only: entrances that shouldn't overshoot. */
    enter: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

/**
 * Three durations. `fast` is hover/press feedback on a control under the
 * cursor, `base` is a state change you're meant to notice, `slow` is a
 * whole-element entrance.
 */
export const DUR = {
    fast: "0.11s",
    base: "0.18s",
    slow: "0.28s",
} as const;

/* -------------------------------------------------------------------- */
/* Geometry helpers                                                      */
/* -------------------------------------------------------------------- */

/**
 * A hairline rule that fades at both ends, so a divider reads as etched
 * into the panel rather than drawn edge to edge with a ruler.
 *
 * Returns a gradient *value*, not a border shorthand, so it cannot sit in
 * `borderTop` directly — pair it with `borderImage`, as the ledger dividers do.
 */
export const hairline = (color: string = vars.color.talus) =>
    `linear-gradient(90deg, transparent 0%, ${color} 12%, ${color} 88%, transparent 100%)`;

/**
 * Expands an element's clickable area to at least `size`×`size` without
 * changing how big it looks or disturbing layout.
 *
 * DESIGN.md deliberately sizes icon controls at 18–30px for instrument-panel
 * density, but WCAG 2.2 SC 2.5.8 asks for a 24×24 minimum target. Rather than
 * inflate the visuals and lose the density, this centres an invisible
 * pseudo-element over the control and lets that catch the pointer.
 *
 * Spread into a `selectors` entry for `&::after`; the host needs a
 * non-static `position` so the overlay is measured against it.
 */
export const hitArea = (size = 24) =>
    ({
        content: '""',
        position: "absolute",
        top: "50%",
        left: "50%",
        width: `max(100%, ${size}px)`,
        height: `max(100%, ${size}px)`,
        transform: "translate(-50%, -50%)",
    }) as const;
