import { renderSolid } from "$tests/helpers/renderSolid";
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import Plate from "./Plate";

import * as s from "~/styles/schematic.css";

describe("Plate", () => {
    it("renders its children", () => {
        const { container, unmount } = renderSolid(() => (
            <Plate>content</Plate>
        ));
        expect(container.textContent).toContain("content");
        unmount();
    });

    it("renders two corner ticks by default", () => {
        const { container, unmount } = renderSolid(() => <Plate>x</Plate>);
        expect(container.querySelectorAll(`.${s.plateTick}`)).toHaveLength(2);
        unmount();
    });

    it("omits ticks when asked", () => {
        const { container, unmount } = renderSolid(() => (
            <Plate ticks={false}>x</Plate>
        ));
        expect(container.querySelectorAll(`.${s.plateTick}`)).toHaveLength(0);
        unmount();
    });

    it("marks ticks decorative", () => {
        const { container, unmount } = renderSolid(() => <Plate>x</Plate>);
        for (const tick of container.querySelectorAll(`.${s.plateTick}`)) {
            expect(tick.getAttribute("aria-hidden")).toBe("true");
        }
        unmount();
    });

    it("renders a div by default and a list item on request", () => {
        const asDiv = renderSolid(() => <Plate>x</Plate>);
        expect(asDiv.container.firstElementChild?.tagName).toBe("DIV");
        asDiv.unmount();

        const asLi = renderSolid(() => (
            <ul>
                <Plate as="li">x</Plate>
            </ul>
        ));
        expect(asLi.container.querySelector("li")).not.toBeNull();
        asLi.unmount();
    });
});
