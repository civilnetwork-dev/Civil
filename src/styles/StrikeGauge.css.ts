import { style, styleVariants } from "@vanilla-extract/css";

import { DUR, EASE } from "./material.css";
import { ANNO, FONT_MONO, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The strike tally.
 *
 * A segmented gauge rather than a progress bar: strikes are discrete and
 * capped, so the meter should answer "how many are left" at a glance rather
 * than render a percentage of a continuous fill.
 *
 * The segment colour was previously set inline from `--civil-color-yellow`,
 * `--civil-color-maroon` and `--civil-color-red`. None of those exist — the
 * theme contract generates `--civil-color-<palette-slot>`, and the palette has
 * no `yellow`, `maroon` or `red` — so every segment rendered with no colour at
 * all. The severity ramp now runs sol → arcturus → antares, which are real
 * slots and, being separated by lightness rather than only hue, stay
 * distinguishable under deuteranopia.
 */

export const gauge = style({
    display: "flex",
    gap: "5px",
    margin: "10px 0 0",
});

const segmentBase = style({
    flex: 1,
    height: "10px",
    minWidth: "10px",
    borderRadius: "3px",
    transitionProperty: "background, box-shadow",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.base,
});

/**
 * The tones are enumerated as static variants rather than driven by a dynamic
 * custom property. Three fixed severities do not need a runtime variable, and
 * the alternative — `assignInlineVars` — would mean adding
 * `@vanilla-extract/dynamic` as a dependency to colour eight small rectangles.
 */
// A strike is a raised block of its tone, lit on top and banded underneath;
// a strike still in hand is the empty socket it would fill.
const used = (color: string) => [
    segmentBase,
    {
        background: `linear-gradient(180deg, color-mix(in oklab, ${color} 70%, ${vars.color.firn}), ${color} 60%)`,
        boxShadow: [
            `inset 0 1px 0 color-mix(in srgb, ${vars.color.firn} 35%, transparent)`,
            `0 1px 0 color-mix(in oklab, ${color} 55%, ${vars.color.basalt})`,
            `0 2px 0 color-mix(in oklab, ${color} 35%, ${vars.color.basalt})`,
            `0 5px 6px -3px color-mix(in srgb, ${vars.color.basalt} 85%, transparent)`,
        ].join(", "),
    },
];

export const segment = styleVariants({
    low: used(vars.color.calcite),
    mid: used(vars.color.sandstone),
    high: used(vars.color.wine),
    free: [
        segmentBase,
        {
            background: vars.color.basalt,
            boxShadow: `inset 0 1px 3px color-mix(in srgb, black 60%, transparent), 0 1px 0 color-mix(in srgb, ${vars.color.firn} 6%, transparent)`,
        },
    ],
});

export type SegmentTone = "low" | "mid" | "high";

export const head = style({
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "16px",
});

export const label = style({ ...ANNO });

export const count = style({
    fontFamily: FONT_MONO,
    fontSize: "17px",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    color: vars.color.firn,
});

export const policy = style({
    ...ANNO,
    display: "block",
    margin: "12px 0 0",
    paddingTop: "10px",
    borderTop: RULE.hair,
    color: vars.color.snowmelt,
    lineHeight: 1.6,
    maxWidth: "62ch",
});
