// @vitest-environment happy-dom
import { renderSolid } from "$tests/helpers/renderSolid";
import { beforeEach, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
    getSession: vi.fn(),
    listAccounts: vi.fn(),
    signOut: vi.fn(),
    signIn: { social: vi.fn() },
    linkSocial: vi.fn(),
}));
vi.mock("~/lib/auth", () => ({ getAuthClient: () => auth }));

import PatreonLoginButton from "./PatreonLoginButton";

const user = { id: "civil", name: "Civil user" };
const button = (root: HTMLElement, label: string) =>
    [...root.querySelectorAll("button")].find(
        el => el.textContent?.trim() === label,
    )!;

beforeEach(() => {
    vi.resetAllMocks();
    auth.getSession.mockResolvedValue({ data: { user: null } });
    auth.listAccounts.mockResolvedValue({ data: [] });
    auth.signOut.mockResolvedValue({ data: { success: true } });
    auth.signIn.social.mockResolvedValue({ data: {} });
    auth.linkSocial.mockResolvedValue({ data: {} });
});

it("keeps guest Patreon login working", async () => {
    const { container, unmount } = renderSolid(() => <PatreonLoginButton />);
    await vi.waitFor(() =>
        expect(button(container, "Log in with Patreon")).toBeDefined(),
    );
    button(container, "Log in with Patreon").click();
    expect(auth.signIn.social).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "patreon" }),
    );
    expect(auth.linkSocial).not.toHaveBeenCalled();
    unmount();
});

it("offers linking rather than treating a ClassLink login as Patreon", async () => {
    auth.getSession.mockResolvedValue({ data: { user } });
    auth.listAccounts.mockResolvedValue({
        data: [{ providerId: "classlink" }],
    });
    const { container, unmount } = renderSolid(() => <PatreonLoginButton />);
    await vi.waitFor(() =>
        expect(button(container, "Connect Patreon")).toBeDefined(),
    );
    button(container, "Connect Patreon").click();
    expect(auth.linkSocial).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "patreon" }),
    );
    expect(auth.signIn.social).not.toHaveBeenCalled();
    unmount();
});

it("keeps linked Patreon user and local signout", async () => {
    auth.getSession.mockResolvedValue({ data: { user } });
    auth.listAccounts.mockResolvedValue({ data: [{ providerId: "patreon" }] });
    const { container, unmount } = renderSolid(() => <PatreonLoginButton />);
    await vi.waitFor(() =>
        expect(container.textContent).toContain("Civil user"),
    );
    button(container, "Sign out").click();
    await vi.waitFor(() =>
        expect(button(container, "Log in with Patreon")).toBeDefined(),
    );
    expect(auth.signOut).toHaveBeenCalledWith();
    unmount();
});
