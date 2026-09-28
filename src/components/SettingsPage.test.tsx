import { renderSolid } from "$tests/helpers/renderSolid";
// @vitest-environment happy-dom
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "./SettingsPage";

beforeEach(() => {
    localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
});

// A control by its visible name: a <label> for a select or field, plain text
// wired through aria-labelledby for a switch.
const control = (root: HTMLElement, name: string) => {
    const el = [...root.querySelectorAll("label, [id]")].find(
        l => l.textContent?.trim() === name,
    );
    if (!el) throw new Error(`no control named "${name}"`);
    return root.querySelector(
        el instanceof HTMLLabelElement
            ? `#${CSS.escape(el.htmlFor)}`
            : `[aria-labelledby="${el.id}"]`,
    ) as HTMLInputElement | HTMLSelectElement;
};

const choose = (select: HTMLSelectElement, text: string) => {
    const index = [...select.options].findIndex(o => o.text === text);
    select.selectedIndex = index;
    select.dispatchEvent(new Event("change", { bubbles: true }));
};

describe("SettingsPage", () => {
    it("shows every group", () => {
        const { container, unmount } = renderSolid(() => <SettingsPage />);
        const titles = [...container.querySelectorAll("h2")].map(
            h => h.textContent,
        );
        expect(titles).toEqual([
            "Search",
            "Connection",
            "History",
            "Tabs and appearance",
            "Privacy",
            "Backup",
            "Setup",
        ]);
        unmount();
    });

    it("saves a switch and a choice as they change", () => {
        const { container, unmount } = renderSolid(() => <SettingsPage />);
        (control(container, "Save history") as HTMLInputElement).click();
        expect(localStorage.getItem("civil:history-enabled")).toBe("false");
        choose(
            control(container, "Default method") as HTMLSelectElement,
            "libcurl",
        );
        expect(localStorage.getItem("transport")).toBe("libcurl");
        unmount();
    });

    it("leaves a switch alone when its name is clicked", () => {
        const { container, unmount } = renderSolid(() => <SettingsPage />);
        const toggle = control(container, "Save history") as HTMLInputElement;
        const name = container.querySelector(
            `#${CSS.escape(toggle.getAttribute("aria-labelledby")!)}`,
        ) as HTMLElement;
        expect(name.tagName).toBe("SPAN");
        const before = toggle.checked;
        name.click();
        expect(toggle.checked).toBe(before);
        expect(localStorage.getItem("civil:history-enabled")).toBeNull();
        unmount();
    });

    it("refuses a custom search address without %s", async () => {
        const { container, unmount } = renderSolid(() => <SettingsPage />);
        choose(
            control(container, "Search engine") as HTMLSelectElement,
            "Custom",
        );
        await vi.waitFor(() =>
            expect(container.textContent).toContain("Custom search address"),
        );
        const input = control(container, "Custom search address");
        input.value = "https://example.com/search?q=";
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await vi.waitFor(() =>
            expect(container.textContent).toContain(
                "Use a web address with %s where the search goes.",
            ),
        );
        expect(localStorage.getItem("civil:search-template")).toBeNull();

        input.value = "https://example.com/search?q=%s";
        input.dispatchEvent(new Event("change", { bubbles: true }));
        expect(localStorage.getItem("civil:search-template")).toBe(
            "https://example.com/search?q=%s",
        );
        unmount();
    });

    it("leaves a site out of history and offers to delete what it saved", async () => {
        localStorage.setItem(
            "civil-history",
            JSON.stringify([
                {
                    id: "a",
                    url: "https://m.youtube.com/watch",
                    title: "Video",
                    visitedAt: Date.now(),
                },
                {
                    id: "b",
                    url: "https://example.com/",
                    title: "Other",
                    visitedAt: Date.now() - 1000,
                },
            ]),
        );
        const { container, unmount } = renderSolid(() => <SettingsPage />);
        const site = container.querySelector(
            'input[aria-label="Site to leave out of history"]',
        ) as HTMLInputElement;
        site.value = "youtube.com";
        site.form!.requestSubmit();
        expect(
            JSON.parse(localStorage.getItem("civil:history-exclude")!),
        ).toEqual(["youtube.com"]);

        await vi.waitFor(() =>
            expect(container.textContent).toContain(
                "1 page from youtube.com is already saved.",
            ),
        );
        [...container.querySelectorAll("button")]
            .find(b => b.textContent?.trim() === "Delete it")!
            .click();
        await vi.waitFor(() =>
            expect(
                JSON.parse(localStorage.getItem("civil-history")!).map(
                    (e: { id: string }) => e.id,
                ),
            ).toEqual(["b"]),
        );
        unmount();
    });

    it("restores settings from pasted text", async () => {
        const { container, unmount } = renderSolid(() => <SettingsPage />);
        const button = (text: string) =>
            [...container.querySelectorAll("button")].find(
                b => b.textContent?.trim() === text,
            )!;
        button("Paste text").click();
        await vi.waitFor(() =>
            expect(container.querySelector("textarea")).not.toBeNull(),
        );
        container.querySelector("textarea")!.value = JSON.stringify({
            format: "civil-settings",
            version: 1,
            settings: { search: "brave", ads: false, madeUp: 1 },
        });
        button("Restore").click();
        expect(localStorage.getItem("search")).toBe("brave");
        expect(localStorage.getItem("civil:ads")).toBe("false");
        await vi.waitFor(() =>
            expect(container.textContent).toContain(
                "Restored 2 settings. Skipped 1 this version of Civil doesn't recognise.",
            ),
        );
        unmount();
    });

    it("adds a site rule under its bare hostname and removes it", async () => {
        const { container, unmount } = renderSolid(() => <SettingsPage />);
        const site = container.querySelector(
            'input[aria-label="Site"]',
        ) as HTMLInputElement;
        site.value = "https://www.Discord.com/app";
        site.dispatchEvent(new Event("input", { bubbles: true }));
        // Typing and submitting are separate tasks for a real user, and
        // Solid applies signal writes between them.
        await new Promise(resolve => setTimeout(resolve, 0));
        site.form!.requestSubmit();
        expect(
            JSON.parse(localStorage.getItem("civil:transport-sites")!),
        ).toEqual({ "discord.com": "libcurl" });

        await vi.waitFor(() =>
            expect(
                container.querySelector(
                    'button[aria-label="Remove the rule for discord.com"]',
                ),
            ).not.toBeNull(),
        );
        (
            container.querySelector(
                'button[aria-label="Remove the rule for discord.com"]',
            ) as HTMLButtonElement
        ).click();
        expect(
            JSON.parse(localStorage.getItem("civil:transport-sites")!),
        ).toEqual({});
        unmount();
    });
});
