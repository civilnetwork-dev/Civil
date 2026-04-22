import { extensionsApplyToIframe } from "~/api/extensions";
import { historyAdd } from "~/api/history";
import { iframeSetCurrentSrc } from "~/api/iframe";
import { displayUrl, normalizeNav } from "~/lib/browserHelpers";
import { trackVisit } from "~/lib/db";
import type searchBar from "~/lib/SearchBar";
import { isInternalUrl, resolveUrl, tabManager } from "~/lib/TabManager";

type BarInstance = ReturnType<typeof searchBar>;

export function injectChiiIntoIframe(
    iframe: HTMLIFrameElement,
    devtoolsIframe?: HTMLIFrameElement,
): void {
    const inject = () => {
        try {
            const doc = iframe.contentDocument;
            if (!doc || doc.location.href === "about:blank") return;
            doc.getElementById("__civil_chii__")?.remove();
            const script = doc.createElement("script");
            script.id = "__civil_chii__";
            script.src = `${window.location.origin}/chii/target.js`;
            script.setAttribute("embedded", "true");
            script.setAttribute("defer", "");
            if (devtoolsIframe) {
                script.onload = () => {
                    (iframe.contentWindow as any).ChiiDevtoolsIframe =
                        devtoolsIframe;
                };
            }
            (doc.body ?? doc.head ?? doc.documentElement)?.appendChild(script);
        } catch {}
    };

    const onLoad = () => {
        inject();
        iframe.addEventListener("load", onLoad, { once: true });
    };

    if (
        iframe.contentDocument?.readyState === "complete" &&
        iframe.contentDocument?.location.href !== "about:blank"
    ) {
        inject();
    }

    iframe.addEventListener("load", onLoad, { once: true });
}

export function createIframeManager(
    bar: BarInstance,
    push: (id: string, url: string) => void,
) {
    const iframeMap = new Map<string, HTMLIFrameElement>();

    const navigateIframe = (id: string, url: string) => {
        const iframe = iframeMap.get(id);
        if (!iframe) return;

        push(id, url);
        tabManager.updateTab(id, { url, isLoading: true, title: "Loading…" });

        if (!isInternalUrl(url)) {
            void trackVisit(normalizeNav(url)).then(
                ({ userBanned, banReason }) => {
                    if (!userBanned) return;
                    tabManager.updateTab(id, {
                        isLoading: false,
                        title: "Banned",
                    });

                    if (!banReason) return;
                    iframe.src = `${window.location.origin}/ban?reason=${encodeURIComponent(banReason)}`;
                },
            );
        }

        if (id === tabManager.activeId) {
            iframeSetCurrentSrc(url);
        }

        if (isInternalUrl(url)) {
            iframe.src = url;
        } else {
            bar.emit("submit", iframe, normalizeNav(url));
        }
    };

    const navigate = (id: string, url: string) =>
        navigateIframe(id, resolveUrl(url));

    const registerIframe = (id: string, el: HTMLIFrameElement) => {
        iframeMap.set(id, el);

        el.addEventListener("load", () => {
            let href: string | undefined;
            try {
                href = el.contentWindow?.location.href;
            } catch {}
            if (!href || href === "about:blank") return;

            try {
                const docTitle = el.contentDocument?.title;
                const favicon =
                    el.contentDocument?.querySelector<HTMLLinkElement>(
                        'link[rel*="icon"]',
                    )?.href;
                tabManager.updateTab(id, {
                    isLoading: false,
                    title:
                        docTitle ||
                        displayUrl(
                            tabManager.tabs.find(t => t.id === id)?.url ?? "",
                        ) ||
                        "Untitled",
                    favicon,
                });

                if (!isInternalUrl(href)) {
                    const tab = tabManager.tabs.find(t => t.id === id);
                    void historyAdd({
                        url: href,
                        title:
                            docTitle ||
                            displayUrl(tab?.url ?? href) ||
                            "Untitled",
                        visitedAt: Date.now(),
                        favicon,
                    });
                    void extensionsApplyToIframe(el);
                    try {
                        const doc = el.contentDocument;
                        if (doc && !doc.getElementById("__civil_chii__")) {
                            const s = doc.createElement("script");
                            s.id = "__civil_chii__";
                            s.src = `${window.location.origin}/chii/target.js`;
                            s.setAttribute("embedded", "true");
                            (doc.head ?? doc.documentElement)?.appendChild(s);
                        }
                    } catch {}
                }

                if (id === tabManager.activeId) {
                    iframeSetCurrentSrc(href);
                }
            } catch {
                tabManager.updateTab(id, { isLoading: false });
            }
        });

        const tab = tabManager.tabs.find(t => t.id === id);
        if (tab?.url) {
            push(id, tab.url);
            if (id === tabManager.activeId) {
                iframeSetCurrentSrc(tab.url);
            }
            if (isInternalUrl(tab.url)) {
                el.src = tab.url;
            } else {
                bar.ready.then(() =>
                    bar.emit("submit", el, normalizeNav(tab.url)),
                );
            }
        }
    };

    return { iframeMap, navigateIframe, navigate, registerIframe };
}
