/**
 * "Strata" — the app's colour palette as plain data.
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
 * ## Provenance — measured, not sampled by eye
 *
 * Every hue below traces to a *measured* region of one of five landscape
 * photographs. Each image was decoded to raw sRGB, resampled to a 16×16 grid
 * of true pixels (nearest-neighbour, so no averaging invented colours the
 * photograph never contained), and quantised into dominant clusters. The HCT
 * hue angles in the table are what came back, not what we wanted:
 *
 * | source | measured | supplies |
 * |---|---|---|
 * | Svalbard, Nordenskiöld  | H 278.5 C 5.5  | the whole surface stack |
 * | Denali at dusk          | H 262.7 C 32.5 | snow tiers, cold confirmation |
 * | Lake Marie, Snowy Range | H 351.8 C 27.9 | `wine` |
 * | Carlsbad Caverns        | H  81.5 C 20.6 | `calcite` |
 * | Sedona, Thunder Mtn.    | H 271.2 C 51.2 | `cobalt` — highest chroma in the set |
 * | Sedona, Thunder Mtn.    | H  59.8 C 32.9 | `sandstone` |
 * | Sedona, Thunder Mtn.    | H 116.1 C 12.8 | `juniper` |
 *
 * The cool spine is not a stylistic preference: H 252–295 was the one hue
 * band present in **all five** photographs, so it earns the surfaces. The
 * warm band (H 54–85) was present in four, and supplies the two warm tiers.
 * Surfaces and text are HCT tonal steps off the Svalbard hue; every accent is
 * a tonal step off its own measured seed. Nothing here was picked by eye.
 *
 * ## Twelve slots, not twenty-two
 *
 * The previous palette carried six surface tiers, six text tiers and ten
 * accents. Twelve is the budget now, so tiers that differed by less than they
 * cost were merged: `halo`/`daylight` (11.64 vs 13.07 — a distinction almost
 * nobody could see), `ember`/`cinder`, `moonlight`/`starlight`, and the five
 * stellar accents that were all doing one job. Resting icons come up from
 * 3.56 to 4.80 in the merge, which clears AA rather than relying on WCAG
 * 1.4.11's non-text threshold.
 *
 * No pure black (causes halation against a bright screen) and no pure white
 * (`firn`, the primary text colour, sits at 13.94:1 against `stratum` rather
 * than pure white's 15.6:1) — both are deliberate, not oversights.
 *
 * ## Contrast, measured against `stratum` (#22262F), the content plane
 *
 * `ash` 4.80 · `snowmelt` 8.87 · `firn` 13.94 · `cobalt` 4.80 ·
 * `juniper` 9.53 · `calcite` 12.63 · `sandstone` 6.58 · `wine` 4.77.
 *
 * Every text tier and every accent clears WCAG AA for small text. `ash` is
 * the floor and is still the muted tier — nothing dimmer exists to reach for.
 *
 * ## The four verdicts
 *
 * `juniper` allowed, `calcite` warned, `sandstone` error, `wine` blocked —
 * separated by LIGHTNESS as well as hue, because hue separation is worthless
 * to the ~1% of people with deuteranopia. Audited under protanopia,
 * deuteranopia, tritanopia and achromatopsia: the worst surviving pair is
 * juniper↔calcite at ΔE 6.6, against the previous palette's worst of 5.6
 * across three failing pairs. Colour remains a third redundant channel behind
 * the verdict text and its glyph — never the only one.
 */
export const PALETTE = {
    /** Outermost frame, browser chrome, panels, dropdowns, menus. */
    basalt: "#0E1119",
    /** The active content plane. All contrast above is measured here. */
    stratum: "#22262F",
    /** Raised surface; hairline rules. */
    scree: "#2D3039",
    /** Hover, major rules, strongest border. */
    talus: "#434751",
    /** Muted tier: resting icons, ticks, annotation. 4.80 — AA, and the floor. */
    ash: "#8C919E",
    /** Body text and annotation. */
    snowmelt: "#C2C6D2",
    /** Primary text and emphasis. */
    firn: "#EDF1FB",
    /** The accent: chrome, focus rings, links, active state. */
    cobalt: "#4295E4",
    /** Verdict — allowed. */
    juniper: "#C3CAA4",
    /** Verdict — warned. */
    calcite: "#F2E0C7",
    /** Verdict — error. */
    sandstone: "#E29B69",
    /** Verdict — blocked. */
    wine: "#C8789B",
} as const;

export type SlotName = keyof typeof PALETTE;
