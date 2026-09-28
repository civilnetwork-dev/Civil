import { globalStyle, style } from "@vanilla-extract/css";

import { vars } from "./theme.css";

export const icon = style({
    display: "inline-block",
    flexShrink: 0,
    verticalAlign: "middle",
    overflow: "visible",
});

// One curve and one duration for every glyph motion, matching the slabs the
// glyphs sit on (material.css.ts LIFT), so a key and its glyph move as one.
const LAYER_MOTION = "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * The extrusion: the glyph again, heavier and sunk toward basalt, sitting a
 * little down and right of the face. Offsets are in the 16-unit grid.
 */
export const depth = style({
    color: `color-mix(in oklab, currentColor 38%, ${vars.color.basalt})`,
    strokeWidth: 2.1,
    transform: "translate(0.45px, 0.7px)",
});

/** The lit rim: a firn-warmed copy peeking out on the upper-left edges. */
export const rim = style({
    color: `color-mix(in srgb, color-mix(in oklab, currentColor 45%, ${vars.color.firn}) 55%, transparent)`,
    transform: "translate(-0.35px, -0.45px)",
    transition: LAYER_MOTION,
});

export const face = style({ transition: LAYER_MOTION });

// A filled glyph has no stroke to thicken, so its extrusion is the shape plus
// a hairline; a 2.1 stroke would halo it on every side, not only the lower.
globalStyle(`.${icon}[fill="currentColor"] > .${depth}`, {
    stroke: "currentColor",
    strokeWidth: 1,
});

// Animate the drawing, never its layout box. Parent focus makes the same
// feedback available to keyboard users. No timers or idle animation.
globalStyle(`.${icon} > g > path`, {
    transformOrigin: "8px 8px",
    transition: LAYER_MOTION,
    "@media": { "(prefers-reduced-motion: reduce)": { transition: "none" } },
});

const CONTROL = `:is(button, a, summary, [role="button"], [role="tab"])`;
const PARENT_HOVER =
    "(hover: hover) and (prefers-reduced-motion: no-preference)";

/**
 * Lift: face and rim rise toward the viewer while the extrusion stays, on the
 * glyph's own hover, its control's keyboard focus, or its control's hover.
 */
const lifts = [
    [face, "translate(-0.35px, -0.5px)"],
    [rim, "translate(-0.7px, -0.95px)"],
] as const;
for (const [layer, transform] of lifts) {
    globalStyle(
        `${CONTROL}:focus-visible .${icon} > .${layer}, .${icon}:hover > .${layer}`,
        {
            transform,
            "@media": {
                "(prefers-reduced-motion: reduce)": { transform: "none" },
            },
        },
    );
    globalStyle(`${CONTROL}:not(:disabled):hover .${icon} > .${layer}`, {
        "@media": { [PARENT_HOVER]: { transform } },
    });
}

/**
 * Each glyph's own gesture, applied to all three layers so the solid moves as
 * one piece: meridians narrow, hands turn, arrows extend.
 */
const motions: Record<string, Record<string, string>> = {
    left: { "1": "scaleX(0.85)", "2": "translateX(-1.5px)" },
    right: { "1": "scaleX(0.85)", "2": "translateX(1.5px)" },
    refresh: { "1": "rotate(30deg)", "2": "rotate(30deg) scale(0.9)" },
    plus: { "1": "scaleY(0.72)", "2": "scaleX(1.15)" },
    close: {
        "1": "rotate(12deg) scale(0.85)",
        "2": "rotate(-12deg) scale(0.85)",
    },
    down: { "1": "translateY(1.5px) scaleX(0.85)" },
    search: { "1": "scale(1.08)", "2": "translate(1px, 1px)" },
    lock: { "1": "translateY(-1.5px) rotate(-8deg)", "3": "scaleY(0.65)" },
    world: { "2": "scaleX(0.5)", "3": "rotate(-12deg)" },
    link: {
        "1": "translate(1px, -1px)",
        "2": "translate(-1px, 1px)",
        "3": "scale(0.8)",
    },
    out: { "1": "scale(0.85)", "2": "translate(1px, -1px)" },
    check: { "1": "scale(1.08)" },
    alert: { "1": "scaleY(1.08)" },
    ban: { "2": "rotate(12deg)" },
    spinner: { "1": "rotate(45deg) scale(0.9)" },
    bookmark: { "1": "translateY(-1px)", "2": "translateY(-1px) scaleX(0.6)" },
    puzzle: { "1": "rotate(-8deg)", "2": "translateY(-1.5px) rotate(8deg)" },
    clock: { "2": "rotate(45deg)" },
    trash: { "1": "translateY(-1.5px) rotate(-10deg)", "3": "scaleY(0.7)" },
    apps: {
        "1": "translate(-0.75px, -0.75px)",
        "2": "translate(0.75px, -0.75px)",
        "3": "translate(-0.75px, 0.75px)",
        "4": "translate(0.75px, 0.75px)",
    },
    sliders: {
        "2": "translateX(2.5px)",
        "4": "translateX(-2.5px)",
        "6": "translateX(2px)",
    },
    "panel-top": { "2": "translateY(2px)" },
    "panel-bottom": { "2": "translateY(-2px)" },
    "panel-left": { "2": "translateX(2px)" },
    "panel-right": { "2": "translateX(-2px)" },
    upload: { "1": "translateY(-1.5px)", "2": "scaleX(0.85)" },
    loader: { "1": "rotate(45deg)", "2": "rotate(-45deg)" },
    dots: {
        "1": "translateY(-1px)",
        "2": "scale(1.25)",
        "3": "translateY(1px)",
    },
    patreon: { "1": "rotate(-6deg) scale(1.04)" },
};
for (const [name, parts] of Object.entries(motions)) {
    for (const [part, transform] of Object.entries(parts)) {
        const target = `.${icon}[data-icon="${name}"] > g > path:nth-child(${part})`;
        globalStyle(
            `${CONTROL}:focus-visible ${target}, .${icon}[data-icon="${name}"]:hover > g > path:nth-child(${part})`,
            {
                transform,
                "@media": {
                    "(prefers-reduced-motion: reduce)": { transform: "none" },
                },
            },
        );
        globalStyle(`${CONTROL}:not(:disabled):hover ${target}`, {
            "@media": { [PARENT_HOVER]: { transform } },
        });
    }
}
