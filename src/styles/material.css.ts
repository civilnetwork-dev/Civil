/**
 * Shared material language — "Backlit Instrumentation".
 *
 * DESIGN.md's north star is a stealth cockpit: dense, precise, and quiet
 * enough to sit open on a shared screen. What the system described but never
 * actually rendered was *material*. Every surface was a flat fill, so the
 * panel read as dark rectangles rather than machined objects.
 *
 * This module supplies the missing physicality, all of it static (the system
 * forbids ambient motion) and all of it inside the Macchiato palette (it
 * forbids neon):
 *
 *   - `edgeLit` / `edgeLitStrong` — a hairline of light along a surface's top
 *     edge, the way light catches a milled edge. This is the single highest
 *     leverage detail in the set: it turns a filled rect into an object.
 *   - `SHADOW` — the shadow vocabulary from DESIGN.md, finally in one place
 *     instead of re-typed with drifting alpha values at each call site.
 *   - `EASE` / `DUR` — motion tokens. The codebase had 0.1/0.12/0.15/0.16/
 *     0.2/0.3s and four different easings scattered across twenty files with
 *     no rule; unevenness at that scale reads as sloppiness even when no
 *     single value is wrong.
 *   - `atmosphere()` — a page-level backdrop: one soft accent bloom plus a
 *     fine grain wash, so a full-page surface has a light source and a
 *     texture instead of being one flat colour.
 *   - `microLabel` — the Label type tier (12px/600/uppercase/0.06em) as a
 *     recipe, since it appears on nearly every page.
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
/* Elevation                                                             */
/* -------------------------------------------------------------------- */

/**
 * Structural elevation is always neutral black (DESIGN.md's
 * Colored-Glow-vs-Black-Shadow rule); accent glows live in `glow()`.
 */
export const SHADOW = {
    /** Cards and rows resting on the page. */
    resting: "0 1px 2px rgba(0, 0, 0, 0.28)",
    /** Cards lifted under the cursor. */
    lifted: "0 10px 26px -8px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.22)",
    /** Free-floating dropdowns and popovers. */
    menu: "0 14px 34px -10px rgba(0, 0, 0, 0.6), 0 3px 10px rgba(0, 0, 0, 0.28)",
    /**
     * Menus docked to a control (Select, omnibox suggestions).
     *
     * `menu` blurs ~7px upward, which lands right on the seam where the menu
     * meets its trigger and paints a dark band across a join that is supposed
     * to read as one continuous surface. Offset and negative spread are
     * balanced here so the shadow never reaches above the element's own top
     * edge: top = offsetY - spread - blur/2 = 16 + 10 - 15 = +11px.
     */
    attached: "0 16px 30px -10px rgba(0, 0, 0, 0.55)",
    /** Command palette / modal-scale surfaces. */
    overlay:
        "0 0 0 1px rgba(0, 0, 0, 0.4), 0 32px 70px -20px rgba(0, 0, 0, 0.7), 0 10px 26px rgba(0, 0, 0, 0.35)",
    /** The tab being dragged. */
    drag: "0 10px 26px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.3)",
} as const;

/** Interactive accent feedback — never structural elevation. */
export const glow = (accent: string, strength = 34) =>
    `0 6px 20px -4px color-mix(in srgb, ${accent} ${strength}%, transparent)`;

/** The focus ring used across every accent lane. */
export const focusRing = (accent: string) =>
    `0 0 0 3px color-mix(in srgb, ${accent} 22%, transparent)`;

/* -------------------------------------------------------------------- */
/* Surface material                                                      */
/* -------------------------------------------------------------------- */

/**
 * A hairline of light on the top edge and a matching shadow on the bottom.
 * Layered as insets so it composes with any real box-shadow on the element.
 */
export const edgeLit = {
    boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.045), inset 0 -1px 0 rgba(0, 0, 0, 0.22)`,
} as const;

export const edgeLitStrong = {
    boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.075), inset 0 -1px 0 rgba(0, 0, 0, 0.3)`,
} as const;

/** Compose the edge highlight with an outer shadow in one declaration. */
export const lit = (outer: string, strong = false) =>
    `${strong ? edgeLitStrong.boxShadow : edgeLit.boxShadow}, ${outer}`;

/**
 * A brushed, very slightly warmer fill for surfaces that should read as a
 * machined face rather than a hole in the page. The gradient is only a few
 * percent — at Macchiato's contrast it reads as a sheen, not a stripe.
 */
export const machined = (from: string, to: string) =>
    `linear-gradient(168deg, ${from} 0%, ${to} 100%)`;

/* -------------------------------------------------------------------- */
/* Atmosphere                                                            */
/* -------------------------------------------------------------------- */

/**
 * A fine luminance grain, as a data-URI SVG so it costs no request and
 * cannot be blocked. Two percent opacity: invisible as texture, but it
 * breaks up the flat fills that made large dark areas look like voids.
 */
const GRAIN =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

/**
 * Page backdrop: a soft off-centre bloom in the page's accent, a second
 * cooler bloom for depth, then grain over the top.
 *
 * Static by design — DESIGN.md forbids anything that animates at rest.
 */
export const atmosphere = (accent: string, intensity = 1) => ({
    backgroundColor: vars.color.base,
    backgroundImage: [
        `radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, ${accent} ${Math.round(
            7 * intensity,
        )}%, transparent) 0%, transparent 60%)`,
        `radial-gradient(80% 60% at 85% 110%, color-mix(in srgb, ${vars.color.mauve} ${Math.round(
            4 * intensity,
        )}%, transparent) 0%, transparent 70%)`,
        GRAIN,
    ].join(", "),
    backgroundAttachment: "fixed, fixed, fixed",
    backgroundBlendMode: "normal, normal, overlay",
});

/** Just the grain, for surfaces that already own their background. */
export const grainOverlay = {
    content: '""',
    position: "absolute",
    inset: 0,
    backgroundImage: GRAIN,
    opacity: 0.025,
    pointerEvents: "none",
    mixBlendMode: "overlay",
} as const;

/* -------------------------------------------------------------------- */
/* Type recipes                                                          */
/* -------------------------------------------------------------------- */

/**
 * DESIGN.md's Label tier.
 *
 * subtext0, not an Overlay tier: at 11px this is small text, so it needs
 * 4.5:1. Overlay 0 and 1 measure 3.15:1 and 4.14:1 on Base — both below the
 * floor. The tier still reads as quiet because it's small, tracked and
 * uppercase, not because it's dim.
 */
export const microLabel = {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.09em",
    textTransform: "uppercase",
    color: vars.color.subtext0,
} as const;

/** Numeric readouts: equal-width digits so columns never jitter. */
export const readout = {
    fontVariantNumeric: "tabular-nums",
    fontFeatureSettings: '"tnum" 1, "ss01" 1',
} as const;

/**
 * A hairline rule that fades at both ends, so a divider reads as etched
 * into the panel rather than drawn edge to edge with a ruler.
 */
export const hairline = (color: string = vars.color.surface1) =>
    `linear-gradient(90deg, transparent 0%, ${color} 12%, ${color} 88%, transparent 100%)`;

/* -------------------------------------------------------------------- */
/* Hit targets                                                           */
/* -------------------------------------------------------------------- */

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
