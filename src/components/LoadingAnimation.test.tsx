// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import * as s from "~/styles/LoadingAnimation.css";
import LoadingAnimation from "./LoadingAnimation";

describe("LoadingAnimation", () => {
    it("draws the mark and a stream of route nodes", () => {
        const { container, unmount } = renderSolid(() => <LoadingAnimation />);
        expect(container.querySelector(`.${s.loadingMarkC}`)).not.toBeNull();
        expect(container.querySelectorAll(`.${s.loadingMarkNode}`).length).toBe(
            3,
        );
        unmount();
    });

    /**
     * The whole idea rests on paint order. The nodes are drawn *before* the C so
     * the letter's own material occludes them and the route surfaces only in the
     * mouth and the counter — exactly as the wordmark does it at full size. Move
     * the path above the rects and the nodes float over the glyph: still
     * animated, still on-palette, and meaningless.
     *
     * There is no clip path or mask holding this together, so nothing else would
     * catch the regression.
     */
    it("paints the route behind the letter, not over it", () => {
        const { container, unmount } = renderSolid(() => <LoadingAnimation />);
        const svg = container.querySelector(`.${s.loadingMark}`);
        const kids = [...(svg?.children ?? [])];

        const lastNode = kids.findLastIndex(el =>
            el.classList.contains(s.loadingMarkNode),
        );
        const letter = kids.findIndex(el =>
            el.classList.contains(s.loadingMarkC),
        );

        expect(letter).toBeGreaterThan(-1);
        expect(lastNode).toBeGreaterThan(-1);
        expect(letter).toBeGreaterThan(lastNode);
        unmount();
    });

    it("hides the mark from assistive tech and announces status as text", () => {
        const { container, unmount } = renderSolid(() => <LoadingAnimation />);
        expect(
            container
                .querySelector(`.${s.loadingMark}`)
                ?.getAttribute("aria-hidden"),
        ).toBe("true");
        expect(container.textContent).toContain("Loading");
        unmount();
    });

    /**
     * Each node enters a third of a cycle after the one before it. Collapse the
     * stagger and three nodes sit on top of each other, which renders as one.
     */
    it("staggers the nodes across the cycle", () => {
        const { container, unmount } = renderSolid(() => <LoadingAnimation />);
        const delays = [
            ...container.querySelectorAll<HTMLElement>(`.${s.loadingMarkNode}`),
        ].map(el => el.style.animationDelay);

        expect(delays).toEqual(["0ms", "800ms", "1600ms"]);
        unmount();
    });
});
