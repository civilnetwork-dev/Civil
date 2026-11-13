// @vitest-environment happy-dom
import { renderSolid } from "$tests/helpers/renderSolid";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getSession: vi.fn(),
    listAccounts: vi.fn(),
    signOut: vi.fn(),
    login: vi.fn(),
}));
vi.mock("~/lib/auth", async importOriginal => ({
    ...(await importOriginal<typeof import("~/lib/auth")>()),
    getAuthClient: () => mocks,
    signInWithClassLink: mocks.login,
}));

import ClassLinkAccount from "./ClassLinkAccount";

const findButton = (root: HTMLElement, label: string) =>
    [...root.querySelectorAll("button")].find(
        button => button.textContent?.trim() === label,
    )!;
const primary = {
    id: "civil",
    email: "primary@example.com",
    name: "Civil user",
};

beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSession.mockResolvedValue({ data: { user: null } });
    mocks.listAccounts.mockResolvedValue({ data: [] });
    mocks.signOut.mockResolvedValue({ data: { success: true } });
    vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(Response.json({ classlink: true })),
    );
    window.history.replaceState(null, "", "/settings");
});
afterEach(() => vi.unstubAllGlobals());

it.each(["/setup", "/settings"] as const)(
    "hides unavailable ClassLink controls on %s",
    async page => {
        vi.mocked(fetch).mockResolvedValue(Response.json({ classlink: false }));
        const { container, unmount } = renderSolid(() => (
            <ClassLinkAccount page={page} />
        ));
        expect(container.querySelector("button")).toBeNull();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(container.textContent).toBe("");
        expect(container.querySelector("div")).toBeNull();
        expect(mocks.login).not.toHaveBeenCalled();
        unmount();
    },
);

it("reports availability after the async account lookup", async () => {
    const onAvailable = vi.fn();
    const { container, unmount } = renderSolid(() => (
        <ClassLinkAccount page="/settings" onAvailable={onAvailable} />
    ));
    expect(container.querySelector("button")).toBeNull();
    await vi.waitFor(() => expect(onAvailable).toHaveBeenLastCalledWith(true));
    expect(findButton(container, "Sign in with ClassLink").disabled).toBe(
        false,
    );
    unmount();
});

it("shows account lookup errors only for an available provider and prevents ambiguous sign-in", async () => {
    mocks.getSession.mockRejectedValue(new Error("Session lookup failed."));
    const { container, unmount } = renderSolid(() => (
        <ClassLinkAccount page="/settings" />
    ));
    await vi.waitFor(() =>
        expect(
            container.querySelector('[role="alert"]')?.textContent,
        ).toContain("Reload to try again"),
    );
    expect(findButton(container, "Sign in with ClassLink").disabled).toBe(true);
    findButton(container, "Sign in with ClassLink").click();
    expect(mocks.login).not.toHaveBeenCalled();
    unmount();
});

it("signs anonymous visitors in and displays a returned error", async () => {
    mocks.getSession.mockResolvedValue({
        data: { user: { ...primary, isAnonymous: true } },
    });
    mocks.login.mockRejectedValue(new Error("ClassLink could not be reached."));
    const { container, unmount } = renderSolid(() => (
        <ClassLinkAccount page="/setup" />
    ));
    await vi.waitFor(() =>
        expect(findButton(container, "Sign in with ClassLink").disabled).toBe(
            false,
        ),
    );
    findButton(container, "Sign in with ClassLink").click();
    await vi.waitFor(() =>
        expect(
            container.querySelector('[role="alert"]')?.textContent,
        ).toContain("could not be reached"),
    );
    expect(mocks.login).toHaveBeenCalledWith("/setup", false);
    expect(mocks.listAccounts).not.toHaveBeenCalled();
    unmount();
});

