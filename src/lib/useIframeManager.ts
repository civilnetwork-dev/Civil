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

const CHII_GHOST_SELECTOR = '.__chobitsu-hide__, [class*="__chobitsu"]';

function isChiiGhost(el: Element): boolean {
    try {
        return el.matches(CHII_GHOST_SELECTOR);
    } catch {
        return false;
    }
}

function collectAccessibleDocs(
    doc: Document,
    seen = new Set<Document>(),
): Document[] {
    if (!doc || seen.has(doc)) return [];
    seen.add(doc);
    try {
        for (const frame of Array.from(doc.querySelectorAll("iframe"))) {
            let child: Document | null = null;
            try {
                child = (frame as HTMLIFrameElement).contentDocument;
            } catch {
                child = null;
            }
            if (child) collectAccessibleDocs(child, seen);
        }
    } catch {}
    return [...seen];
}

function hideChiiGhostNodes(doc: Document): void {
    for (const d of collectAccessibleDocs(doc)) {
        try {
            d.querySelectorAll(CHII_GHOST_SELECTOR).forEach(node => {
                if (node instanceof HTMLElement) setNodeStylesToHidden(node);
            });
        } catch {}
    }
}

function ensureChiiGhostCleanup(doc: Document): void {
    for (const d of collectAccessibleDocs(doc)) ensureChiiGhostCleanupDoc(d);
}

function hideGhostsInSingleDoc(doc: Document): void {
    try {
        doc.querySelectorAll(CHII_GHOST_SELECTOR).forEach(node => {
            if (node instanceof HTMLElement) setNodeStylesToHidden(node);
        });
    } catch {}
}

function ensureChiiGhostCleanupDoc(doc: Document): void {
    hideGhostsInSingleDoc(doc);
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
                if (node instanceof HTMLIFrameElement) {
                    let child: Document | null = null;
                    try {
                        child = node.contentDocument;
                    } catch {
                        child = null;
                    }
                    if (child) ensureChiiGhostCleanupDoc(child);
                }
            }
        }
        hideGhostsInSingleDoc(doc);
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

/**
 * A proxied navigation that never fires `load`.
 *
 * The transport can die *after* it initialises — epoxy's wisp socket comes back
 * `400 != 101` at connect time, long past `createTransport`'s init-time
 * fallback — and when it does, `sframe.go()` resolves, nothing loads, and the
 * tab sits on "Loading…" against a blank frame forever. Session replay shows
 * exactly what people do next: they hammer Reload, which re-runs the same dead
 * transport and changes nothing.
 *
 * So the timeout rotates to the next transport and retries once on its own,
 * and only shows a page when the whole ladder is spent. Fifteen seconds is
 * past a slow school link's first paint but well inside the patience that
 * produced those rage clicks.
 */
const NAV_TIMEOUT_MS = 15_000;

/** Mirrors the fallback ladder in `misc/config/scramjet/scramjetInit.ts`. */
const TRANSPORT_ORDER = ["epoxy", "libcurl", "bare"] as const;
type TransportName = (typeof TRANSPORT_ORDER)[number];

function currentTransport(): TransportName {
    const stored = localStorage.getItem("transport");
    return TRANSPORT_ORDER.includes(stored as TransportName)
        ? (stored as TransportName)
        : TRANSPORT_ORDER[0];
}

/** True once the ladder is spent — kept side-effect free, unlike the rotate. */
function isLastTransport(): boolean {
    return (
        TRANSPORT_ORDER.indexOf(currentTransport()) ===
        TRANSPORT_ORDER.length - 1
    );
}

/**
 * Move to the next transport in the ladder, or return null when the current one
 * is already the last. Persisted, so the next page load starts on the transport
 * that actually works on this network rather than rediscovering the failure.
 */
function rotateTransport(): TransportName | null {
    const index = TRANSPORT_ORDER.indexOf(currentTransport());
    const next = TRANSPORT_ORDER[index + 1];
    if (!next) return null;
    localStorage.setItem("transport", next);
    return next;
}

const CONNECTION_ERROR_STYLE = `
:root{color-scheme:dark}
body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
background:#22262F;color:#C2C6D2;
font:400 14px/1.55 "IBM Plex Sans",system-ui,sans-serif}
main{max-width:34rem;padding:2rem}
h1{margin:0 0 .75rem;font-size:15px;font-weight:600;letter-spacing:.02em;color:#EDF1FB}
p{margin:0 0 .75rem}
code{font-family:"IBM Plex Mono",ui-monospace,monospace;color:#E29B69}
.rule{height:1px;background:#434751;margin:1.25rem 0}
button,a.btn{font:inherit;color:#EDF1FB;background:transparent;border:1px solid #434751;
padding:.45rem .9rem;cursor:pointer;text-decoration:none;display:inline-block}
button:hover,a.btn:hover{border-color:#4295E4;color:#4295E4}
.muted{color:#8C919E;font-size:12px}
`;

/**
 * Rendered into the frame itself rather than over it: the frame is the thing
 * that failed, and an overlay would leave a blank page underneath for anyone
 * who dismissed it.
 */
