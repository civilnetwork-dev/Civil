import { silentEvent } from "./silentEvent";

const AUTH_FLOW_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Opens the auth page in a popup and resolves with the redirect it lands on,
 * or undefined when the popup is blocked, closed, or never comes back.
 */
function waitForAuthRedirect(
    url: string,
    redirectBase: string,
): Promise<string | undefined> {
    return new Promise<string | undefined>(resolve => {
        const popup = window.open(
            url,
            "_blank",
            "width=600,height=700,noopener",
        );
        if (!popup) {
            resolve(undefined);
            return;
        }

        const tid = setInterval(() => {
            try {
                if (popup.closed) {
                    clearInterval(tid);
                    resolve(undefined);
                    return;
                }
                const href = popup.location?.href;
                if (href?.startsWith(redirectBase)) {
                    popup.close();
                    clearInterval(tid);
                    resolve(href);
                }
            } catch {}
        }, 200);

        setTimeout(() => {
            clearInterval(tid);
            if (!popup.closed) popup.close();
            resolve(undefined);
        }, AUTH_FLOW_TIMEOUT_MS);
    });
}

function launchWebAuthFlow(extId: string) {
    return (details: unknown, cb?: (url?: string) => void) => {
        const d = details as { url: string; interactive?: boolean };
        const p = (async (): Promise<string | undefined> => {
            if (!d.url) return undefined;
            if (d.interactive === false) return undefined;
            try {
                return await waitForAuthRedirect(
                    d.url,
                    `https://${extId}.chromiumapp.org/`,
                );
            } catch {
                return undefined;
            }
        })();
        if (cb) p.then(cb).catch(() => cb(undefined));
        return p;
    };
}

export function buildIdentityAPI(extId: string) {
    return {
        getAuthToken: (_d: unknown, cb?: (t?: string) => void) => {
            if (cb) cb(undefined);
            return Promise.resolve(undefined as string | undefined);
        },
        removeCachedAuthToken: (_d: unknown, cb?: () => void) => {
            if (cb) cb();
            return Promise.resolve();
        },
        getRedirectURL: (path?: string) =>
            `https://${extId}.chromiumapp.org/${path ?? ""}`,
        getProfileUserInfo: (_d: unknown, cb?: (i: unknown) => void) => {
            if (cb) cb({ email: "", id: "" });
            return Promise.resolve({ email: "", id: "" });
        },
        launchWebAuthFlow: launchWebAuthFlow(extId),
        clearAllCachedAuthTokens: (cb?: () => void) => {
            if (cb) cb();
            return Promise.resolve();
        },
        onSignInChanged: silentEvent(),
    };
}
