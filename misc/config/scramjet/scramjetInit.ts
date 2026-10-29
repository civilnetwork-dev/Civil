/// <reference types="@mercuryworkshop/scramjet-controller" />
import genProxyPath from "$config/shared/genProxyPath";
import { decode, encode } from "$config/shared/xorCodec";

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scramjet: any;
        scramjetReady: Promise<void>;
    }
}

const { Controller } = $scramjetController;
const proxyPath = genProxyPath("/", "scramjet");
const spf = `${proxyPath}scramjet.`;
const controllerPath = genProxyPath("/", "scramjetController");

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
                `${location.origin}/bare-transport/index.mjs`
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
    const { defaultConfig } = $scramjet;

    return new Controller({
        serviceworker,
        transport,
        config: {
            prefix: "/~/scramjet/",
            scramjetPath: `${spf}js`,
            injectPath: `${controllerPath}controller.inject.js`,
            wasmPath: `${spf}wasm`,
            virtualWasmPath: "scramjet.wasm.js",
            codec,
        },
        scramjetConfig: {
            ...defaultConfig,
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

async function initScramjet() {
    // Same check as registerSw in src/lib/swUtils.ts. Without it the first
    // read of navigator.serviceWorker throws a TypeError.
    if (!("serviceWorker" in navigator)) {
        throw new Error(
            "Service workers are not supported, so scramjet cannot start.",
        );
    }

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
