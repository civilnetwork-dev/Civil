import { PROXY_PREFIX } from "$config/shared/runtimeScripts";

import {
    dispatchExtensionBrowserEvent,
    extensionChromeTabId,
    extensionsLaunchBackgrounds,
    injectExtensionShimsIntoIframe,
} from "~/api/extensionRuntime";
import { historyAdd } from "~/api/history";
import { iframeSetCurrentSrc } from "~/api/iframe";
import { displayUrl, gstaticFavicon, normalizeNav } from "~/lib/browserHelpers";
import { isInternalUrl, resolveUrl } from "~/lib/browserUrls";
import type searchBar from "~/lib/SearchBar";
import { getSetting, isTransport, type TransportName } from "~/lib/settings";
import { tabManager } from "~/lib/TabManager";
import { retryWith, rotateFrom, usedTransport } from "~/lib/transport";

type BarInstance = ReturnType<typeof searchBar>;

function decodeProxyUrl(href: string): string {
    try {
        const url = new URL(href);
        if (url.pathname.startsWith(PROXY_PREFIX)) {
            const encoded = url.pathname.split("/").findLast(Boolean);
            if (encoded && window.scramjet?.decodeUrl) {
                return window.scramjet.decodeUrl(encoded);
            }
        }
    } catch {}
    return href;
}

function extensionTab(
    civilTabId: string,
    url: string,
    status: "loading" | "complete",
) {
    const tab = tabManager.tabs.find(item => item.id === civilTabId);
    const index = tabManager.tabs.findIndex(item => item.id === civilTabId);
    return {
        id: extensionChromeTabId(civilTabId),
        civilTabId,
        index,
        windowId: 1,
        active: tabManager.activeId === civilTabId,
        highlighted: tabManager.activeId === civilTabId,
        pinned: false,
        incognito: false,
        status,
        url,
        pendingUrl: status === "loading" ? url : undefined,
        title: tab?.title ?? "",
        favIconUrl: tab?.favicon,
    };
}

/**
 * A proxied navigation that never fires `load`.
 *
 * The transport can die *after* it initialises (epoxy's wisp socket comes back
 * `400 != 101` at connect time, long past `createTransport`'s init-time
 * fallback) and when it does, `sframe.go()` resolves, nothing loads, and the
 * tab sits on "Loading…" against a blank frame forever. Session replay shows
 * exactly what people do next: they hammer Reload, which re-runs the same dead
 * transport and changes nothing.
 *
 * So the timeout fails over to the next transport and retries once on its own
 * (lib/transport.ts decides which, and Settings can turn it off), and
 * otherwise shows a page offering every method by hand. The timeout is a
 * setting too. Its default, fifteen seconds, is past a slow school link's
 * first paint but well inside the patience that produced those rage clicks.
 */

const CONNECTION_ERROR_PATH = "/connectionError";

/** The page (src/routes/connectionError.tsx) offering every method by hand. */
function connectionErrorUrl(url: string, used?: TransportName): string {
    const search = new URLSearchParams({ url, used: used ?? "" });
    return `${window.location.origin}${CONNECTION_ERROR_PATH}?${search}`;
}

/** Tells the extensions a tab started loading `url`. */
function announceNavigationStart(id: string, url: string): void {
    const chromeTab = extensionTab(id, url, "loading");
    dispatchExtensionBrowserEvent("webNavigation.onBeforeNavigate", [
        {
            tabId: chromeTab.id,
            url,
            frameId: 0,
            parentFrameId: -1,
            timeStamp: Date.now(),
        },
    ]);
    dispatchExtensionBrowserEvent("tabs.onUpdated", [
        chromeTab.id,
        { status: "loading", url },
        chromeTab,
    ]);
}

/** What /api/trackVisit says about a navigation. */
type VisitVerdict = {
    userBanned?: boolean;
    banReason?: string | null;
    /** The restricted host the server refused. Refused only: asking again
     *  costs the student nothing. */
    restricted?: string;
};

const banPageUrl = (reason: string) =>
    `${window.location.origin}/ban?reason=${encodeURIComponent(reason)}`;

/** Reports the visit, and shows the ban page for a restricted site or a ban. */
function trackVisit(id: string, url: string, iframe: HTMLIFrameElement): void {
    void fetch("/api/trackVisit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizeNav(url) }),
    })
        .then(res => res.json())
        .then((data: VisitVerdict) => {
            if (data.restricted) {
                tabManager.updateTab(id, {
                    isLoading: false,
                    title: "Site restricted",
                });
                iframe.src = banPageUrl(
                    `${data.restricted} is restricted by this proxy`,
                );
                return;
            }
            if (!data.userBanned) return;
            tabManager.updateTab(id, {
                isLoading: false,
                title: "Banned",
            });

            if (!data.banReason) return;
            iframe.src = banPageUrl(data.banReason);
        })
        .catch(() => {});
}

