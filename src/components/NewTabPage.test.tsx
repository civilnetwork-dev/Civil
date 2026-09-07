import { renderSolid } from "$tests/helpers/renderSolid";
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import NewTabPage from "./NewTabPage";

import * as page from "~/styles/NewTabPage.css";
import * as s from "~/styles/schematic.css";

describe("NewTabPage", () => {
    /**
     * The wordmark is drawn art, not type, so the heading has no text content —
     * its accessible name comes from the `role="img"` label on the SVG. Asserting
     * on `textContent` here would pass only if someone quietly put the word back
     * as a string, which is the regression this guards against.
     */
    it("renders the wordmark as the page heading", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        const mark = container.querySelector("h1 svg[role='img']");
        expect(mark).not.toBeNull();
        expect(mark?.getAttribute("aria-label")).toBe("Civil");
        unmount();
    });

    /**
     * The heading must not carry stray text.
     *
     * The wordmark is drawn art whose name comes from `aria-label`, so the `h1`
     * has no text of its own — but SVG `<title>` elements *do* contribute to
     * `textContent`. Five of them, one per joint, once made this heading read
     * `"relayprivatefilter checkbrowser in a browserout"` in the live page.
     * The assertion above passed the whole time, because it only ever looked at
     * the `aria-label`. This is the check that would have caught it.
     */
    it("keeps the heading free of stray text from the drawing", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        expect(container.querySelector("h1")?.textContent?.trim()).toBe("");
        expect(container.querySelectorAll("h1 svg title").length).toBe(0);
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

    it("renders the strata section, hidden from assistive tech", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        const layer = container.querySelector(`.${page.sectionLayer}`);
        expect(layer).not.toBeNull();
        expect(layer?.getAttribute("aria-hidden")).toBe("true");
        expect(layer?.querySelectorAll(`.${page.band}`).length).toBe(9);
        unmount();
    });

    /**
     * The minimal pass cut the depth log, the sample callout, and the session
     * readout: fake figures, engine names and transport diagnostics are
     * developer decoration, and this page's job is to show a first-time user
     * exactly one thing to do. This pins the cut so nothing labelled creeps
     * back into the ground layer.
     */
    it("keeps the section as pure ground — no figures, no callouts", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        const layer = container.querySelector(`.${page.sectionLayer}`);
        expect(layer?.textContent).toBe("");
        expect(container.textContent).not.toContain("scramjet");
        expect(container.textContent).not.toContain("wisp");
        unmount();
    });

    /**
     * This page server-side renders. A section drawn from `Math.random()` would
     * differ between the server pass and the client pass, which is a hydration
     * mismatch and a visible flicker on load.
     */
    it("draws the section deterministically across renders", () => {
        const first = renderSolid(() => <NewTabPage />);
        const firstHtml = first.container.querySelector(
            `.${page.sectionLayer}`,
        )?.outerHTML;
        first.unmount();

        const second = renderSolid(() => <NewTabPage />);
        const secondHtml = second.container.querySelector(
            `.${page.sectionLayer}`,
        )?.outerHTML;
        second.unmount();

        expect(firstHtml).toBeTruthy();
        expect(firstHtml).toBe(secondHtml);
    });

    it("renders a horizon rule spanning the sheet at the omnibox's baseline", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        const track = container.querySelector(`.${page.horizonRuleTrack}`);
        expect(track).not.toBeNull();
        expect(track?.querySelector(`.${s.ruleLineMajor}`)).not.toBeNull();
        unmount();
    });
});
