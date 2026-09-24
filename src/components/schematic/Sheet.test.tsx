import { renderSolid } from "$tests/helpers/renderSolid";
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import Sheet from "./Sheet";

import * as s from "~/styles/schematic.css";

describe("Sheet", () => {
    it("renders its children on the sheet plane", () => {
        const { container, unmount } = renderSolid(() => (
            <Sheet class="extra">
                <p>body</p>
            </Sheet>
        ));
        const root = container.firstElementChild!;
        expect(root.className).toContain(s.sheet);
        expect(root.className).toContain("extra");
        expect(container.textContent).toContain("body");
        unmount();
    });

    it("draws no decoration around the content", () => {
        const { container, unmount } = renderSolid(() => <Sheet>x</Sheet>);
        expect(container.querySelectorAll("[aria-hidden]")).toHaveLength(0);
        unmount();
    });
});
