import {
    createVar,
    type CSSProperties,
    globalStyle,
    keyframes,
    style,
} from "@vanilla-extract/css";

import { type Morph, smil } from "./morph";

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
 * How far behind the face each layer plays its glyph's gesture. The three
 * copies part mid-act like exposures of one motion and stack again as it
 * lands; the rim trails furthest because its firn tint still shows on
 * basalt, where the extrusion nearly vanishes.
 */
const lag = createVar();

/**
 * The extrusion: the glyph again, heavier and sunk toward basalt, sitting a
 * little down and right of the face. Offsets are in the 16-unit grid. Every
 * glyph is solid, so "heavier" is the shape plus a hairline outline.
 */
export const depth = style({
    vars: { [lag]: "30ms" },
    color: `color-mix(in oklab, currentColor 38%, ${vars.color.basalt})`,
    stroke: "currentColor",
    strokeWidth: 1,
    transform: "translate(0.45px, 0.7px)",
});

/** The lit rim: a firn-warmed copy peeking out on the upper-left edges. */
export const rim = style({
    vars: { [lag]: "90ms" },
    color: `color-mix(in srgb, color-mix(in oklab, currentColor 45%, ${vars.color.firn}) 55%, transparent)`,
    transform: "translate(-0.35px, -0.45px)",
    transition: LAYER_MOTION,
});

export const face = style({ vars: { [lag]: "0ms" }, transition: LAYER_MOTION });

// Animate the drawing, never its layout box. Parent focus makes the same
// feedback available to keyboard users. No timers or idle animation.
globalStyle(`.${icon} > g > path`, { transformOrigin: "8px 8px" });

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

/* -------------------------------------------------------------------- */
/* Gestures                                                              */
/* -------------------------------------------------------------------- */

/** A closed path through `points`, in the 16-unit grid. */
const poly = (...points: number[][]) =>
    `M${points.map(p => p.map(v => +v.toFixed(3)).join(" ")).join("L")}Z`;

// The verdict tile, shared by the check and the unknown socket.
const TILE = "M6 2L14 2L14 14L2 14L2 6C2 3.791 3.791 2 6 2Z";

/**
 * The close X's two bars turned `deg` toward each other about the centre,
 * each still knocking out the rhombus where they cross, so the diamond
 * stretches to a slit as the blades close. Corner order matches the paths in
 * components/icons, which `d` needs to tween point by point.
 */
const shear = (deg: number, bar: 1 | 2) => {
    const half = Math.PI / 4 - (deg * Math.PI) / 180;
    const turn = bar === 1 ? half : -half;
    const [ux, uy] = [Math.cos(turn), Math.sin(turn)];
    const corner = ([s, k]: number[]) => [
        8 + s * 6.2225 * ux - k * 1.2007 * uy,
        8 + s * 6.2225 * uy + k * 1.2007 * ux,
    ];
    const ends =
        bar === 1
            ? [
                  [-1, -1],
                  [1, -1],
                  [1, 1],
                  [-1, 1],
              ]
            : [
                  [1, 1],
                  [-1, 1],
                  [-1, -1],
                  [1, -1],
              ];
    const [across, along] = [1.2007 / Math.cos(half), 1.2007 / Math.sin(half)];
    return (
        poly(...ends.map(corner)) +
        poly([8, 8 - across], [8 - along, 8], [8, 8 + across], [8 + along, 8])
    );
};

/**
 * The check tile with its tick knocked out `t` of the way along the stroke:
 * 0 to 1 down the short arm, 1 to 2 up the long one.
 */
const tick = (t: number) => {
    const lerp = (p: number[], q: number[], k: number) =>
        p.map((v, i) => v + (q[i] - v) * k);
    const [a, b] = [
        [5.272, 7.628],
        [3.928, 8.972],
    ];
    const low = lerp(b, [7.1, 12.144], Math.min(t, 1));
    const high = lerp(a, [7.1, 9.456], Math.min(t, 1));
    const long = Math.max(t - 1, 0);
    return (
        TILE +
        poly(
            a,
            b,
            low,
            lerp(low, [12.272, 6.972], long),
            lerp(high, [10.928, 5.628], long),
            high,
        )
    );
};

