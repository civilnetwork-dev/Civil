import { renderSolid } from "$tests/helpers/renderSolid";
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { IconCheck, IconWorld } from "./index";

import * as s from "~/styles/icons.css";

/**
 * Every glyph is a small solid: an extrusion, a lit rim and a face, drawn from
 * one path source so the three can never drift out of register.
 */
describe("glyph layers", () => {
    const paths = (layer: Element) =>
        [...layer.querySelectorAll("path")]
            .map(p => p.getAttribute("d"))
            .join("|");

    it("draws depth, rim and face from the same path data", () => {
        const { container, unmount } = renderSolid(() => (
            <IconWorld size={14} />
        ));
        const svg = container.querySelector("svg")!;
        const [depth, rim, face] = [...svg.children];

        expect([...svg.children].map(g => g.getAttribute("class"))).toEqual([
            s.depth,
            s.rim,
            s.face,
        ]);
        expect(paths(depth)).toBe(paths(face));
        expect(paths(rim)).toBe(paths(face));
        expect(svg.getAttribute("aria-hidden")).toBe("true");
        expect(svg.getAttribute("width")).toBe("14");
        unmount();
    });

    it("keeps filled glyphs filled on every layer", () => {
        const { container, unmount } = renderSolid(() => <IconCheck />);
        const svg = container.querySelector("svg")!;
        expect(svg.getAttribute("fill")).toBe("currentColor");
        expect(svg.querySelectorAll(":scope > g")).toHaveLength(3);
        unmount();
    });
});