/** Tells the extensions a tab finished loading `tabUrl`. */
function announceNavigationComplete(id: string, tabUrl: string): void {
    const chromeTab = extensionTab(id, tabUrl, "complete");
    const navigationDetails = {
        tabId: chromeTab.id,
        url: tabUrl,
        frameId: 0,
        parentFrameId: -1,
        documentId: crypto.randomUUID(),
        documentLifecycle: "active",
        frameType: "outermost_frame",
        processId: -1,
        timeStamp: Date.now(),
    };
    dispatchExtensionBrowserEvent("webNavigation.onCommitted", [
        {
            ...navigationDetails,
            transitionType: "link",
            transitionQualifiers: [],
        },
    ]);
    dispatchExtensionBrowserEvent("webNavigation.onCompleted", [
        navigationDetails,
    ]);
    dispatchExtensionBrowserEvent("tabs.onUpdated", [
        chromeTab.id,
        { status: "complete", url: tabUrl },
        chromeTab,
    ]);
}

/**
 * Userscript install: if the page is a .user.js file, ask TM's content script
 * to handle it. TM's content script checks window.location.href (Scramjet
 * rewrites it to the original URL) and document.body.innerText. This also
 * fires browser:userscript-install on window.top so Civil can forward it to
 * TM's background directly.
 */
function offerUserScriptInstall(el: HTMLIFrameElement, href: string): void {
    const cleanHref = href.split("?")[0].split("#")[0];
    if (!/\.user\.(js|ts)$/i.test(cleanHref)) return;
    try {
        const src = el.contentDocument?.body?.innerText ?? "";
        if (src.includes("// ==UserScript==")) {
            window.dispatchEvent(
                new CustomEvent("browser:userscript-install", {
                    detail: { url: href, source: src },
                }),
            );
        }
    } catch {}
}

/** The loaded page's real URL, or nothing for a page that isn't one. */
function loadedHref(el: HTMLIFrameElement): string | undefined {
    let href: string | undefined;
    try {
        href = el.contentWindow?.location.href;
    } catch {}
    if (!href || href === "about:blank") return undefined;
    // The connection error page is a Civil artefact, not somewhere the user
    // went: it stays out of history, and the tab keeps the address that
    // failed, ready to retry.
    if (href.startsWith(`${window.location.origin}${CONNECTION_ERROR_PATH}`))
        return undefined;
    return href;
}

/** Updates the tab from the page that just loaded into its frame. */
async function recordLoadedPage(
    id: string,
    el: HTMLIFrameElement,
    href: string,
    push: (id: string, url: string) => void,
): Promise<void> {
    const tabUrl = decodeProxyUrl(href);
    const favicon = isInternalUrl(tabUrl)
        ? "/favicon.ico"
        : gstaticFavicon(normalizeNav(tabUrl));
    const title = el.contentDocument?.title || displayUrl(tabUrl) || "Untitled";
    tabManager.updateTab(id, { url: tabUrl, isLoading: false, title, favicon });
    push(id, tabUrl);

    if (!isInternalUrl(href)) {
        void historyAdd({ url: tabUrl, title, visitedAt: Date.now(), favicon });
        // Await shim injection BEFORE firing any webNavigation or
        // tabs.onUpdated events. TM background responds to these events by
        // calling scripting.executeScript; the BC message must find the
        // content-script listener already active in the iframe, otherwise
        // the executeScript is silently lost.
        await injectExtensionShimsIntoIframe(el, tabUrl, id);
        offerUserScriptInstall(el, href);
    }

    announceNavigationComplete(id, tabUrl);
    if (id === tabManager.activeId) iframeSetCurrentSrc(href);
}

/** Loads a restored tab's URL into its new frame. */
function restoreTabFrame(id: string, el: HTMLIFrameElement, bar: BarInstance) {
    const tab = tabManager.tabs.find(t => t.id === id);
    if (!tab?.url) return;
    if (id === tabManager.activeId) iframeSetCurrentSrc(tab.url);
    if (isInternalUrl(tab.url)) {
        el.src = tab.url;
    } else {
        bar.ready.then(() => bar.emit("submit", el, normalizeNav(tab.url)));
    }
}

type NavRequest = {
    id: string;
    url: string;
    /**
     * Set when the caller resolved this from a `browser:` URL. `resolveUrl`
     * maps unknown `browser:x` names onto `${origin}/x`, and those don't
     * appear in BROWSER_URLS, so `isInternalUrl` reports false for them and
     * the page gets handed to the proxy instead of loaded directly - it
     * never navigates. The caller knows the scheme, so it says so.
     */
    forceInternal: boolean;
    /** 0 for a user-initiated navigation, 1 for the automatic retry. */
    attempt: number;
};

type FrameMessage = {
    type?: string;
    url?: string;
    transport?: unknown;
    newTab?: unknown;
} | null;

class IframeManager {
    readonly iframeMap = new Map<string, HTMLIFrameElement>();
    /** Pending navigation watchdogs, keyed by tab id. */
    private readonly navTimers = new Map<
        string,
        ReturnType<typeof setTimeout>
    >();
    /** Last proxied URL per tab, so a retry knows what to re-request. */
    private readonly lastProxiedUrl = new Map<string, string>();

    constructor(
        private readonly bar: BarInstance,
        private readonly push: (id: string, url: string) => void,
    ) {}