/** The unknown verdict's empty socket, opened to the given box. */
const socket = (from: number, to: number) =>
    TILE + poly([from, from], [from, to], [to, to], [to, from]);

/**
 * A bookmark ribbon whose tails end at `tail` and whose notch rises to
 * `notch`. The outline's inner edge keeps the same wall all round.
 */
const ribbon = (tail: number, notch: number, inside = "") =>
    `M6 2L12 2L12 ${tail}L8 ${notch}L4 ${tail}L4 4C4 2.895 4.895 2 6 2Z${inside}`;
const ribbons = {
    bookmark: () => "M6.4 5L6.4 6.5L9.6 6.5L9.6 5Z",
    "bookmark-filled": () => "",
    "bookmark-outline": (tail: number, notch: number) =>
        `M6 3.6C5.779 3.6 5.6 3.779 5.6 4L5.6 ${+(tail - 3.329).toFixed(3)}L8 ${+(notch - 2.049).toFixed(3)}L10.4 ${+(tail - 3.329).toFixed(3)}L10.4 3.6Z`,
};
// The trap loads (tails stretch, notch deepens), snaps shut, and eases open,
// while the ribbon swings from its top edge.
const FLUTTER: [string, number, number, string][] = [
    ["0%", 14, 10.8, "none"],
    ["28%", 15.2, 9.2, "skewX(-7deg)"],
    ["46%", 13, 12.9, "skewX(5deg)"],
    ["66%", 14.5, 10, "skewX(-2deg)"],
    ["84%", 13.8, 11.2, "skewX(1deg)"],
    ["100%", 14, 10.8, "none"],
];

type Frames = Record<string, CSSProperties>;

/** The same transform at each keyframe offset. */
const at = (frames: Record<string, string>): Frames =>
    Object.fromEntries(
        Object.entries(frames).map(([k, transform]) => [k, { transform }]),
    );

type Gesture = {
    frames: Frames;
    /** Milliseconds. */
    ms?: number;
    /** Extra milliseconds after hover intent, to stagger parts. */
    delay?: number;
    origin?: string;
};

/**
 * Each glyph's own act, played once when the glyph or its control is
 * hovered or keyboard-focused, on all three layers so the solid moves as one
 * piece: arrows dash, blades snip, the lid flips, the globe turns, the tick
 * redraws, the faders ripple. Part numbers are the glyph's `<path>` order in
 * components/icons; offsets are in its 16-unit grid.
 *
 * Every act starts and ends at rest. A part shows the glyph as drawn while it
 * waits out the hover intent and again once its act is over, so a first or
 * last pose anywhere else would jump; and reduced motion collapses each act to
 * its last frame. Rotations end on a turn that maps the glyph onto itself.
 */
