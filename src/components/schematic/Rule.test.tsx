// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import * as s from "~/styles/schematic.css";
import Rule from "./Rule";

describe("Rule", () => {
    it("renders a label when given one", () => {
        const { container, unmount } = renderSolid(() => (
            <Rule label="add item" />
        ));
        expect(container.textContent).toContain("add item");
        unmount();
    });

    it("renders no text when unlabelled", () => {
        const { container, unmount } = renderSolid(() => <Rule />);
        expect(container.textContent).toBe("");
        unmount();
    });

    it("hides the line itself from assistive tech", () => {
        const { container, unmount } = renderSolid(() => <Rule label="lat" />);
        const line = container.querySelector(`.${s.ruleLine}`);
        expect(line?.getAttribute("aria-hidden")).toBe("true");
        unmount();
    });

    it("uses the major weight when asked", () => {
        const { container, unmount } = renderSolid(() => (
            <Rule weight="major" />
        ));
        expect(container.querySelector(`.${s.ruleLineMajor}`)).not.toBeNull();
        unmount();
    });

    it("renders two dimension caps when caps are requested", () => {
        const { container, unmount } = renderSolid(() => <Rule caps />);
        expect(container.querySelectorAll(`.${s.ruleCap}`)).toHaveLength(2);
        unmount();
    });

    it("renders no caps by default", () => {
        const { container, unmount } = renderSolid(() => <Rule />);
        expect(container.querySelectorAll(`.${s.ruleCap}`)).toHaveLength(0);
        unmount();
    });

    it("marks caps as decorative", () => {
        const { container, unmount } = renderSolid(() => <Rule caps />);
        for (const cap of container.querySelectorAll(`.${s.ruleCap}`)) {
            expect(cap.getAttribute("aria-hidden")).toBe("true");
        }
        unmount();
    });
});
