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
 * (`daylight`, the primary text colour, sits at 12.88:1 against `dusk`
 * rather than pure white's 16.32:1) — both are deliberate, not oversights.
 *
 * Every value below was measured for contrast against `dusk` (#18202F), the
 * active content plane. See `.superpowers/sdd/task-T1-brief.md` for the
 * full rename table and measured ratios.
 */
export const PALETTE = {
    void: "#0C111A",
    night: "#121926",
    dusk: "#18202F",
    horizon: "#212B3D",
    haze: "#2C3850",
    dust: "#3C4A66",
    ember: "#5A6B8C",
    cinder: "#7B8CAE",
    starlight: "#9DAECB",
    moonlight: "#BFCADD",
    halo: "#CFD8E7",
    daylight: "#DEE5F0",
    sirius: "#8FC3EA",
    vega: "#A8B4EE",
    rigel: "#7FA8DC",
    aurora: "#8FD4D0",
    nebula: "#79B8B4",
    airglow: "#87C9A3",
    sol: "#E6C782",
    corona: "#E8B478",
    arcturus: "#E3A56E",
    antares: "#DC8B92",
} as const;

export type SlotName = keyof typeof PALETTE;