it("offers explicit linking for another provider and keeps Civil's email", async () => {
    mocks.getSession.mockResolvedValue({ data: { user: primary } });
    mocks.listAccounts.mockResolvedValue({ data: [{ providerId: "patreon" }] });
    const { container, unmount } = renderSolid(() => (
        <ClassLinkAccount page="/settings" />
    ));
    await vi.waitFor(() =>
        expect(findButton(container, "Connect ClassLink").disabled).toBe(false),
    );
    expect(container.textContent).toContain("primary@example.com");
    findButton(container, "Connect ClassLink").click();
    await vi.waitFor(() =>
        expect(mocks.login).toHaveBeenCalledWith("/settings", true),
    );
    unmount();
});

it("shows linked state and signs out only through Civil", async () => {
    mocks.getSession.mockResolvedValue({ data: { user: primary } });
    mocks.listAccounts.mockResolvedValue({
        data: [{ providerId: "classlink" }],
    });
    const { container, unmount } = renderSolid(() => (
        <ClassLinkAccount page="/settings" />
    ));
    await vi.waitFor(() =>
        expect(findButton(container, "ClassLink connected").disabled).toBe(
            true,
        ),
    );
    findButton(container, "Sign out of Civil").click();
    await vi.waitFor(() =>
        expect(findButton(container, "Sign in with ClassLink")).toBeDefined(),
    );
    expect(mocks.signOut).toHaveBeenCalledWith();
    expect(container.textContent).not.toContain("primary@example.com");
    unmount();
});

it("hides linked accounts when ClassLink sign-in is disabled without changing the session", async () => {
    mocks.getSession.mockResolvedValue({ data: { user: primary } });
    mocks.listAccounts.mockResolvedValue({
        data: [{ providerId: "classlink" }],
    });
    vi.mocked(fetch).mockResolvedValue(Response.json({ classlink: false }));
    const onAvailable = vi.fn();
    const { container, unmount } = renderSolid(() => (
        <ClassLinkAccount page="/settings" onAvailable={onAvailable} />
    ));
    await vi.waitFor(() => expect(mocks.listAccounts).toHaveBeenCalled());
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(onAvailable).toHaveBeenLastCalledWith(false);
    expect(container.textContent).toBe("");
    expect(container.querySelector("div")).toBeNull();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.login).not.toHaveBeenCalled();
    unmount();
});

it("shows a loading action until sign-in finishes", async () => {
    let finish!: () => void;
    mocks.login.mockImplementation(
        () =>
            new Promise<void>(resolve => {
                finish = resolve;
            }),
    );
    const { container, unmount } = renderSolid(() => (
        <ClassLinkAccount page="/setup" />
    ));
    await vi.waitFor(() =>
        expect(findButton(container, "Sign in with ClassLink").disabled).toBe(
            false,
        ),
    );
    findButton(container, "Sign in with ClassLink").click();
    await vi.waitFor(() =>
        expect(findButton(container, "Working…").disabled).toBe(true),
    );
    finish();
    await vi.waitFor(() =>
        expect(findButton(container, "Sign in with ClassLink").disabled).toBe(
            false,
        ),
    );
    unmount();
});

it("explains cancelled sign-in when ClassLink is available", async () => {
    window.history.replaceState(null, "", "/settings?error=access_denied");
    const { container, unmount } = renderSolid(() => (
        <ClassLinkAccount page="/settings" />
    ));
    await vi.waitFor(() =>
        expect(
            container.querySelector('[role="alert"]')?.textContent,
        ).toContain("cancelled"),
    );
    expect(container.textContent).not.toContain(
        "unavailable on this Civil site",
    );
    unmount();
});

it("hides controls after capability lookup failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    const onAvailable = vi.fn();
    const { container, unmount } = renderSolid(() => (
        <ClassLinkAccount page="/settings" onAvailable={onAvailable} />
    ));
    await vi.waitFor(() => expect(onAvailable).toHaveBeenCalledWith(false));
    expect(container.querySelector("button")).toBeNull();
    expect(container.textContent).toBe("");
    unmount();
});
