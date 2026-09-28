// @vitest-environment happy-dom
import { renderSolid } from "$tests/helpers/renderSolid";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setSetting } from "~/lib/settings";

import NewTabPage from "./NewTabPage";

afterEach(() => vi.restoreAllMocks());

describe("NewTabPage", () => {
    it("stops crediting ads once they're turned off", async () => {
        setSetting("ads", false);
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        await vi.waitFor(() =>
            expect(container.textContent).toContain(
                "Civil is free and open source.",
            ),
        );
        expect(container.textContent).not.toContain("Ads keep");
        setSetting("ads", true);
        unmount();
    });

    it("gives new users a clear start and all four browser destinations", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        expect(container.querySelector("h1")?.textContent).toBe(
            "A little space to explore.",
        );
        expect(
            container.querySelector('svg[aria-label="Civil Proxy"]'),
        ).not.toBeNull();
        const links = [...container.querySelectorAll("nav a")];
        expect(links.map(link => link.getAttribute("href"))).toEqual([
            "/apps",
            "/bookmarks",
            "/history",
            "/extensions",
        ]);
        expect(
            container.querySelector('a[href="/checkfilters"]'),
        ).not.toBeNull();
        expect(container.textContent).toContain(
            "Ads keep Civil free and open source.",
        );
        unmount();
    });

    it("offers a working browser entry instead of an inert search outside a tab", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        expect(container.querySelector("input")).toBeNull();
        const entry = [...container.querySelectorAll('a[href="/"]')].find(
            link => link.textContent?.includes("Open Civil browser"),
        );
        expect(entry).toBeDefined();
        unmount();
    });

    it("hands shortcut navigation to the parent without hijacking modified clicks", () => {
        vi.spyOn(window, "top", "get").mockReturnValue(null);
        const postMessage = vi
            .spyOn(window.parent, "postMessage")
            .mockImplementation(() => {});
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        // Solid 2 drops a boolean `spellcheck={false}`, which left spellcheck on.
        expect(
            container.querySelector("input")?.getAttribute("spellcheck"),
        ).toBe("false");
        const link = container.querySelector<HTMLAnchorElement>(
            'a[href="/bookmarks"]',
        )!;
        const click = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
        });
        link.dispatchEvent(click);
        expect(click.defaultPrevented).toBe(true);
        expect(postMessage).toHaveBeenCalledWith(
            { type: "civil:navigate", url: "browser:bookmarks" },
            window.location.origin,
        );
        postMessage.mockClear();
        const modified = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
        });
        link.dispatchEvent(modified);
        expect(modified.defaultPrevented).toBe(false);
        expect(postMessage).not.toHaveBeenCalled();
        unmount();
    });
});