function connectionErrorDoc(url: string, exhausted: boolean): string {
    const safeUrl = url.replace(/[<&>"]/g, c => `&#${c.charCodeAt(0)};`);
    const action = exhausted
        ? `<p>Every connection method Civil has — <code>epoxy</code>,
             <code>libcurl</code> and <code>bare</code> — failed on this
             network. That usually means the filter is blocking Civil's
             WebSocket, not that the site is down.</p>
           <a class="btn" href="/checkfilters" target="_top">Check this network</a>`
        : `<p>Civil switched to <code>${currentTransport()}</code>. Try again.</p>
           <button type="button" id="retry">Try again</button>`;

    return `<!doctype html><meta charset="utf-8"><title>Can't connect</title>
<style>${CONNECTION_ERROR_STYLE}</style>
<main>
  <h1>Can't reach ${safeUrl}</h1>
  <p>The connection to Civil's proxy opened but never delivered the page.</p>
  <div class="rule"></div>
  ${action}
  <p class="muted">Reloading on its own won't help — the connection method has to change.</p>
</main>
<script>
document.getElementById("retry")?.addEventListener("click", function () {
  parent.postMessage({ type: "civil:nav-retry" }, location.origin);
});
</script>`;
}

export function createIframeManager(
    bar: BarInstance,
    push: (id: string, url: string) => void,
) {
    const iframeMap = new Map<string, HTMLIFrameElement>();
    /** Pending navigation watchdogs, keyed by tab id. */
    const navTimers = new Map<string, ReturnType<typeof setTimeout>>();
    /** Last proxied URL per tab, so a retry knows what to re-request. */
    const lastProxiedUrl = new Map<string, string>();

    const clearNavTimer = (id: string) => {
        const timer = navTimers.get(id);
        if (timer === undefined) return;
        clearTimeout(timer);
        navTimers.delete(id);
    };

    void extensionsLaunchBackgrounds();

    const navigateIframe = (
        id: string,
        url: string,
        /**
         * Set when the caller resolved this from a `browser:` URL. `resolveUrl`
         * maps unknown `browser:x` names onto `${origin}/x`, and those don't
         * appear in BROWSER_URLS, so `isInternalUrl` reports false for them and
         * the page gets handed to the proxy instead of loaded directly - it
         * never navigates. The caller knows the scheme, so it says so.
         */
        forceInternal = false,
        /** 0 for a user-initiated navigation, 1 for the automatic retry. */
        attempt = 0,
    ) => {
        const iframe = iframeMap.get(id);
        if (!iframe) return;

        clearNavTimer(id);
        // A frame left holding the error page keeps rendering it: `srcdoc`
        // outranks whatever `src` the proxy sets next.
        iframe.removeAttribute("srcdoc");

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

        const internal = forceInternal || isInternalUrl(url);

        if (!internal) {
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

        if (internal) {
            iframe.src = url;
            return;
        }

        const target = normalizeNav(url);
        lastProxiedUrl.set(id, target);
        bar.emit("submit", iframe, target);

        navTimers.set(
            id,
            setTimeout(() => {
                navTimers.delete(id);
                const rotated = attempt === 0 ? rotateTransport() : null;
                if (rotated) {
                    navigateIframe(id, url, forceInternal, attempt + 1);
                    return;
                }
                tabManager.updateTab(id, {
                    isLoading: false,
                    title: "Can't connect",
                });
                iframe.removeAttribute("src");
                iframe.srcdoc = connectionErrorDoc(target, isLastTransport());
            }, NAV_TIMEOUT_MS),
        );
    };

    const navigate = (id: string, url: string) =>
        navigateIframe(id, resolveUrl(url), url.startsWith("browser:"));

    if (typeof window !== "undefined") {
        window.addEventListener("message", event => {
            if (event.origin !== window.location.origin) return;
            const data = event.data as { type?: string; url?: string } | null;

            if (data?.type === "civil:nav-retry") {
                const id = tabManager.activeId;
                const url = id ? lastProxiedUrl.get(id) : undefined;
                if (id && url) navigateIframe(id, url);
                return;
            }

            // The New Tab omnibox lives inside the tab's own frame, so it
            // hands the URL up rather than navigating itself. A frame that
            // navigates itself to a scramjet URL has no scramjet frame behind
            // it — the URL carries only that document's own controller
            // prefix, which owns no frames — and the service worker answers
            // "Internal Service Worker Error: No frame found for request".
            if (
                data?.type === "civil:navigate" &&
                typeof data.url === "string"
            ) {
                const id =
                    [...iframeMap].find(
                        ([, el]) => el.contentWindow === event.source,
                    )?.[0] ?? tabManager.activeId;
                if (id) navigate(id, data.url);
            }
        });
    }

    const registerIframe = (id: string, el: HTMLIFrameElement) => {
        iframeMap.set(id, el);

        el.addEventListener("load", async () => {
            // The page arrived, so the watchdog has nothing left to catch.
            // Cleared before the early returns: a cross-origin frame throws on
            // `location.href` and would otherwise leave the timer armed, firing
            // a spurious "can't connect" over a page that loaded fine.
            clearNavTimer(id);

            let href: string | undefined;
            try {
                href = el.contentWindow?.location.href;
            } catch {}
            // `about:srcdoc` is the connection-error page below — a Civil
            // artefact, not somewhere the user went, so it stays out of history.
            if (!href || href === "about:blank" || href === "about:srcdoc")
                return;

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
