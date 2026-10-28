import type { ChromeManifest, MessageSender, Port } from "../types";
import { CivilEvent } from "./event";
import {
    dispatchBrowserEvent,
    dual,
    extUrl,
    getBiB,
    getCivilBus,
    resolved,
    toLastError,
} from "./util";

type BusMsg =
    | {
          kind: "sendMessage";
          reqId: string;
          from: string;
          contextType: string;
          message: unknown;
          sender: MessageSender;
      }
    | {
          kind: "sendMessageToTab";
          reqId: string;
          from: string;
          contextType: string;
          message: unknown;
          sender: MessageSender;
      }
    | {
          kind: "sendMessageExternal";
          reqId: string;
          from: string;
          contextType: string;
          message: unknown;
          sender: MessageSender;
      }
    | { kind: "sendResponse"; reqId: string; response: unknown }
    | {
          kind: "connect";
          portId: string;
          portName: string;
          from: string;
          contextType: string;
          sender: MessageSender;
      }
    | {
          kind: "connectExternal";
          portId: string;
          portName: string;
          from: string;
          contextType: string;
          sender: MessageSender;
      }
    | { kind: "portMessage"; portId: string; from: string; message: unknown }
    | { kind: "portDisconnect"; portId: string }
    | {
          kind: "executeScript";
          reqId: string;
          tabId: number | null;
          code?: string;
          files?: string[];
          funcStr?: string;
          args?: unknown[];
      }
    | { kind: "executeScriptResult"; reqId: string; results: unknown[] };

class CivilPort implements Port {
    name: string;
    sender?: MessageSender;
    error?: { message: string };
    readonly onMessage = new CivilEvent<
        (message: unknown, port: Port) => void
    >();
    readonly onDisconnect = new CivilEvent<(port: Port) => void>();
    private _connected = true;
    private _remote: CivilPort | null = null;

    constructor(name: string, sender?: MessageSender) {
        this.name = name;
        this.sender = sender;
    }

    _link(remote: CivilPort): void {
        this._remote = remote;
    }

    postMessage(message: unknown): void {
        if (!this._connected) {
            console.warn("[civil-ext-shim] postMessage on disconnected port");
            return;
        }
        this._remote?.onMessage.dispatch(message, this._remote);
    }

    disconnect(): void {
        if (!this._connected) return;
        this._connected = false;
        this.onDisconnect.dispatch(this);
        this._remote?.onDisconnect.dispatch(this._remote);
        this._remote = null;
    }
}

class BusBridgedPort implements Port {
    name: string;
    sender?: MessageSender;
    error?: { message: string };
    readonly onMessage = new CivilEvent<
        (message: unknown, port: Port) => void
    >();
    readonly onDisconnect = new CivilEvent<(port: Port) => void>();
    private _connected = true;
    private _bus: BroadcastChannel;
    readonly portId: string;
    private _selfFrom: string;

    constructor(
        portId: string,
        name: string,
        bus: BroadcastChannel,
        selfFrom: string,
        sender?: MessageSender,
    ) {
        this.portId = portId;
        this.name = name;
        this._bus = bus;
        this._selfFrom = selfFrom;
        this.sender = sender;
    }

    postMessage(message: unknown): void {
        if (!this._connected) return;
        this._bus.postMessage({
            kind: "portMessage",
            portId: this.portId,
            from: this._selfFrom,
            message,
        } satisfies BusMsg);
    }

    disconnect(): void {
        if (!this._connected) return;
        this._connected = false;
        this._bus.postMessage({
            kind: "portDisconnect",
            portId: this.portId,
        } satisfies BusMsg);
        this.onDisconnect.dispatch(this);
    }

    _receiveMessage(message: unknown): void {
        if (this._connected) this.onMessage.dispatch(message, this);
    }

    _receiveDisconnect(): void {
        if (!this._connected) return;
        this._connected = false;
        this.onDisconnect.dispatch(this);
    }
}

/**
 * The chrome-extension:// sender URL for this context. Content scripts use
 * their actual page URL. Extension pages loaded at /civil-ext/{extId}/{path}
 * use chrome-extension://{extId}/{path} so that background message routers
 * (e.g. Tampermonkey's th()) see the correct URL.
 */