const gestures: Record<string, Record<string, Gesture>> = {
    left: {
        "1": {
            frames: at({
                "22%": "translateX(1.2px)",
                "52%": "translateX(-2.4px)",
                "76%": "translateX(0.5px)",
            }),
        },
        "2": {
            frames: at({
                "22%": "translateX(0.6px) scaleX(0.88)",
                "52%": "translateX(-1.3px) scaleX(1.12)",
                "76%": "translateX(0.25px) scaleX(1)",
            }),
        },
    },
    right: {
        "1": {
            frames: at({
                "22%": "translateX(-1.2px)",
                "52%": "translateX(2.4px)",
                "76%": "translateX(-0.5px)",
            }),
        },
        "2": {
            frames: at({
                "22%": "translateX(-0.6px) scaleX(0.88)",
                "52%": "translateX(1.3px) scaleX(1.12)",
                "76%": "translateX(-0.25px) scaleX(1)",
            }),
        },
    },
    refresh: Object.fromEntries(
        ["1", "2"].map(part => [
            part,
            {
                ms: 760,
                frames: at({
                    "18%": "rotate(-28deg)",
                    "72%": "rotate(372deg)",
                    "100%": "rotate(360deg)",
                }),
            },
        ]),
    ),
    plus: Object.fromEntries(
        ["1", "2"].map(part => [
            part,
            {
                frames: at({
                    "35%": "rotate(50deg) scale(0.78)",
                    "70%": "rotate(98deg) scale(1.1)",
                    "100%": "rotate(90deg) scale(1)",
                }),
            },
        ]),
    ),
    close: Object.fromEntries(
        ([1, 2] as const).map(bar => [
            String(bar),
            {
                ms: 620,
                frames: {
                    "0%": { d: `path("${shear(0, bar)}")` },
                    "30%": { d: `path("${shear(28, bar)}")` },
                    "56%": { d: `path("${shear(-10, bar)}")` },
                    "78%": { d: `path("${shear(4, bar)}")` },
                    "100%": { d: `path("${shear(0, bar)}")` },
                },
            },
        ]),
    ),
    down: {
        "1": {
            frames: at({
                "24%": "translateY(1.8px) scaleX(0.9)",
                "46%": "translateY(-0.7px) scaleX(1)",
                "66%": "translateY(1px) scaleX(0.95)",
                "84%": "translateY(-0.2px) scaleX(1)",
            }),
        },
    },
    // The lens sweeps one small circle, as if scanning, and comes home.
    search: Object.fromEntries(
        ["1", "2"].map(part => [
            part,
            {
                ms: 760,
                frames: at(
                    Object.fromEntries(
                        [1, 2, 3, 4, 5, 6, 7].map(i => {
                            const turn = (i * Math.PI) / 4;
                            const x = 0.9 * (Math.cos(turn) - 1);
                            const y = -0.9 * Math.sin(turn);
                            return [
                                `${i * 12.5}%`,
                                `translate(${+x.toFixed(3)}px, ${+y.toFixed(3)}px)`,
                            ];
                        }),
                    ),
                ),
            },
        ]),
    ),
    lock: {
        "1": {
            origin: "5.4px 6.5px",
            ms: 700,
            frames: at({
                "22%": "translateY(-1.8px) rotate(0deg)",
                "50%": "translateY(-1.8px) rotate(-24deg)",
                "74%": "translateY(-0.3px) rotate(5deg)",
                "90%": "translateY(0px) rotate(-1deg)",
            }),
        },
        "2": { frames: at({ "18%": "translateY(0.5px)", "40%": "none" }) },
    },
    // The meridians turn a full revolution: a ring seen edge-on is a line.
    world: {
        "2": {
            ms: 900,
            frames: at({ "50%": "scaleX(-1)", "100%": "scaleX(1)" }),
        },
        "3": {
            ms: 900,
            frames: at({ "25%": "rotate(-8deg)", "75%": "rotate(6deg)" }),
        },
    },
    link: {
        "1": {
            ms: 700,
            frames: at({
                "60%": "rotate(200deg) scale(1.06)",
                "100%": "rotate(180deg) scale(1)",
            }),
        },
    },
    // Out through the corner, back in from the opposite one.
    out: Object.fromEntries(
        ["1", "2"].map(part => [
            part,
            {
                frames: {
                    "38%": {
                        transform: "translate(3.2px, -3.2px)",
                        opacity: 0,
                    },
                    "39%": {
                        transform: "translate(-3.2px, 3.2px)",
                        opacity: 0,
                    },
                    "80%": {
                        transform: "translate(0.3px, -0.3px)",
                        opacity: 1,
                    },
                },
            },
        ]),
    ),
    // The tick wipes and draws itself again, and the tile settles on it.
    check: {
        "1": {
            ms: 760,
            frames: {
                "0%": { d: `path("${tick(2)}")` },
                "12%": { d: `path("${tick(0)}")` },
                "40%": { d: `path("${tick(1)}")` },
                "74%": { d: `path("${tick(2)}")`, transform: "scale(1)" },
                "86%": { transform: "scale(1.08)" },
                "100%": { d: `path("${tick(2)}")`, transform: "scale(1)" },
            },
        },
    },
    socket: {
        "1": {
            frames: {
                "0%": { d: `path("${socket(5.5, 10.5)}")` },
                "30%": { d: `path("${socket(7.4, 8.6)}")` },
                "58%": { d: `path("${socket(4.8, 11.2)}")` },
                "80%": { d: `path("${socket(5.7, 10.3)}")` },
                "100%": { d: `path("${socket(5.5, 10.5)}")` },
            },
        },
    },
    alert: {
        "1": {
            origin: "8px 13.9px",
            ms: 700,
            frames: at({
                "15%": "rotate(-10deg)",
                "32%": "rotate(8deg)",
                "50%": "rotate(-5deg)",
                "68%": "rotate(3deg)",
                "84%": "rotate(-1deg)",
            }),
        },
    },
    ban: {
        "1": { ms: 680, frames: at({ "40%": "scale(0.9)" }) },
        "2": {
            ms: 680,
            frames: at({ "60%": "rotate(200deg)", "100%": "rotate(180deg)" }),
        },
    },
    spinner: {
        "1": {
            ms: 800,
            frames: at({ "100%": "rotate(360deg)" }),
        },
    },
    ...Object.fromEntries(
        Object.entries(ribbons).map(([name, inside]) => [
            name,
            {
                "1": {
                    origin: "8px 2px",
                    ms: 700,
                    frames: Object.fromEntries(
                        FLUTTER.map(([k, tail, notch, transform]) => [
                            k,
                            {
                                d: `path("${ribbon(tail, notch, inside(tail, notch))}")`,
                                transform,
                            },
                        ]),
                    ),
                },
            },
        ]),
    ),
    puzzle: {
        "1": {
            frames: at({ "30%": "rotate(-5deg)", "58%": "rotate(1.5deg)" }),
        },
        "2": {
            origin: "11.77px 9.32px",
            ms: 680,
            frames: at({
                "30%": "translate(1.6px, -1.1px) rotate(28deg)",
                "58%": "translate(-0.35px, 0.25px) rotate(-6deg)",
                "80%": "translate(0.1px, 0px) rotate(2deg)",
            }),
        },
    },
    clock: {
        "1": { ms: 820, frames: at({ "50%": "scale(0.94)" }) },
        "2": { ms: 820, frames: at({ "100%": "rotate(360deg)" }) },
    },
    trash: {
        "1": {
            origin: "13px 3.4px",
            ms: 720,
            frames: at({
                "26%": "translateY(-1.2px) rotate(-26deg)",
                "50%": "translateY(0px) rotate(5deg)",
                "70%": "translateY(-0.4px) rotate(-8deg)",
                "86%": "translateY(0px) rotate(1.5deg)",
            }),
        },
        "2": {
            origin: "8px 14.25px",
            ms: 720,
            frames: at({ "50%": "scaleY(0.94)", "70%": "scaleY(1.02)" }),
        },
    },
    // An iris: each tile slides along its own edge while the four turn a
    // quarter about the centre, where their door heads open and close.
    apps: Object.fromEntries(
        [
            [0, -1.4],
            [1.4, 0],
            [-1.4, 0],
            [0, 1.4],
        ].map(([x, y], i) => [
            String(i + 1),
            {
                ms: 820,
                frames: at({
                    "34%": `translate(${x}px, ${y}px) rotate(30deg)`,
                    "72%": "translate(0px, 0px) rotate(96deg)",
                    "100%": "translate(0px, 0px) rotate(90deg)",
                }),
            },
        ]),
    ),
    sliders: Object.fromEntries(
        [3, -3, 2.6].map((shift, i) => [
            String(i * 2 + 2),
            {
                ms: 700,
                delay: i * 70,
                frames: at({
                    "28%": `translateX(${shift}px)`,
                    "58%": `translateX(${+(-shift * 0.4).toFixed(2)}px)`,
                    "80%": `translateX(${+(shift * 0.13).toFixed(2)}px)`,
                }),
            },
        ]),
    ),
    ...Object.fromEntries(
        (
            [
                ["panel-top", "8px 2px", "scaleY"],
                ["panel-bottom", "8px 14px", "scaleY"],
                ["panel-left", "2px 8px", "scaleX"],
                ["panel-right", "14px 8px", "scaleX"],
            ] as const
        ).map(([name, origin, scale]) => [
            name,
            {
                "2": {
                    origin,
                    frames: at({
                        "38%": `${scale}(0.25)`,
                        "68%": `${scale}(1.12)`,
                        "86%": `${scale}(0.97)`,
                    }),
                },
            },
        ]),
    ),
    upload: {
        "1": {
            ms: 680,
            frames: at({
                "18%": "translateY(0.9px)",
                "48%": "translateY(-2.6px)",
                "72%": "translateY(0.5px)",
                "88%": "translateY(-0.2px)",
            }),
        },
        "2": {
            origin: "8px 14.13px",
            ms: 680,
            frames: at({
                "18%": "scaleY(0.6)",
                "48%": "scaleY(1.1)",
                "72%": "scaleY(0.92)",
            }),
        },
    },
    loader: {
        "1": {
            ms: 760,
            frames: at({ "80%": "rotate(100deg)", "100%": "rotate(90deg)" }),
        },
        "2": {
            ms: 760,
            frames: at({ "80%": "rotate(-100deg)", "100%": "rotate(-90deg)" }),
        },
    },
    dots: Object.fromEntries(
        ["1", "2", "3"].map((part, i) => [
            part,
            {
                ms: 560,
                delay: i * 90,
                frames: at({
                    "30%": "translateY(-2.2px)",
                    "60%": "translateY(0.4px)",
                    "80%": "translateY(0px)",
                }),
            },
        ]),
    ),
    patreon: {
        "1": {
            frames: at({
                "30%": "scale(1.14)",
                "55%": "scale(0.94)",
                "78%": "scale(1.04)",
            }),
        },
    },
};

