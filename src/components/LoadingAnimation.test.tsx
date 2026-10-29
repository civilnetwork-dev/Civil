import { renderSolid } from "$tests/helpers/renderSolid";
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import LoadingAnimation from "./LoadingAnimation";

import * as s from "~/styles/LoadingAnimation.css";

describe("LoadingAnimation", () => {
    it("draws the mark and a stream of route nodes", () => {
        const { container, unmount } = renderSolid(() => <LoadingAnimation />);
        expect(
            container.querySelector(`.${s.loadingMarkStone}`),
        ).not.toBeNull();
        expect(container.querySelector(`.${s.loadingMarkDoor}`)).not.toBeNull();
        expect(container.querySelectorAll(`.${s.loadingMarkNode}`).length).toBe(
            3,
        );
        unmount();
    });

    /**
     * The whole idea rests on paint order. The door's light is drawn first, the
     * nodes over it, and the stone last, so the stone's own material occludes
     * the nodes and the traffic surfaces only in the door. Move the stone below
     * the rects and the nodes float over the wall; move the light above them
     * and they vanish into it: still animated, still on-palette, and
     * meaningless.
     *
     * There is no clip path or mask holding this together, so nothing else would
     * catch the regression.
     */
    it("paints the traffic over the light and behind the stone", () => {
        const { container, unmount } = renderSolid(() => <LoadingAnimation />);
        const svg = container.querySelector(`.${s.loadingMark}`);
        const kids = [...(svg?.children ?? [])];

        const firstNode = kids.findIndex(el =>
            el.classList.contains(s.loadingMarkNode),
        );
        const lastNode = kids.findLastIndex(el =>
            el.classList.contains(s.loadingMarkNode),
        );
        const door = kids.findIndex(el =>
            el.classList.contains(s.loadingMarkDoor),
        );
        const stone = kids.findIndex(el =>
            el.classList.contains(s.loadingMarkStone),
        );

        expect(door).toBeGreaterThan(-1);
        expect(firstNode).toBeGreaterThan(door);
        expect(stone).toBeGreaterThan(lastNode);
        unmount();
    });
});

describe("LoadingAnimation accessibility and timing", () => {
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
