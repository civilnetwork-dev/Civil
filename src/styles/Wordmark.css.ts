import {
    type CSSProperties,
    globalStyle,
    keyframes,
    style,
} from "@vanilla-extract/css";

import { type Morph, smil } from "./morph";

/**
 * The lockup's act, played once when it or the link holding it is hovered or
 * keyboard-focused: the Doorway's two slabs slam together, and the jolt runs
 * down the name.
 *
 * 1. The tall slab (the top course and the courses left of the door) strains
 *    back, opening cracks round the door, sticks, then slips 32 units into
 *    the short slab, which never moves, and ratchets home in two clicks. The
 *    door is their overlap, so it widens as they overlap more: only its right
 *    jamb moves, and painted over the stone that slid beneath it, every held
 *    pose is the exact XOR of the two slabs. The kiss at the door's top-right
 *    corner unfolds into a flat edge and folds back to a point.
 * 2. When the bottom course hits its dead stop, the jolt crosses into CIVIL
 *    PROXY at the speed of sound in stone, reaching each cap by its distance
 *    from the C: its foot kicks forward while its top lags, leaning back
 *    toward the door, then recovers with a flex. Leaning back keeps the caps
 *    apart; their tops sit only 13 units apart at I|V and V|I, and a forward
 *    lean fuses them. Y, the free end, whips past upright.
 * 3. PROXY's X is its two bars drawn even-odd. When the jolt reaches it, the
 *    bars swing upright onto one another and, A xor A being nothing, the X
 *    vanishes for an instant before springing back: the rule the door and
 *    the URL codec share, run on screen.
 *
 * Every part starts and ends at rest, for the same reasons as the icons'
 * gestures (icons.css.ts). Offsets are in the lockup's units, about 10.5 to a
 * pixel at the sidebar's 164px. Geometry here must match Wordmark.tsx.
 */
export const wordmark = style({ overflow: "visible" });

// Hover waits this long first, so a pointer crossing the sidebar's top on its
// way somewhere else does not set the lockup off. Focus waits as long, so the
// act keeps one timing whether hover, focus or the latch holds it.
const INTENT_MS = 120;
const PARENT_HOVER =
    "(hover: hover) and (prefers-reduced-motion: no-preference)";
const CURVE = "cubic-bezier(0.37, 0, 0.63, 1)";

// lib/acts.ts latches data-act on the lockup while its act runs, so the act
// plays to its end after hover or focus has gone.
function act(part: string, rule: CSSProperties) {
    globalStyle(
        `:is(a, button):hover .${wordmark} ${part}, .${wordmark}:hover ${part}`,
        { "@media": { [PARENT_HOVER]: rule } },
    );
    globalStyle(
        `:is(a, button):focus-visible .${wordmark} ${part}, .${wordmark}[data-act] ${part}`,
        { "@media": { "(prefers-reduced-motion: no-preference)": rule } },
    );
}

// Strain, stick, slip, hold, click, stick, click: the slip and both clicks
// accelerate into a dead stop, stone on stone, with no bounce.
const SLAM_MS = 800;
const SLIP = "cubic-bezier(0.55, 0, 1, 0.45)";
const SLAM: [string, number, number][] = [
    ["0%", 0, 0],
    ["10%", -16, 0],
    ["25%", -16, 0],
    ["30%", 32, 32],
    ["60%", 32, 32],
    ["67.5%", 16, 16],
    ["77.5%", 16, 16],
    ["85%", 0, 0],
    ["100%", 0, 0],
];
const slam = (prop: (shift: number, jamb: number) => CSSProperties) =>
    Object.fromEntries(
        SLAM.map(([at, shift, jamb]) => [
            at,
            {
                ...prop(shift, jamb),
                ...(["25%", "60%", "77.5%"].includes(at) && {
                    animationTimingFunction: SLIP,
                }),
            },
        ]),
    );
const slide = keyframes(
    slam(shift => ({ transform: `translateX(${shift}px)` })),
);
const doorFrames = slam((_, jamb) => ({
    d: `path("M64 224V128A64 64 0 0 1 128 64H${128 + jamb}V224Z")`,
}));
const door = keyframes(doorFrames);

// The tall slab's courses, bottom first, a frame apart, so the cracks zip
// shut up the wall and the lintel lands last. The door moves with the bottom.
(
    [
        [6, 0],
        [4, 16],
        [2, 32],
        [1, 48],
    ] as const
).forEach(([course, lag]) =>
    act(`> g:first-child > path:nth-child(${course})`, {
        animation: `${slide} ${SLAM_MS}ms ${CURVE} ${INTENT_MS + lag}ms`,
    }),
);
act("> path", {
    animation: `${door} ${SLAM_MS}ms ${CURVE} ${INTENT_MS}ms`,
});

// PROXY's X as two bars, each tweening toward the one upright bar they share.
const BARS = [
    [1425.68, 1474.4, 1578.24, 1529.75],
    [1529.78, 1575.75, 1469.16, 1423.18],
];
const UPRIGHT = [1477.06, 1524.36, 1524.36, 1477.06];
const bars = (k: number) =>
    BARS.map(
        xs =>
            `M${xs.map((x, i) => `${+(x + k * (UPRIGHT[i] - x)).toFixed(2)} ${i < 2 ? 64 : 224}`).join("L")}Z`,
    ).join("");
const CANCEL_MS = 520;
const cancelFrames = {
    "0%": { d: `path("${bars(0)}")` },
    "38%": { d: `path("${bars(1)}")` },
    "62%": { d: `path("${bars(-0.1)}")` },
    "82%": { d: `path("${bars(0.03)}")` },
    "100%": { d: `path("${bars(0)}")` },
};
const cancel = keyframes(cancelFrames);

const stroke = keyframes({
    "16%": { transform: "translateX(10px) rotate(-10deg) skewX(0deg)" },
    "50%": { transform: "translateX(0px) rotate(-4deg) skewX(5deg)" },
    "80%": { transform: "translateX(0px) rotate(1.2deg) skewX(0deg)" },
});
const whip = keyframes({
    "14%": { transform: "translateX(10px) rotate(-10deg) skewX(0deg)" },
    "50%": { transform: "translateX(0px) rotate(7deg) skewX(-4deg)" },
    "75%": { transform: "translateX(0px) rotate(-2deg) skewX(0deg)" },
});

// Each cap's left edge: C I V I L P R O X Y. The jolt leaves the door as the
// slip stops and travels five units a millisecond.
const LEFT = [
    266.84, 417.52, 511.29, 671.18, 780.23, 968.41, 1120.17, 1269.98, 1423.18,
    1577.8,
];
const SLIPPED_MS = SLAM_MS * 0.3;
LEFT.forEach((x, i) => {
    const delay = Math.round(INTENT_MS + SLIPPED_MS + (x - LEFT[0]) / 5);
    act(
        `> g:last-child > path:nth-child(${i + 1})`,
        i === 8
            ? { animation: `${cancel} ${CANCEL_MS}ms ${CURVE} ${delay}ms` }
            : {
                  transformBox: "fill-box",
                  transformOrigin: "50% 100%",
                  animation: `${i === 9 ? whip : stroke} ${i === 9 ? 560 : 460}ms ${CURVE} ${delay}ms`,
              },
    );
});

/** The door's and the X's timelines, for Safari (see morph.ts). */
export const lockupMorphs: Record<string, Morph> = {
    [door]: smil(doorFrames, SLAM_MS, CURVE),
    [cancel]: smil(cancelFrames, CANCEL_MS, CURVE),
};