function senderUrl(extId: string, contextType: string): string {
    if (contextType === "content") {
        // Prefer the real page URL baked into bib at inject time over
        // window.location.href which returns the Scramjet proxy URL.
        const bib = getBiB();
        if (bib.currentTab?.url) return bib.currentTab.url;
        return typeof window !== "undefined" ? window.location.href : "";
    }
    if (typeof window !== "undefined") {
        // Prefer the page path embedded by buildExtensionPageSrcDoc so that
        // options.html reports chrome-extension://{extId}/options.html, not
        // action.html (the fallback). This matters for TM's extpage checks.
        const embedded = (window as unknown as Record<string, unknown>)
            .__CIVIL_EXT_PAGE_PATH__;
        if (typeof embedded === "string" && embedded) {
            return `chrome-extension://${extId}/${embedded}`;
        }
        // Pages served at /civil-ext/{extId}/{path}
        const extPathPrefix = `/civil-ext/${extId}/`;
        if (window.location.pathname.startsWith(extPathPrefix)) {
            const filePath = window.location.pathname.slice(
                extPathPrefix.length,
            );
            return `chrome-extension://${extId}/${filePath}`;
        }
    }
    return `chrome-extension://${extId}/${contextType === "popup" ? "action" : contextType}.html`;
}

/** The tab a content script reports itself as being in. */
function contentSenderTab(url: string): chrome.tabs.Tab {
    const bib = getBiB();
    const ct = bib.currentTab as Partial<chrome.tabs.Tab> | undefined;
    return {
        id: ct?.id ?? 1,
        index: ct?.index ?? 0,
        windowId: ct?.windowId ?? 1,
        highlighted: true,
        active: ct?.active ?? true,
        pinned: ct?.pinned ?? false,
        audible: false,
        discarded: false,
        autoDiscardable: true,
        mutedInfo: { muted: false },
        url,
        title:
            ct?.title ??
            (typeof document !== "undefined" ? document.title : ""),
        status: "complete" as const,
        incognito: bib.incognito ?? false,
        width: typeof window !== "undefined" ? window.innerWidth : 1280,
        height: typeof window !== "undefined" ? window.innerHeight : 800,
        groupId: -1,
        selected: true,
        frozen: false,
        lastAccessed: Date.now(),
    } satisfies chrome.tabs.Tab;
}

/**
 * Build a MessageSender for outgoing sendMessage / connect calls.
 * Content scripts always include a `tab` + `frameId` because extensions
 * like TamperMonkey access `sender.tab.id` in their background onMessage
 * handler and crash with a TypeError if `tab` is absent.
 */
function buildSender(
    extId: string,
    contextType: string,
    isExternal = false,
): MessageSender {
    const url = senderUrl(extId, contextType);
    if (isExternal) return { url };
    const base: MessageSender = { id: extId, url };
    if (contextType !== "content") return base;
    return { ...base, tab: contentSenderTab(url), frameId: 0 };
}

type MessageListener = (
    msg: unknown,
    sender: MessageSender,
    sendResponse: (r?: unknown) => void,
) => undefined | boolean;

function runtimeEvents() {
    return {
        onMessage: new CivilEvent<MessageListener>(),
        onMessageExternal: new CivilEvent<MessageListener>(),
        onConnect: new CivilEvent<(port: Port) => void>(),
        onConnectExternal: new CivilEvent<(port: Port) => void>(),
        onInstalled: new CivilEvent<
            (details: chrome.runtime.InstalledDetails) => void
        >(),
        onStartup: new CivilEvent<() => void>(),
        onSuspend: new CivilEvent<() => void>(),
        onSuspendCanceled: new CivilEvent<() => void>(),
        onUpdateAvailable: new CivilEvent<
            (details: { version: string }) => void
        >(),
        onBrowserUpdateAvailable: new CivilEvent<() => void>(),
        onRestartRequired: new CivilEvent<(reason: string) => void>(),
        onUserScriptConnect: new CivilEvent<(port: Port) => void>(),
        onUserScriptMessage: new CivilEvent<
            (msg: unknown, sender: MessageSender) => void
        >(),
    };
}

type RuntimeEvents = ReturnType<typeof runtimeEvents>;
type ConnectInfo = { name?: string; includeTlsChannelId?: boolean };

/** This context's end of the bus every context of the extension shares. */
class RuntimeBus {
    readonly bus: BroadcastChannel;
    readonly contextId: string;
    readonly events = runtimeEvents();
    // Active bus-bridged ports keyed by portId
    private readonly ports = new Map<string, BusBridgedPort>();
    // pending sendMessage responses keyed by reqId
    private readonly pending = new Map<string, (r: unknown) => void>();

    constructor(
        readonly extId: string,
        readonly contextType: string,
    ) {
        this.bus = getCivilBus(extId);
        this.contextId = `${contextType}-${Math.random().toString(36).slice(2)}`;
        this.bus.addEventListener("message", (e: MessageEvent) =>
            this.receive(e.data as BusMsg),
        );
    }

    sender(isExternal = false): MessageSender {
        return buildSender(this.extId, this.contextType, isExternal);
    }

