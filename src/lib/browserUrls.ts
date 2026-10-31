/** Civil's own pages, by the `browser:` address the chrome shows for each. */
export const BROWSER_URLS: Record<string, string> = {
    "browser:newtab": `${window.location.origin}/newTab`,
    "browser:checkfilters": `${window.location.origin}/checkFilters`,
    "browser:settings": `${window.location.origin}/settings`,
    "browser:history": `${window.location.origin}/history`,
    "browser:apps": `${window.location.origin}/apps`,
    "browser:extensions": `${window.location.origin}/extensions`,
    "browser:bookmarks": `${window.location.origin}/bookmarks`,
    "browser:blank": "about:blank",
};

export function resolveUrl(url: string) {
    if (BROWSER_URLS[url]) return BROWSER_URLS[url];

    const browserMatch = url.match(/^browser:(.+)$/);
    if (browserMatch) {
        const key = `browser:${browserMatch[1]}`;
        return (
            BROWSER_URLS[key] ?? `${window.location.origin}/${browserMatch[1]}`
        );
    }
    return url;
}

export function isNewtabUrl(url: string) {
    const newtab = BROWSER_URLS["browser:newtab"];
    return (
        url === newtab ||
        // Sessions saved before the route was camelCased.
        url === `${window.location.origin}/newtab` ||
        url === "browser:newtab" ||
        url === "browser://newtab"
    );
}

export function isInternalUrl(url: string): boolean {
    if (url === "about:blank" || url.startsWith("browser:")) return true;
    try {
        const origin =
            typeof window !== "undefined" ? window.location.origin : "";
        if (origin && url.startsWith(`${origin}/civil-ext/`)) return true;
        // Pre-shimmed extension pages cached by buildExtensionPageSrcDoc.
        if (origin && url.startsWith(`${origin}/action-popup/`)) return true;
        // Options-page variant: served at /options-tab/ so TM's pathname check
        // `indexOf("/options") === 0` passes, enabling full dashboard UI.
        if (origin && url.startsWith(`${origin}/options-tab/`)) return true;
        // Ask-page variant: served at /ask-tab/ so TM's pathname check
        // `indexOf("/ask") === 0` passes for the install confirmation dialog.
        if (origin && url.startsWith(`${origin}/ask-tab/`)) return true;
    } catch {}
    return Object.values(BROWSER_URLS).some(v => url === v);
}
