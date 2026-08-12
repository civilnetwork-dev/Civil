// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import * as page from "~/styles/NewTabPage.css";
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

    it("renders the star field, hidden from assistive tech", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        const svg = container.querySelector(`svg.${page.starField}`);
        expect(svg).not.toBeNull();
        expect(svg?.getAttribute("aria-hidden")).toBe("true");
        unmount();
    });

    it("draws more than a handful of stars", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        const svg = container.querySelector(`svg.${page.starField}`);
        expect(svg?.querySelectorAll("circle").length).toBeGreaterThan(40);
        unmount();
    });

    it("renders the catalogued star's label as real text", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        const label = container.querySelector(`.${page.catalogueLabel}`);
        expect(label).not.toBeNull();
        expect(label?.getAttribute("aria-hidden")).not.toBe("true");
        expect(label?.textContent).toContain("scramjet");
        unmount();
    });

    it("draws the star field deterministically across renders", () => {
        const first = renderSolid(() => <NewTabPage />);
        const firstSvg = first.container.querySelector(
            `svg.${page.starField}`,
        )?.outerHTML;
        first.unmount();

        const second = renderSolid(() => <NewTabPage />);
        const secondSvg = second.container.querySelector(
            `svg.${page.starField}`,
        )?.outerHTML;
        second.unmount();

        expect(firstSvg).toBeTruthy();
        expect(firstSvg).toBe(secondSvg);
    });

    it("renders a horizon rule spanning the sheet at the omnibox's baseline", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        const track = container.querySelector(`.${page.horizonRuleTrack}`);
        expect(track).not.toBeNull();
        expect(track?.querySelector(`.${s.ruleLineMajor}`)).not.toBeNull();
        unmount();
    });
});
