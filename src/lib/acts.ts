import { glyphMorphs } from "~/styles/icons.css";
import { lockupMorphs } from "~/styles/Wordmark.css";

/**
 * Animation handlers for an `<svg>` that plays hover acts: the icons
 * (icons.css.ts) and the wordmark (Wordmark.css.ts).
 *
 * An act plays to its end. CSS drops an animation the moment :hover ends,
 * which snapped a half-played act to rest, so a part's first frame latches
 * `data-act` on the svg; the stylesheets match it like the hover until the
 * last part has ended. A pointer that leaves within the hover intent never
 * starts a part, so it latches nothing.
 *
 * Safari has no CSS `d` and drops a morph's keyframes, so there each part
 * replays its morph as SMIL when it starts (styles/morph.ts).
 */
const MORPHS = { ...glyphMorphs, ...lockupMorphs };

// The svg's own animations, such as a loading spin, are not acts.
const isPart = (event: AnimationEvent) => event.target !== event.currentTarget;

export function actStart(event: AnimationEvent) {
    if (!isPart(event)) return;
    (event.currentTarget as Element).setAttribute("data-act", "");
    const morph = MORPHS[event.animationName];
    if (!morph || CSS.supports("d", 'path("M0 0")')) return;
    const replay = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "animate",
    );
    const attributes = {
        attributeName: "d",
        calcMode: "spline",
        begin: "indefinite",
        ...morph,
    };
    for (const [name, value] of Object.entries(attributes))
        replay.setAttribute(name, value);
    replay.addEventListener("endEvent", () => replay.remove());
    (event.target as Element).append(replay);
    replay.beginElement();
}

export function actEnd(event: AnimationEvent) {
    if (!isPart(event)) return;
    const svg = event.currentTarget as Element;
    const playing = svg
        .getAnimations({ subtree: true })
        .some(
            animation =>
                "animationName" in animation &&
                (animation.effect as KeyframeEffect | null)?.target !== svg &&
                animation.playState === "running",
        );
    if (!playing) svg.removeAttribute("data-act");
}