    /**
     * Hands a bus request to `event`'s listeners and posts one response back,
     * from whichever comes first: a listener calling sendResponse, or a
     * promise a listener returned.
     */
    private answerRequest(
        event: RuntimeEvents["onMessage"],
        {
            reqId,
            message,
            sender,
        }: { reqId: string; message: unknown; sender: MessageSender },
    ): void {
        let responded = false;
        const sendResponse = (r?: unknown) => {
            if (responded) return;
            responded = true;
            this.bus.postMessage({
                kind: "sendResponse",
                reqId,
                response: r,
            } satisfies BusMsg);
        };
        const results = event.dispatch(
            message,
            sender,
            sendResponse,
        ) as unknown[];
        const thenable = results.find(
            r =>
                r !== null &&
                typeof r === "object" &&
                typeof (r as { then?: unknown }).then === "function",
        ) as Promise<unknown> | undefined;
        if (thenable) {
            thenable.then(sendResponse).catch(() => sendResponse(undefined));
        }
    }

    private bridgePort(
        data: { portId: string; portName: string; sender: MessageSender },
        event: RuntimeEvents["onConnect"],
    ): void {
        const port = new BusBridgedPort(
            data.portId,
            data.portName,
            this.bus,
            this.contextId,
            data.sender,
        );
        this.ports.set(data.portId, port);
        event.dispatch(port);
    }

    private settleResponse(reqId: string, response: unknown): void {
        const resolve = this.pending.get(reqId);
        if (resolve) {
            this.pending.delete(reqId);
            resolve(response);
        }
    }

    private receivePort(
        data: Extract<BusMsg, { kind: "portMessage" | "portDisconnect" }>,
    ): void {
        const port = this.ports.get(data.portId);
        if (!port) return;
        if (data.kind === "portMessage") {
            if (data.from !== this.contextId)
                port._receiveMessage(data.message);
            return;
        }
        this.ports.delete(data.portId);
        port._receiveDisconnect();
    }

    private receive(data: BusMsg): void {
        if (!data?.kind) return;
        const { events } = this;
        // Don't process our own messages
        const foreign = "from" in data && data.from !== this.contextId;

        switch (data.kind) {
            case "sendMessage":
                if (foreign) this.answerRequest(events.onMessage, data);
                break;
            case "sendMessageToTab":
                if (this.contextType === "content" && foreign) {
                    this.answerRequest(events.onMessage, data);
                }
                break;
            case "sendMessageExternal":
                if (foreign) this.answerRequest(events.onMessageExternal, data);
                break;
            case "sendResponse":
                this.settleResponse(data.reqId, data.response);
                break;
            case "connect":
                if (foreign) this.bridgePort(data, events.onConnect);
                break;
            case "connectExternal":
                if (foreign) this.bridgePort(data, events.onConnectExternal);
                break;
            case "portMessage":
            case "portDisconnect":
                this.receivePort(data);
                break;
        }
    }

    connect(
        extensionIdOrInfo?: string | ConnectInfo,
        connectInfo?: ConnectInfo,
    ): Port {
        const isExternal = typeof extensionIdOrInfo === "string";
        const info = isExternal
            ? (connectInfo ?? {})
            : typeof extensionIdOrInfo === "object"
              ? (extensionIdOrInfo ?? {})
              : {};
        const portId = `port-${Math.random().toString(36).slice(2)}`;
        const portName = info.name ?? "";
        const sender = this.sender(isExternal);

        const localEvent = isExternal
            ? this.events.onConnectExternal
            : this.events.onConnect;
        if (localEvent.hasListeners()) {
            const local = new CivilPort(portName, sender);
            const remote = new CivilPort(portName, sender);
            local._link(remote);
            remote._link(local);
            localEvent.dispatch(remote);
            return local;
        }

        // Cross-context connect via bus
        const port = new BusBridgedPort(
            portId,
            portName,
            this.bus,
            this.contextId,
            sender,
        );
        this.ports.set(portId, port);
        this.bus.postMessage({
            kind: isExternal ? "connectExternal" : "connect",
            portId,
            portName,
            from: this.contextId,
            contextType: this.contextType,
            sender,
        } satisfies BusMsg);
        return port;
    }

