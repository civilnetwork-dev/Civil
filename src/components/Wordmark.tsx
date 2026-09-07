import type { JSX } from "@solidjs/web";

import { vars } from "~/styles/theme.css";

/**
 * The Civil wordmark — five custom-drawn letters, each carrying a proxy icon
 * inside its own form rather than beside it.
 *
 * | letter | icon | reading |
 * |---|---|---|
 * | C | a ring opened by a wedge that widens outward | the way through |
 * | I | a keyhole punched through the stem | privacy |
 * | V | a funnel: converging arms and a neck | filtering |
 * | I | three bars widening downward | the relay |
 * | L | a port cut into the foot's outer edge | the connection |
 *
 * ## No typeface, and no relatives
 *
 * Nothing here is set in a font. The letters are drawn on one skeleton —
 * even-weight 20-unit slabs, cap 14→82 — and every icon is **subtractive**: a
 * wedge, a keyhole, a counter, a slot, a port. That is the whole grammar, and
 * it is deliberately the inverse of the UI icon set in `components/icons`,
 * which is additive hairline outline on a 16px grid at 45° only. The wordmark
 * uses curves, solid mass, and negative space; the icon set uses none of them.
 *
 * ## What the earlier versions got wrong, so it is not repeated
 *
 * Six treatments were rendered and compared before this one:
 *
 * - **Tapered stems** (wide at the cap, narrow at the base) made both I's read
 *   as chess pawns, and the second one as a control tower.
 * - **Protruding icons** — key teeth, plug prongs, antenna arcs bolted to a
 *   serif — rendered as thin tapering shards that read as glitches, not
 *   objects, and one of them collided with the next letter.
 * - **Small square notches** cut into serif ends read as castle crenellation.
 * - **Changing an I's silhouette breaks the letter.** A round bow on top reads
 *   as lowercase "i"; a broad beam on top reads as "T". Both were tried; both
 *   spelled something other than CIVIL. The I's therefore keep plain slab
 *   silhouettes and carry their icons entirely in punched negative space.
 * - **A detached drop** below the V's neck read as an exclamation mark:
 *   "CI!IL".
 *
 * The icons are sized to survive the New Tab's 196px, where they read as
 * texture, and to resolve fully above roughly 320px. That is a deliberate
 * trade: legible small, rewarding large.
 *
 * ## Colour
 *
 * One warm-to-cool sweep across the word — calcite → sandstone → wine →
 * cobalt → a lighter cobalt tone → juniper — with each letter carrying the
 * segment between its neighbours' hues, so the five gradients read as a single
 * blend rather than five separate fills. Palette values only.
 */

/**
 * Gradient ids are module-level constants rather than generated per render.
 * The mark appears once per page; two instances would share these defs, which
 * is harmless because both want identical gradients.
 */
const G = {
    c: "civilWordmarkC",
    i1: "civilWordmarkI1",
    v: "civilWordmarkV",
    i2: "civilWordmarkI2",
    l: "civilWordmarkL",
} as const;

export type WordmarkProps = {
    /** Rendered width in px. Height follows the 359 × 96 ratio. */
    width?: number;
    class?: string;
};

export function Wordmark(props: WordmarkProps): JSX.Element {
    const w = () => props.width ?? 359;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 359 96"
            width={w()}
            height={(w() * 96) / 359}
            class={props.class}
            role="img"
            aria-label="Civil"
        >
            <defs>
                <linearGradient
                    id={G.c}
                    x1="14"
                    y1="14"
                    x2="81"
                    y2="82"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stop-color={vars.color.calcite} />
                    <stop offset="1" stop-color={vars.color.sandstone} />
                </linearGradient>
                <linearGradient
                    id={G.i1}
                    x1="97"
                    y1="14"
                    x2="131"
                    y2="82"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stop-color={vars.color.sandstone} />
                    <stop offset="1" stop-color={vars.color.wine} />
                </linearGradient>
                <linearGradient
                    id={G.v}
                    x1="147"
                    y1="14"
                    x2="213"
                    y2="82"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stop-color={vars.color.wine} />
                    <stop offset="1" stop-color={vars.color.cobalt} />
                </linearGradient>
                {/*
                    The lighter cobalt tone is the same one the devtools theme
                    uses for `--color-accent-teal`. A tone of a palette colour
                    is not a thirteenth colour.
                */}
                <linearGradient
                    id={G.i2}
                    x1="229"
                    y1="14"
                    x2="263"
                    y2="82"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stop-color={vars.color.cobalt} />
                    <stop offset="1" stop-color="#93CAFF" />
                </linearGradient>
                <linearGradient
                    id={G.l}
                    x1="279"
                    y1="14"
                    x2="345"
                    y2="82"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stop-color="#93CAFF" />
                    <stop offset="1" stop-color={vars.color.juniper} />
                </linearGradient>
            </defs>

            {/* C — the way through. */}
            <path
                d="M80.53 38.12 A34 34 0 1 0 80.53 57.88 L64.93 51.56 A17 17 0 1 1 64.93 46.44 Z"
                fill={`url(#${G.c})`}
            />

            {/* I — privacy. Bow and slot are one contour; as two overlapping
                punches the even-odd rule fills the overlap back in and the
                keyhole disappears. */}
            <path
                fill-rule="evenodd"
                fill={`url(#${G.i1})`}
                d="M97 14 H131 V27 H124 V69 H131 V82 H97 V69 H104 V27 H97 Z M116.75 44.51 A8 8 0 1 0 111.25 44.51 L109.5 64 H118.5 Z"
            />

            {/* V — the filter. */}
            <path
                d="M147 14 H167 L180 52 L193 14 H213 L189 70 L187 82 H173 L171 70 Z"
                fill={`url(#${G.v})`}
            />

            {/* I — the relay. */}
            <path
                fill-rule="evenodd"
                fill={`url(#${G.i2})`}
                d="M229 14 H263 V27 H256 V69 H263 V82 H229 V69 H236 V27 H229 Z M243 32 H249 V37 H243 Z M240.5 44 H251.5 V49 H240.5 Z M238 56 H254 V61 H238 Z"
            />

            {/* L — the port. */}
            <path
                d="M279 14 H299 V68 H345 V71 H329 V79 H345 V82 H279 Z"
                fill={`url(#${G.l})`}
            />
        </svg>
    );
}
