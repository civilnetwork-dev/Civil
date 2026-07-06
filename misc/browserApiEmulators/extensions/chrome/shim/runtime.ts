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

export function buildRuntimeAPI(
    extId: string,
    manifest: ChromeManifest,
    contextType: string = "content",
) {
    let _lastError: { message: string } | null = null;
    const bus = getCivilBus(extId);
    const _contextId = `${contextType}-${Math.random().toString(36).slice(2)}`;

    // Derive the chrome-extension:// sender URL for this context.
    // Content scripts use their actual page URL. Extension pages loaded at
    // /civil-ext/{extId}/{path} use chrome-extension://{extId}/{path} so that
    // background message routers (e.g. Tampermonkey's th()) see the correct URL.
    function _buildSenderUrl(): string {
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

    /**
     * Build a MessageSender for outgoing sendMessage / connect calls.
     * Content scripts always include a `tab` + `frameId` because extensions
     * like TamperMonkey access `sender.tab.id` in their background onMessage
     * handler and crash with a TypeError if `tab` is absent.
     */
    function _buildSender(isExternal = false): MessageSender {
        const url = _buildSenderUrl();
        if (isExternal) return { url };
        const base: MessageSender = { id: extId, url };
        if (contextType !== "content") return base;
        const bib = getBiB();
        const ct = bib.currentTab as Partial<chrome.tabs.Tab> | undefined;
        return {
            ...base,
            tab: {
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
                height:
                    typeof window !== "undefined" ? window.innerHeight : 800,
                groupId: -1,
                selected: true,
                frozen: false,
            } satisfies chrome.tabs.Tab,
            frameId: 0,
        };
    }

    // Active bus-bridged ports keyed by portId
    const _busPorts = new Map<string, BusBridgedPort>();

    const onMessage = new CivilEvent<
        (
            msg: unknown,
            sender: MessageSender,
            sendResponse: (r?: unknown) => void,
        ) => undefined | boolean
    >();
    const onMessageExternal = new CivilEvent<
        (
            msg: unknown,
            sender: MessageSender,
            sendResponse: (r?: unknown) => void,
        ) => undefined | boolean
    >();
    const onConnect = new CivilEvent<(port: Port) => void>();
    const onConnectExternal = new CivilEvent<(port: Port) => void>();
    const onInstalled = new CivilEvent<
        (details: chrome.runtime.InstalledDetails) => void
    >();
    const onStartup = new CivilEvent<() => void>();
    const onSuspend = new CivilEvent<() => void>();
    const onSuspendCanceled = new CivilEvent<() => void>();
    const onUpdateAvailable = new CivilEvent<
        (details: { version: string }) => void
    >();
    const onBrowserUpdateAvailable = new CivilEvent<() => void>();
    const onRestartRequired = new CivilEvent<(reason: string) => void>();
    const onUserScriptConnect = new CivilEvent<(port: Port) => void>();
    const onUserScriptMessage = new CivilEvent<
        (msg: unknown, sender: MessageSender) => void
    >();

    // pending sendMessage responses keyed by reqId
    const _pendingResponses = new Map<string, (r: unknown) => void>();

    bus.addEventListener("message", (e: MessageEvent) => {
        const data = e.data as BusMsg;
        if (!data?.kind) return;

        if (data.kind === "sendMessage") {
            // Don't process our own messages
            if (data.from === _contextId) return;
            const { reqId, message, sender } = data;
            let responded = false;
            const sendResponse = (r?: unknown) => {
                if (!responded) {
                    responded = true;
                    bus.postMessage({
                        kind: "sendResponse",
                        reqId,
                        response: r,
                    } satisfies BusMsg);
                }
            };
            const results = onMessage.dispatch(
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
                thenable
                    .then(sendResponse)
                    .catch(() => sendResponse(undefined));
            }
        }

        if (data.kind === "sendMessageToTab") {
            if (contextType !== "content") return;
            if (data.from === _contextId) return;
            const { reqId, message, sender } = data;
            let responded = false;
            const sendResponse = (r?: unknown) => {
                if (!responded) {
                    responded = true;
                    bus.postMessage({
                        kind: "sendResponse",
                        reqId,
                        response: r,
                    } satisfies BusMsg);
                }
            };
            const results = onMessage.dispatch(
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
                thenable
                    .then(sendResponse)
                    .catch(() => sendResponse(undefined));
            }
        }

        if (data.kind === "sendResponse") {
            const resolve = _pendingResponses.get(data.reqId);
            if (resolve) {
                _pendingResponses.delete(data.reqId);
                resolve(data.response);
            }
        }

        if (data.kind === "sendMessageExternal") {
            if (data.from === _contextId) return;
            const { reqId, message, sender } = data;
            let responded = false;
            const sendResponse = (r?: unknown) => {
                if (!responded) {
                    responded = true;
                    bus.postMessage({
                        kind: "sendResponse",
                        reqId,
                        response: r,
                    } satisfies BusMsg);
                }
            };
            const results = onMessageExternal.dispatch(
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
                thenable
                    .then(sendResponse)
                    .catch(() => sendResponse(undefined));
            }
        }

        if (data.kind === "connect") {
            if (data.from === _contextId) return;
            const port = new BusBridgedPort(
                data.portId,
                data.portName,
                bus,
                _contextId,
                data.sender,
            );
            _busPorts.set(data.portId, port);
            onConnect.dispatch(port);
        }

        if (data.kind === "connectExternal") {
            if (data.from === _contextId) return;
            const port = new BusBridgedPort(
                data.portId,
                data.portName,
                bus,
                _contextId,
                data.sender,
            );
            _busPorts.set(data.portId, port);
            onConnectExternal.dispatch(port);
        }

        if (data.kind === "portMessage") {
            const port = _busPorts.get(data.portId);
            if (port && data.from !== _contextId) {
                port._receiveMessage(data.message);
            }
        }

        if (data.kind === "portDisconnect") {
            const port = _busPorts.get(data.portId);
            if (port) {
                _busPorts.delete(data.portId);
                port._receiveDisconnect();
            }
        }
    });

    if (contextType === "background") {
        setTimeout(() => {
            onInstalled.dispatch({
                reason: "install",
                previousVersion: undefined,
            } as chrome.runtime.InstalledDetails);
            onStartup.dispatch();
        }, 0);
    }

    function getURL(path: string): string {
        return extUrl(extId, path);
    }

    function connect(
        extensionIdOrInfo?:
            | string
            | { name?: string; includeTlsChannelId?: boolean },
        connectInfo?: { name?: string; includeTlsChannelId?: boolean },
    ): Port {
        const isExternal = typeof extensionIdOrInfo === "string";
        const info = isExternal
            ? (connectInfo ?? {})
            : typeof extensionIdOrInfo === "object"
              ? (extensionIdOrInfo ?? {})
              : {};
        const portId = `port-${Math.random().toString(36).slice(2)}`;
        const portName = info.name ?? "";

        const sender = _buildSender(isExternal);

        const localEvent = isExternal ? onConnectExternal : onConnect;
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
            bus,
            _contextId,
            sender,
        );
        _busPorts.set(portId, port);
        bus.postMessage({
            kind: isExternal ? "connectExternal" : "connect",
            portId,
            portName,
            from: _contextId,
            contextType,
            sender,
        } satisfies BusMsg);
        return port;
    }

    function sendMessage(
        extensionIdOrMessage?: string | unknown,
        messageOrOptions?: unknown,
        optionsOrCb?: unknown,
        maybeCb?: (response: unknown) => void,
    ): Promise<unknown> {
        let message: unknown;
        let cb: ((response: unknown) => void) | undefined;
        let isExternalCall = false;
        if (typeof extensionIdOrMessage === "string") {
            isExternalCall = true;
            message = messageOrOptions;
            cb = (
                typeof optionsOrCb === "function" ? optionsOrCb : maybeCb
            ) as typeof cb;
        } else {
            message = extensionIdOrMessage;
            cb = (
                typeof messageOrOptions === "function"
                    ? messageOrOptions
                    : typeof optionsOrCb === "function"
                      ? optionsOrCb
                      : maybeCb
            ) as typeof cb;
        }

        const sender = _buildSender(isExternalCall);

        // Always send via bus so the message reaches OTHER contexts (background,
        // offscreen, etc.). Dispatching locally would deliver the message back to
        // the sending context itself, which is never correct: Chrome never
        // delivers a sendMessage to the same context that sent it.
        return dual(() => {
            const reqId = Math.random().toString(36).slice(2);
            return new Promise<unknown>(resolve => {
                _pendingResponses.set(reqId, resolve);
                bus.postMessage({
                    kind: isExternalCall
                        ? "sendMessageExternal"
                        : "sendMessage",
                    reqId,
                    from: _contextId,
                    contextType,
                    message,
                    sender,
                } satisfies BusMsg);
                setTimeout(() => {
                    if (_pendingResponses.has(reqId)) {
                        console.warn(
                            `[civil-ext-runtime:${contextType}] sendMessage TIMEOUT reqId=${reqId} msg=${JSON.stringify(message)?.slice(0, 120)}`,
                        );
                        _pendingResponses.delete(reqId);
                        resolve(undefined);
                    }
                }, 5000);
            });
        }, cb);
    }

    return {
        id: extId,
        get lastError() {
            return _lastError;
        },

        getManifest: () => ({ ...manifest }) as Record<string, unknown>,
        getURL,
        sendMessage,
        connect,

        getContexts: (
            _filter: Record<string, unknown>,
            cb?: (ctx: unknown[]) => void,
        ) => resolved([], cb),

        getPlatformInfo: (cb?: (info: chrome.runtime.PlatformInfo) => void) => {
            const bib = getBiB();
            return resolved(
                {
                    os: bib.platformInfo.os ?? "win",
                    arch: bib.platformInfo.arch ?? "x86-64",
                    nacl_arch: bib.platformInfo.nacl_arch ?? "x86-64",
                } as chrome.runtime.PlatformInfo,
                cb,
            );
        },

        getBackgroundPage: (cb?: (page: Window | null) => void) =>
            resolved(null, cb),
        openOptionsPage: (cb?: () => void) => {
            // Open options_page / options_ui.page in a new tab (simulates
            // Chrome's behaviour when options_ui.open_in_tab is true).
            const m = manifest as unknown as {
                options_page?: string;
                options_ui?: { page?: string };
            };
            const optPath = m.options_page ?? m.options_ui?.page;
            if (optPath) {
                const bib = getBiB();
                dispatchBrowserEvent(bib.newTabEvent, {
                    url: `chrome-extension://${extId}/${optPath}`,
                });
            }
            if (cb) cb();
            return Promise.resolve();
        },

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

        sendRequest: sendMessage,

        onMessage,
        onMessageExternal,
        onConnect,
        onConnectExternal,
        onInstalled,
        onStartup,
        onSuspend,
        onSuspendCanceled,
        onUpdateAvailable,
        onBrowserUpdateAvailable,
        onRestartRequired,
        onUserScriptConnect,
        onUserScriptMessage,

        _bus: bus,
        _contextId,
        _setLastError(e: unknown) {
            _lastError = e ? toLastError(e) : null;
        },
        _clearLastError() {
            _lastError = null;
        },
    };
}
