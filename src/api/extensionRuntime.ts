// biome-ignore-all lint: chrome apis

import type { ChromeManifest } from "~/types";
import {
    buildBackgroundShim,
    buildChromeShim,
    RAW_SHIM_SOURCE,
} from "../../misc/browserApiEmulators/extensions/chrome";
import type { CivilExtension } from "./extensions";
import {
    extensionsGetAll,
    extensionsReadLocaleMessages,
    extensionsReadText,
    extensionsSyncExternalKeys,
    normalizeExtensionPath,
} from "./extensions";

export { buildChromeShim };

function patchBgScript(code: string): string {
    return code.replace(
        'runtime_content_mode:"userscripts"',
        'runtime_content_mode:"userscripts-dynamic"',
    );
}

/**
 * Matches a URL against a Chrome extension match pattern.
 * https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
 */
export function matchesUrlPattern(pattern: string, url: string): boolean {
    if (pattern === "<all_urls>") return true;
    try {
        const u = new URL(url);
        const m = /^(\*|https?|ftp|file):\/\/(\*|[^/]*)(\/.*)?$/.exec(pattern);
        if (!m) return false;
        const pScheme = m[1]!;
        const pHost = m[2]!;
        const pPath = m[3] ?? "/*";

        // scheme check
        const scheme = u.protocol.slice(0, -1);
        if (pScheme !== "*" && pScheme !== scheme) return false;

        // host check
        if (pScheme === "file") {
            // file:// has no host requirement
        } else if (pHost === "*") {
            // matches any host
        } else if (pHost.startsWith("*.")) {
            const base = pHost.slice(2);
            if (u.hostname !== base && !u.hostname.endsWith("." + base))
                return false;
        } else {
            if (u.hostname !== pHost) return false;
        }

        const pathAndQuery = u.pathname + (u.search ?? "");
        const pathRegex = new RegExp(
            "^" +
                pPath
                    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
                    .replace(/\*/g, ".*") +
                "$",
        );
        if (!pathRegex.test(pathAndQuery)) return false;

        return true;
    } catch {
        return false;
    }
}

export function matchesUrlPatterns(
    patterns: string[] | undefined,
    url: string,
): boolean {
    if (!patterns || patterns.length === 0) return false;
    return patterns.some(p => matchesUrlPattern(p, url));
}

const _launchedBackgrounds = new Set<string>();
const _chromeTabIds = new Map<string, number>();
let _nextChromeTabId = 1;

export function extensionChromeTabId(civilTabId: string): number {
    let id = _chromeTabIds.get(civilTabId);
    if (id === undefined) {
        id = _nextChromeTabId++;
        _chromeTabIds.set(civilTabId, id);
    }
    return id;
}

export function extensionCivilTabIdFromChromeId(
    chromeTabId: number,
): string | undefined {
    for (const [civilId, chromeId] of _chromeTabIds) {
        if (chromeId === chromeTabId) return civilId;
    }
    return undefined;
}

export function dispatchExtensionBrowserEvent(
    event: string,
    args: unknown[],
): void {
    for (const ext of extensionsGetAll().filter(item => item.enabled)) {
        const bus = new BroadcastChannel(`civil-ext-bus-${ext.id}`);
        bus.postMessage({
            kind: "browserEvent",
            event,
            args,
        });
        setTimeout(() => bus.close(), 100);
    }
}

/**
 * Tracks documents that have already received extension shim injection so we
 * never inject twice into the same Document (e.g. if the load event fires more
 * than once, or if injectExtensionShimsIntoIframe is called concurrently).
 */
const _injectedDocs = new WeakSet<Document>();

/**
 * Launch an extension's background page/scripts/service_worker in a hidden iframe.
 * Returns the iframe element, or null if no background is defined.
 */
