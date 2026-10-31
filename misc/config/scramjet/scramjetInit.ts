/// <reference types="@mercuryworkshop/scramjet-controller" />
import {
    engineNames,
    PROXY_PREFIX,
    runtimeScripts,
} from "$config/shared/runtimeScripts";
import { decode, encode } from "$config/shared/xorCodec";

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scramjet: any;
        scramjetReady: Promise<void>;
    }
}

// misc/runtimeScripts.ts serves the bundles with their globals renamed, so
// the upstream names are never defined here.
const runtime = globalThis as unknown as Record<string, any>;
const { Controller } = runtime[engineNames.controller];

// bare-mux publishes its worker path here, and Aristotle Student reads the key
// as a proxy marker. Nothing in Civil reads it back (see forgetBareMuxPath in
// src/lib/swUtils.ts), so drop whatever an earlier visit left behind.
try {
    localStorage.removeItem("bare-mux-path");
} catch {}

// The controller copies these into every proxied frame and worker as source
// text, which is why shared/xorCodec.ts keeps both functions self-contained.
const codec = { encode, decode };

const WISP_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/wisp/`;

// Built transport instances, cached by key so each is created at most once and
// reused across frames. Enables per-frame transport switching at runtime (the
// scramjet controller stores transport per-frame on frame.controller.transport).
const transportCache = new Map<string, Promise<any>>();

function getTransport(key: string): Promise<any> {
    if (!transportCache.has(key)) {
        transportCache.set(
            key,
            buildTransport(key, WISP_URL).catch(error => {
                transportCache.delete(key);
                throw error;
            }),
        );
    }
    return transportCache.get(key)!;
}

async function buildTransport(key: string, wispUrl: string) {
    switch (key) {
        case "bare": {
            const { default: BareTransport } = await import(
                `${location.origin}/bareTransport/index.mjs`
            );
            const t = new BareTransport(new URL(`${location.origin}/bare/`));
            await t.init();
            return t;
        }
        case "libcurl": {
            const { default: LibcurlTransport } = await import(
                `${location.origin}/libcurl/index.mjs`
            );
            const t = new LibcurlTransport({ wisp: wispUrl });
            await t.init();
            return t;
        }
        default: {
            const { default: EpoxyTransport } = await import(
                `${location.origin}/epoxy/index.mjs`
            );
            // "epoxy@2" speaks Wisp version 2. Civil's server (run.ts) answers
            // in version 2 only when the socket asks for a subprotocol, so the
            // client names one; plain "epoxy" stays the version 1 client.
            const t = new EpoxyTransport(
                key === "epoxy@2"
                    ? {
                          wisp: wispUrl,
                          wisp_v2: true,
                          wisp_ws_protocols: ["wisp-v2"],
                      }
                    : { wisp: wispUrl },
            );
            await t.init();
            return t;
        }
    }
}

async function createTransport() {
    const stored = localStorage.getItem("transport") || "epoxy";
    // Same default as `wispVersion` in src/lib/settings.ts: version 2 unless
    // the user picked 1. A value older builds stored, like "auto", reads as 2.
    const wisp = localStorage.getItem("civil:wisp-version") || "2";
    const preferred = stored === "epoxy" && wisp !== "1" ? "epoxy@2" : stored;

    const tryOrder = [...new Set([preferred, "epoxy", "libcurl", "bare"])];

    let lastError: unknown;
    for (const key of tryOrder) {
        try {
            const t = await getTransport(key);
            // Seed cache already done by getTransport; return the winning one.
            return t;
        } catch (error) {
            lastError = error;
            console.warn(
                `[civil] transport "${key}" failed to init, trying next`,
                error,
            );
        }
    }
    throw lastError ?? new Error("No usable proxy transport");
}

/** Resolves on the next controllerchange, or after `timeoutMs` regardless. */
function controllerChange(timeoutMs: number): Promise<void> {
    return new Promise<void>(resolve => {
        const onChange = () => {
            navigator.serviceWorker.removeEventListener(
                "controllerchange",
                onChange,
            );
            resolve();
        };
        navigator.serviceWorker.addEventListener("controllerchange", onChange, {
            once: true,
        });
        setTimeout(resolve, timeoutMs);
    });
}

function createController(
    serviceworker: ServiceWorker,
    transport: Awaited<ReturnType<typeof createTransport>>,
) {
    const { defaultConfig } = runtime[engineNames.engine];

    return new Controller({
        serviceworker,
        transport,
        config: {
            prefix: PROXY_PREFIX,
            scramjetPath: runtimeScripts.engine,
            injectPath: runtimeScripts.frame,
            wasmPath: runtimeScripts.wasm,
            virtualWasmPath: engineNames.wasmScript,
            codec,
        },
        scramjetConfig: {
            ...defaultConfig,
            // Rewritten page code calls these helpers by name, so every proxied
            // frame defines them on its window: `$scramjet$wrap` and the rest.
            // The engine takes the names from config, which lets them drop the
            // engine's name.
            globals: Object.fromEntries(
                Object.entries(defaultConfig.globals as Record<string, string>)
                    .map(([key, name]) => [key, name.replace("$scramjet", "$rt")]),
            ),
            maskedfiles: [engineNames.wasmScript],
            flags: {
                ...defaultConfig.flags,
                rewriterLogs: false,
                scramitize: false,
                cleanErrors: true,
                sourcemaps: true,
                syncxhr: true,
                allowInvalidJs: true,
                allowFailedIntercepts: true,
            } as any,
            siteFlags: defaultConfig.siteFlags,
        },
    });
}

function openCookieStore(name: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        // Version and store name are the controller's own: it opens the same
        // database with the same schema.
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains("state")) {
                request.result.createObjectStore("state");
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function cookieRecord(
    db: IDBDatabase,
    mode: IDBTransactionMode,
    use: (store: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const request = use(db.transaction("state", mode).objectStore("state"));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * The controller keeps proxied sites' cookies in IndexedDB. Earlier builds
 * named that database after the engine, and Aristotle Student matches
 * /scramjet/ against `indexedDB.databases()`. Move the saved cookies to the
 * neutral name once, then delete the old database, so nobody loses a login.
 */
async function retireLegacyDatabase(): Promise<void> {
    const { database, legacyDatabase } = engineNames;
    try {
        const known = await indexedDB.databases?.();
        if (known && !known.some(db => db.name === legacyDatabase)) return;

        const legacy = await openCookieStore(legacyDatabase);
        const saved = await cookieRecord(legacy, "readonly", store =>
            store.get("cookies"),
        );
        legacy.close();
        if (saved) {
            const current = await openCookieStore(database);
            // Keep newer cookies if this build already saved some.
            const existing = await cookieRecord(current, "readonly", store =>
                store.get("cookies"),
            );
            if (!existing) {
                await cookieRecord(current, "readwrite", store =>
                    store.put(saved, "cookies"),
                );
            }
            current.close();
        }
    } catch (error) {
        console.warn("[civil] could not move saved cookies", error);
    }
    indexedDB.deleteDatabase(legacyDatabase);
}

async function initScramjet() {
    // Same check as registerSw in src/lib/swUtils.ts. Without it the first
    // read of navigator.serviceWorker throws a TypeError.
    if (!("serviceWorker" in navigator)) {
        throw new Error(
            "Service workers are not supported, so scramjet cannot start.",
        );
    }

    await retireLegacyDatabase();

    const [registration, transport] = await Promise.all([
        navigator.serviceWorker.ready,
        createTransport(),
    ]);

    if (!navigator.serviceWorker.controller) await controllerChange(5000);

    const serviceworker =
        navigator.serviceWorker.controller ?? registration.active!;

    const controller = createController(serviceworker, transport);

    await controller.wait();

    window.scramjet = Object.assign(controller, {
        encodeUrl: (s: string) => controller.prefix + codec.encode(s),
        decodeUrl: codec.decode,
    });

    // Expose lazy transport builder for per-frame runtime transport switching.
    (window as any).__civilGetTransport = getTransport;
}

window.scramjetReady = initScramjet().catch(error => {
    console.error("[civil] scramjet failed to start:", error);
});
