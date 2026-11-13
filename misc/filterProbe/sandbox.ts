/**
 * "Open the proxy in a sandbox with exactly one filter installed", headless.
 *
 * This is the window.open emulation the task's step 2 asks for, assembled from
 * the two emulator subsystems that already exist rather than as a third:
 *
 *   - The filter's **background** runs in the extension host (`loadExtension`,
 *     misc/extensionHost): real `chrome.*`, real declarativeNetRequest, real
 *     alarms, headless. That is "one filter installed".
 *   - The proxied **page** is fetched through the running Civil server and
 *     loaded into a happy-dom `Window`, and the filter's **content scripts**
 *     (the code that renders an in-place block page) are run against it, with a
 *     small `chrome` shim whose `runtime.sendMessage` is bridged to the loaded
 *     background. That is "the proxy opened".
 *
 * After a wait (the task's fifteen seconds, so a content script that polls or
 * defers has run) it reports back what `detect.ts` needs: the final
 * `location.href`, the page text (enriched with alt/aria/title attribute text,
 * so an image-only overlay isn't invisible to a marker search), and the
 * filter's own declarativeNetRequest verdict for the page URL: a fourth,
 * independent channel alongside redirect/marker/vendor-name that needs no
 * rendering at all, just the ruleset the background already registered.
 *
 * What it is not: a browser. There is no layout, no navigation engine, no
 * cross-origin fetch. A content script that blocks by *redirecting* real
 * navigation is observed through the `location` assignment it makes (captured
 * below); one that blocks by *rewriting the DOM* is observed through the text
 * it leaves; one that blocks via a registered DNR rule is observed by asking
 * the ruleset directly. A filter that blocks by some mechanism needing a real
 * renderer is beyond this and beyond what runs without a browser at all: the
 * honest ceiling, the same one the extension host draws.
 */

import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type * as vm from "node:vm";

import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { Window } from "happy-dom";

import {
    buildFetch,
    buildFreshConsole,
    buildNavigator,
    buildOfflineWebSocket,
    buildXMLHttpRequest,
    compileScript,
    loadExtension,
} from "../extensionHost";
import { shouldLeaveMissing } from "../extensionHost/api/stub";
import {
    ASYNC_CONTAINMENT_INCOMPLETE,
    containVmRejections,
} from "../extensionHost/asyncErrors";

const pageRejections = new WeakMap<Window, (() => void) | undefined>();
import type { ExtensionHandle } from "../extensionHost/types";
import { VENDOR_EMULATION } from "../extensionHost/vendorEmulation";
import type { PageObservation } from "./detect";
import { probeRouteUrl } from "./routes";

export interface SandboxOptions {
    /** Unpacked extension folder for the one filter under test. */
    extensionDir: string;
    /** Catalog folder for fixture policy when the bundle lives under a version directory. */
    extensionFolder?: string;
    /** Catalog ID for bundles that derive URLs or configuration from their own ID. */
    extensionId?: string;
    /** Base URL of the running Civil server (the tunnel URL, or local). */
    baseUrl: string;
    /** The Civil route being tested, e.g. "/newTab". */
    route: string;
    /** For the proxy route, the third-party URL to route through Civil. */
    proxyTarget?: string;
    /** How long to let content scripts settle. The task says fifteen seconds;
     *  a test overrides it down. */
    waitMs?: number;
    /** How the page is fetched. Defaults to global `fetch`; a test injects a
     *  stub so no server is needed. */
    fetchImpl?: typeof fetch;
    /**
     * Real, unstubbed `fetch`/`XMLHttpRequest`/`WebSocket` for both the
     * background (already the case via `loadExtension`) and content scripts.
     * Off by default, same as `LoadOptions.allowNetwork` and for the same
     * reason: an unknown filter bundle must not reach the real network during
     * a routine test run. A one-off, explicitly opted-in live check is the
     * only reason to set this: vendorEmulation.ts's offline emulation is what
     * routine runs should rely on instead.
     */
    allowNetwork?: boolean;
}

interface ContentScript {
    matches: string[];
    exclude_matches?: string[];
    include_globs?: string[];
    exclude_globs?: string[];
    js?: string[];
    run_at?: string;
}