export async function launchExtensionBackground(
    ext: Omit<CivilExtension, "files">,
): Promise<HTMLIFrameElement | null> {
    if (_launchedBackgrounds.has(ext.id)) return null;
    _launchedBackgrounds.add(ext.id);

    const manifest = ext.manifest as ChromeManifest;
    const bg = manifest.background;
    if (!bg) return null;

    const iframe = document.createElement("iframe");
    iframe.id = `civil-ext-bg-${ext.id}`;
    iframe.style.cssText =
        "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;";
    iframe.setAttribute("aria-hidden", "true");
    // Navigate to a SW-controlled URL so the SW intercepts all subsequent
    // fetch/XHR requests (importScripts polyfill, etc.) from inside this iframe.
    // about:blank iframes are NOT SW-controlled clients.
    iframe.src = "/civil-ext-bg-frame";
    document.body.appendChild(iframe);
    // Wait for the iframe to finish loading before injecting scripts.
    await new Promise<void>(resolve => {
        iframe.onload = () => resolve();
        // Fallback if already loaded or load event fires before listener attaches
        setTimeout(resolve, 2000);
    });
    // Forward unhandled errors in the background iframe to the top-level
    // console so we can diagnose TM/VM background init failures.
    try {
        iframe.contentWindow?.addEventListener("error", ev => {
            console.error(
                `[extensionRuntime] bg iframe error for ${ext.id}:`,
                ev.message,
                ev.filename,
                ev.lineno,
                ev.colno,
            );
        });
        iframe.contentWindow?.addEventListener(
            "unhandledrejection",
            (ev: PromiseRejectionEvent) => {
                console.error(
                    `[extensionRuntime] bg iframe unhandled rejection for ${ext.id}:`,
                    ev.reason,
                );
            },
        );
    } catch {}

    const localeMessages = await extensionsReadLocaleMessages(ext.id, manifest);

    const shim = buildBackgroundShim({
        extId: ext.id,
        manifest: manifest as Parameters<
            typeof buildBackgroundShim
        >[0]["manifest"],
        contextType: "background",
        bib: {
            messages: localeMessages,
        },
    });

    // Write raw shim source + per-ext opts to OPFS so the SW can inject the
    // shim into extension HTML pages that are opened as tabs (e.g. dashboard).
    void (async () => {
        try {
            const opfsRoot = await navigator.storage.getDirectory();
            const shimDir = await opfsRoot.getDirectoryHandle("_civil_shim", {
                create: true,
            });

            const shimJsHandle = await shimDir.getFileHandle("shim.js", {
                create: true,
            });
            const shimJsWritable = await shimJsHandle.createWritable();
            await shimJsWritable.write(RAW_SHIM_SOURCE);
            await shimJsWritable.close();

            // Per-extension shim options for contextType "popup".
            const shimOpts = JSON.stringify({
                extId: ext.id,
                manifest,
                contextType: "popup",
                bib: { messages: localeMessages },
            });
            const optsHandle = await shimDir.getFileHandle(
                `${ext.id}_opts.json`,
                { create: true },
            );
            const optsWritable = await optsHandle.createWritable();
            await optsWritable.write(shimOpts);
            await optsWritable.close();
        } catch (e) {
            console.warn("[extensionRuntime] Failed to store shim to OPFS:", e);
        }
    })();

    // Helper to inject script text into the iframe
    function injectScript(text: string): void {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const s = doc.createElement("script");
        s.textContent = text;
        (doc.head ?? doc.documentElement)?.appendChild(s);
    }

    /**
     * Polyfill for service worker globals when running in iframe context.
     * Tampermonkey MV3 calls importScripts() which is Worker-only API.
     * Also polyfills self, skipWaiting, clients, registration.
     */
    function buildSwPolyfill(extId: string): string {
        const extBase = `${window.location.origin}/civil-ext/${extId}/`;
        return `(function() {
var _swExtBase = ${JSON.stringify(extBase)};
// Set document base URL to the extension root so that any dynamically-created
// <script src="relative.js"> elements resolve correctly against the extension.
(function() {
    var existing = document.querySelector('base');
    if (!existing) {
        var b = document.createElement('base');
        b.href = _swExtBase;
        document.head.appendChild(b);
    }
})();
// importScripts: synchronous XHR fetch + eval, relative to extension base.
// Throws a NetworkError DOMException on failure to match real SW importScripts
// behavior (Tampermonkey probes by catching the specific error type).
if (typeof importScripts === 'undefined') {
    window.importScripts = function() {
        for (var i = 0; i < arguments.length; i++) {
            var url = arguments[i];
            if (/^\\/\\//.test(url)) {
                url = window.location.protocol + url;
            } else if (/^\\//.test(url)) {
                url = _swExtBase + url.replace(/^\\/+/, '');
            } else if (!/^[a-z][a-z0-9+.-]*:\\/\\//i.test(url)) {
                url = _swExtBase + url.replace(/^\\.?\\//, '');
            }
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            try { xhr.send(null); } catch(netErr) {
                throw new DOMException('Failed to fetch ' + url, 'NetworkError');
            }
            if (xhr.status < 200 || xhr.status >= 300) {
                // Non-2xx status: throw NetworkError like a real SW would
                throw new DOMException('Failed to fetch ' + url + ' (HTTP ' + xhr.status + ')', 'NetworkError');
            }
            // If the server returns HTML (e.g. SPA shell), treat as network failure.
            var ct = xhr.getResponseHeader('content-type') || '';
            var text = xhr.responseText;
            if (ct.indexOf('text/html') !== -1 || text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html')) {
                throw new DOMException('Failed to fetch ' + url + ' (received HTML)', 'NetworkError');
            }
            try { (0, eval)(text); } catch(e) {
                console.error('[civil-ext-shim] importScripts eval error:', url, e);
                throw e;
            }
        }
    };
}
// SW globals
if (typeof self === 'undefined') window.self = window;
if (typeof skipWaiting === 'undefined') {
    window.skipWaiting = function() { return Promise.resolve(); };
}
if (typeof clients === 'undefined') {
    window.clients = {
        matchAll: function() { return Promise.resolve([]); },
        claim: function() { return Promise.resolve(); },
        get: function() { return Promise.resolve(undefined); },
        openWindow: function(url) { return Promise.resolve(null); },
    };
}
if (typeof registration === 'undefined') {
    window.registration = {
        scope: '/',
        pushManager: null,
        navigationPreload: { enable: function() { return Promise.resolve(); }, disable: function() { return Promise.resolve(); }, setHeaderValue: function() { return Promise.resolve(); }, getState: function() { return Promise.resolve({ enabled: false }); } },
        showNotification: function() { return Promise.resolve(); },
        getNotifications: function() { return Promise.resolve([]); },
        update: function() { return Promise.resolve(); },
        unregister: function() { return Promise.resolve(false); },
        installing: null, waiting: null, active: null,
    };
}
if (typeof ServiceWorkerGlobalScope === 'undefined') {
    window.ServiceWorkerGlobalScope = window.constructor;
}
if (typeof WorkerGlobalScope === 'undefined') {
    window.WorkerGlobalScope = window.constructor;
}
// addEventListener on window already works; patch self.addEventListener to alias
if (window.self === window) {
    // already aliased
}
})();`;
    }

    async function setupScriptsBackground(
        scripts: string[],
        isServiceWorker = false,
    ): Promise<void> {
        const doc = iframe.contentDocument;
        if (!doc) return;
        // inject SW polyfill first (for service workers), then shim, then scripts
        if (isServiceWorker) {
            injectScript(buildSwPolyfill(ext.id));
        }
        // Store the RAW (un-substituted) shim IIFE source on window so
        // buildOffscreenAPI can inject it into offscreen document iframes
        // setting window.__CIVIL_SHIM_OPTIONS__ to per-context options.
        // Must use RAW_SHIM_SOURCE (placeholder intact) not the replaced `shim`.
        // Escape </script inside the JSON string to prevent premature tag close.
        const rawShimJson = JSON.stringify(RAW_SHIM_SOURCE).replace(
            /<\/script/gi,
            "<\\/script",
        );
        injectScript(`window.__CIVIL_SHIM_SRC__ = ${rawShimJson};`);
        injectScript(shim);
        // then inject each background script
        for (const scriptPath of scripts) {
            try {
                let code = await extensionsReadText(ext.id, scriptPath);
                code = patchBgScript(code);
                console.log(
                    `[extensionRuntime] injecting bg script "${scriptPath}" for ${ext.id} (${code.length} bytes)`,
                );
                injectScript(code);
            } catch (e) {
                console.warn(
                    `[extensionRuntime] background script "${scriptPath}" failed:`,
                    e,
                );
            }
        }
    }

    try {
        if (bg.page) {
            // background.page: load HTML, inject shim at top
            try {
                const html = await extensionsReadText(ext.id, bg.page);
                const shimStoreSrc = shim.replace(/<\/script/gi, "<\\/script");
                // Use RAW_SHIM_SOURCE (unreplaced) so offscreen docs can inject
                // it with their own __CIVIL_SHIM_OPTIONS__.
                const rawJson = JSON.stringify(RAW_SHIM_SOURCE).replace(
                    /<\/script/gi,
                    "<\\/script",
                );
                const shimScript = `<script>window.__CIVIL_SHIM_SRC__=${rawJson};</script><script>${shimStoreSrc}</script>`;
                const patched = /<head[^>]*>/i.test(html)
                    ? html.replace(
                          /<head([^>]*)>/i,
                          (_m, a: string) => `<head${a}>${shimScript}`,
                      )
                    : shimScript + html;
                const blob = new Blob([patched], { type: "text/html" });
                const blobUrl = URL.createObjectURL(blob);
                await new Promise<void>(resolve => {
                    iframe.onload = () => resolve();
                    iframe.src = blobUrl;
                    setTimeout(resolve, 3000);
                });
                URL.revokeObjectURL(blobUrl);
            } catch (e) {
                console.warn(
                    `[extensionRuntime] background page "${bg.page}" failed:`,
                    e,
                );
            }
        } else if (bg.service_worker) {
            // MV3 service_worker: run in iframe context (simpler than real SW)
            await setupScriptsBackground([bg.service_worker], true);
            // Also load static DNR rulesets if declared
            await loadStaticDNRRulesets(ext.id, manifest, iframe);
        } else if (bg.scripts && bg.scripts.length > 0) {
            // MV2 background.scripts
            await setupScriptsBackground(bg.scripts, false);
        }
    } catch (e) {
        console.error(
            `[extensionRuntime] background launch failed for ${ext.id}:`,
            e,
        );
    }

    return iframe;
}

