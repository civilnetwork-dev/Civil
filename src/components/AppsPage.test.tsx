import { renderSolid } from "$tests/helpers/renderSolid";
// @vitest-environment happy-dom
import { flush } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("~/lib/openInBrowser", () => ({ openInBrowser: vi.fn() }));

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
        expect(container.querySelector(`.${s.sheet}`)).not.toBeNull();
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
     * looked like a broken page to a first-time user: eight empty boxes
     * labelled 01-08 with nothing in them reads as "this failed to load".
     */
    it("renders the empty state as one plain sentence", () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        expect(container.textContent).toContain("Nothing pinned yet");
        expect(container.querySelectorAll("[data-ghost]").length).toBe(0);
        unmount();
    });
});

describe("AppsPage list", () => {
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
        const list = container.querySelector("[data-pins]") as HTMLUListElement;
        expect(list).not.toBeNull();
        expect(list.children).toHaveLength(1);
        expect(list.children[0].tagName).toBe("LI");
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

    it("renders no pin list at all when there are no apps", () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        expect(container.querySelector("[data-pins]")).toBeNull();
        unmount();
    });
});

describe("AppsPage opening and shelf", () => {
    /**
     * Clicking an app opens it: one step. The earlier layout put "open"
     * inside a per-tile disclosure, so the primary action was two clicks and
     * the first click taught the user that clicking does not open.
     */
    /**
     * The page is its own document inside a tab's frame, so it must ask the
     * chrome to open the app: a `tabManager` call made here once reached a
     * second, invisible tab list and nothing opened at all.
     */
    it("opens the app on a single click of the tile", async () => {
        mockApps = ONE_APP;
        const { openInBrowser } = await import("~/lib/openInBrowser");
        const { container, unmount } = renderSolid(() => <AppsPage />);
        expect(container.textContent).toContain("chess.org");
        (
            container.querySelector("[data-pins] button") as HTMLButtonElement
        ).click();
        flush();
        expect(openInBrowser).toHaveBeenCalledWith("https://chess.org/", {
            newTab: false,
        });
        unmount();
    });

    it("filters the shelf by chip", () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        const chip = [...container.querySelectorAll("button")].find(
            b => b.textContent === "Music",
        ) as HTMLButtonElement;
        chip.click();
        flush();
        expect(chip.getAttribute("aria-pressed")).toBe("true");
        expect(container.textContent).toContain("Spotify");
        expect(container.textContent).not.toContain("Krunker");
        unmount();
    });
});
