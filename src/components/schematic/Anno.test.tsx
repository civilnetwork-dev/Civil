import { renderSolid } from "$tests/helpers/renderSolid";
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import Anno from "./Anno";

import * as s from "~/styles/schematic.css";

describe("Anno", () => {
    it("renders its children", () => {
        const { container, unmount } = renderSolid(() => <Anno>12ms</Anno>);
        expect(container.textContent).toBe("12ms");
        unmount();
    });

    it("uses the annotation class by default", () => {
        const { container, unmount } = renderSolid(() => <Anno>x</Anno>);
        expect(container.firstElementChild?.className).toContain(s.anno);
        unmount();
    });

    it("uses the muted class when asked", () => {
        const { container, unmount } = renderSolid(() => <Anno muted>x</Anno>);
        expect(container.firstElementChild?.className).toContain(s.annoMuted);
        unmount();
    });

    it("appends a caller class", () => {
        const { container, unmount } = renderSolid(() => (
            <Anno class="extra">x</Anno>
        ));
        expect(container.firstElementChild?.className).toContain("extra");
        unmount();
    });
});