/**
 * Load static declarativeNetRequest rulesets declared in the manifest
 * and inject them into the background's DNR engine.
 */
async function loadStaticDNRRulesets(
    extId: string,
    manifest: ChromeManifest,
    bgIframe: HTMLIFrameElement,
): Promise<void> {
    const resources = (
        manifest as unknown as {
            declarative_net_request?: {
                rule_resources?: Array<{
                    id: string;
                    enabled: boolean;
                    path: string;
                }>;
            };
        }
    ).declarative_net_request?.rule_resources;
    if (!resources) return;

    // Collect all navigation-redirect rules so the SW can apply them for
    // main-frame navigations (e.g. TM redirecting *.user.js to confirm.html).
    const allNavRedirectRules: unknown[] = [];

    for (const rs of resources) {
        if (!rs.enabled) continue;
        try {
            const raw = await extensionsReadText(extId, rs.path);
            const rules = JSON.parse(raw) as unknown[];
            // Inject rules via the background iframe's chrome.declarativeNetRequest
            const doc = bgIframe.contentDocument;
            if (!doc) continue;
            const s = doc.createElement("script");
            s.textContent = `
try {
  chrome.declarativeNetRequest.updateDynamicRules({
    addRules: ${JSON.stringify(rules)},
    removeRuleIds: []
  });
} catch(e) { console.warn('[civil-ext-shim] DNR ruleset load failed:', e); }
`;
            doc.body?.appendChild(s);

            // Collect redirect rules that apply to main_frame navigations.
            // The SW will read these from OPFS to intercept *.user.js navigations.
            for (const rule of rules) {
                const r = rule as Record<string, unknown>;
                const action = r.action as Record<string, unknown> | undefined;
                const cond = r.condition as Record<string, unknown> | undefined;
                if (action?.type !== "redirect") continue;
                const resourceTypes = cond?.resourceTypes as
                    | string[]
                    | undefined;
                // Include if: no resource type restriction, OR includes main_frame/sub_frame
                if (
                    !resourceTypes ||
                    resourceTypes.includes("main_frame") ||
                    resourceTypes.includes("sub_frame")
                ) {
                    allNavRedirectRules.push(rule);
                }
            }
        } catch (e) {
            console.warn(
                `[extensionRuntime] DNR ruleset "${rs.path}" load failed:`,
                e,
            );
        }
    }

    if (allNavRedirectRules.length > 0) {
        void (async () => {
            try {
                const opfsRoot = await navigator.storage.getDirectory();
                const navDir = await opfsRoot.getDirectoryHandle(
                    "_civil_dnr_nav",
                    { create: true },
                );
                const handle = await navDir.getFileHandle(`${extId}.json`, {
                    create: true,
                });
                const writable = await handle.createWritable();
                await writable.write(JSON.stringify(allNavRedirectRules));
                await writable.close();
                console.log(
                    `[extensionRuntime] saved ${allNavRedirectRules.length} DNR nav-redirect rules for ${extId}`,
                );
            } catch (e) {
                console.warn(
                    `[extensionRuntime] failed to save DNR nav rules for ${extId}:`,
                    e,
                );
            }
        })();
    }
}

