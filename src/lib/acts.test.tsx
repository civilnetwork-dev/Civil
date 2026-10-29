import { renderSolid } from "$tests/helpers/renderSolid";
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

import * as icons from "~/components/icons";
import { Wordmark } from "~/components/Wordmark";

import { glyphMorphs } from "~/styles/icons.css";
import { lockupMorphs } from "~/styles/Wordmark.css";

const MORPHS = { ...glyphMorphs, ...lockupMorphs };
const numbers = (d: string) => d.match(/-?\d*\.?\d+/g)!.map(Number);
const commands = (d: string) => d.replace(/[-\d.\s]+/g, " ").trim();

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("hover acts", () => {
    // CSS `d` and SMIL both tween point by point, so every frame needs the
    // drawing's commands in its order, and an act that starts or ends
    // anywhere but the drawing jumps when it starts or ends.
    it("tweens each morph from the drawing back to it, one structure throughout", () => {
        const { container, unmount } = renderSolid(() => (
            <>
                {Object.values(icons).map(Icon => (
                    <Icon />
                ))}
                <Wordmark />
            </>
        ));
        const drawn = [...container.querySelectorAll("path")].map(p =>
            p.getAttribute("d")!,
        );
        const isDrawn = (d: string) =>
            drawn.some(
                other =>
                    commands(other) === commands(d) &&
                    numbers(other).every(
                        (n, i) => Math.abs(n - numbers(d)[i]) < 0.002,
                    ),
            );

        // Close's two blades, the tick, the socket, three bookmarks, and the
        // lockup's door and X.
        expect(Object.keys(MORPHS)).toHaveLength(9);
        for (const morph of Object.values(MORPHS)) {
            const values = morph.values.split(";");
            const keyTimes = morph.keyTimes.split(";").map(Number);
            const splines = morph.keySplines.split(";");
            expect(new Set(values.map(commands)).size).toBe(1);
            expect(isDrawn(values[0]) && isDrawn(values.at(-1)!)).toBe(true);
            expect(keyTimes).toHaveLength(values.length);
            expect([keyTimes[0], keyTimes.at(-1)]).toEqual([0, 1]);
            expect(splines).toHaveLength(values.length - 1);
            for (const spline of splines)
                expect(numbers(spline)).toHaveLength(4);
        }
        unmount();
    });
});

describe("hover acts latching", () => {
    it("latches an act on its glyph until the last part ends", () => {
        const { container, unmount } = renderSolid(() => (
            <icons.IconBookmark />
        ));
        const svg = container.querySelector("svg")!;
        const part = svg.querySelector("path")!;
        let running = [{ animationName: "act", playState: "running" }];
        svg.getAnimations = () => running as unknown as Animation[];
        const fire = (target: Element, type: string) =>
            target.dispatchEvent(
                new AnimationEvent(type, {
                    animationName: "act",
                    bubbles: true,
                }),
            );

        // The svg's own animation, such as a loading spin, is not an act.
        fire(svg, "animationstart");
        expect(svg.hasAttribute("data-act")).toBe(false);

        fire(part, "animationstart");
        expect(svg.hasAttribute("data-act")).toBe(true);
        fire(part, "animationend");
        expect(svg.hasAttribute("data-act")).toBe(true);
        running = [];
        fire(part, "animationcancel");
        expect(svg.hasAttribute("data-act")).toBe(false);
        unmount();
    });
});

describe("hover acts SMIL fallback", () => {
    it("replays a morph as SMIL where CSS has no `d`", () => {
        const { container, unmount } = renderSolid(() => (
            <icons.IconBookmark />
        ));
        const part = container.querySelector("path")!;
        vi.stubGlobal("CSS", { supports: () => false });
        const begin = vi.fn();
        const create = document.createElementNS.bind(document);
        vi.spyOn(document, "createElementNS").mockImplementation(
            (ns: string | null, tag: string) =>
                Object.assign(create(ns, tag), { beginElement: begin }),
        );
        const [name, morph] = Object.entries(glyphMorphs)[0];
        part.dispatchEvent(
            new AnimationEvent("animationstart", {
                animationName: name,
                bubbles: true,
            }),
        );
        const replay = part.querySelector("animate")!;

        expect(begin).toHaveBeenCalledOnce();
        expect(replay.getAttribute("attributeName")).toBe("d");
        expect(replay.getAttribute("values")).toBe(morph.values);
        expect(replay.getAttribute("keySplines")).toBe(morph.keySplines);
        unmount();
    });
});
