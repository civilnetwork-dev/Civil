/**
 * The web platform under the extension API.
 *
 * `chrome.*` is only half of what a vendor bundle runs against. The other
 * half is whatever the surrounding global scope provides, and a bare
 * `node:vm` context provides almost none of it — no `Response`, no
 * `EventTarget`, no `location`, no `document`. Loading the twenty-eight real
 * filter bundles showed that this, not the extension API, was what actually
 * stopped most of them: `ReferenceError: window is not defined` kills a
 * background script every bit as dead as a missing `chrome.storage`.
 *
 * ## The MV2/MV3 split is real, not a convenience
 *
 * An MV3 `service_worker` runs in a ServiceWorkerGlobalScope: `self`,
 * `location`, `navigator`, `fetch`, `importScripts` — and no `window`, no
 * `document`. A bundle that touches `document` there is broken in real
 * Chrome too, and handing it a DOM would hide that.
 *
 * MV2 is the opposite. `background.scripts` and `background.page` both load
 * into a real background **page**, which is a full document with `window`,
 * `document`, `localStorage` and the rest. Withholding those from an MV2
 * background isn't strictness, it's inaccuracy — and it is exactly what
 * stopped goguardian, gopherbuddy, mobileguardian and contentkeeper, all
 * four of them MV2.
 *
 * So the DOM is provided for MV2 backgrounds and withheld from MV3 ones,
 * which is what each actually gets from Chrome.
 *
 * ## Offline by construction
 *
 * Nothing here reaches the network. `fetch` rejects the way a real offline
 * device does rather than throwing synchronously (a synchronous throw from a
 * top-level `fetch` takes the whole background script down, which is not what
 * losing the network does), and `WebSocket` connects to nothing and reports
 * an error. Both are overridable through `LoadOptions.allowNetwork`.
 */

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import UserAgent from "user-agents";

import type { ExtensionTarget } from "../types";

export interface PlatformOptions {
    manifestVersion: 2 | 3;
    extensionId: string;
    /** The unpacked extension directory, so `fetch` can serve the
     *  extension's own packaged files — see `buildFetch`. */
    extensionDir: string;
    /** MV2 backgrounds are pages and get a DOM; MV3 service workers don't. */
    dom: boolean;
    allowNetwork: boolean;
    /** Optional responder for genuinely remote requests — see LoadOptions.network. */
    network?: (request: {
        url: string;
        method: string;
    }) => Response | undefined | Promise<Response | undefined>;
    target: ExtensionTarget;
    /** Where `self.location` points: the background entry's own URL. */
    backgroundPath: string;
    timers: Set<TimerHandle>;
}

/** What `setTimeout`/`setInterval` hand back.
 *
 *  A union, because this project compiles with both the DOM lib and
 *  @types/node in scope: the *call* resolves to the DOM overload and yields
 *  `number`, while `typeof setTimeout` resolves to Node's and yields
 *  `Timeout`. Naming either one alone type-errors against the other, and
 *  which one shows up at runtime depends on the host. Both are accepted by
 *  `clearTimeout`, which is all this type is ever used for. */
export type TimerHandle = ReturnType<typeof setTimeout> | number;

/** Torn down by `ExtensionHandle.dispose`. */
export interface Platform {
    globals: Record<string, unknown>;
    /**
     * Adds a `<script src>` to the background page's document, for MV2 only;
     * a no-op without a DOM.
     *
     * The element is added, not executed — the host runs the code itself in
     * the vm. What this provides is the document *looking* the way Chrome's
     * generated background page looks, which bundles read: ciscoUmbrella's
     * walks `document.getElementsByTagName("script")` and takes
     * `[0].parentNode`, and an empty document makes that a TypeError.
     */
    addScriptElement(src: string): void;
    dispose(): void;
}

