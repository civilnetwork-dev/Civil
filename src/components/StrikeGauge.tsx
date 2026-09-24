import { For, Show } from "solid-js";

import type { SegmentTone } from "~/styles/StrikeGauge.css";
import * as s from "~/styles/StrikeGauge.css";

/**
 * The shared strike readout, used by both the interstitial and the status page.
 *
 * It lives here rather than in either page because the two rendered the same
 * gauge from two copies of the same markup, and both copies carried the same
 * dead-CSS-variable bug. One copy means one fix.
 */
export default function StrikeGauge(props: {
    violations: number;
    maxViolations: number;
    /** Omit the explanatory policy text where the surrounding page already says it. */
    policy?: boolean;
}) {
    /**
     * Severity ramps with how close the account is to the cap, not with a fixed
     * threshold: one strike out of three is not the same situation as one out
     * of ten. The final strike is always the most severe tone.
     */
    const tone = (): SegmentTone => {
        if (props.violations >= props.maxViolations) return "high";
        if (props.violations >= Math.ceil(props.maxViolations / 2))
            return "mid";
        return "low";
    };

    return (
        <div>
            <div class={s.head}>
                <span class={s.label}>Strikes</span>
                {/* String(), because Solid renders the number 0 as nothing at
                    all — and zero strikes is the single most common state this
                    component is asked to display. */}
                <span class={s.count}>
                    {String(props.violations)} / {String(props.maxViolations)}
                </span>
            </div>
            {/* Presentational: the "n / max" readout above is the accessible
                value, so the cells are not announced a second time. */}
            <div class={s.gauge} aria-hidden="true">
                <For
                    each={Array.from(
                        { length: props.maxViolations },
                        (_, i) => i,
                    )}
                    keyed={false}
                >
                    {i => (
                        <span
                            class={
                                i() < props.violations
                                    ? s.segment[tone()]
                                    : s.segment.free
                            }
                        />
                    )}
                </For>
            </div>
            <Show when={props.policy !== false}>
                <span class={s.policy}>
                    Reaching a restricted domain through the proxy counts as a
                    strike. At {String(props.maxViolations)} strikes the account
                    is permanently banned. Strikes reset after 24 hours of
                    inactivity.
                </span>
            </Show>
        </div>
    );
}
