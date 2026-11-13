import { createAuthClient } from "better-auth/client";

export type CivilUser = {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    isAnonymous?: boolean | null;
};

let client: ReturnType<typeof createAuthClient> | null = null;

export function getAuthClient() {
    if (typeof window === "undefined") return null;
    client ??= createAuthClient({ baseURL: window.location.origin });
    return client;
}

export function authCallbackPath(
    page: "/setup" | "/settings",
    framed: boolean,
) {
    return framed ? "/" : page;
}

export function classLinkCallbackError(search: string): string {
    const error = new URLSearchParams(search).get("error");
    if (!error) return "";
    return error === "access_denied"
        ? "ClassLink sign-in was cancelled. You can try again or continue without signing in."
        : "ClassLink sign-in did not finish. You can try again or continue without signing in.";
}

export async function signInWithClassLink(
    page: "/setup" | "/settings",
    signedIn: boolean,
) {
    const auth = getAuthClient();
    if (!auth) return;
    const callback = authCallbackPath(page, window.top !== window);
    const options = {
        provider: "classlink",
        callbackURL: `${window.location.origin}${callback}`,
        // Errors return to a visible page, including from framed Settings.
        errorCallbackURL: `${window.location.origin}${page}`,
        disableRedirect: true,
    };
    const result = signedIn
        ? await auth.linkSocial(options)
        : await auth.signIn.social(options);
    if (result.error)
        throw new Error(result.error.message || "ClassLink sign-in failed.");
    if (!result.data?.url)
        throw new Error(
            "ClassLink did not provide a sign-in address. Try again.",
        );
    (window.top ?? window).location.assign(result.data.url);
}
