// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import * as s from "~/styles/schematic.css";
import Sheet from "./Sheet";

describe("Sheet", () => {
    it("renders its children", () => {
        const { container, unmount } = renderSolid(() => (
            <Sheet>
                <p>body</p>
            </Sheet>
        ));
        expect(container.textContent).toContain("body");
        unmount();
    });

    it("marks the ruled field decorative", () => {
        const { container, unmount } = renderSolid(() => <Sheet>x</Sheet>);
        const fieldEl = container.querySelector(`.${s.sheetField}`);
        expect(fieldEl?.getAttribute("aria-hidden")).toBe("true");
        unmount();
    });

    it("defaults to three registration marks, leaving bottom-left for the title block", () => {
        const { container, unmount } = renderSolid(() => <Sheet>x</Sheet>);
        expect(container.querySelectorAll(`.${s.mark}`)).toHaveLength(3);
        expect(container.querySelector(`.${s.markCorner.bl}`)).toBeNull();
        unmount();
    });

    it("renders only the requested marks", () => {
        const { container, unmount } = renderSolid(() => (
            <Sheet marks={["tl"]}>x</Sheet>
        ));
        expect(container.querySelectorAll(`.${s.mark}`)).toHaveLength(1);
        expect(container.querySelector(`.${s.markCorner.tl}`)).not.toBeNull();
        unmount();
    });

    it("marks registration marks decorative", () => {
        const { container, unmount } = renderSolid(() => <Sheet>x</Sheet>);
        for (const m of container.querySelectorAll(`.${s.mark}`)) {
            expect(m.getAttribute("aria-hidden")).toBe("true");
        }
        unmount();
    });

    it("applies the requested field density", () => {
        const { container, unmount } = renderSolid(() => (
            <Sheet density="coarse">x</Sheet>
        ));
        const fieldEl = container.querySelector(`.${s.sheetField}`);
        expect(fieldEl?.className).toContain(s.sheetFieldDensity.coarse);
        unmount();
    });
});
