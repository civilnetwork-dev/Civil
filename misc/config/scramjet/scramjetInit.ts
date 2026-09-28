/// <reference types="@mercuryworkshop/scramjet-controller" />
import genProxyPath from "$config/shared/genProxyPath";
import { init, setSearchEngine } from "$config/shared/wasmDencode";

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

const codec = {
    encode: (s: string) => {
        const state = (globalThis as any).__civil_xorWasm__;
        if (state) {
            const { mod } = state;
            const maxBytes = s.length * 3;
            if (state.scratch.length < maxBytes)
                state.scratch = new Uint8Array(maxBytes * 2);
            const { written } = new TextEncoder().encodeInto(s, state.scratch);
            const ptr = mod.getInBuf(written);
            if (!mod.cachedHeap || mod.cachedHeap.buffer.byteLength === 0)
                mod.cachedHeap = mod.HEAPU8;
            mod.cachedHeap.set(state.scratch.subarray(0, written), ptr);
            mod.encodeBuf(written);
            const outPtr = mod.getOutBuf();
            const outLen = mod.outLen();
            if (!mod.cachedHeap || mod.cachedHeap.buffer.byteLength === 0)
                mod.cachedHeap = mod.HEAPU8;
            return new TextDecoder().decode(
                mod.cachedHeap.subarray(outPtr, outPtr + outLen),
            );
        }
        const H = "0123456789ABCDEF";
        const u = (c: number) =>
            (c >= 65 && c <= 90) ||
            (c >= 97 && c <= 122) ||
            (c >= 48 && c <= 57) ||
            c === 45 ||
            c === 95 ||
            c === 46 ||
            c === 126;
        let s1 = "";
        for (const b of new TextEncoder().encode(s))
            s1 += u(b) ? String.fromCharCode(b) : "%" + H[b >> 4] + H[b & 15];
        const b2 = Array.from(s1, c => c.charCodeAt(0));
        for (let i = 1; i < b2.length; i += 2) b2[i] ^= 2;
        let out = "";
        for (const c of b2)
            out += u(c) ? String.fromCharCode(c) : "%" + H[c >> 4] + H[c & 15];
        return out;
    },
    decode: (s: string) => {
        const state = (globalThis as any).__civil_xorWasm__;
        if (state) {
            const { mod } = state;
            const maxBytes = s.length * 3;
            if (state.scratch.length < maxBytes)
                state.scratch = new Uint8Array(maxBytes * 2);
            const { written } = new TextEncoder().encodeInto(s, state.scratch);
            const ptr = mod.getInBuf(written);
            if (!mod.cachedHeap || mod.cachedHeap.buffer.byteLength === 0)
                mod.cachedHeap = mod.HEAPU8;
            mod.cachedHeap.set(state.scratch.subarray(0, written), ptr);
            mod.decodeBuf(written);
            const outPtr = mod.getOutBuf();
            const outLen = mod.outLen();
            if (!mod.cachedHeap || mod.cachedHeap.buffer.byteLength === 0)
                mod.cachedHeap = mod.HEAPU8;
            return new TextDecoder().decode(
                mod.cachedHeap.subarray(outPtr, outPtr + outLen),
            );
        }
        const b: number[] = [];
        for (let i = 0; i < s.length; i++) {
            if (s[i] === "%" && i + 2 < s.length) {
                b.push(parseInt(s.slice(i + 1, i + 3), 16));
                i += 2;
            } else b.push(s.charCodeAt(i));
        }
        for (let i = 1; i < b.length; i += 2) b[i] ^= 2;
        try {
            return decodeURIComponent(String.fromCharCode(...b));
        } catch {
            return s;
        }
    },
};

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
    // the user picked 1. "auto" has no site to ask about yet, so it's 2 too.
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

async function initScramjet() {
    await init()!;
    setSearchEngine(localStorage.getItem("search")! || "google");

    const [registration, transport] = await Promise.all([
        navigator.serviceWorker.ready,
        createTransport(),
    ]);

    if (!navigator.serviceWorker.controller) {
        await new Promise<void>(resolve => {
            const onChange = () => {
                navigator.serviceWorker.removeEventListener(
                    "controllerchange",
                    onChange,
                );
                resolve();
            };
            navigator.serviceWorker.addEventListener(
                "controllerchange",
                onChange,
                { once: true },
            );
            setTimeout(resolve, 5000);
        });
    }

    const serviceworker =
        navigator.serviceWorker.controller ?? registration.active!;

    const { defaultConfig } = $scramjet;

    const controller = new Controller({
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

    await controller.wait();

    window.scramjet = Object.assign(controller, {
        encodeUrl: (s: string) => controller.prefix + codec.encode(s),
        decodeUrl: codec.decode,
    });

    // Expose lazy transport builder for per-frame runtime transport switching.
    (window as any).__civilGetTransport = getTransport;
}

window.scramjetReady = initScramjet();
