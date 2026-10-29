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
        // The sheet is the page column inside the app shell.
        const sheet = container.querySelector(`.${s.sheet}`)!;
        expect(sheet.className).toContain("extra");
        expect(sheet.textContent).toContain("body");
        unmount();
    });

    it("draws no decoration around the content", () => {
        const { container, unmount } = renderSolid(() => <Sheet>x</Sheet>);
        const sheet = container.querySelector(`.${s.sheet}`)!;
        expect(sheet.querySelectorAll("[aria-hidden]")).toHaveLength(0);
        unmount();
    });
});