// A pointer only passing over a toolbar starts no acts: each waits this long
// under the pointer first, and leaving inside the wait cancels it unseen.
const INTENT_MS = 80;
const CURVE = "cubic-bezier(0.37, 0, 0.63, 1)";

/** The morphing parts' timelines, for Safari (see morph.ts). */
export const glyphMorphs: Record<string, Morph> = {};

for (const [name, parts] of Object.entries(gestures)) {
    const glyph = `.${icon}[data-icon="${name}"]`;
    for (const [
        part,
        { frames, ms = 640, delay = 0, origin },
    ] of Object.entries(parts)) {
        const motion = keyframes(frames);
        if (Object.values(frames).some(frame => frame.d))
            glyphMorphs[motion] = smil(frames, ms, CURVE);
        const act = {
            animation: `${motion} ${ms}ms ${CURVE} calc(${INTENT_MS + delay}ms + ${lag})`,
            ...(origin && { transformOrigin: origin }),
        };
        const path = `> g > path:nth-child(${part})`;
        // lib/acts.ts latches data-act on the glyph while its act runs, so the
        // act plays to its end after hover or focus has gone.
        globalStyle(
            `${CONTROL}:focus-visible ${glyph} ${path}, ${glyph}:is(:hover, [data-act]) ${path}`,
            { "@media": { "(prefers-reduced-motion: no-preference)": act } },
        );
        globalStyle(`${CONTROL}:not(:disabled):hover ${glyph} ${path}`, {
            "@media": { [PARENT_HOVER]: act },
        });
    }
}