    /**
     * Always sends via the bus so the message reaches OTHER contexts
     * (background, offscreen, etc.). Dispatching locally would deliver the
     * message back to the sending context itself, which is never correct:
     * Chrome never delivers a sendMessage to the same context that sent it.
     */
    request(message: unknown, isExternal: boolean): Promise<unknown> {
        const sender = this.sender(isExternal);
        const reqId = Math.random().toString(36).slice(2);
        return new Promise<unknown>(resolve => {
            this.pending.set(reqId, resolve);
            this.bus.postMessage({
                kind: isExternal ? "sendMessageExternal" : "sendMessage",
                reqId,
                from: this.contextId,
                contextType: this.contextType,
                message,
                sender,
            } satisfies BusMsg);
            setTimeout(() => {
                if (this.pending.has(reqId)) {
                    console.warn(
                        `[civil-ext-runtime:${this.contextType}] sendMessage TIMEOUT reqId=${reqId} msg=${JSON.stringify(message)?.slice(0, 120)}`,
                    );
                    this.pending.delete(reqId);
                    resolve(undefined);
                }
            }, 5000);
        });
    }
}

/** sendMessage(message, options?, cb?) or sendMessage(extId, message, options?, cb?). */
function sendMessageVia(runtimeBus: RuntimeBus) {
    return (
        extensionIdOrMessage?: string | unknown,
        messageOrOptions?: unknown,
        optionsOrCb?: unknown,
        maybeCb?: (response: unknown) => void,
    ): Promise<unknown> => {
        const isExternal = typeof extensionIdOrMessage === "string";
        const message = isExternal ? messageOrOptions : extensionIdOrMessage;
        const callbacks = isExternal
            ? [optionsOrCb, maybeCb]
            : [messageOrOptions, optionsOrCb, maybeCb];
        const cb = callbacks.find(c => typeof c === "function") as
            | ((response: unknown) => void)
            | undefined;
        return dual(() => runtimeBus.request(message, isExternal), cb);
    };
}

function openOptionsPage(extId: string, manifest: ChromeManifest) {
    return (cb?: () => void) => {
        // Open options_page / options_ui.page in a new tab (simulates
        // Chrome's behaviour when options_ui.open_in_tab is true).
        const m = manifest as unknown as {
            options_page?: string;
            options_ui?: { page?: string };
        };
        const optPath = m.options_page ?? m.options_ui?.page;
        if (optPath) {
            dispatchBrowserEvent(getBiB().newTabEvent, {
                url: `chrome-extension://${extId}/${optPath}`,
            });
        }
        if (cb) cb();
        return Promise.resolve();
    };
}

/** The runtime methods that answer from fixed facts about this host. */
function runtimeFacts() {
    return {
        getContexts: (
            _filter: Record<string, unknown>,
            cb?: (ctx: unknown[]) => void,
        ) => resolved([], cb),
        getPlatformInfo: (cb?: (info: chrome.runtime.PlatformInfo) => void) => {
            const { platformInfo } = getBiB();
            return resolved(
                {
                    os: platformInfo.os ?? "win",
                    arch: platformInfo.arch ?? "x86-64",
                    nacl_arch: platformInfo.nacl_arch ?? "x86-64",
                } as chrome.runtime.PlatformInfo,
                cb,
            );
        },
        getBackgroundPage: (cb?: (page: Window | null) => void) =>
            resolved(null, cb),
        isAllowedFileSchemeAccess: (cb?: (allowed: boolean) => void) =>
            resolved(false, cb),
        isAllowedIncognitoAccess: (cb?: (allowed: boolean) => void) =>
            resolved(false, cb),
        setUninstallURL: (_url: string, cb?: () => void) =>
            resolved(undefined, cb),
        reload: () => {
            /* no-op */
        },
        requestUpdateCheck: (cb?: (status: string) => void) => {
            if (cb) cb("no_update");
            return Promise.resolve({ status: "no_update" });
        },
    };
}

export function buildRuntimeAPI(
    extId: string,
    manifest: ChromeManifest,
    contextType: string = "content",
) {
    let _lastError: { message: string } | null = null;
    const runtimeBus = new RuntimeBus(extId, contextType);
    const { events } = runtimeBus;

    if (contextType === "background") {
        setTimeout(() => {
            events.onInstalled.dispatch({
                reason: "install",
                previousVersion: undefined,
            } as chrome.runtime.InstalledDetails);
            events.onStartup.dispatch();
        }, 0);
    }

    const sendMessage = sendMessageVia(runtimeBus);
    return {
        id: extId,
        get lastError() {
            return _lastError;
        },
        getManifest: () => ({ ...manifest }) as Record<string, unknown>,
        getURL: (path: string): string => extUrl(extId, path),
        sendMessage,
        connect: runtimeBus.connect.bind(runtimeBus),
        ...runtimeFacts(),
        openOptionsPage: openOptionsPage(extId, manifest),
        sendRequest: sendMessage,
        ...events,
        _bus: runtimeBus.bus,
        _contextId: runtimeBus.contextId,
        _setLastError(e: unknown) {
            _lastError = e ? toLastError(e) : null;
        },
        _clearLastError() {
            _lastError = null;
        },
    };
}
