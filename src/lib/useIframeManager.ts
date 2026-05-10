import { extensionsApplyToIframe } from "~/api/extensions";
import { historyAdd } from "~/api/history";
import { iframeSetCurrentSrc } from "~/api/iframe";
import { displayUrl, normalizeNav } from "~/lib/browserHelpers";
import { buildChiiInjectScript } from "~/lib/buildChiiInjectScript";
import { trackVisit } from "~/lib/db";
import type searchBar from "~/lib/SearchBar";
import { isInternalUrl, resolveUrl, tabManager } from "~/lib/TabManager";

type BarInstance = ReturnType<typeof searchBar>;

let chiiTargetScriptTextPromise: Promise<string> | null = null;
const chiiSocketBridgeWindows = new WeakSet<Window>();
const chiiGhostCleanupDocs = new WeakSet<Document>();
// Reset cache when hot-reloaded so patching always uses latest logic.
if (import.meta.hot) {
    import.meta.hot.accept(() => {
        chiiTargetScriptTextPromise = null;
    });
}

function hideChiiGhostNodes(doc: Document): void {
    try {
        const ghostNodes = doc.querySelectorAll(".__chobitsu-hide__");
        ghostNodes.forEach(node => {
            if (!(node instanceof HTMLElement)) return;
            node.style.setProperty("display", "none", "important");
            node.style.setProperty("visibility", "hidden", "important");
            node.style.setProperty("opacity", "0", "important");
            node.style.setProperty("pointer-events", "none", "important");
        });
    } catch {}
}

function ensureChiiGhostCleanup(doc: Document): void {
    hideChiiGhostNodes(doc);
    if (chiiGhostCleanupDocs.has(doc)) return;
    chiiGhostCleanupDocs.add(doc);

    const observer = new MutationObserver(records => {
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (!(node instanceof Element)) continue;
                if (node.classList.contains("__chobitsu-hide__")) {
                    if (node instanceof HTMLElement) {
                        node.style.setProperty("display", "none", "important");
                        node.style.setProperty(
                            "visibility",
                            "hidden",
                            "important",
                        );
                        node.style.setProperty("opacity", "0", "important");
                        node.style.setProperty(
                            "pointer-events",
                            "none",
                            "important",
                        );
                    }
                    continue;
                }
                const nestedGhosts =
                    node.querySelectorAll(".__chobitsu-hide__");
                nestedGhosts.forEach(ghost => {
                    if (!(ghost instanceof HTMLElement)) return;
                    ghost.style.setProperty("display", "none", "important");
                    ghost.style.setProperty(
                        "visibility",
                        "hidden",
                        "important",
                    );
                    ghost.style.setProperty("opacity", "0", "important");
                    ghost.style.setProperty(
                        "pointer-events",
                        "none",
                        "important",
                    );
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

                const existing = doc.getElementById("__civil_chii__");
                if (existing) {
                    existing.remove();
                }

                const script = doc.createElement("script");
                script.id = "__civil_chii__";
                script.type = "text/javascript";
                script.textContent = buildChiiInjectScript(targetScriptText);
                bindChiiGlobals(win, doc, devtoolsIframe);
                (doc.body ?? doc.head ?? doc.documentElement)?.appendChild(
                    script,
                );
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
