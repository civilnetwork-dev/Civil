import type { BiBConfig } from "../types";

let _bib: Required<BiBConfig> = {
    extPrefix: "/civil-ext/",
    origin: "",
    storagePersistence: "localStorage",
    storageKey: "civil-ext-storage",
    newTabEvent: "browser:newtab",
    navigateEvent: "browser:navigate",
    closeTabEvent: "browser:closetab",
    storagePostMessageType: "civil-ext-storage",
    storageSyncMessageType: "civil-ext-storage-sync",
    platformInfo: { os: "win", arch: "x86-64", nacl_arch: "x86-64" },
    currentTab: {},
    currentWindow: {},
    incognito: false,
    messages: {},
    features: {},
};

export function initBiB(
    cfg: BiBConfig | undefined,
    fallbackOrigin: string,
): void {
    _bib = {
        extPrefix: cfg?.extPrefix ?? "/civil-ext/",
        origin: cfg?.origin ?? fallbackOrigin,
        storagePersistence: cfg?.storagePersistence ?? "localStorage",
        storageKey: cfg?.storageKey ?? "civil-ext-storage",
        newTabEvent: cfg?.newTabEvent ?? "browser:newtab",
        navigateEvent: cfg?.navigateEvent ?? "browser:navigate",
        closeTabEvent: cfg?.closeTabEvent ?? "browser:closetab",
        storagePostMessageType:
            cfg?.storagePostMessageType ?? "civil-ext-storage",
        storageSyncMessageType:
            cfg?.storageSyncMessageType ?? "civil-ext-storage-sync",
        platformInfo: {
            os: cfg?.platformInfo?.os ?? "win",
            arch: cfg?.platformInfo?.arch ?? "x86-64",
            nacl_arch: cfg?.platformInfo?.nacl_arch ?? "x86-64",
        },
        currentTab: cfg?.currentTab ?? {},
        currentWindow: cfg?.currentWindow ?? {},
        incognito: cfg?.incognito ?? false,
        messages: cfg?.messages ?? {},
        features: cfg?.features ?? {},
    };
}

export function getBiB(): Required<BiBConfig> {
    return _bib;
}

export function dual<T>(
    thunk: () => Promise<T>,
    cb?: ((result: T) => void) | null,
): Promise<T> {
    const p = thunk();
    if (cb) {
        p.then(cb).catch(err => {
            console.error("[civil-ext-shim] dual() error:", err);
        });
    }
    return p;
}

export function resolved<T>(
    value: T,
    cb?: ((result: T) => void) | null,
): Promise<T> {
    return dual(() => Promise.resolve(value), cb);
}

export function extUrl(extId: string, path: string): string {
    const prefix = _bib.extPrefix.endsWith("/")
        ? _bib.extPrefix
        : `${_bib.extPrefix}/`;
    const p = path.replace(/^\//, "");
    return `${_bib.origin}${prefix}${extId}/${p}`;
}

export function clone<T>(v: T): T {
    if (v === undefined) return undefined as T;
    if (v === null) return null as T;
    return JSON.parse(JSON.stringify(v)) as T;
}

export function toLastError(e: unknown): { message: string } {
    if (e instanceof Error) return { message: e.message };
    return { message: String(e) };
}

export function dispatchBrowserEvent(name: string, detail: unknown): void {
    try {
        // Extension shims run inside hidden iframes. Dispatch on window.top.document
        // so the Civil SPA (top-level frame) receives the event.
        // Falls back to own document if cross-origin (shouldn't happen in Civil's
        // same-origin proxy, but guard anyway).
        const target: Document | null = (() => {
            try {
                if (typeof window !== "undefined" && window.top)
                    return window.top.document;
            } catch {
                // cross-origin: SecurityError
            }
            return typeof document !== "undefined" ? document : null;
        })();
        target?.dispatchEvent(new CustomEvent(name, { detail }));
    } catch {}
}

export function persistenceRead(key: string): string | null {
    try {
        switch (_bib.storagePersistence) {
            case "localStorage":
                return localStorage.getItem(key);
            case "sessionStorage":
                return sessionStorage.getItem(key);
            default:
                return null;
        }
    } catch {
        return null;
    }
}

export function persistenceWrite(key: string, value: string): void {
    try {
        switch (_bib.storagePersistence) {
            case "localStorage":
                localStorage.setItem(key, value);
                break;
            case "sessionStorage":
                sessionStorage.setItem(key, value);
                break;
            case "postMessage":
                try {
                    window.parent?.postMessage(
                        {
                            type: _bib.storagePostMessageType,
                            data: JSON.parse(value),
                        },
                        "*",
                    );
                } catch {}
                break;
        }
    } catch {}
}

const _buses = new Map<string, BroadcastChannel>();

/**
 * Retrieve (or create) the BroadcastChannel used as the extension message bus
 * for a given extension ID.
 *
 * When running inside a Scramjet-proxied page Scramjet wraps
 * BroadcastChannel.prototype.postMessage to inject a {$scramjet$messagetype,
 * $scramjet$data} envelope.  The extension bus protocol (runtime.ts) checks
 * data.kind directly, so that envelope breaks all messaging.
 *
 * CIVIL_CHII_PREAMBLE saves the native constructor and postMessage BEFORE
 * Scramjet's controller.inject.js runs.  We use those natives here so the
 * bus can always communicate without the Scramjet envelope regardless of which
 * context (background, content, popup) the shim runs in.
 */
export function getCivilBus(extId: string): BroadcastChannel {
    let bus = _buses.get(extId);
    if (!bus) {
        // Use native BroadcastChannel constructor if Scramjet has wrapped it.
        const NativeBC: typeof BroadcastChannel =
            ((typeof window !== "undefined" &&
                (window as unknown as Record<string, unknown>)
                    .__civilNativeBroadcastChannel) as typeof BroadcastChannel) ||
            BroadcastChannel;
        bus = new NativeBC(`civil-ext-bus-${extId}`);

        // Patch postMessage and addEventListener to bypass Scramjet's
        // $scramjet$ envelope wrapper.  Scramjet wraps both the outgoing
        // postMessage (to add its envelope) AND the incoming addEventListener
        // (to unwrap / re-wrap message event.data with $scramjet__* proxies).
        // Using the native versions saved before Scramjet's controller.inject.js
        // ran keeps all BC data clean for the extension bus protocol.
        const _w =
            typeof window !== "undefined"
                ? (window as unknown as Record<string, unknown>)
                : null;
        const nativePost: BroadcastChannel["postMessage"] | undefined =
            _w?.__civilNativeBCPostMessage as
                | BroadcastChannel["postMessage"]
                | undefined;
        if (nativePost && bus.postMessage !== nativePost) {
            bus.postMessage = nativePost.bind(bus);
        }
        const nativeAddEvt: BroadcastChannel["addEventListener"] | undefined =
            _w?.__civilNativeBCAddEventListener as
                | BroadcastChannel["addEventListener"]
                | undefined;
        if (nativeAddEvt && bus.addEventListener !== nativeAddEvt) {
            // Override addEventListener so that handlers receive the raw
            // (non-Scramjet-wrapped) MessageEvent with unmodified data.
            bus.addEventListener = nativeAddEvt.bind(
                bus,
            ) as typeof bus.addEventListener;
        }

        _buses.set(extId, bus);
    }
    return bus;
}
