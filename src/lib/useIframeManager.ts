import {
    dispatchExtensionBrowserEvent,
    extensionChromeTabId,
    extensionsLaunchBackgrounds,
    injectExtensionShimsIntoIframe,
} from "~/api/extensionRuntime";
import { historyAdd } from "~/api/history";
import { iframeSetCurrentSrc } from "~/api/iframe";
import { displayUrl, gstaticFavicon, normalizeNav } from "~/lib/browserHelpers";
import { buildChiiInjectScript } from "~/lib/buildChiiInjectScript";
import type searchBar from "~/lib/SearchBar";
import { isInternalUrl, resolveUrl, tabManager } from "~/lib/TabManager";

type BarInstance = ReturnType<typeof searchBar>;

let chiiTargetScriptTextPromise: Promise<string> | null = null;
const chiiSocketBridgeWindows = new WeakSet<Window>();
const chiiGhostCleanupDocs = new WeakSet<Document>();

function decodeProxyUrl(href: string): string {
    try {
        const url = new URL(href);
        if (url.pathname.startsWith("/~/scramjet/")) {
            const encoded = url.pathname.split("/").filter(Boolean).at(-1);
            if (encoded && window.scramjet?.decodeUrl) {
                return window.scramjet.decodeUrl(encoded);
            }
        }

        const uv = window.__uv$config;
        const uvPrefix = uv?.prefix as string | undefined;
        if (uvPrefix && url.pathname.startsWith(uvPrefix) && uv.decodeUrl) {
            return uv.decodeUrl(url.pathname.slice(uvPrefix.length));
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
// Reset cache when hot-reloaded so patching always uses latest logic.
if (import.meta.hot) {
    import.meta.hot.accept(() => {
        chiiTargetScriptTextPromise = null;
    });
}

function setNodeStylesToHidden(node: HTMLElement) {
    node.style.setProperty("display", "none", "important");
    node.style.setProperty("visibility", "hidden", "important");
    node.style.setProperty("opacity", "0", "important");
    node.style.setProperty("pointer-events", "none", "important");
}

// chii/chobitsu injects hidden helper nodes it marks with `__chobitsu-hide__`.
// Match that plus any chobitsu-namespaced class so late-renamed variants are
// caught too.
const CHII_GHOST_SELECTOR = '.__chobitsu-hide__, [class*="__chobitsu"]';

function isChiiGhost(el: Element): boolean {
    try {
        return el.matches(CHII_GHOST_SELECTOR);
    } catch {
        return false;
    }
}

function hideChiiGhostNodes(doc: Document): void {
    try {
        doc.querySelectorAll(CHII_GHOST_SELECTOR).forEach(node => {
            if (node instanceof HTMLElement) setNodeStylesToHidden(node);
        });
    } catch {}
}

function ensureChiiGhostCleanup(doc: Document): void {
    hideChiiGhostNodes(doc);
    if (chiiGhostCleanupDocs.has(doc)) return;
    chiiGhostCleanupDocs.add(doc);

    const observer = new MutationObserver(records => {
        for (const record of records) {
            if (record.type === "attributes") {
                const t = record.target;
                if (t instanceof HTMLElement && isChiiGhost(t)) {
                    setNodeStylesToHidden(t);
                }
                continue;
            }
            for (const node of record.addedNodes) {
                if (!(node instanceof Element)) continue;
                if (node instanceof HTMLElement && isChiiGhost(node)) {
                    setNodeStylesToHidden(node);
                }
                node.querySelectorAll(CHII_GHOST_SELECTOR).forEach(ghost => {
                    if (ghost instanceof HTMLElement) {
                        setNodeStylesToHidden(ghost);
                    }
                });
            }
        }
        hideChiiGhostNodes(doc);
    });

    const root = doc.documentElement;
    if (!root) return;
    observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
    });
}

function ensureChiiSocketBridgeHost(targetWindow: Window): void {
    if (chiiSocketBridgeWindows.has(targetWindow)) return;
    chiiSocketBridgeWindows.add(targetWindow);

    const HOST_WS = window.WebSocket;
    const sockets = new Map<string, WebSocket>();
    const emitToChild = (message: Record<string, unknown>): void => {
        try {
            targetWindow.dispatchEvent(
                new CustomEvent("__civilChiiBridgeToChild", {
                    detail: message,
                }),
            );
        } catch {}
    };

    const onBridgeRequest = (event: Event) => {
        const detail = (event as CustomEvent<Record<string, string>>).detail;
        const data = detail;
        if (!data) return;
        const id = typeof data.id === "string" ? data.id : "";
        if (!id) return;

        if (data.type === "create") {
            const existing = sockets.get(id);
            if (existing) {
                try {
                    existing.close(1000, "");
                } catch {}
                sockets.delete(id);
            }

            const url = typeof data.url === "string" ? data.url : "";
            if (!url) return;
            const protocols = Array.isArray(data.protocols)
                ? data.protocols
                : typeof data.protocols === "string"
                  ? data.protocols
                  : undefined;

            const ws =
                protocols === undefined
                    ? new HOST_WS(url)
                    : new HOST_WS(url, protocols);
            sockets.set(id, ws);

            ws.addEventListener("open", () => {
                emitToChild({
                    id,
                    type: "open",
                    protocol: ws.protocol,
                    extensions: ws.extensions,
                });
            });
            ws.addEventListener("message", async ev => {
                let payload = ev.data;
                if (payload && typeof payload !== "string") {
                    if ("arrayBuffer" in payload) {
                        payload = await payload.arrayBuffer();
                    } else if ("byteLength" in payload) {
                        payload = payload.slice(0);
                    }
                }
                emitToChild({
                    id,
                    type: "message",
                    data: payload,
                    origin: ev.origin,
                    lastEventId: ev.lastEventId,
                    ports: ev.ports,
                });
            });
            ws.addEventListener("error", () => {
                emitToChild({ id, type: "error" });
            });
            ws.addEventListener("close", ev => {
                sockets.delete(id);
                emitToChild({
                    id,
                    type: "close",
                    code: ev.code,
                    reason: ev.reason,
                    wasClean: ev.wasClean,
                });
            });
            return;
        }

        const ws = sockets.get(id);
        if (!ws) return;

        if (data.type === "send") {
            ws.send(data.data);
            return;
        }

        if (data.type === "close") {
            sockets.delete(id);
            ws.close(
                typeof data.code === "number" ? data.code : 1000,
                typeof data.reason === "string" ? data.reason : "",
            );
            return;
        }

        if (data.type === "setBinaryType") {
            if (
                data.binaryType === "blob" ||
                data.binaryType === "arraybuffer"
            ) {
                ws.binaryType = data.binaryType;
            }
        }
    };

    targetWindow.addEventListener(
        "__civilChiiBridgeToHost",
        onBridgeRequest as EventListener,
    );
}

function getChiiTargetScriptText(): Promise<string> {
    if (!chiiTargetScriptTextPromise) {
        chiiTargetScriptTextPromise = fetch(
            `${window.location.origin}/chii/target.js`,
            { cache: "no-store" },
        ).then(async res => {
            if (!res.ok)
                throw new Error(`Failed to load chii target.js: ${res.status}`);
            return res.text();
        });
    }
    return chiiTargetScriptTextPromise;
}

function bindChiiGlobals(
    win: Window,
    doc: Document,
    devtoolsIframe?: HTMLIFrameElement,
) {
    const targets: unknown[] = [win];
    try {
        targets.push(win.window);
    } catch {}
    try {
        targets.push(win.self);
    } catch {}

    for (const target of targets) {
        try {
            (target as any).ChiiServerUrl = `${window.location.origin}/chii/`;
            (target as any).ChiiTitle = doc.title || "Civil Tab";
            if (devtoolsIframe) {
                (target as any).ChiiDevtoolsIframe = devtoolsIframe;
            }
        } catch {}
    }
}

export function injectChiiIntoIframe(
    iframe: HTMLIFrameElement,
    devtoolsIframe?: HTMLIFrameElement,
): void {
    const resolveInjectableContexts = (): Array<{
        win: Window;
        doc: Document;
    }> => {
        try {
            const initialWin = iframe.contentWindow;
            const initialDoc = iframe.contentDocument;
            if (
                !initialWin ||
                !initialDoc ||
                initialDoc.location.href === "about:blank"
            )
                return [];
            return [{ win: initialWin, doc: initialDoc }];
        } catch {
            return [];
        }
    };

    const inject = async () => {
        const contexts = resolveInjectableContexts();
        if (!contexts.length) return;

        let targetScriptText = "";
        try {
            targetScriptText = await getChiiTargetScriptText();
        } catch {
            return;
        }

        for (const { win, doc } of contexts) {
            try {
                ensureChiiSocketBridgeHost(win);
                ensureChiiGhostCleanup(doc);
                bindChiiGlobals(win, doc, devtoolsIframe);

                const code = buildChiiInjectScript(targetScriptText);

                // Scramjet/UV block <script>-tag injection from executing on
                // proxied pages, so the chii client never ran (target never
                // registered -> devtools stuck on about:blank). Run it through
                // the preamble's saved native eval instead; fall back to a
                // <script> tag on internal (non-proxied) pages where eval isn't
                // stashed but script tags work.
                const nativeEval = (
                    win as unknown as {
                        __civilNativeEval?: (c: string) => unknown;
                    }
                ).__civilNativeEval;

                if (typeof nativeEval === "function") {
                    nativeEval(code);
                } else {
                    const existing = doc.getElementById("__civil_chii__");
                    if (existing) existing.remove();
                    const script = doc.createElement("script");
                    script.id = "__civil_chii__";
                    script.type = "text/javascript";
                    script.textContent = code;
                    (doc.body ?? doc.head ?? doc.documentElement)?.appendChild(
                        script,
                    );
                }
            } catch {}
        }
    };

    const onLoad = () => {
        void inject();
        iframe.addEventListener("load", onLoad, { once: true });
    };

    if (
        iframe.contentDocument?.readyState === "complete" &&
        iframe.contentDocument?.location.href !== "about:blank"
    ) {
        void inject();
    }

    iframe.addEventListener("load", onLoad, { once: true });
}

export function cleanupChiiArtifacts(iframe: HTMLIFrameElement): void {
    // Also sweep the host document: a stray chii/chobitsu helper node can be
    // attached there (not just inside the target frame), and it only becomes
    // visible for certain dock positions (top/left).
    try {
        if (typeof document !== "undefined") {
            ensureChiiGhostCleanup(document);
            hideChiiGhostNodes(document);
        }
    } catch {}
    try {
        const doc = iframe.contentDocument;
        if (!doc || doc.location.href === "about:blank") return;
        ensureChiiGhostCleanup(doc);
        hideChiiGhostNodes(doc);
    } catch {}
}

export function createIframeManager(
    bar: BarInstance,
    push: (id: string, url: string) => void,
) {
    const iframeMap = new Map<string, HTMLIFrameElement>();

    void extensionsLaunchBackgrounds();

    const navigateIframe = (id: string, url: string) => {
        const iframe = iframeMap.get(id);
        if (!iframe) return;

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

        tabManager.updateTab(id, { url, isLoading: true, title: "Loading…" });

        if (!isInternalUrl(url)) {
            void fetch("/api/track-visit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: normalizeNav(url) }),
            })
                .then(res => res.json())
                .then(
                    (data: {
                        userBanned?: boolean;
                        banReason?: string | null;
                    }) => {
                        if (!data.userBanned) return;
                        tabManager.updateTab(id, {
                            isLoading: false,
                            title: "Banned",
                        });

                        if (!data.banReason) return;
                        iframe.src = `${window.location.origin}/ban?reason=${encodeURIComponent(data.banReason)}`;
                    },
                )
                .catch(() => {});
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

        el.addEventListener("load", async () => {
            let href: string | undefined;
            try {
                href = el.contentWindow?.location.href;
            } catch {}
            if (!href || href === "about:blank") return;

            try {
                const docTitle = el.contentDocument?.title;
                const tabUrl = decodeProxyUrl(href);
                const favicon = isInternalUrl(tabUrl)
                    ? "/favicon.ico"
                    : gstaticFavicon(normalizeNav(tabUrl));
                const resolvedTitle =
                    docTitle || displayUrl(tabUrl) || "Untitled";
                tabManager.updateTab(id, {
                    url: tabUrl,
                    isLoading: false,
                    title: resolvedTitle,
                    favicon,
                });

                push(id, tabUrl);

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
                if (!isInternalUrl(href)) {
                    void historyAdd({
                        url: tabUrl,
                        title: resolvedTitle,
                        visitedAt: Date.now(),
                        favicon,
                    });
                    // Await shim injection BEFORE firing any webNavigation or
                    // tabs.onUpdated events. TM background responds to these
                    // events by calling scripting.executeScript; the BC message
                    // must find the content-script listener already active in
                    // the iframe, otherwise the executeScript is silently lost.
                    await injectExtensionShimsIntoIframe(el, tabUrl, id);

                    // Userscript install: if the page is a .user.js file, inject
                    // a small helper that asks TM's content script to handle it.
                    // TM's content script checks window.location.href (Scramjet
                    // rewrites it to the original URL) and document.body.innerText.
                    // We also fire browser:userscript-install on window.top so
                    // Civil can forward it to TM's background directly.
                    const cleanHref = href.split("?")[0].split("#")[0];
                    if (/\.user\.(js|ts)$/i.test(cleanHref)) {
                        try {
                            const src =
                                el.contentDocument?.body?.innerText ?? "";
                            if (src.includes("// ==UserScript==")) {
                                window.dispatchEvent(
                                    new CustomEvent(
                                        "browser:userscript-install",
                                        {
                                            detail: { url: href, source: src },
                                        },
                                    ),
                                );
                            }
                        } catch {}
                    }
                }

                // Fire webNavigation and tabs.onUpdated AFTER shim injection
                // so that TM's scripting.executeScript responses from the BC
                // bus find the content-script listener already active.
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

                if (id === tabManager.activeId) {
                    iframeSetCurrentSrc(href);
                }
            } catch {
                tabManager.updateTab(id, { isLoading: false });
            }
        });

        const tab = tabManager.tabs.find(t => t.id === id);
        if (tab?.url) {
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