/**
 * Launch background pages for all enabled extensions.
 * Call this once when the app boots.
 */
export async function extensionsLaunchBackgrounds(): Promise<void> {
    // Sync window.external keys (e.g. Tampermonkey) so the SW stub can inject
    // them at document_start on proxied pages before content scripts run.
    extensionsSyncExternalKeys();
    const enabled = extensionsGetAll().filter(e => e.enabled);
    for (const ext of enabled) {
        try {
            await launchExtensionBackground(ext);
        } catch (e) {
            console.error(
                `[extensionRuntime] background launch failed for ${ext.id}:`,
                e,
            );
        }
    }
}

export async function injectExtensionShimsIntoIframe(
    iframe: HTMLIFrameElement,
    pageUrlHint?: string,
    civilTabId?: string,
): Promise<void> {
    // Guard: only inject once per Document instance. This prevents re-injection
    // if injectExtensionShimsIntoIframe is called again for the same document
    // (e.g. concurrent load events, or content-script re-triggers).
    const iframeDocForGuard = iframe.contentDocument;
    console.log(
        `[extensionRuntime] injectExtensionShimsIntoIframe called, pageUrlHint=${pageUrlHint}, iframeDoc=${!!iframeDocForGuard}, alreadyInjected=${iframeDocForGuard ? _injectedDocs.has(iframeDocForGuard) : "n/a"}`,
    );
    if (!iframeDocForGuard) return;
    if (_injectedDocs.has(iframeDocForGuard)) return;
    _injectedDocs.add(iframeDocForGuard);

    const enabled = extensionsGetAll().filter(e => e.enabled);
    for (const ext of enabled) {
        try {
            const manifest = ext.manifest as ChromeManifest;
            const iframeDoc = iframe.contentDocument;
            if (!iframeDoc) continue;

            // Use pageUrlHint (caller-provided decoded real URL) when available.
            // Scramjet rewrites window.location INSIDE the iframe's JS context
            // but iframeDoc.location (read from the parent frame) still returns
            // the scramjet proxy URL, so content-script patterns like
            // *://www.google.com/* would never match without the hint.
            const pageUrl =
                pageUrlHint ??
                (() => {
                    try {
                        return iframeDoc.location?.href || iframe.src;
                    } catch {
                        return iframe.src;
                    }
                })();

            const shim = buildChromeShim({
                extId: ext.id,
                manifest: manifest as Parameters<
                    typeof buildChromeShim
                >[0]["manifest"],
                contextType: "content",
                bib: {
                    messages: await extensionsReadLocaleMessages(
                        ext.id,
                        manifest,
                    ),
                    ...(pageUrl || civilTabId !== undefined
                        ? {
                              currentTab: {
                                  ...(pageUrl ? { url: pageUrl } : {}),
                                  ...(civilTabId !== undefined
                                      ? { id: extensionChromeTabId(civilTabId) }
                                      : {}),
                              },
                          }
                        : {}),
                },
            });

            // Inject via contentWindow.eval to bypass Scramjet's
            // createElement/prepend interception. Scramjet wraps the iframe's
            // document.createElement("script") and Node.prepend so dynamically-
            // inserted script elements don't execute. eval() on the child window
            // from the parent frame runs in the child context without hitting
            // those DOM hooks.
            const iframeWin = iframe.contentWindow as
                | (Window & typeof globalThis & Record<string, unknown>)
                | null;
            console.log(
                `[extensionRuntime] injecting shim for ${ext.id}, pageUrl=${pageUrl?.slice(0, 60)}, shimLen=${shim.length}, hasEval=${typeof iframeWin?.eval}`,
            );
            if (iframeWin?.eval) {
                try {
                    (iframeWin.eval as (code: string) => unknown)(shim);
                } catch (e) {
                    console.error(
                        `[extensionRuntime] eval shim failed for ${ext.id}:`,
                        e,
                    );
                    // Fallback: script tag
                    const script = iframeDoc.createElement("script");
                    script.textContent = shim;
                    (iframeDoc.head ?? iframeDoc.documentElement)?.prepend(
                        script,
                    );
                }
            } else {
                const script = iframeDoc.createElement("script");
                script.textContent = shim;
                (iframeDoc.head ?? iframeDoc.documentElement)?.prepend(script);
            }
            // Verify shim IIFE ran
            setTimeout(() => {
                try {
                    const flag = iframeWin?.__civil_chrome_injected;
                    console.log(
                        `[extensionRuntime] post-inject check for ${ext.id}: civil_chrome_injected=${flag}`,
                    );
                } catch (e) {
                    console.log(
                        `[extensionRuntime] post-inject check threw: ${e}`,
                    );
                }
            }, 300);
            const cs = manifest.content_scripts ?? [];
            for (const rule of cs) {
                // Check URL matching before injecting
                const ruleEx = rule as typeof rule & {
                    exclude_matches?: string[];
                };
                if (rule.matches && !matchesUrlPatterns(rule.matches, pageUrl))
                    continue;
                if (
                    ruleEx.exclude_matches &&
                    matchesUrlPatterns(ruleEx.exclude_matches, pageUrl)
                )
                    continue;

                for (const cssPath of rule.css ?? []) {
                    try {
                        const raw = await extensionsReadText(ext.id, cssPath);
                        const el = iframeDoc.createElement("style");
                        el.textContent = raw;
                        iframeDoc.head?.appendChild(el);
                    } catch {}
                }
                for (const jsPath of rule.js ?? []) {
                    try {
                        const raw = await extensionsReadText(ext.id, jsPath);
                        const el = iframeDoc.createElement("script");
                        el.textContent = `(function(){\n${raw}\n})();`;
                        (iframeDoc.head ?? iframeDoc.body)?.appendChild(el);
                        console.log(
                            `[extensionRuntime] injected content script "${jsPath}" for ${ext.id} on ${pageUrl.slice(0, 80)}`,
                        );
                    } catch {}
                }
            }
        } catch (e) {
            console.error("[extensionRuntime] inject failed for", ext.id, e);
        }
    }
}

