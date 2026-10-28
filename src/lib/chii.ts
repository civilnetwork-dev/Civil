import { buildChiiInjectScript } from "~/lib/buildChiiInjectScript";

let chiiTargetScriptTextPromise: Promise<string> | null = null;
const chiiSocketBridges = new WeakMap<Window, ChiiSocketBridge>();
const chiiGhostCleanupDocs = new WeakSet<Document>();

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

/** Hides chii's ghost nodes in a node just added to a watched document, and
 *  starts watching the document of any iframe it brings along. */
function hideGhostsInAddedNode(node: Node): void {
    if (!(node instanceof Element)) return;
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
            record.addedNodes.forEach(hideGhostsInAddedNode);
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

type BridgeRequest = Record<string, string>;

/**
 * Host-side WebSockets for chii running inside a proxied frame: the frame
 * asks over `__civilChiiBridgeToHost` events, and each socket's events go
 * back over `__civilChiiBridgeToChild`.
 */
class ChiiSocketBridge {
    private readonly HostWebSocket = window.WebSocket;
    private readonly sockets = new Map<string, WebSocket>();

    constructor(private readonly targetWindow: Window) {
        targetWindow.addEventListener(
            "__civilChiiBridgeToHost",
            (event: Event) =>
                this.onRequest((event as CustomEvent<BridgeRequest>).detail),
        );
    }

    private emitToChild(message: Record<string, unknown>): void {
        try {
            this.targetWindow.dispatchEvent(
                new CustomEvent("__civilChiiBridgeToChild", {
                    detail: message,
                }),
            );
        } catch {}
    }

    /** Relays a host socket's events to the child frame's stand-in. */
    private relay(id: string, ws: WebSocket): void {
        ws.addEventListener("open", () => {
            this.emitToChild({
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
            this.emitToChild({
                id,
                type: "message",
                data: payload,
                origin: ev.origin,
                lastEventId: ev.lastEventId,
                ports: ev.ports,
            });
        });
        ws.addEventListener("error", () => {
            this.emitToChild({ id, type: "error" });
        });
        ws.addEventListener("close", ev => {
            this.sockets.delete(id);
            this.emitToChild({
                id,
                type: "close",
                code: ev.code,
                reason: ev.reason,
                wasClean: ev.wasClean,
            });
        });
    }

    /** Opens the host socket the child asked for, replacing any it already
     *  had under the same id. */
    private open(id: string, data: BridgeRequest): void {
        const existing = this.sockets.get(id);
        if (existing) {
            try {
                existing.close(1000, "");
            } catch {}
            this.sockets.delete(id);
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
                ? new this.HostWebSocket(url)
                : new this.HostWebSocket(url, protocols);
        this.sockets.set(id, ws);
        this.relay(id, ws);
    }

    private onRequest(data: BridgeRequest | undefined): void {
        if (!data) return;
        const id = typeof data.id === "string" ? data.id : "";
        if (!id) return;

        if (data.type === "create") {
            this.open(id, data);
            return;
        }

        const ws = this.sockets.get(id);
        if (!ws) return;

        switch (data.type) {
            case "send":
                ws.send(data.data);
                break;
            case "close":
                this.sockets.delete(id);
                ws.close(
                    typeof data.code === "number" ? data.code : 1000,
                    typeof data.reason === "string" ? data.reason : "",
                );
                break;
            case "setBinaryType":
                if (
                    data.binaryType === "blob" ||
                    data.binaryType === "arraybuffer"
                ) {
                    ws.binaryType = data.binaryType;
                }
                break;
        }
    }
}

function ensureChiiSocketBridgeHost(targetWindow: Window): void {
    if (chiiSocketBridges.has(targetWindow)) return;
    chiiSocketBridges.set(targetWindow, new ChiiSocketBridge(targetWindow));
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

/** The frame's window and document, once it holds a real page. */
function injectableContexts(
    iframe: HTMLIFrameElement,
): Array<{ win: Window; doc: Document }> {
    try {
        const win = iframe.contentWindow;
        const doc = iframe.contentDocument;
        if (!win || !doc || doc.location.href === "about:blank") return [];
        return [{ win, doc }];
    } catch {
        return [];
    }
}

/** Runs chii in the page: by its saved native eval, else a script tag. */
function runChiiScript(win: Window, doc: Document, code: string): void {
    const nativeEval = (
        win as unknown as {
            __civilNativeEval?: (c: string) => unknown;
        }
    ).__civilNativeEval;

    if (typeof nativeEval === "function") {
        nativeEval(code);
        return;
    }
    const existing = doc.getElementById("__civil_chii__");
    if (existing) existing.remove();
    const script = doc.createElement("script");
    script.id = "__civil_chii__";
    script.type = "text/javascript";
    script.textContent = code;
    (doc.body ?? doc.head ?? doc.documentElement)?.appendChild(script);
}

async function injectChii(
    iframe: HTMLIFrameElement,
    devtoolsIframe?: HTMLIFrameElement,
): Promise<void> {
    const contexts = injectableContexts(iframe);
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
            runChiiScript(win, doc, buildChiiInjectScript(targetScriptText));
        } catch {}
    }
}

export function injectChiiIntoIframe(
    iframe: HTMLIFrameElement,
    devtoolsIframe?: HTMLIFrameElement,
): void {
    const onLoad = () => {
        void injectChii(iframe, devtoolsIframe);
        iframe.addEventListener("load", onLoad, { once: true });
    };

    if (
        iframe.contentDocument?.readyState === "complete" &&
        iframe.contentDocument?.location.href !== "about:blank"
    ) {
        void injectChii(iframe, devtoolsIframe);
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
