// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
    signIn: { social: vi.fn() },
    linkSocial: vi.fn(),
}));
vi.mock("better-auth/client", () => ({ createAuthClient: () => auth }));

import {
    authCallbackPath,
    classLinkCallbackError,
    signInWithClassLink,
} from "./auth";

beforeEach(() => {
    vi.clearAllMocks();
    auth.signIn.social.mockResolvedValue({
        data: { url: "https://launchpad.classlink.com/oauth2/v2/auth" },
    });
    auth.linkSocial.mockResolvedValue({
        data: { url: "https://launchpad.classlink.com/oauth2/v2/auth" },
    });
});

it.each([
    ["/settings", true, "/"],
    ["/settings", false, "/settings"],
    ["/setup", false, "/setup"],
] as const)("returns %s framed=%s to %s", (page, framed, expected) => {
    expect(authCallbackPath(page, framed)).toBe(expected);
});

it("uses top-level navigation with a framed success callback and visible error callback", async () => {
    const original = Object.getOwnPropertyDescriptor(window, "top")!;
    const assign = vi.fn();
    Object.defineProperty(window, "top", {
        configurable: true,
        value: { location: { assign } },
    });
    try {
        await signInWithClassLink("/settings", false);
        expect(auth.signIn.social).toHaveBeenCalledWith({
            provider: "classlink",
            disableRedirect: true,
            callbackURL: `${window.location.origin}/`,
            errorCallbackURL: `${window.location.origin}/settings`,
        });
        expect(assign).toHaveBeenCalledWith(
            "https://launchpad.classlink.com/oauth2/v2/auth",
        );
    } finally {
        Object.defineProperty(window, "top", original);
    }
});

it("explicitly links an authenticated Civil account", async () => {
    const assign = vi
        .spyOn(window.location, "assign")
        .mockImplementation(() => {});
    await signInWithClassLink("/settings", true);
    expect(auth.linkSocial).toHaveBeenCalledWith(
        expect.objectContaining({
            provider: "classlink",
            callbackURL: `${window.location.origin}/settings`,
        }),
    );
    expect(auth.signIn.social).not.toHaveBeenCalled();
    assign.mockRestore();
});

it("surfaces returned errors without navigating", async () => {
    auth.signIn.social.mockResolvedValue({
        error: { message: "ClassLink is unavailable" },
    });
    await expect(signInWithClassLink("/setup", false)).rejects.toThrow(
        "ClassLink is unavailable",
    );
    auth.signIn.social.mockResolvedValue({ data: {} });
    await expect(signInWithClassLink("/setup", false)).rejects.toThrow(
        "sign-in address",
    );
});

it("explains cancellation without echoing untrusted callback text", () => {
    expect(classLinkCallbackError("?error=access_denied")).toContain(
        "cancelled",
    );
    expect(classLinkCallbackError("?error=<script>")).toContain(
        "did not finish",
    );
    expect(classLinkCallbackError("")).toBe("");
});
