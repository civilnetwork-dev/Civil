/**
 * "Open the proxy in a sandbox with exactly one filter installed", headless.
 *
 * This is the window.open emulation the task's step 2 asks for, assembled from
 * the two emulator subsystems that already exist rather than as a third:
 *
 *   - The filter's **background** runs in the extension host (`loadExtension`,
 *     misc/extensionHost) — real `chrome.*`, real declarativeNetRequest, real
 *     alarms, headless. That is "one filter installed".
 *   - The proxied **page** is fetched through the running Civil server and
 *     loaded into a happy-dom `Window`, and the filter's **content scripts**
 *     (the code that renders an in-place block page) are run against it, with a
 *     small `chrome` shim whose `runtime.sendMessage` is bridged to the loaded
 *     background. That is "the proxy opened".
 *
 * After a wait — the task's fifteen seconds, so a content script that polls or
 * defers has run — it reports back what `detect.ts` needs: the final
 * `location.href` and the page text.
 *
 * What it is not: a browser. There is no layout, no navigation engine, no
 * cross-origin fetch. A content script that blocks by *redirecting* real
 * navigation is observed through the `location` assignment it makes (captured
 * below); one that blocks by *rewriting the DOM* is observed through the text
 * it leaves. A filter that blocks by some mechanism needing a real renderer is
 * beyond this and beyond what runs without a browser at all — the honest
 * ceiling, the same one the extension host draws.
 */

import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type * as vm from "node:vm";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { Window } from "happy-dom";
import {
    buildFetch,
    buildFreshConsole,
    buildOfflineWebSocket,
    buildXMLHttpRequest,
    compileScript,
    loadExtension,
} from "../extensionHost";
import type { ExtensionHandle } from "../extensionHost/types";
import { VENDOR_EMULATION } from "../extensionHost/vendorEmulation";
import type { PageObservation } from "./detect";

export interface SandboxOptions {
    /** Unpacked extension folder for the one filter under test. */
    extensionDir: string;
    /** Base URL of the running Civil server (the tunnel URL, or local). */
    baseUrl: string;
    /** The Civil route being tested, e.g. "/newtab". */
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
     * only reason to set this — vendorEmulation.ts's offline emulation is what
     * routine runs should rely on instead.
     */
    allowNetwork?: boolean;
}