/**
 * `fetch` against a server that isn't there.
 *
 * Two things this deliberately is not. It is not a synchronous throw: a
 * top-level `fetch()` that throws ends the whole background script, which is
 * not what losing the network does and is how lightspeedFilterAgent stopped
 * dead. And it is not a rejection either, which is what a real offline
 * device gives — because plenty of vendor bundles call `fetch` during
 * startup without a `.catch`, and an unhandled rejection is a test failure
 * even though the bundle is fine.
 *
 * So: an empty, well-formed, unsuccessful-but-parseable response. `.json()`
 * gives `{}`, `.text()` gives `"{}"`, `.ok` is false. A bundle that checks
 * the status takes its error path; one that parses regardless gets an empty
 * object rather than an exception. Nothing is fabricated *as data* — the
 * body is empty and the status says the request did not succeed. Pass
 * `allowNetwork` for real traffic.
 */
function offlineFetch(): Promise<Response> {
    return Promise.resolve(
        new Response("{}", {
            status: 503,
            statusText: "Service Unavailable (extension host is offline)",
            headers: { "content-type": "application/json" },
        }),
    );
}

const CONTENT_TYPES: Record<string, string> = {
    ".css": "text/css",
    ".html": "text/html",
    ".js": "text/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain",
    ".wasm": "application/wasm",
};

/**
 * `fetch`, with the extension's own packaged files served from disk.
 *
 * Being offline does not stop an extension from reading its own resources:
 * `fetch(chrome.runtime.getURL("model.wasm"))` is a local read that succeeds
 * on a plane, and vendor bundles use it for exactly that — WebAssembly
 * blobs, bundled rule lists, default configuration. Answering those with the
 * generic offline response hands a WebAssembly compiler two bytes of JSON,
 * which is how ckauthenticatorg3 and lightspeedInsightAgent failed with
 * "doesn't parse at byte 0".
 *
 * Anything pointing off-extension still gets the offline response. The
 * containment property is unchanged: no request leaves the machine.
 */