const INJECTION_ORDER: Record<string, number> = {
    document_start: 0,
    document_end: 1,
    document_idle: 2,
};

/** The page fetch, retried a couple of times with a short backoff before
 *  giving up: a bare transient tunnel blip must not be laundered into a
 *  false "clean" read the way a silently-swallowed empty page would be
 *  (detect.ts's fetchError/status check is what actually acts on this; this
 *  is just making sure a real hiccup gets a second chance first). */
async function fetchPageWithRetry(
    doFetch: typeof fetch,
    url: string,
    attempts = 3,
): Promise<{
    html: string;
    status: number;
    fetchError?: string;
    networkRedirectUrl?: string;
}> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const res = await doFetch(url, { redirect: "manual" });
            const location = res.headers.get("location");
            const networkRedirectUrl = res.redirected
                ? res.url
                : location && [301, 302, 303, 307, 308].includes(res.status)
                  ? (URL.parse(location, url)?.href ?? location)
                  : undefined;
            return {
                html: await res.text(),
                status: res.status,
                networkRedirectUrl,
            };
        } catch (error) {
            lastError = error;
            if (attempt < attempts)
                await new Promise(resolve =>
                    setTimeout(resolve, 300 * attempt),
                );
        }
    }
    return {
        html: "",
        status: 0,
        fetchError:
            lastError instanceof Error ? lastError.message : String(lastError),
    };
}

/** `body.textContent` alone misses an image-only block overlay: a shield
 *  icon with `alt="Blocked by Securly"` and no visible text run leaves
 *  nothing in plain text content. Folding in `alt`/`aria-label`/`title`
 *  attribute text and the document title catches that without needing a
 *  real renderer. */
function extractRichText(window: Window): string {
    const doc = window.document;
    const bodyText = doc.body?.textContent ?? "";
    const attrText = [...doc.querySelectorAll("[alt], [aria-label], [title]")]
        .flatMap(el => [
            el.getAttribute("alt"),
            el.getAttribute("aria-label"),
            el.getAttribute("title"),
        ])
        .filter((v): v is string => Boolean(v))
        .join(" ");
    return [doc.title, bodyText, attrText].filter(Boolean).join(" ");
}

/** Chrome match-pattern → predicate. Enough of the grammar for the real
 *  manifests: `*://`, `http(s)://`, a `*.` host wildcard, and a path glob. */