interface ContentScript {
    matches: string[];
    js?: string[];
    runAt?: string;
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

/** A minimal content-script `chrome`, bridged to the loaded background for
 *  messaging and answering everything else the way the extension host's
 *  universal stub does — do nothing, never throw. */
function contentChrome(handle: ExtensionHandle, extensionId: string): unknown {
    const noopEvent = {
        addListener: () => {},
        removeListener: () => {},
        hasListener: () => false,
    };
    const stub: unknown = new Proxy(() => undefined, {
        get: (_t, p) => (p === "then" ? undefined : stub),
        apply: () => undefined,
    });
    const port = {
        name: "",
        postMessage: () => {},
        disconnect: () => {},
        onMessage: noopEvent,
        onDisconnect: noopEvent,
    };
    const runtime = {
        id: extensionId,
        getURL: (path: string) =>
            `chrome-extension://${extensionId}/${path.replace(/^\//, "")}`,
        sendMessage: (...args: unknown[]) => {
            const message =
                typeof args[0] === "string" && args.length > 1
                    ? args[1]
                    : args[0];
            const cb = args.find(a => typeof a === "function") as
                | ((r: unknown) => void)
                | undefined;
            // A background listener that throws is Chrome's problem to log,
            // not the content script's to crash on — swallow it to undefined,
            // the same result Chrome gives the sender when a listener errors.
            const p = handle
                .sendMessage(message)
                .then(r => r.response)
                .catch(() => undefined);
            if (cb) {
                void p.then(cb);
                return undefined;
            }
            return p;
        },
        onMessage: noopEvent,
        connect: () => port,
        lastError: undefined,
    };
    const surface: Record<string, unknown> = {
        runtime,
        storage: stub,
        i18n: { getMessage: () => "" },
    };
    return new Proxy(surface, {
        get: (target, prop) =>
            typeof prop === "string" && prop in target ? target[prop] : stub,
    });
}

/** Load one filter over one proxied route and report what the page became. */
export async function observeRoute(
    options: SandboxOptions,
): Promise<PageObservation> {
    const {
        extensionDir,
        baseUrl,
        route,
        proxyTarget,
        waitMs = 15_000,
        allowNetwork = false,
    } = options;
    const doFetch = options.fetchImpl ?? fetch;

    // The URL the page is fetched from: for the proxy route, the third-party
    // target routed through Civil; otherwise Civil's own page.
    const pageUrl = proxyTarget
        ? `${baseUrl.replace(/\/$/, "")}${route}${encodeURIComponent(proxyTarget)}`
        : `${baseUrl.replace(/\/$/, "")}${route}`;

    // One filter installed: its background, headless. Best-effort — a filter
    // whose background can't fully start still has content scripts, which are
    // what render block pages; the point of the run is the page, not the
    // worker. The emulation (vendorEmulation.ts) — matched by the bundle's
    // own folder name — is what lets a vendor's real, configured code path
    // run rather than its unconfigured one.
    const emulation = VENDOR_EMULATION[basename(extensionDir)];
    let extId = "a".repeat(32);
    // Filled in once the page window exists, below — a filter's background
    // can call chrome.scripting.executeScript in reaction to a message from
    // its own content script (the normal "content script announces the page,
    // background decides, background injects the block" shape), which can
    // only happen after that content script is running, i.e. after `window`
    // exists. A call before then (rare — genuine startup-time injection has
    // no specific page to target anyway) fails safe to a no-op, same as
    // Chrome resolving no frames.
    let win: Record<string, unknown> | undefined;
    const runScript = async (call: {
        func?: string;
        files?: string[];
        args?: unknown[];
    }): Promise<unknown[]> => {
        if (!win) return [];
        try {
            const source = call.func
                ? `(${call.func})(${(call.args ?? []).map(a => JSON.stringify(a)).join(",")})`
                : (
                      await Promise.all(
                          (call.files ?? []).map(f =>
                              readFile(join(extensionDir, f), "utf8").catch(
                                  () => "",
                              ),
                          ),
                      )
                  ).join(";\n");
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

    let handle: ExtensionHandle | undefined;
    try {
        handle = await loadExtension({
            dir: extensionDir,
            managedStorage: emulation?.managedStorage,
            initialStorage: emulation?.initialStorage,
            initialBookmarks: emulation?.initialBookmarks,
            network: emulation?.network,
            runScript,
            allowNetwork,
        });
    } catch {
        handle = undefined;
    }
    extId = handle?.id ?? extId;

    let html = "";
    let status = 0;
    try {
        const res = await doFetch(pageUrl);
        status = res.status;
        html = await res.text();
    } catch {
        // Network/tunnel failure surfaces as an empty page, which detects as
        // "not flagged" rather than a false positive.
        html = "";
    }

    // A real `console`, not happy-dom's VirtualConsole (a content script
    // that logs from a deferred timer would otherwise reach the virtual
    // console after the window is closed and throw on its freed printer),
    // but a fresh one per observation, not the shared global object itself —
    // see `buildFreshConsole`'s own comment for why that distinction is load
    // bearing, not cosmetic.
    //
    // The settings match api/platform.ts's happy-dom usage: this document's
    // own markup must not trigger real loads of its own (a `<link href>`/
    // `<script src>` the fetched page happens to carry), the same reasoning
    // that made that comment — "happy-dom must not also try to evaluate or
    // fetch anything the document references" — apply here too. Content
    // scripts still run: they're injected by `runInContext` below, entirely
    // outside happy-dom's own script pipeline, which these settings don't gate.
    const window = new Window({
        url: pageUrl,
        console: buildFreshConsole(),
        settings: {
            disableJavaScriptEvaluation: true,
            disableJavaScriptFileLoading: true,
            disableCSSFileLoading: true,
            // errorCapture left at the default ("tryAndCatch"): a content
            // script's own deferred timer callback (setTimeout/setInterval/…)
            // throwing is then caught and logged via console.error instead of
            // crashing this process — "disabled" previously took down the
            // whole multi-vendor sweep on one vendor's async bug (GoGuardian's
            // admin.js _reRun, scheduled off a chrome.storage stub call).
        },
    });
    win = window as unknown as Record<string, unknown>;
    // A content script's own fetch()/XMLHttpRequest()/WebSocket() calls go
    // through happy-dom's real, working implementations by default — none of
    // the settings above gate a direct JS call the way they gate the
    // document's own tag-driven loads. Content scripts get the same
    // containment background scripts already have (api/platform.ts):
    // offline-but-emulated by default (`emulation.network` answers a vendor's
    // own endpoints — see vendorEmulation.ts), genuinely live only when a
    // caller opts in via `allowNetwork`. A content script's own
    // extension-relative fetches (its bundled WASM, config, etc.) still
    // resolve for real, off `extensionDir`, either way.
    // XMLHttpRequest has no toggle: Node never implemented a real one (it
    // predates fetch as a browser-only API), so api/platform.ts's own
    // `allowNetwork` handling doesn't branch on it either — the offline,
    // local-file-serving version is what both paths use regardless.
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
    try {
        window.document.write(html);

        // The content scripts that match this URL, in manifest order.
        const manifest = handle?.manifest ?? (await readManifest(extensionDir));
        const scripts = (manifest.content_scripts ?? []) as ContentScript[];
        const chrome = handle ? contentChrome(handle, handle.id) : undefined;
        if (chrome) {
            (window as unknown as Record<string, unknown>).chrome = chrome;
            (window as unknown as Record<string, unknown>).browser = chrome;
        }

        for (const script of scripts) {
            if (!script.matches?.some(p => matchesPattern(p, pageUrl)))
                continue;
            for (const file of script.js ?? []) {
                const filePath = join(extensionDir, file);
                const code = await readFile(filePath, "utf8").catch(() => "");
                if (!code) continue;
                try {
                    // compileScript (extensionHost/host.ts) gives dynamic
                    // import() a real resolver and bundles a script through
                    // esbuild when a plain vm.Script can't compile it at all
                    // (an ES module, or a static import statement). window.
                    // eval() has neither and dies on any of the three; this
                    // is the same path background scripts already use,
                    // reused rather than reimplemented.
                    const compiled = await compileScript(code, filePath, {
                        context: window as unknown as vm.Context,
                        extensionId: extId,
                        extensionDir,
                    });
                    compiled.runInContext(window as unknown as vm.Context);
                } catch {
                    // A content script that throws in this reduced environment
                    // has still had its chance to redirect or rewrite; keep
                    // going.
                }
            }
        }

        await new Promise(resolve => setTimeout(resolve, waitMs));

        // Some filters (lanschoolWebHelper, mobileguardian) block from their
        // background via chrome.tabs.update({url}) rather than a content
        // script writing location.href — invisible to a real browser's
        // address bar only in the sense that this host never re-navigates
        // the happy-dom window to render it. A real tab would already be
        // showing that URL, so it's what a redirect check should see too.
        const finalUrl =
            handle && handle.tabUrl !== "about:blank"
                ? handle.tabUrl
                : String(window.location.href);

        return {
            route,
            finalUrl,
            pageText: `${status} ${window.document.body?.textContent ?? ""}`,
        };
    } finally {
        // Cancel happy-dom's pending timers/microtasks before closing, so a
        // content script's deferred callback can't fire against a freed
        // window. `abort` exists on happy-dom's control object; guard it in
        // case the shape changes.
        const control = (
            window as unknown as { happyDOM?: { abort?: () => Promise<void> } }
        ).happyDOM;
        try {
            await control?.abort?.();
        } catch {
            // best-effort teardown
        }
        window.close();
        handle?.dispose();
    }
}

async function readManifest(
    dir: string,
): Promise<{ content_scripts?: unknown[] }> {
    try {
        const raw = await readFile(join(dir, "manifest.json"), "utf8");
        return JSON.parse(raw.replace(/^﻿/, ""));
    } catch {
        return {};
    }
}

export { matchesPattern };
