import { renderSolid } from "$tests/helpers/renderSolid";
// @vitest-environment happy-dom
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

// An Edge window on a short screen whose network blocks WebSockets.
vi.mock("~/lib/setupDefaults", async importOriginal => ({
    ...(await importOriginal<typeof import("~/lib/setupDefaults")>()),
    readSetupEnv: async () => ({
        userAgent: "Mozilla/5.0 Chrome/139.0 Safari/537.36 Edg/139.0",
        brave: false,
        privacySignal: false,
        saveData: false,
        cores: 8,
        memoryGb: 8,
        reducedMotion: false,
        viewportHeight: 600,
        quota: 50 * 1024 ** 3,
        webSocketWorks: async () => false,
    }),
}));

import SetupPage from "./SetupPage";

const buttonNamed = (root: HTMLElement, text: string) => {
    const button = [...root.querySelectorAll("button")].find(
        b => b.textContent?.trim() === text,
    );
    if (!button) throw new Error(`no button "${text}"`);
    return button;
};

beforeEach(() => {
    localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
});

describe("SetupPage", () => {
    it("picks everything, says why, and saves on Start browsing", async () => {
        const replace = vi
            .spyOn(window.location, "replace")
            .mockImplementation(() => {});
        const { container, unmount } = renderSolid(() => <SetupPage />);

        buttonNamed(container, "Pick for me").click();
        await vi.waitFor(() =>
            expect(container.textContent).toContain("You're all set."),
        );
        expect(container.textContent).toContain("Bing");
        expect(container.textContent).toContain(
            "Automatic, starting with Bare",
        );
        expect(container.textContent).toContain("Show on new tabs only");
        expect(container.textContent).toContain(
            "You use Microsoft Edge, which searches with Bing.",
        );
        const rows = container.querySelectorAll("dd");
        const marked = [...rows].filter(dd =>
            dd.textContent?.includes("Picked for you"),
        );
        expect(marked.length).toBe(rows.length);

        buttonNamed(container, "Start browsing").click();
        await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
        expect(localStorage.getItem("search")).toBe("bing");
        expect(localStorage.getItem("transport")).toBe("bare");
        expect(localStorage.getItem("civil:bookmarks-bar")).toBe("newtab");
        expect(localStorage.getItem("civil:setup-complete")).not.toBeNull();
        replace.mockRestore();
        unmount();
    });

    it("keeps a choice the visitor made and picks only what they skipped", async () => {
        const { container, unmount } = renderSolid(() => <SetupPage />);

        buttonNamed(container, "Set up Civil").click();
        await vi.waitFor(() =>
            expect(container.textContent).toContain(
                "How do you like to search?",
            ),
        );
        const ddg = [...container.querySelectorAll("label")].find(l =>
            l.textContent?.includes("DuckDuckGo"),
        )!;
        ddg.querySelector("input")!.click();
        buttonNamed(container, "Next").click();

        await vi.waitFor(() =>
            expect(container.textContent).toContain(
                "How should Civil connect?",
            ),
        );
        buttonNamed(container, "Skip setup").click();
        await vi.waitFor(() =>
            expect(container.textContent).toContain("You're all set."),
        );

        const search = [...container.querySelectorAll("dd")][0];
        expect(search.textContent).toContain("DuckDuckGo");
        expect(search.textContent).not.toContain("Picked for you");
        const connection = [...container.querySelectorAll("dd")][2];
        expect(connection.textContent).toContain("Picked for you");
        unmount();
    });
});