function matchesPattern(pattern: string, url: string): boolean {
    if (pattern === "<all_urls>") return true;
    const m = /^(\*|https?|file|ftp):\/\/(\*|\*\.[^/]+|[^/*]+)(\/.*)$/.exec(
        pattern,
    );
    if (!m) return false;
    const [, scheme, host, path] = m;
    let u: URL;
    try {
        u = new URL(url);
    } catch {
        return false;
    }
    if (scheme !== "*" && `${scheme}:` !== u.protocol) return false;
    if (host !== "*") {
        if (host!.startsWith("*.")) {
            const bare = host!.slice(2);
            if (u.hostname !== bare && !u.hostname.endsWith(`.${bare}`))
                return false;
        } else if (u.hostname !== host) {
            return false;
        }
    }
    const pathRe = new RegExp(
        `^${path!.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
    );
    return pathRe.test(u.pathname + u.search);
}

function matchesGlob(pattern: string, url: string): boolean {
    // Chromium's MatchPattern treats ? as optional and honors backslash escapes.
    const escaped = pattern.replace(
        /\\(.)|([*?]+)|./gu,
        (token, literal, wildcards) => {
            if (wildcards)
                return wildcards.includes("*")
                    ? ".*"
                    : `.{0,${wildcards.length}}`;
            return (literal ?? token).replace(/[.*+?^{}$()|[\]\\]/g, "\\$&");
        },
    );
    return new RegExp(`^${escaped}$`, "u").test(url);
}

function matchesContentScript(script: ContentScript, url: string): boolean {
    return (
        !!script.matches?.some(pattern => matchesPattern(pattern, url)) &&
        !script.exclude_matches?.some(pattern =>
            matchesPattern(pattern, url),
        ) &&
        (!script.include_globs?.length ||
            script.include_globs.some(glob => matchesGlob(glob, url))) &&
        !script.exclude_globs?.some(glob => matchesGlob(glob, url))
    );
}

const noopEvent = {
    addListener: () => {},
    removeListener: () => {},
    hasListener: () => false,
};

const universalStub: unknown = new Proxy(() => undefined, {
    get: (_t, p) =>
        p === "then" || shouldLeaveMissing(p) ? undefined : universalStub,
    apply: () => undefined,
});

// Anything not listed answers as the universal stub, same as the outer
// surface below: a missing method is "does nothing", never a TypeError
// that kills the content script at whatever point it first reaches it.
function stubbed(target: Record<string, unknown>) {
    return new Proxy(target, {
        get: (t, prop) => {
            if (typeof prop === "string" && prop in t) return t[prop];
            if (shouldLeaveMissing(prop)) return undefined;
            return universalStub;
        },
    });
}

/** runtime.sendMessage from a content script, delivered to the background. */
function contentSendMessage(handle: ExtensionHandle, pageUrl: string) {
    return (...args: unknown[]) => {
        const message =
            typeof args[0] === "string" && args.length > 1 ? args[1] : args[0];
        const cb = args.find(a => typeof a === "function") as
            | ((r: unknown) => void)
            | undefined;
        // A background listener that throws is Chrome's problem to log,
        // not the content script's to crash on: swallow it to undefined,
        // the same result Chrome gives the sender when a listener errors.
        const p = handle
            .sendMessage(message, pageUrl)
            .then(r => r.response)
            .catch(() => undefined);
        if (cb) {
            void p.then(cb);
            return undefined;
        }
        return p;
    };
}

/** A minimal content-script `chrome`, bridged to the loaded background for
 *  messaging and answering everything else the way the extension host's
 *  universal stub does: do nothing, never throw. */
function contentChrome(handle: ExtensionHandle, pageUrl: string): unknown {
    const extensionId = handle.id;
    const port = {
        name: "",
        postMessage: () => {},
        disconnect: () => {},
        onMessage: noopEvent,
        onDisconnect: noopEvent,
    };
    const runtime = stubbed({
        id: extensionId,
        getURL: (path: string) =>
            `chrome-extension://${extensionId}/${path.replace(/^\//, "")}`,
        // Read for its result, so a stub's `undefined` won't do: bundles
        // pull `version` and `name` off it during startup (mobileguardian).
        getManifest: () => handle.manifest,
        sendMessage: contentSendMessage(handle, pageUrl),
        onMessage: noopEvent,
        connect: () => port,
        lastError: undefined,
    });
    return stubbed({
        runtime,
        storage: handle.storage,
        i18n: { getMessage: () => "" },
    });
}

type ExecuteScriptCall = { func?: string; files?: string[]; args?: unknown[] };

/** Where an injected script runs: filled in as the observation progresses. */
type InjectionTarget = {
    win?: Record<string, unknown>;
    extId: string;
    extensionDir: string;
};

async function injectionSource(
    call: ExecuteScriptCall,
    extensionDir: string,
): Promise<string> {
    if (call.func) {
        return `(${call.func})(${(call.args ?? []).map(a => JSON.stringify(a)).join(",")})`;
    }
    const files = await Promise.all(
        (call.files ?? []).map(f =>
            readFile(join(extensionDir, f), "utf8").catch(() => ""),
        ),
    );
    return files.join(";\n");
}

/**
 * chrome.scripting.executeScript for the background. The page window is
 * filled in once it exists: a filter's background can call executeScript in
 * reaction to a message from its own content script (the normal "content
 * script announces the page, background decides, background injects the
 * block" shape), which can only happen after that content script is running,
 * i.e. after `window` exists. A call before then (rare: genuine
 * startup-time injection has no specific page to target anyway) fails safe to
 * a no-op, same as Chrome resolving no frames.
 */
function createScriptRunner(target: InjectionTarget) {
    return async (call: ExecuteScriptCall): Promise<unknown[]> => {
        const { win, extId, extensionDir } = target;
        if (!win) return [];
        try {
            const source = await injectionSource(call, extensionDir);
            if (!source) return [];
            const compiled = await compileScript(
                source,
                join(extensionDir, "__executeScript__.js"),
                {
                    context: win as unknown as vm.Context,
                    extensionId: extId,
                    extensionDir,
                },
            );
            const result = compiled.runInContext(win as unknown as vm.Context);
            return [{ result, frameId: 0 }];
        } catch {
            // Chrome's own shape for an injection that threw: no result for
            // that frame, not a rejected executeScript call.
            return [];
        }
    };
}

/**
 * One filter installed: its background, headless. Best-effort: a filter
 * whose background can't fully start still has content scripts, which are
 * what render block pages; the point of the run is the page, not the
 * worker. The emulation (vendorEmulation.ts), matched by the bundle's own
 * folder name, is what lets a vendor's real, configured code path run
 * rather than its unconfigured one.
 */
async function loadFilterBackground(
    { extensionDir, extensionId, allowNetwork = false }: SandboxOptions,
    emulation: (typeof VENDOR_EMULATION)[string] | undefined,
    runScript: ReturnType<typeof createScriptRunner>,
): Promise<{ handle?: ExtensionHandle; backgroundError?: string }> {
    try {
        const handle = await loadExtension({
            dir: extensionDir,
            extensionId,
            managedStorage: emulation?.managedStorage,
            initialStorage: emulation?.initialStorage,
            initialBookmarks: emulation?.initialBookmarks,
            network: emulation?.network,
            runScript,
            allowNetwork,
        });
        return { handle };
    } catch (error) {
        return {
            backgroundError: `Filter background failed to load: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}

/**
 * A real `console`, not happy-dom's VirtualConsole (a content script that
 * logs from a deferred timer would otherwise reach the virtual console after
 * the window is closed and throw on its freed printer), but a fresh one per
 * observation, not the shared global object itself: see
 * `buildFreshConsole`'s own comment for why that distinction is load
 * bearing, not cosmetic.
 *
 * The settings match api/platform.ts's happy-dom usage: this document's own
 * markup must not trigger real loads of its own (a `<link href>`/`<script
 * src>` the fetched page happens to carry), the same reasoning that made
 * that comment ("happy-dom must not also try to evaluate or fetch anything
 * the document references") apply here too. Content scripts still run:
 * they're injected by `runInContext` below, entirely outside happy-dom's own
 * script pipeline, which these settings don't gate.
 */
function createPageWindow(pageUrl: string, channels: MessageChannel[]): Window {
    const window = new Window({
        url: pageUrl,
        console: buildFreshConsole(),
        settings: {
            disableJavaScriptEvaluation: true,
            disableJavaScriptFileLoading: true,
            // errorCapture left at the default ("tryAndCatch"): a content
            // script's own deferred timer callback (setTimeout/setInterval/…)
            // throwing is then caught and logged via console.error instead of
            // crashing this process: "disabled" previously took down the
            // whole multi-vendor sweep on one vendor's async bug (GoGuardian's
            // admin.js _reRun, scheduled off a chrome.storage stub call).
        },
    });
    // happy-dom lacks MessageChannel. LoiLo uses it to schedule work.
    Object.assign(window, {
        MessageChannel: class extends MessageChannel {
            constructor() {
                super();
                channels.push(this);
            }
        },
    });
    containPageCallbacks(window);
    pageRejections.set(
        window,
        containVmRejections(window as unknown as vm.Context, error =>
            reportPageError(window, error),
        ),
    );
    return window;
}

function reportPageError(window: Window, error: unknown): void {
    const cause = error instanceof Error ? error : new Error(String(error));
    window.dispatchEvent(
        new window.ErrorEvent("error", {
            error: cause,
            message: cause.message,
        }),
    );
}

function runPageCallback(window: Window, callback: () => unknown): void {
    try {
        void Promise.resolve(callback()).catch(error =>
            reportPageError(window, error),
        );
    } catch (error) {
        reportPageError(window, error);
    }
}

function containPageCallbacks(window: Window): void {
    // VM promises fail happy-dom's host-realm instanceof Promise check.
    const schedule = (method: "setTimeout" | "setInterval") => {
        const original = window[method].bind(window);
        return (
            callback: ((...args: unknown[]) => unknown) | string,
            ms?: number,
            ...args: unknown[]
        ) =>
            original(
                typeof callback === "function"
                    ? () => runPageCallback(window, () => callback(...args))
                    : () =>
                          runPageCallback(window, () => window.eval(callback)),
                ms,
                ...args,
            );
    };
    const microtask = window.queueMicrotask.bind(window);
    Object.assign(window, {
        setTimeout: schedule("setTimeout"),
        setInterval: schedule("setInterval"),
        queueMicrotask: (callback: () => unknown) =>
            microtask(() => runPageCallback(window, callback)),
    });
}

/**
 * A content script's own fetch()/XMLHttpRequest()/WebSocket() calls go
 * through happy-dom's real, working implementations by default: none of the
 * window settings gate a direct JS call the way they gate the document's own
 * tag-driven loads. Content scripts get the same containment background
 * scripts already have (api/platform.ts): offline-but-emulated by default
 * (`emulation.network` answers a vendor's own endpoints: see
 * vendorEmulation.ts), genuinely live only when a caller opts in via
 * `allowNetwork`. A content script's own extension-relative fetches (its
 * bundled WASM, config, etc.) still resolve for real, off `extensionDir`,
 * either way.
 *
 * XMLHttpRequest has no toggle: Node never implemented a real one (it
 * predates fetch as a browser-only API), so api/platform.ts's own
 * `allowNetwork` handling doesn't branch on it either: the offline,
 * local-file-serving version is what both paths use regardless.
 */
function containPageNetwork(
    win: Record<string, unknown>,
    extId: string,
    extensionDir: string,
    emulation: (typeof VENDOR_EMULATION)[string] | undefined,
    allowNetwork: boolean,
): void {
    win.fetch = allowNetwork
        ? fetch
        : buildFetch(extId, extensionDir, emulation?.network);
    win.XMLHttpRequest = buildXMLHttpRequest(extId, extensionDir);
    win.WebSocket = allowNetwork ? WebSocket : buildOfflineWebSocket();
    // Neither Node nor happy-dom implements IndexedDB. A fresh factory per
    // route observation, not a shared one: leaking one page's stored data
    // into the next observation would be its own false-positive risk.
    win.indexedDB = new IDBFactory();
    win.IDBKeyRange = IDBKeyRange;
}

/**
 * happy-dom's navigator is missing members content scripts read unguarded,
 * so a startup TypeError could kill a filter's script before it ever got to
 * block anything -- and this harness would have read that crash as "not
 * flagged". Seen live: `navigator.getBattery is not a function` (imtlazarus,
 * lanschoolStudent). Background scripts already get these from
 * api/platform.ts's buildNavigator; fill in only what happy-dom lacks,
 * rather than replacing a navigator its own internals use.
 */
function fillNavigator(window: Window): void {
    const emulatedNavigator = buildNavigator("chrome");
    const navigator = window.navigator as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(emulatedNavigator)) {
        if (key in navigator) continue;
        Object.defineProperty(navigator, key, {
            value,
            configurable: true,
            enumerable: true,
        });
    }
}

/** Runs one content script and retains any failure for the verdict. */
async function runContentScript(
    window: Window,
    filePath: string,
    extId: string,
    extensionDir: string,
): Promise<string | undefined> {
    try {
        const code = await readFile(filePath, "utf8");
        if (!code) return undefined;
        // compileScript (extensionHost/host.ts) gives dynamic import() a real
        // resolver and bundles a script through esbuild when a plain
        // vm.Script can't compile it at all (an ES module, or a static import
        // statement). window.eval() has neither and dies on any of the three;
        // this is the same path background scripts already use, reused
        // rather than reimplemented.
        const compiled = await compileScript(code, filePath, {
            context: window as unknown as vm.Context,
            extensionId: extId,
            extensionDir,
        });
        const result = compiled.runInContext(window as unknown as vm.Context);
        void Promise.resolve(result).catch(error =>
            reportPageError(window, error),
        );
    } catch (error) {
        return `Filter content script ${basename(filePath)} failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    return undefined;
}

/** Run matching scripts by injection phase, preserving order within a phase. */
async function runContentScripts(
    window: Window,
    handle: ExtensionHandle | undefined,
    extensionDir: string,
    extId: string,
    pageUrl: string,
): Promise<string | undefined> {
    const manifest = handle?.manifest ?? (await readManifest(extensionDir));
    const scripts = (
        (manifest.content_scripts ?? []) as ContentScript[]
    ).toSorted(
        (left, right) =>
            (INJECTION_ORDER[left.run_at ?? "document_idle"] ?? 2) -
            (INJECTION_ORDER[right.run_at ?? "document_idle"] ?? 2),
    );
    const chrome = handle ? contentChrome(handle, pageUrl) : undefined;
    if (chrome) {
        (window as unknown as Record<string, unknown>).chrome = chrome;
        (window as unknown as Record<string, unknown>).browser = chrome;
    }

    let contentScriptError: string | undefined;
    const injected = new Set<string>();
    const documentUrl = new URL(pageUrl).href;
    for (const script of scripts) {
        if (!matchesContentScript(script, documentUrl)) continue;
        for (const file of script.js ?? []) {
            const filePath = join(extensionDir, file);
            // Chromium injects each file once per frame and run location.
            const key = `${script.run_at ?? "document_idle"}:${filePath}`;
            if (injected.has(key)) continue;
            injected.add(key);
            const error = await runContentScript(
                window,
                filePath,
                extId,
                extensionDir,
            );
            contentScriptError ??= error;
        }
    }
    return contentScriptError;
}

/**
 * Where the tab ended up. Some filters (lanschoolWebHelper, mobileguardian)
 * block from their background via chrome.tabs.update({url}) rather than a
 * content script writing location.href: invisible to a real browser's
 * address bar only in the sense that this host never re-navigates the
 * happy-dom window to render it. A real tab would already be showing that
 * URL, so it's what a redirect check should see too.
 */
function finalUrlOf(
    handle: ExtensionHandle | undefined,
    window: Window,
    pageUrl: string,
) {
    return handle && handle.tabUrl !== pageUrl
        ? handle.tabUrl
        : String(window.location.href);
}

/** Close the detached page and cancel work that outlived the observation. */
async function closePageWindow(
    window: Window,
    handle: ExtensionHandle | undefined,
): Promise<void> {
    try {
        // abort() leaves the page open, allowing scripts to enqueue more work.
        await window.happyDOM.close();
    } finally {
        pageRejections.get(window)?.();
        pageRejections.delete(window);
        handle?.dispose();
    }
}

/** Writes the served page, lets the filter act on it, and reads the result. */
async function observePage(
    window: Window,
    handle: ExtensionHandle | undefined,
    page: {
        html: string;
        pageUrl: string;
        extId: string;
        interrupted?: boolean;
    },
    options: SandboxOptions,
): Promise<Omit<PageObservation, "status" | "fetchError">> {
    const { extensionDir, route, waitMs = 15_000 } = options;
    let runtimeError: string | undefined;
    window.addEventListener("error", event => {
        if (event instanceof window.ErrorEvent)
            runtimeError ??= `Filter content script failed: ${event.message}`;
    });
    window.document.write(page.html);
    // The served page's own rich text, before any content script
    // has had a chance to touch it: the dom-replaced heuristic's baseline
    // (detect.ts).
    const originalPageText = extractRichText(window);

    const contentScriptError =
        !handle || handle.runtimeError || handle.tabRemoved || page.interrupted
            ? undefined
            : await runContentScripts(
                  window,
                  handle,
                  extensionDir,
                  page.extId,
                  page.pageUrl,
              );
    await new Promise(resolve => setTimeout(resolve, waitMs));

    return {
        route,
        contentScriptError: contentScriptError ?? runtimeError,
        asyncContainmentIncomplete:
            handle?.asyncContainmentIncomplete ??
            (!pageRejections.get(window)
                ? ASYNC_CONTAINMENT_INCOMPLETE
                : undefined),
        tabRemoved: handle?.tabRemoved,
        extensionId: page.extId,
        finalUrl: finalUrlOf(handle, window, page.pageUrl),
        pageText: extractRichText(window),
        originalPageText,
        originalLength: originalPageText.length,
        // The filter's own configured block rules, asked directly whether
        // they'd block this exact page URL: a real, deterministic check
        // that needed none of the rendering above. Only meaningful when the
        // background actually loaded far enough to register rules.
        dnrMatch: handle?.matchRequest(page.pageUrl, {
            resourceType: "main_frame",
            method: "GET",
        }),
    };
}

/** Load one filter over one proxied route and report what the page became. */
export async function observeRoute(
    options: SandboxOptions,
): Promise<PageObservation> {
    const { baseUrl, route, proxyTarget } = options;
    const pageUrl = probeRouteUrl(baseUrl, route, proxyTarget);
    const { html, status, fetchError, networkRedirectUrl } =
        await fetchPageWithRetry(options.fetchImpl ?? fetch, pageUrl);
    if (networkRedirectUrl) {
        return {
            route: options.route,
            finalUrl: networkRedirectUrl,
            networkRedirectUrl,
            pageText: "",
            originalLength: 0,
            status,
        };
    }
    return {
        ...(await observeFetchedPage(options, { html, pageUrl })),
        status,
        fetchError,
    };
}

function requestObservation(
    observed: Omit<PageObservation, "status" | "fetchError">,
    pageUrl: string,
    request: ReturnType<ExtensionHandle["dispatchRequest"]> | undefined,
    backgroundError: string | undefined,
): Omit<PageObservation, "status" | "fetchError"> {
    return {
        ...observed,
        finalUrl:
            observed.finalUrl === pageUrl
                ? (request?.redirectUrl ?? observed.finalUrl)
                : observed.finalUrl,
        backgroundError:
            backgroundError ??
            request?.incomplete ??
            (request?.redirectUrl
                ? "Filter request redirected navigation; destination was not loaded"
                : undefined),
        webRequestCancelled: request?.cancelled,
        unreplayedBlockingRequest: false,
    };
}

async function observeFetchedPage(
    options: SandboxOptions,
    { html, pageUrl }: { html: string; pageUrl: string },
): Promise<Omit<PageObservation, "status" | "fetchError">> {
    const { extensionDir, allowNetwork = false } = options;
    const emulation =
        VENDOR_EMULATION[options.extensionFolder ?? basename(extensionDir)];
    const target: InjectionTarget = {
        extId: options.extensionId ?? "a".repeat(32),
        extensionDir,
    };
    const { handle, backgroundError } = await loadFilterBackground(
        options,
        emulation,
        createScriptRunner(target),
    );
    target.extId = handle?.id ?? target.extId;
    const channels: MessageChannel[] = [];
    const window = createPageWindow(pageUrl, channels);
    target.win = window as unknown as Record<string, unknown>;
    containPageNetwork(
        target.win,
        target.extId,
        extensionDir,
        emulation,
        allowNetwork,
    );
    fillNavigator(window);
    try {
        let navigationError: string | undefined;
        handle?.notifyBeforeNavigate(pageUrl, error => {
            navigationError ??= `Filter navigation listener failed: ${error instanceof Error ? error.message : String(error)}`;
        });
        const request = handle?.dispatchRequest(pageUrl);
        const observed = await observePage(
            window,
            handle,
            {
                html,
                pageUrl,
                extId: target.extId,
                interrupted:
                    request?.cancelled || Boolean(request?.redirectUrl),
            },
            options,
        );
        return requestObservation(
            observed,
            pageUrl,
            request,
            backgroundError ?? handle?.runtimeError ?? navigationError,
        );
    } finally {
        for (const { port1, port2 } of channels) {
            port1.close();
            port2.close();
        }
        await closePageWindow(window, handle);
    }
}

async function readManifest(
    dir: string,
): Promise<{ content_scripts?: unknown[] }> {
    try {
        const raw = await readFile(join(dir, "manifest.json"), "utf8");
        return JSON.parse(raw.replace(/^\uFEFF/, ""));
    } catch {
        return {};
    }
}
