import type { CSSProperties } from "@vanilla-extract/css";

/**
 * A `d` morph restated as SMIL `<animate>` attributes. Safari has no CSS `d`:
 * it drops a morph's keyframes, though the act around them still runs, so when
 * a part starts there lib/acts.ts replays its morph as SMIL, which every
 * engine animates. Stylesheets key these by keyframes name, the name the
 * part's animation events carry.
 */
export type Morph = Record<
    "dur" | "values" | "keyTimes" | "keySplines",
    string
>;

/**
 * The frames that set `d: path("…")`, with their offsets and the timing
 * function each eases into the next with. Timing functions must be
 * `cubic-bezier()`, whose four numbers are what SMIL takes.
 */
export function smil(
    frames: Record<string, CSSProperties>,
    ms: number,
    easing: string,
): Morph {
    const shapes = Object.entries(frames).filter(([, frame]) => frame.d);
    return {
        dur: `${ms}ms`,
        values: shapes.map(([, { d }]) => String(d).slice(6, -2)).join(";"),
        keyTimes: shapes.map(([at]) => parseFloat(at) / 100).join(";"),
        keySplines: shapes
            .slice(0, -1)
            .map(([, frame]) =>
                String(frame.animationTimingFunction ?? easing).slice(13, -1),
            )
            .join(";"),
    };
}
