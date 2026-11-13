// @vitest-environment happy-dom
import { renderSolid } from "$tests/helpers/renderSolid";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("~/lib/swUtils", () => ({
    checkFiltersNow: vi.fn().mockResolvedValue([]),
}));
vi.mock("./ui/PatreonLoginButton", () => ({ default: () => null }));

import FilterCheckPage from "./FilterCheckPage";

const VENDORS = [
    ["prismaBrowser", "Prisma Browser"],
    ["dyknowCloud", "Dyknow Cloud"],
    ["gopherBuddyPremium", "Gopher Buddy Premium"],
    ["classlinkAnalyticsPlus", "ClassLink Analytics+"],
    ["classlinkOneClick", "ClassLink OneClick"],
] as const;
const button = (root: HTMLElement, label: string) =>
    [...root.querySelectorAll("button")].find(
        el => el.textContent?.trim() === label,
    )!;

beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
            if (url.startsWith("/filterCheck/"))
                return Response.json({
                    status: "unknown",
                    detail: "This extension has no verified site-classification protocol.",
                });
            return new Response("", { status: 404 });
        }),
    );
});
afterEach(() => vi.unstubAllGlobals());

async function submit(root: HTMLElement) {
    const input = root.querySelector('input[type="url"]') as HTMLInputElement;
    input.value = "https://example.com/path";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
    root.querySelector("form")!.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
    );
}

it.each(VENDORS)(
    "explains unsupported %s without sending a check",
    async (key, name) => {
        localStorage.setItem("detectedFilters", JSON.stringify([key]));
        const { container, unmount } = renderSolid(() => <FilterCheckPage />);
        expect(container.textContent).toContain(`Can't check ${name} yet`);
        expect(button(container, name).getAttribute("aria-pressed")).toBe(
            "false",
        );
        await submit(container);
        expect(
            vi
                .mocked(fetch)
                .mock.calls.filter(([url]) =>
                    String(url).startsWith("/filterCheck/"),
                ),
        ).toHaveLength(0);
        unmount();
    },
);

it.each(VENDORS)("can select unsupported %s manually", async (_key, name) => {
    const { container, unmount } = renderSolid(() => <FilterCheckPage />);
    const choice = button(container, name);
    choice.click();
    await vi.waitFor(() =>
        expect(container.textContent).toContain(`Can't check ${name} yet`),
    );
    expect(choice.getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem("detectedFilters")).toBeNull();
    expect(
        (container.querySelector('button[type="submit"]') as HTMLButtonElement)
            .disabled,
    ).toBe(true);
    await submit(container);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(container.querySelector("table")).toBeNull();
    expect(
        vi
            .mocked(fetch)
            .mock.calls.filter(([url]) =>
                String(url).startsWith("/filterCheck/"),
            ),
    ).toHaveLength(0);
    choice.click();
    await vi.waitFor(() =>
        expect(container.textContent).not.toContain(`Can't check ${name} yet`),
    );
    unmount();
});

it("uses detected exact keys and does not mistake related extensions for classifiers", async () => {
    localStorage.setItem(
        "detectedFilters",
        JSON.stringify(["lightspeedFilterAgent", "securlyClassroom"]),
    );
    const { container, unmount } = renderSolid(() => <FilterCheckPage />);
    expect(container.textContent).toContain(
        "Can't check Securly Classroom yet",
    );
    await submit(container);
    await vi.waitFor(() =>
        expect(fetch).toHaveBeenCalledWith(
            "/filterCheck/lightspeed",
            expect.anything(),
        ),
    );
    expect(
        vi
            .mocked(fetch)
            .mock.calls.filter(([url]) =>
                String(url).startsWith("/filterCheck/"),
            ),
    ).toHaveLength(1);
    expect(container.querySelector('input[type="email"]')).toBeNull();
    unmount();
});

it("can remove a manual choice without changing detection", async () => {
    const { container, unmount } = renderSolid(() => <FilterCheckPage />);
    const choice = button(container, "Blocksi");
    choice.click();
    await vi.waitFor(() =>
        expect(choice.getAttribute("aria-pressed")).toBe("true"),
    );
    expect(
        (container.querySelector('button[type="submit"]') as HTMLButtonElement)
            .disabled,
    ).toBe(false);
    choice.click();
    await vi.waitFor(() =>
        expect(choice.getAttribute("aria-pressed")).toBe("false"),
    );
    expect(
        (container.querySelector('button[type="submit"]') as HTMLButtonElement)
            .disabled,
    ).toBe(true);
    await submit(container);
    expect(
        vi
            .mocked(fetch)
            .mock.calls.filter(([url]) =>
                String(url).startsWith("/filterCheck/"),
            ),
    ).toHaveLength(0);
    expect(localStorage.getItem("detectedFilters")).toBeNull();
    unmount();
});
