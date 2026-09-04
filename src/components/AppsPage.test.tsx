// @vitest-environment happy-dom
import { flush } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import type { CivilApp } from "~/types";

/**
 * `apps()` is mutable per test rather than a fixed empty array: the plate only
 * renders its `<ul>` when at least one app exists, so an always-empty mock could
 * never exercise the grid at all.
 */
let mockApps: CivilApp[] = [];

vi.mock("~/api/apps", () => ({
    apps: () => mockApps,
    appsAdd: vi.fn(async () => undefined),
    appsRemove: vi.fn(),
}));

vi.mock("~/lib/TabManager", () => ({
    tabManager: {
        tabs: [],
        createTab: vi.fn(() => ({ id: "t1" })),
        activateTab: vi.fn(),
    },
    BROWSER_URLS: {},
}));

const { default: AppsPage } = await import("./AppsPage");
const s = await import("~/styles/schematic.css");

const ONE_APP: CivilApp[] = [
    {
        id: "a1",
        url: "https://chess.org/",
        name: "chess.org",
        icon: null,
        addedAt: 0,
    },
];

beforeEach(() => {
    mockApps = [];
});

describe("AppsPage", () => {
    it("renders the page title", () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        expect(container.querySelector("h1")?.textContent).toBe("Apps");
        unmount();
    });

    it("sits on a sheet", () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        expect(container.querySelector(`.${s.sheetField}`)).not.toBeNull();
        unmount();
    });

    it("labels the add field in plain words", () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        const label = container.querySelector("label") as HTMLLabelElement;
        const input = container.querySelector("input") as HTMLInputElement;
        expect(label.getAttribute("for")).toBe(input.id);
        expect(container.textContent?.toLowerCase()).toContain("add a site");
        unmount();
    });

    /**
     * One line of text, not a grid of dashed numbered slots. The ghost grid
     * looked like a broken page to a first-time user — eight empty boxes
     * labelled 01–08 with nothing in them reads as "this failed to load".
     */
    it("renders the empty state as one plain sentence", () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        expect(container.textContent).toContain("Nothing pinned yet");
        expect(container.querySelectorAll("[data-ghost]").length).toBe(0);
        unmount();
    });

    it("rejects input that is not a hostname", async () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        const input = container.querySelector("input") as HTMLInputElement;
        input.value = "not a valid url";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        await Promise.resolve();
        flush();
        expect(container.textContent).toContain(
            "doesn't look like a web address",
        );
        unmount();
    });

    it("renders each app as a direct child li of the ul", () => {
        mockApps = ONE_APP;
        const { container, unmount } = renderSolid(() => <AppsPage />);
        const list = container.querySelector("ul") as HTMLUListElement;
        expect(list).not.toBeNull();
        expect(list.children).toHaveLength(1);
        expect(list.children[0].tagName).toBe("LI");
        unmount();
    });

    /**
     * Clicking an app opens it — one step. The earlier layout put "open"
     * inside a per-tile disclosure, so the primary action was two clicks and
     * the first click taught the user that clicking does not open.
     */
    it("opens the app on a single click of the tile", async () => {
        mockApps = ONE_APP;
        const { tabManager } = await import("~/lib/TabManager");
        const { container, unmount } = renderSolid(() => <AppsPage />);
        expect(container.textContent).toContain("chess.org");
        (container.querySelector("li button") as HTMLButtonElement).click();
        flush();
        expect(tabManager.createTab).toHaveBeenCalledWith("https://chess.org/");
        expect(tabManager.activateTab).toHaveBeenCalled();
        unmount();
    });

    it("labels the remove control with the app's name", () => {
        mockApps = ONE_APP;
        const { container, unmount } = renderSolid(() => <AppsPage />);
        expect(
            container.querySelector('[aria-label="Remove chess.org"]'),
        ).not.toBeNull();
        unmount();
    });

    it("renders no list at all when there are no apps", () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        expect(container.querySelector("ul")).toBeNull();
        unmount();
    });
});