    private clearNavTimer(id: string): void {
        const timer = this.navTimers.get(id);
        if (timer === undefined) return;
        clearTimeout(timer);
        this.navTimers.delete(id);
    }

    readonly navigateIframe = (
        id: string,
        url: string,
        forceInternal = false,
        attempt = 0,
    ): void => {
        const iframe = this.iframeMap.get(id);
        if (!iframe) return;

        this.clearNavTimer(id);
        announceNavigationStart(id, url);
        tabManager.updateTab(id, { url, isLoading: true, title: "Loading…" });

        const internal = forceInternal || isInternalUrl(url);
        if (!internal) trackVisit(id, url, iframe);
        if (id === tabManager.activeId) iframeSetCurrentSrc(url);

        if (internal) {
            iframe.src = url;
            return;
        }

        const target = normalizeNav(url);
        this.lastProxiedUrl.set(id, target);
        this.bar.emit("submit", iframe, target);
        this.armWatchdog(iframe, target, { id, url, forceInternal, attempt });
    };

    /** Fails over to the next transport once, then shows the error page. */
    private armWatchdog(
        iframe: HTMLIFrameElement,
        target: string,
        nav: NavRequest,
    ): void {
        const seconds = getSetting("navTimeout");
        if (!seconds) return;
        const timer = setTimeout(() => {
            this.navTimers.delete(nav.id);
            const rotated = nav.attempt === 0 ? rotateFrom(iframe) : null;
            if (rotated) {
                this.navigateIframe(
                    nav.id,
                    nav.url,
                    nav.forceInternal,
                    nav.attempt + 1,
                );
                return;
            }
            tabManager.updateTab(nav.id, {
                isLoading: false,
                title: "Can't connect",
            });
            iframe.src = connectionErrorUrl(target, usedTransport(iframe));
        }, seconds * 1000);
        this.navTimers.set(nav.id, timer);
    }

    readonly navigate = (id: string, url: string): void =>
        this.navigateIframe(id, resolveUrl(url), url.startsWith("browser:"));

    private sourceTabId(source: MessageEventSource | null): string | null {
        return (
            [...this.iframeMap].find(
                ([, el]) => el.contentWindow === source,
            )?.[0] ?? tabManager.activeId
        );
    }

    /** Switches to a tab already showing `url`, or opens one through the
     *  same path as every other new tab. */
    private openInOwnTab(url: string): void {
        const open = tabManager.tabs.find(t => t.url === url);
        if (open) {
            tabManager.activateTab(open.id);
            return;
        }
        document.dispatchEvent(
            new CustomEvent("browser:newtab", { detail: { url } }),
        );
    }

    readonly onWindowMessage = (event: MessageEvent): void => {
        if (event.origin !== window.location.origin) return;
        const data = event.data as FrameMessage;

        if (data?.type === "civil:nav-retry") {
            const id = this.sourceTabId(event.source);
            const url = id ? this.lastProxiedUrl.get(id) : undefined;
            const iframe = id ? this.iframeMap.get(id) : undefined;
            if (!id || !url || !iframe) return;
            if (isTransport(data.transport)) {
                retryWith(iframe, data.transport);
            }
            this.navigateIframe(id, url);
            return;
        }

        // The New Tab omnibox lives inside the tab's own frame, so it
        // hands the URL up rather than navigating itself. A frame that
        // navigates itself to a scramjet URL has no scramjet frame behind
        // it (the URL carries only that document's own controller
        // prefix, which owns no frames) and the service worker answers
        // "Internal Service Worker Error: No frame found for request".
        if (data?.type === "civil:navigate" && typeof data.url === "string") {
            // Apps, bookmarks and history may ask for a tab of their own.
            if (data.newTab === true) {
                this.openInOwnTab(data.url);
                return;
            }
            const id = this.sourceTabId(event.source);
            if (id) this.navigate(id, data.url);
        }
    };

    readonly registerIframe = (id: string, el: HTMLIFrameElement): void => {
        this.iframeMap.set(id, el);

        el.addEventListener("load", async () => {
            // The page arrived, so the watchdog has nothing left to catch.
            // Cleared before the early returns: a cross-origin frame throws on
            // `location.href` and would otherwise leave the timer armed, firing
            // a spurious "can't connect" over a page that loaded fine.
            this.clearNavTimer(id);
            const href = loadedHref(el);
            if (!href) return;
            try {
                await recordLoadedPage(id, el, href, this.push);
            } catch {
                tabManager.updateTab(id, { isLoading: false });
            }
        });

        restoreTabFrame(id, el, this.bar);
    };
}

export function createIframeManager(
    bar: BarInstance,
    push: (id: string, url: string) => void,
) {
    const manager = new IframeManager(bar, push);
    void extensionsLaunchBackgrounds();
    if (typeof window !== "undefined") {
        window.addEventListener("message", manager.onWindowMessage);
    }
    const { iframeMap, navigateIframe, navigate, registerIframe } = manager;
    return { iframeMap, navigateIframe, navigate, registerIframe };
}