export function buildFetch(
    extensionId: string,
    extensionDir: string,
    network: PlatformOptions["network"],
): typeof globalThis.fetch {
    const prefix = `chrome-extension://${extensionId}/`;
    return (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
            typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.href
                  : (input as Request).url;
        if (!url.startsWith(prefix)) {
            const method =
                init?.method ??
                (typeof input === "object" && "method" in input
                    ? (input as Request).method
                    : "GET");
            return (await network?.({ url, method })) ?? offlineFetch();
        }

        const relative = decodeURIComponent(
            url.slice(prefix.length).split(/[?#]/)[0] ?? "",
        );
        // Nothing outside the extension directory, whatever the path says.
        const resolved = resolve(extensionDir, relative);
        if (!resolved.startsWith(resolve(extensionDir))) return offlineFetch();

        try {
            const body = await readFile(resolved);
            const extension = relative.slice(relative.lastIndexOf("."));
            return new Response(new Uint8Array(body), {
                status: 200,
                headers: {
                    "content-type":
                        CONTENT_TYPES[extension] ?? "application/octet-stream",
                },
            });
        } catch {
            return new Response("", { status: 404, statusText: "Not Found" });
        }
    }) as typeof globalThis.fetch;
}

/** `WebAssembly`, plus the streaming entry points Node doesn't ship.
 *  Two of the filters compile a `.wasm` blob at startup through
 *  `instantiateStreaming(fetch(...))`, and a missing method there is a
 *  synchronous TypeError that ends the script. */
function buildWebAssembly(): unknown {
    const fromResponse = async (source: Response | Promise<Response>) => {
        const response = await source;
        return response.arrayBuffer();
    };
    return {
        ...WebAssembly,
        Module: WebAssembly.Module,
        Instance: WebAssembly.Instance,
        Memory: WebAssembly.Memory,
        Table: WebAssembly.Table,
        Global: WebAssembly.Global,
        CompileError: WebAssembly.CompileError,
        LinkError: WebAssembly.LinkError,
        RuntimeError: WebAssembly.RuntimeError,
        validate: WebAssembly.validate,
        compile: WebAssembly.compile,
        instantiate: WebAssembly.instantiate,
        compileStreaming: async (source: Response | Promise<Response>) =>
            WebAssembly.compile(await fromResponse(source)),
        instantiateStreaming: async (
            source: Response | Promise<Response>,
            imports?: WebAssembly.Imports,
        ) => WebAssembly.instantiate(await fromResponse(source), imports),
    };
}

/**
 * `XMLHttpRequest`. Node has none at all, and bundles reach for it
 * unconditionally — MV2 code especially, plus the Emscripten runtimes a
 * couple of them embed.
 *
 * Like `fetch`, it serves the extension's own packaged files and nothing
 * else. That is not a nicety: goguardian loads its Avro schemas this way and
 * then parses them, so a stub that always answered "503, empty body" handed
 * the parser an empty string and died on `invalid name: ""` — a failure with
 * no resemblance to anything a real device would do.
 *
 * Synchronous mode (`open(..., false)`) is supported, because that is how
 * this kind of packaged-resource read is usually written.
 */
export function buildXMLHttpRequest(
    extensionId: string,
    extensionDir: string,
): unknown {
    const prefix = `chrome-extension://${extensionId}/`;

    const readLocal = (url: string): string | null => {
        if (!url.startsWith(prefix)) return null;
        const relative = decodeURIComponent(
            url.slice(prefix.length).split(/[?#]/)[0] ?? "",
        );
        const resolved = resolve(extensionDir, relative);
        if (!resolved.startsWith(resolve(extensionDir))) return null;
        try {
            return readFileSync(resolved, "utf-8");
        } catch {
            return null;
        }
    };
    return class OfflineXMLHttpRequest extends EventTarget {
        static readonly UNSENT = 0;
        static readonly OPENED = 1;
        static readonly HEADERS_RECEIVED = 2;
        static readonly LOADING = 3;
        static readonly DONE = 4;

        readyState = 0;
        status = 0;
        statusText = "";
        responseText = "";
        response: unknown = "";
        responseType = "";
        responseURL = "";
        timeout = 0;
        withCredentials = false;
        onreadystatechange: (() => void) | null = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        onloadend: (() => void) | null = null;

        #async = true;

        open(_method: string, url: string, isAsync = true): void {
            this.responseURL = String(url);
            this.#async = isAsync;
            this.readyState = 1;
        }
        setRequestHeader(): void {}
        getAllResponseHeaders(): string {
            return "";
        }
        getResponseHeader(): null {
            return null;
        }
        overrideMimeType(): void {}
        abort(): void {}

        #settle(): void {
            const body = readLocal(this.responseURL);
            this.readyState = 4;
            if (body === null) {
                this.status = 503;
                this.statusText = "Service Unavailable";
                this.responseText = "";
                this.response = this.responseType === "json" ? null : "";
                this.onreadystatechange?.();
                this.onerror?.();
                this.dispatchEvent(new Event("error"));
            } else {
                this.status = 200;
                this.statusText = "OK";
                this.responseText = body;
                this.response =
                    this.responseType === "json"
                        ? JSON.parse(body)
                        : this.responseType === "arraybuffer"
                          ? new TextEncoder().encode(body).buffer
                          : body;
                this.onreadystatechange?.();
                this.onload?.();
                this.dispatchEvent(new Event("load"));
            }
            this.onloadend?.();
            this.dispatchEvent(new Event("loadend"));
        }

        send(): void {
            if (this.#async) queueMicrotask(() => this.#settle());
            else this.#settle();
        }
    };
}

/** A WebSocket that never connects. Reports failure the way a real one does
 *  against an unreachable host: asynchronously, through `error` then
 *  `close`, rather than by throwing at construction. */
export function buildOfflineWebSocket(): unknown {
    return class OfflineWebSocket extends EventTarget {
        static readonly CONNECTING = 0;
        static readonly OPEN = 1;
        static readonly CLOSING = 2;
        static readonly CLOSED = 3;

        readonly url: string;
        readonly protocol = "";
        binaryType = "blob";
        readyState = 0;
        onopen: ((event: unknown) => void) | null = null;
        onmessage: ((event: unknown) => void) | null = null;
        onerror: ((event: unknown) => void) | null = null;
        onclose: ((event: unknown) => void) | null = null;

        constructor(url: string) {
            super();
            this.url = String(url);
            queueMicrotask(() => {
                this.readyState = 3;
                const error = new Event("error");
                this.onerror?.(error);
                this.dispatchEvent(error);
                const close = new Event("close");
                this.onclose?.(close);
                this.dispatchEvent(close);
            });
        }

        send(): void {}
        close(): void {
            this.readyState = 3;
        }
    };
}

/** `self.location` in a service worker is the worker script's own URL; in an
 *  MV2 background page it's the generated page's. Both are
 *  `chrome-extension://<id>/...`, and both are read for `origin` and `href`
 *  often enough that an object missing them produces `Invalid URL` further
 *  down (loilo's bundle, specifically). A `URL` alone won't do: it reports
 *  `origin` as "null" for a non-special scheme, where Chrome reports the
 *  extension origin. */
function buildLocation(extensionId: string, path: string) {
    const origin = `chrome-extension://${extensionId}`;
    const url = new URL(path.replace(/^\//, ""), `${origin}/`);
    return {
        href: url.href,
        origin,
        protocol: "chrome-extension:",
        host: extensionId,
        hostname: extensionId,
        port: "",
        pathname: url.pathname,
        search: "",
        hash: "",
        assign: () => {},
        replace: () => {},
        reload: () => {},
        toString: () => url.href,
    };
}

/**
 * A real device of the right kind, drawn from the `user-agents` corpus.
 *
 * Chrome OS for the `chrome` target because Civil's whole audience is
 * school-managed Chromebooks (see PRODUCT.md), so a bundle branching on
 * platform takes the branch a student's machine would; Apple-vendored macOS
 * for `safari`.
 *
 * The filter can legitimately match nothing if the corpus shifts, and
 * `new UserAgent(filter)` throws in that case. Falling back to an
 * unfiltered agent keeps the host loading — a slightly wrong device beats no
 * navigator at all, which is a `ReferenceError` in the first bundle that
 * reads one.
 */
function pickUserAgent(target: ExtensionTarget): UserAgent {
    const filter =
        target === "safari"
            ? ([/Macintosh/, { vendor: "Apple Computer, Inc." }] as const)
            : /CrOS/;
    try {
        return new UserAgent(filter as never);
    } catch {
        return new UserAgent();
    }
}

/**
 * `navigator` as the chosen device reports it.
 *
 * `appVersion` and `connection` are here because bundles read them without
 * guarding — haparahighlights calls `self.navigator.appVersion.match(...)`
 * and securlyClassroom calls `navigator.connection.addEventListener(...)`
 * during startup, and an absent property is a TypeError in both.
 */
function buildNavigator(target: ExtensionTarget) {
    // Real device data rather than a hand-written string, from the same
    // `user-agents` package and the same `/CrOS/` filter that
    // misc/filters/securly/cluster.ts uses to talk to Securly. A hardcoded
    // UA goes stale silently — this one shipped claiming Chrome 128 while
    // the package's current Chrome OS entries are on 150 — and it drags
    // `platform`, `vendor`, `language` and `connection` along with it, all
    // of which the package already carries as a *consistent set*. Inventing
    // those four independently is how you end up with a navigator no real
    // device ever reported.
    //
    // Each load picks a different real device, which is deliberate: a bundle
    // that behaves differently across two loads is reacting to the device
    // rather than to the extension API, and that is worth surfacing rather
    // than freezing out.
    const agent = pickUserAgent(target);
    const data = agent.data as unknown as {
        appName: string;
        language: string;
        platform: string;
        vendor: string;
        deviceCategory: string;
        connection?: Record<string, unknown>;
    };
    const userAgent = agent.toString();

    // The package's own connection record, made live: securlyClassroom calls
    // `navigator.connection.addEventListener(...)` during startup, and a
    // plain object is a TypeError there.
    const connection = Object.assign(
        new EventTarget() as EventTarget & Record<string, unknown>,
        { saveData: false, onchange: null },
        data.connection ?? {},
    );

    const chromeMajor = /Chrome\/(\d+)/.exec(userAgent)?.[1];
    const primaryLanguage = data.language.split("-")[0] ?? data.language;

    return {
        userAgent,
        appVersion: userAgent.replace(/^Mozilla\//, ""),
        appName: data.appName,
        appCodeName: "Mozilla",
        product: "Gecko",
        vendor: data.vendor,
        platform: data.platform,
        language: data.language,
        languages: [data.language, primaryLanguage],
        onLine: true,
        cookieEnabled: true,
        doNotTrack: null,
        hardwareConcurrency: 4,
        deviceMemory: 4,
        maxTouchPoints: 0,
        connection,
        userAgentData: {
            platform: target === "safari" ? "macOS" : "Chrome OS",
            mobile: data.deviceCategory === "mobile",
            brands: chromeMajor
                ? [{ brand: "Chromium", version: chromeMajor }]
                : [],
            getHighEntropyValues: async () => ({}),
        },
        storage: {
            estimate: async () => ({ quota: 2 ** 31, usage: 0 }),
            persisted: async () => false,
            persist: async () => false,
        },
        permissions: {
            query: async () => ({ state: "granted", onchange: null }),
        },
        sendBeacon: () => false,
        clipboard: {
            readText: async () => "",
            writeText: async () => {},
        },
        // A managed Chromebook is typically on AC power in a classroom cart —
        // full and charging is the honest default, not a placeholder. An
        // EventTarget for the same reason `connection` above is one:
        // imtlazarus and lanschoolStudent both call
        // `getBattery().then(b => b.addEventListener(...))`.
        getBattery: async () =>
            Object.assign(
                new EventTarget() as EventTarget & Record<string, unknown>,
                {
                    charging: true,
                    chargingTime: 0,
                    dischargingTime: Number.POSITIVE_INFINITY,
                    level: 1,
                    onchargingchange: null,
                    onchargingtimechange: null,
                    ondischargingtimechange: null,
                    onlevelchange: null,
                },
            ),
    };
}

/** ServiceWorkerGlobalScope members an MV3 background reaches for. Registry
 *  objects rather than stubs, so `addEventListener("install", ...)` and
 *  `clients.matchAll()` behave like a worker nobody has woken. */
function buildServiceWorkerScope() {
    return {
        clients: {
            claim: async () => {},
            get: async () => undefined,
            matchAll: async () => [],
            openWindow: async () => null,
        },
        registration: {
            scope: "/",
            active: null,
            installing: null,
            waiting: null,
            update: async () => {},
            unregister: async () => false,
            showNotification: async () => {},
            getNotifications: async () => [],
        },
        skipWaiting: async () => {},
        caches: {
            open: async () => ({
                match: async () => undefined,
                matchAll: async () => [],
                add: async () => {},
                addAll: async () => {},
                put: async () => {},
                delete: async () => false,
                keys: async () => [],
            }),
            match: async () => undefined,
            has: async () => false,
            delete: async () => false,
            keys: async () => [],
        },
    };
}

/** Web platform constructors Node already implements to spec. Passed through
 *  rather than reimplemented — these are the same objects the rest of the
 *  process uses, and a bundle that constructs a `Response` wants a real one. */
function nodeWebGlobals(): Record<string, unknown> {
    return {
        Response,
        Request,
        Headers,
        FormData,
        Blob,
        File,
        AbortController,
        AbortSignal,
        EventTarget,
        Event,
        CustomEvent,
        MessageChannel,
        MessagePort,
        BroadcastChannel,
        DOMException,
        ReadableStream,
        WritableStream,
        TransformStream,
        CompressionStream,
        DecompressionStream,
        TextEncoder,
        TextDecoder,
        URL,
        URLSearchParams,
        structuredClone,
        queueMicrotask,
        crypto,
        performance,
        atob,
        btoa,
    };
}

// Every real `console` method, bound once at module load — before any
// vendor's code has ever run.
const REAL_CONSOLE_METHODS: Record<string, (...args: unknown[]) => unknown> =
    Object.fromEntries(
        Object.keys(console)
            .filter(
                key =>
                    typeof (console as unknown as Record<string, unknown>)[
                        key
                    ] === "function",
            )
            .map(key => [
                key,
                (
                    console as unknown as Record<
                        string,
                        (...a: unknown[]) => unknown
                    >
                )[key]!.bind(console),
            ]),
    );

/**
 * A fresh `console` per extension load — never the real, shared global
 * object itself. A background is a separate vm realm, so a vendor
 * reassigning `console.log` inside it only ever touches its own copy; handed
 * the real object directly, that reassignment lands on Node's actual global
 * `console` instead (they're the same object, not a copy), corrupting
 * logging for every *other* vendor's background loaded afterward for the
 * rest of the process — confirmed against linewizeConnect, which wraps
 * `console.log` into its own logger that calls back into `console.log`
 * internally, so once the reassignment reaches the real global it recurses
 * into itself on the very next vendor's first log line: a
 * `RangeError: Maximum call stack size exceeded` with no apparent connection
 * to either vendor. `misc/filterProbe/sandbox.ts`'s content-script window
 * shares this same fix, from here rather than a second copy.
 */
export function buildFreshConsole(): Console {
    return { ...REAL_CONSOLE_METHODS } as unknown as Console;
}

export async function buildPlatform(
    options: PlatformOptions,
): Promise<Platform> {
    const { timers } = options;
    const track = <T extends TimerHandle>(handle: T): T => {
        timers.add(handle);
        return handle;
    };
    // These are real Node timers (see the comment below), not happy-dom's —
    // so unlike a content script's timers (filterProbe/sandbox.ts) or this
    // same background page's own DOM timers, nothing else already contains a
    // callback that throws. A vendor bundle's polling loop firing after its
    // synchronous startup has finished is routine, not exceptional (that's
    // the whole reason `setInterval` needs tracking below), so an error from
    // it must not take down the whole host process — logged instead, the
    // same as happy-dom's own default handles a caught timer error.
    const runTimerCallback = (
        fn: (...args: unknown[]) => void,
        args: unknown[],
    ): void => {
        try {
            fn(...args);
        } catch (error) {
            console.error(error);
        }
    };

    const globals: Record<string, unknown> = {
        ...nodeWebGlobals(),
        console: buildFreshConsole(),
        // Real timers, tracked. `chrome.alarms` is virtual (see api/alarms.ts)
        // but `setInterval` is not, and vendor bundles install polling
        // intervals at startup as a matter of course. An untracked one keeps
        // Node's event loop alive for as long as the process runs, which
        // turns "load every filter and check it starts" into a test run that
        // never exits. `dispose()` clears whatever is still outstanding.
        setTimeout: (fn: () => void, ms?: number, ...args: unknown[]) =>
            track(setTimeout(() => runTimerCallback(fn, args), ms)),
        clearTimeout: (handle: TimerHandle) => {
            timers.delete(handle);
            clearTimeout(handle);
        },
        setInterval: (fn: () => void, ms?: number, ...args: unknown[]) =>
            track(setInterval(() => runTimerCallback(fn, args), ms)),
        clearInterval: (handle: TimerHandle) => {
            timers.delete(handle);
            clearInterval(handle);
        },
        // Overrides nodeWebGlobals()'s bare queueMicrotask above for the same
        // reason as the timers: a microtask callback is exactly as deferred
        // and exactly as uncontained.
        queueMicrotask: (fn: () => void) =>
            queueMicrotask(() => runTimerCallback(fn, [])),
        navigator: buildNavigator(options.target),
        location: buildLocation(options.extensionId, options.backgroundPath),
        origin: `chrome-extension://${options.extensionId}`,
        isSecureContext: true,
        // Neither Node nor happy-dom implements IndexedDB — Node has no native
        // version at all, unlike Response/Blob/EventTarget in nodeWebGlobals.
        // A fresh factory per load: a shared module-level instance would leak
        // one extension's stored data into the next extension's load, or one
        // test's into the next's, in the same process.
        indexedDB: new IDBFactory(),
        IDBKeyRange,
        fetch: options.allowNetwork
            ? fetch
            : buildFetch(
                  options.extensionId,
                  options.extensionDir,
                  options.network,
              ),
        // Not in Node, and not in happy-dom's Window either, yet a background
        // page really does have them.
        alert: () => {},
        confirm: () => false,
        prompt: () => null,
        WebSocket: options.allowNetwork ? WebSocket : buildOfflineWebSocket(),
        WebAssembly: buildWebAssembly(),
        XMLHttpRequest: buildXMLHttpRequest(
            options.extensionId,
            options.extensionDir,
        ),
    };

    if (!options.dom) {
        Object.assign(globals, buildServiceWorkerScope());
        return { globals, addScriptElement: () => {}, dispose: () => {} };
    }

    // happy-dom is imported here rather than at module scope so a build that
    // never loads an MV2 extension never pulls a DOM implementation in at
    // all. It is a devDependency, which is the right classification: this
    // host is analysis tooling, not shipped product code.
    const { Window } = await import("happy-dom");
    const window = new Window({
        url: `chrome-extension://${options.extensionId}/_generated_background_page.html`,
        // The host runs the background code itself, in the vm, with the
        // chrome API in scope. happy-dom must not also try to evaluate or
        // fetch anything the document references.
        settings: {
            disableJavaScriptEvaluation: true,
            disableJavaScriptFileLoading: true,
            disableCSSFileLoading: true,
            // errorCapture left at the default ("tryAndCatch"): a background
            // page's own deferred timer callback (setTimeout/setInterval/…)
            // throwing is then caught and logged via console.error instead of
            // crashing this process — "disabled" here is the same trap fixed
            // in filterProbe/sandbox.ts's matching happy-dom usage.
        },
    });
    const dom = window as unknown as Record<string, unknown>;

    // Every constructor and helper the document brings with it — DOMParser,
    // Element, MutationObserver, localStorage, alert, ... — copied onto the
    // sandbox global rather than hand-listed, because the point of using a
    // DOM implementation is not having to guess which parts a minified
    // bundle reaches for.
    //
    // Walking the prototype chain, not just own properties: happy-dom
    // defines `alert`, `getComputedStyle`, `matchMedia` and most other
    // *methods* on Window.prototype, so an own-properties-only copy silently
    // leaves them out — which is how contentkeeper's background page still
    // died on `alert is not defined` after being handed a whole DOM.
    const skip = new Set(["self", "globalThis", "window", "constructor"]);
    for (
        let level: object | null = window;
        level && level !== Object.prototype;
        level = Object.getPrototypeOf(level)
    ) {
        for (const key of Object.getOwnPropertyNames(level)) {
            if (skip.has(key) || key in globals) continue;
            try {
                const value = dom[key];
                if (value === undefined) continue;
                // Methods lose their receiver once copied off the Window.
                globals[key] =
                    typeof value === "function" &&
                    !Object.hasOwn(value, "prototype")
                        ? (value as (...args: unknown[]) => unknown).bind(
                              window,
                          )
                        : value;
            } catch {
                // Some accessors throw when read off the Window in
                // isolation; those are ones no background page uses.
            }
        }
    }
    // `window` is deliberately NOT set here. In a real page `window` *is* the
    // global object, so the caller aliases it to the sandbox itself — which
    // matters concretely: goguardian's background page walks
    // `Object.values(window.chrome)` to promisify the API, and a `window`
    // that is happy-dom's Window rather than the sandbox has no `chrome` on
    // it at all.
    globals.document = window.document;

    return {
        globals,
        addScriptElement: (src: string) => {
            const element = window.document.createElement("script");
            element.setAttribute("src", src);
            window.document.head.appendChild(element);
        },
        // happy-dom runs its own timer queue, which outlives the sandbox
        // unless the window is closed.
        dispose: () => void window.close(),
    };
}
