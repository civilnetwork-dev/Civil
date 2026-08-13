/**
 * "Astronomical twilight" — the app's colour palette as plain data.
 *
 * This is deliberately NOT a `.css.ts` module. vanilla-extract only
 * transforms files matching that suffix, and it can only statically
 * serialize a narrow set of export shapes for production — plain objects,
 * arrays, strings, numbers, null/undefined, or functions tagged via
 * `addFunctionSerializer`. Keeping this as raw data in a plain `.ts` module
 * sidesteps that entirely, and lets `benchmarkConfig.ts` import the hex
 * values directly: echarts renders to canvas and cannot read CSS custom
 * properties, so it needs real strings, not vanilla-extract contract
 * references.
 *
 * Surfaces descend into atmospheric depth; accents are stellar spectral
 * classes plus airglow, the green emission visible at a dark site. No pure
 * black (causes halation against a bright screen) and no pure white
 * (`daylight`, the primary text colour, sits at 13.07:1 against `dusk`
 * rather than pure white's 15.23:1) — both are deliberate, not oversights.
 *
 * Every value below was measured for contrast against `dusk` (#122834), the
 * active content plane. DESIGN.md carries the full measured table.
 */
/**
 * Derived from an alpine-lake photograph (Snowy Range: granite, conifer, glacial
 * water under a deep sky) and re-voiced at night. The photograph supplies the
 * hues; the dark tones are ours. Every hue below traces to a measured region of
 * that image via HCT tonal ramps — the surface stack from the lake's shadowed
 * water (H 239.5), `sirius`/`vega`/`rigel` from the sky (H 270.4),
 * `airglow` from the meadow (H 115.1), `aurora`/`nebula` from the shallows
 * (H 204), and the warm accents from sunlit granite (H 82).
 *
 * Contrast is measured against `dusk`, the active content plane. Text tiers are
 * WCAG AA; `ember` at 3.56 is non-text only (icons, rules, borders).
 *
 * The four status colours are separated by LIGHTNESS, not hue alone —
 * allowed 8.25, warned 10.56, error 6.25, blocked 4.90. Hue separation is
 * useless to the ~1% of people with deuteranopia: the previous palette put
 * allowed and blocked at ΔE 4.9 under that simulation, i.e. indistinguishable,
 * which is the single worst pair in a verdict system to confuse. They now read
 * as clearly different greys even under achromatopsia. Colour remains a third
 * redundant channel behind the verdict text and its glyph — never the only one.
 */
export const PALETTE = {
    void: "#071620",
    night: "#0C1F2B",
    dusk: "#122834",
    horizon: "#1B3543",
    haze: "#264556",
    dust: "#35596D",
    ember: "#5B7F94",
    cinder: "#7FA0B3",
    starlight: "#9FBACA",
    moonlight: "#C0D2DD",
    halo: "#D6E3EB",
    daylight: "#E6EFF4",
    sirius: "#71AFF7",
    vega: "#95CAFF",
    rigel: "#4895E0",
    aurora: "#7FD4D8",
    nebula: "#79BFB4",
    airglow: "#BAC48F",
    sol: "#E6D6A9",
    corona: "#E9C79B",
    arcturus: "#D69967",
    antares: "#D77679",
} as const;

export type SlotName = keyof typeof PALETTE;
