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

    it("labels the add field", () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        const label = container.querySelector("label") as HTMLLabelElement;
        const input = container.querySelector("input") as HTMLInputElement;
        expect(label.getAttribute("for")).toBe(input.id);
        expect(container.textContent?.toLowerCase()).toContain("add item");
        unmount();
    });

    it("renders the empty state as ghost positions", () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        expect(
            container.querySelectorAll("[data-ghost]").length,
        ).toBeGreaterThan(0);
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

    it("renders each position as a direct child li of the ul", () => {
        // Not just "a ul exists somewhere": Plate's as="li" only produces valid
        // markup if the li is a real child of the list. A div here would be
        // invalid and announced badly by screen readers.
        mockApps = ONE_APP;
        const { container, unmount } = renderSolid(() => <AppsPage />);
        const list = container.querySelector("ul") as HTMLUListElement;
        expect(list).not.toBeNull();
        expect(list.children).toHaveLength(1);
        expect(list.children[0].tagName).toBe("LI");
        unmount();
    });

    it("shows the app name and hides its detail until asked", () => {
        mockApps = ONE_APP;
        const { container, unmount } = renderSolid(() => <AppsPage />);
        expect(container.textContent).toContain("chess.org");
        const trigger = container.querySelector(
            "li button",
        ) as HTMLButtonElement;
        expect(trigger.getAttribute("aria-expanded")).toBe("false");
        trigger.click();
        flush();
        expect(trigger.getAttribute("aria-expanded")).toBe("true");
        unmount();
    });

    it("renders no list at all when there are no apps", () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        expect(container.querySelector("ul")).toBeNull();
        unmount();
    });
});
