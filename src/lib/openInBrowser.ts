/**
 * Open an address from one of Civil's own pages.
 *
 * Those pages (Apps, Bookmarks, History) run as their own documents inside a
 * tab's frame, so they share no memory with the chrome: a `tabManager` call
 * made here talks to a second, invisible tab list and nothing opens. That is
 * why pinned apps once did nothing when clicked. The chrome owns the tabs, so
 * the request goes up to it as a `civil:navigate` message, the same channel the
 * New Tab omnibox uses (see the handler in useIframeManager.ts).
 *
 * A page opened on its own, outside the browser, has no chrome to ask. It
 * leaves the address for the browser to open on start and goes there.
 */
export const OPEN_ON_START_KEY = "civil:open-on-start";

export function openInBrowser(url: string, opts: { newTab: boolean }) {
    if (window.self !== window.top) {
        window.parent.postMessage(
            { type: "civil:navigate", url, newTab: opts.newTab },
            window.location.origin,
        );
        return;
    }
    try {
        sessionStorage.setItem(OPEN_ON_START_KEY, url);
    } catch {}
    window.location.href = "/";
}