function injectIntoHtml(html: string, injection: string): string {
    // Use function replacers: the injection string contains compiled JS which
    // may have $& $' $` $1 etc. - those would be misinterpreted as replacement
    // patterns if passed as a string to replace().
    if (/<head[^>]*>/i.test(html)) {
        return html.replace(
            /<head([^>]*)>/i,
            (_m, attrs: string) => `<head${attrs}>${injection}`,
        );
    }
    if (/<html[^>]*>/i.test(html)) {
        return html.replace(
            /<html([^>]*)>/i,
            (_m, attrs: string) => `<html${attrs}>${injection}`,
        );
    }
    return injection + html;
}

function rewriteRootRelativeExtensionUrls(html: string, base: string): string {
    return html
        .replace(
            /\b(src|href|action)=(["'])\/(?!\/)([^"']*)\2/gi,
            (_match, attr: string, quote: string, path: string) =>
                `${attr}=${quote}${base}${path}${quote}`,
        )
        .replace(
            /url\((["']?)\/(?!\/)([^)"']+)\1\)/gi,
            (_match, quote: string, path: string) =>
                `url(${quote}${base}${path}${quote})`,
        );
}

/**
 * Resolves a src/href path to a normalized extension file path.
 * Returns null if the URL is external (http/https/data/blob/chrome-extension).
 */
function resolveExtensionAssetPath(
    src: string,
    pageDir: string,
): string | null {
    if (/^(https?|data|blob|chrome-extension):/.test(src)) return null;
    if (src.startsWith("//")) return null;
    const path = src.startsWith("/") ? src.slice(1) : `${pageDir}/${src}`;
    return normalizeExtensionPath(path);
}

/**
 * Inline all local <script src> and <link rel=stylesheet href> assets into the
 * HTML so that the srcdoc popup has zero external dependencies on the Civil
 * server or SW.  External (https://) references are left as-is.
 */
async function inlineHtmlAssets(
    html: string,
    extId: string,
    pageDir: string,
): Promise<string> {
    let result = html;

    // Inline <script src="..."></script>
    const scriptRe = /<script([^>]*)>\s*<\/script>/gi;
    const scriptMatches = [...html.matchAll(scriptRe)];
    for (const m of scriptMatches) {
        const [fullTag, attrs] = m;
        const srcMatch = /\bsrc=(["'])([^"']+)\1/i.exec(attrs);
        if (!srcMatch) continue;
        const src = srcMatch[2];
        const assetPath = resolveExtensionAssetPath(src, pageDir);
        if (!assetPath) continue;
        // Strip src attr, keep other attrs (type, defer, async, etc.)
        const attrsWithoutSrc = attrs.replace(/\s*\bsrc=(["'])[^"']+\1/i, "");
        try {
            const code = await extensionsReadText(extId, assetPath);
            // Escape </script> inside inlined code - the HTML parser would
            // otherwise terminate the script tag early (srcdoc parses as HTML).
            // Also escape <!-- to prevent comment-mode parsing.
            const safe = code
                .replace(/<\/script/gi, "<\\/script")
                .replace(/<!--/g, "<\\!--");
            result = result.replace(
                fullTag,
                () => `<script${attrsWithoutSrc}>${safe}</script>`,
            );
        } catch (e) {
            console.warn(
                `[extensionRuntime] inline script "${assetPath}" failed:`,
                e,
            );
        }
    }

    // Inline <link rel="stylesheet" href="..."> (rel and href can be in any order)
    const linkRe = /<link([^>]+)>/gi;
    const linkMatches = [...result.matchAll(linkRe)];
    for (const m of linkMatches) {
        const [fullTag, attrs] = m;
        if (!/\brel=(["'])stylesheet\1/i.test(attrs)) continue;
        const hrefMatch = /\bhref=(["'])([^"']+)\1/i.exec(attrs);
        if (!hrefMatch) continue;
        const href = hrefMatch[2];
        const assetPath = resolveExtensionAssetPath(href, pageDir);
        if (!assetPath) continue;
        try {
            const css = await extensionsReadText(extId, assetPath);
            result = result.replace(fullTag, () => `<style>${css}</style>`);
        } catch (e) {
            console.warn(
                `[extensionRuntime] inline css "${assetPath}" failed:`,
                e,
            );
        }
    }

    return result;
}

export async function buildExtensionPageSrcDoc(
    ext: Omit<CivilExtension, "files">,
    pagePath: string,
    contextType: "popup" | "content" = "popup",
    /** OPFS cache key; defaults to ext.id (overwrites popup slot). */
    cacheKey?: string,
): Promise<string> {
    const manifest = ext.manifest as ChromeManifest;
    const normalizedPath = normalizeExtensionPath(pagePath);
    const html = await extensionsReadText(ext.id, normalizedPath);
    const base = `${window.location.origin}/civil-ext/${ext.id}/`;

    // pageDir = directory of the popup HTML, for resolving relative asset paths
    const pageDir = normalizedPath.includes("/")
        ? normalizedPath.slice(0, normalizedPath.lastIndexOf("/"))
        : "";

    const rewrittenHtml = rewriteRootRelativeExtensionUrls(html, base);

    // Inline all local scripts/stylesheets - prevents Nitro 404 pages from
    // being returned for asset requests that bypass the SW.
    const inlinedHtml = await inlineHtmlAssets(rewrittenHtml, ext.id, pageDir);

    const shim = buildChromeShim({
        extId: ext.id,
        manifest: manifest as Parameters<typeof buildChromeShim>[0]["manifest"],
        contextType,
        bib: {
            messages: await extensionsReadLocaleMessages(ext.id, manifest),
        },
    });
    const safeShim = shim
        .replace(/<\/script/gi, "<\\/script")
        .replace(/<!--/g, "<\\!--");
    // Embed the original page path so the shim's _buildSenderUrl() can return
    // the correct chrome-extension:// URL (e.g. options.html, not action.html).
    const safePagePath = JSON.stringify(normalizedPath).replace(
        /<\/script/gi,
        "<\\/script",
    );
    const injection = `<base href="${base}"><script>window.__CIVIL_EXT_PAGE_PATH__=${safePagePath};</script><script>${safeShim}</script>`;
    const finalHtml = injectIntoHtml(inlinedHtml, injection);

    try {
        const opfsRoot = await navigator.storage.getDirectory();
        const cacheDir = await opfsRoot.getDirectoryHandle(
            "_civil_popup_cache",
            { create: true },
        );
        const fileHandle = await cacheDir.getFileHandle(
            `${cacheKey ?? ext.id}.html`,
            { create: true },
        );
        const writable = await fileHandle.createWritable();
        await writable.write(finalHtml);
        await writable.close();
    } catch (e) {
        console.warn("[extensionRuntime] popup cache write failed:", e);
    }

    return finalHtml;
}
