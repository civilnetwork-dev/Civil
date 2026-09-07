import { renderSolid } from "$tests/helpers/renderSolid";
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import StrikeGauge from "./StrikeGauge";

import * as s from "~/styles/StrikeGauge.css";

/**
 * The gauge is the only place in the app that renders account standing, and it
 * previously coloured its segments from `--civil-color-yellow`,
 * `--civil-color-maroon` and `--civil-color-red` — none of which exist, since
 * the theme contract only generates `--civil-color-<palette-slot>`. Every
 * segment therefore rendered with no colour, on both pages that drew it, and
 * nothing failed.
 *
 * These tests pin the two things that were actually broken: that a used
 * segment carries a real class from the stylesheet, and that the severity ramp
 * scales with the cap rather than with a fixed strike count.
 */

function mount(violations: number, maxViolations: number) {
    return renderSolid(() => (
        <StrikeGauge
            violations={violations}
            maxViolations={maxViolations}
            policy={false}
        />
    ));
}

const segments = (c: HTMLElement) =>
    Array.from(c.querySelectorAll(`.${s.gauge} > span`));

describe("StrikeGauge", () => {
    it("draws one segment per allowed strike, not per strike taken", () => {
        const { container } = mount(2, 5);
        expect(segments(container)).toHaveLength(5);
    });

    it("fills exactly as many segments as strikes taken", () => {
        const { container } = mount(2, 5);
        const filled = segments(container).filter(
            el => !el.className.includes(s.segment.free),
        );
        expect(filled).toHaveLength(2);
    });

    it("gives every used segment a real class rather than an empty colour", () => {
        const { container } = mount(3, 5);
        const used = segments(container).filter(
            el => !el.className.includes(s.segment.free),
        );
        // The regression: these carried a class whose colour resolved to
        // nothing. Any of the three tone classes is acceptable; none is not.
        for (const el of used) {
            const tone = [s.segment.low, s.segment.mid, s.segment.high].some(
                c => el.className.includes(c),
            );
            expect(tone, el.className).toBe(true);
        }
    });

    /**
     * Severity is relative to the cap. One strike out of three is a different
     * situation from one out of ten, so a fixed "warn at 2" threshold would be
     * wrong for every cap but the one it was written against.
     */
    it("ramps severity against the cap, not a fixed count", () => {
        const low = mount(1, 10);
        expect(segments(low.container)[0].className).toContain(s.segment.low);

        const mid = mount(5, 10);
        expect(segments(mid.container)[0].className).toContain(s.segment.mid);

        const high = mount(10, 10);
        expect(segments(high.container)[0].className).toContain(s.segment.high);
    });

    it("reaches the top tone on the final strike of a small cap", () => {
        const { container } = mount(3, 3);
        expect(segments(container)[0].className).toContain(s.segment.high);
    });

    /**
     * Solid renders the number 0 as nothing at all, and zero strikes is the
     * most common state this component is ever asked to show — a blank where
     * the count belongs reads as a broken page, not as "you are fine".
     */
    it("renders a zero count as text", () => {
        const { container } = mount(0, 5);
        expect(container.textContent).toContain("0 / 5");
    });

    it("leaves every segment unfilled at zero strikes", () => {
        const { container } = mount(0, 5);
        const filled = segments(container).filter(
            el => !el.className.includes(s.segment.free),
        );
        expect(filled).toHaveLength(0);
    });
});
