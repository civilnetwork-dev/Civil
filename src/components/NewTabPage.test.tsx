// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import * as s from "~/styles/schematic.css";
import NewTabPage from "./NewTabPage";

describe("NewTabPage", () => {
    it("renders the wordmark as the page heading", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        expect(container.querySelector("h1")?.textContent).toBe("Civil");
        unmount();
    });

    it("renders the sheet's ruled field", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        expect(container.querySelector(`.${s.sheetField}`)).not.toBeNull();
        unmount();
    });

    it("renders registration marks as decoration", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        const marks = container.querySelectorAll(`.${s.mark}`);
        expect(marks.length).toBeGreaterThan(0);
        for (const m of marks) {
            expect(m.getAttribute("aria-hidden")).toBe("true");
        }
        unmount();
    });

    it("keeps the ad notice, since ad revenue is a fixed product constraint", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        expect(container.textContent?.toLowerCase()).toContain(
            "ads keep civil",
        );
        unmount();
    });

    it("hides the omnibox outside a frame", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        expect(container.querySelector("input")).toBeNull();
        unmount();
    });
});
