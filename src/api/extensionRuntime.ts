import {
    DNR_NAV_DIR,
    type DnrNavRule,
    isNavRedirectRule,
} from "$config/shared/dnrNavRules";

import type { ChromeManifest } from "~/types";

import {
    buildBackgroundShim,
    buildChromeShim,
    RAW_SHIM_SOURCE,
} from "../../misc/browserApiEmulators/extensions/chrome";
import type { CivilExtension } from "./extensions";
import {
    extensionsGetAll,
    extensionsInjectCss,
    extensionsReadLocaleMessages,
    extensionsReadText,
    extensionsSyncExternalKeys,
    normalizeExtensionPath,
} from "./extensions";

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
function matchesUrlPattern(pattern: string, url: string): boolean {
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

function matchesUrlPatterns(
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
 * Polyfill for service worker globals when running in iframe context.
 * Tampermonkey MV3 calls importScripts() which is Worker-only API.
 * Also polyfills self, skipWaiting, clients, registration.
 */
const SW_POLYFILL = `(function() {
var _swExtBase = __CIVIL_EXT_BASE__;
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

function buildSwPolyfill(extId: string): string {
    const extBase = `${window.location.origin}/civil-ext/${extId}/`;
    return SW_POLYFILL.replace("__CIVIL_EXT_BASE__", () =>
        JSON.stringify(extBase),
    );
}

/** Forwards the background frame's unhandled errors to the top-level console,
 *  to diagnose TM/VM background init failures. */
function forwardFrameErrors(iframe: HTMLIFrameElement, extId: string): void {
    try {
        iframe.contentWindow?.addEventListener("error", ev => {
            console.error(
                `[extensionRuntime] bg iframe error for ${extId}:`,
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
                    `[extensionRuntime] bg iframe unhandled rejection for ${extId}:`,
                    ev.reason,
                );
            },
        );
    } catch {}
}

/** A hidden, loaded, SW-controlled frame for the extension's background. */
async function createBackgroundFrame(
    extId: string,
): Promise<HTMLIFrameElement> {
    const iframe = document.createElement("iframe");
    iframe.id = `civil-ext-bg-${extId}`;
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
    forwardFrameErrors(iframe, extId);
    return iframe;
}

async function writeOpfsFile(
    dir: FileSystemDirectoryHandle,
    name: string,
    text: string,
): Promise<void> {
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
}

/**
 * Writes the raw shim source and per-extension options to OPFS so the SW can
 * inject the shim into extension HTML pages that are opened as tabs (e.g.
 * dashboard).
 */
async function storeShimForPages(
    extId: string,
    manifest: ChromeManifest,
    localeMessages: unknown,
): Promise<void> {
    try {
        const opfsRoot = await navigator.storage.getDirectory();
        const shimDir = await opfsRoot.getDirectoryHandle("_civil_shim", {
            create: true,
        });
        await writeOpfsFile(shimDir, "shim.js", RAW_SHIM_SOURCE);
        // Per-extension shim options for contextType "popup".
        const shimOpts = JSON.stringify({
            extId,
            manifest,
            contextType: "popup",
            bib: { messages: localeMessages },
        });
        await writeOpfsFile(shimDir, `${extId}_opts.json`, shimOpts);
    } catch (e) {
        console.warn("[extensionRuntime] Failed to store shim to OPFS:", e);
    }
}

/** Runs script text in the frame by a script tag. */
function injectScript(iframe: HTMLIFrameElement, text: string): void {
    const doc = iframe.contentDocument;
    if (!doc) return;
    const s = doc.createElement("script");
    s.textContent = text;
    (doc.head ?? doc.documentElement)?.appendChild(s);
}

/** The raw shim as a JS string literal that can't close its script tag. */
function rawShimLiteral(): string {
    return JSON.stringify(RAW_SHIM_SOURCE).replace(/<\/script/gi, "<\\/script");
}

/** MV2 background.scripts, or an MV3 service worker run as a page. */
async function runScriptsBackground(
    iframe: HTMLIFrameElement,
    extId: string,
    shim: string,
    scripts: string[],
    isServiceWorker: boolean,
): Promise<void> {
    if (!iframe.contentDocument) return;
    // inject SW polyfill first (for service workers), then shim, then scripts
    if (isServiceWorker) injectScript(iframe, buildSwPolyfill(extId));
    // Store the RAW (un-substituted) shim IIFE source on window so
    // buildOffscreenAPI can inject it into offscreen document iframes
    // setting window.__CIVIL_SHIM_OPTIONS__ to per-context options.
    // Must use RAW_SHIM_SOURCE (placeholder intact) not the replaced `shim`.
    injectScript(iframe, `window.__CIVIL_SHIM_SRC__ = ${rawShimLiteral()};`);
    injectScript(iframe, shim);
    for (const scriptPath of scripts) {
        try {
            const code = patchBgScript(
                await extensionsReadText(extId, scriptPath),
            );
            console.log(
                `[extensionRuntime] injecting bg script "${scriptPath}" for ${extId} (${code.length} bytes)`,
            );
            injectScript(iframe, code);
        } catch (e) {
            console.warn(
                `[extensionRuntime] background script "${scriptPath}" failed:`,
                e,
            );
        }
    }
}

/** background.page: load its HTML with the shim injected at the top. */
async function runPageBackground(
    iframe: HTMLIFrameElement,
    extId: string,
    shim: string,
    page: string,
): Promise<void> {
    try {
        const html = await extensionsReadText(extId, page);
        const shimStoreSrc = shim.replace(/<\/script/gi, "<\\/script");
        // Use RAW_SHIM_SOURCE (unreplaced) so offscreen docs can inject
        // it with their own __CIVIL_SHIM_OPTIONS__.
        const shimScript = `<script>window.__CIVIL_SHIM_SRC__=${rawShimLiteral()};</script><script>${shimStoreSrc}</script>`;
        const patched = /<head[^>]*>/i.test(html)
            ? html.replace(
                  /<head([^>]*)>/i,
                  (_m, a: string) => `<head${a}>${shimScript}`,
              )
            : shimScript + html;
        const blobUrl = URL.createObjectURL(
            new Blob([patched], { type: "text/html" }),
        );
        await new Promise<void>(resolve => {
            iframe.onload = () => resolve();
            iframe.src = blobUrl;
            setTimeout(resolve, 3000);
        });
        URL.revokeObjectURL(blobUrl);
    } catch (e) {
        console.warn(`[extensionRuntime] background page "${page}" failed:`, e);
    }
}

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

    const iframe = await createBackgroundFrame(ext.id);
    const localeMessages = await extensionsReadLocaleMessages(ext.id, manifest);
    const shim = buildBackgroundShim({
        extId: ext.id,
        manifest: manifest as Parameters<
            typeof buildBackgroundShim
        >[0]["manifest"],
        contextType: "background",
        bib: { messages: localeMessages },
    });
    void storeShimForPages(ext.id, manifest, localeMessages);

    try {
        if (bg.page) {
            await runPageBackground(iframe, ext.id, shim, bg.page);
        } else if (bg.service_worker) {
            // MV3 service_worker: run in iframe context (simpler than real SW)
            await runScriptsBackground(
                iframe,
                ext.id,
                shim,
                [bg.service_worker],
                true,
            );
            // Also load static DNR rulesets if declared
            await loadStaticDNRRulesets(ext.id, manifest, iframe);
        } else if (bg.scripts && bg.scripts.length > 0) {
            // MV2 background.scripts
            await runScriptsBackground(iframe, ext.id, shim, bg.scripts, false);
        }
    } catch (e) {
        console.error(
            `[extensionRuntime] background launch failed for ${ext.id}:`,
            e,
        );
    }

    return iframe;
}

type RuleResource = { id: string; enabled: boolean; path: string };

function ruleResourcesOf(manifest: ChromeManifest): RuleResource[] | undefined {
    return (
        manifest as unknown as {
            declarative_net_request?: { rule_resources?: RuleResource[] };
        }
    ).declarative_net_request?.rule_resources;
}

/** Adds `rules` through the background frame's chrome.declarativeNetRequest. */
function addRulesInBackground(bgIframe: HTMLIFrameElement, rules: unknown[]) {
    const doc = bgIframe.contentDocument;
    if (!doc) return false;
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
    return true;
}

/** Saves the navigation redirects where the SW reads them from OPFS. */
async function saveNavRedirectRules(
    extId: string,
    rules: DnrNavRule[],
): Promise<void> {
    try {
        const opfsRoot = await navigator.storage.getDirectory();
        const navDir = await opfsRoot.getDirectoryHandle(DNR_NAV_DIR, {
            create: true,
        });
        await writeOpfsFile(navDir, `${extId}.json`, JSON.stringify(rules));
        console.log(
            `[extensionRuntime] saved ${rules.length} DNR nav-redirect rules for ${extId}`,
        );
    } catch (e) {
        console.warn(
            `[extensionRuntime] failed to save DNR nav rules for ${extId}:`,
            e,
        );
    }
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
    const resources = ruleResourcesOf(manifest);
    if (!resources) return;

    // Collect all navigation-redirect rules so the SW can apply them for
    // main-frame navigations (e.g. TM redirecting *.user.js to confirm.html).
    const allNavRedirectRules: DnrNavRule[] = [];

    for (const rs of resources) {
        if (!rs.enabled) continue;
        try {
            const raw = await extensionsReadText(extId, rs.path);
            const rules = JSON.parse(raw) as unknown[];
            if (!addRulesInBackground(bgIframe, rules)) continue;
            // Collect redirect rules that apply to main_frame navigations.
            // The SW will read these from OPFS to intercept *.user.js navigations.
            allNavRedirectRules.push(
                ...(rules as DnrNavRule[]).filter(isNavRedirectRule),
            );
        } catch (e) {
            console.warn(
                `[extensionRuntime] DNR ruleset "${rs.path}" load failed:`,
                e,
            );
        }
    }

    if (allNavRedirectRules.length > 0) {
        void saveNavRedirectRules(extId, allNavRedirectRules);
    }
}

/** The URL an iframe's document reports, read from the parent frame. */
function iframePageUrl(iframe: HTMLIFrameElement, iframeDoc: Document): string {
    try {
        return iframeDoc.location?.href || iframe.src;
    } catch {
        return iframe.src;
    }
}

/** The chrome.* shim an extension's content script sees on `pageUrl`. */
async function buildContentShim(
    extId: string,
    manifest: ChromeManifest,
    pageUrl: string,
    civilTabId: string | undefined,
): Promise<string> {
    return buildChromeShim({
        extId,
        manifest: manifest as Parameters<typeof buildChromeShim>[0]["manifest"],
        contextType: "content",
        bib: {
            messages: await extensionsReadLocaleMessages(extId, manifest),
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
}

/**
 * Runs a shim in the iframe's own context.
 *
 * Inject via contentWindow.eval to bypass Scramjet's
 * createElement/prepend interception. Scramjet wraps the iframe's
 * document.createElement("script") and Node.prepend so dynamically-
 * inserted script elements don't execute. eval() on the child window
 * from the parent frame runs in the child context without hitting
 * those DOM hooks.
 */
function runShimInFrame(
    iframe: HTMLIFrameElement,
    iframeDoc: Document,
    shim: string,
    extId: string,
    pageUrl: string,
): void {
    const iframeWin = iframe.contentWindow as
        | (Window & typeof globalThis & Record<string, unknown>)
        | null;
    console.log(
        `[extensionRuntime] injecting shim for ${extId}, pageUrl=${pageUrl?.slice(0, 60)}, shimLen=${shim.length}, hasEval=${typeof iframeWin?.eval}`,
    );
    const prependScript = () => {
        const script = iframeDoc.createElement("script");
        script.textContent = shim;
        (iframeDoc.head ?? iframeDoc.documentElement)?.prepend(script);
    };
    if (iframeWin?.eval) {
        try {
            (iframeWin.eval as (code: string) => unknown)(shim);
        } catch (e) {
            console.error(
                `[extensionRuntime] eval shim failed for ${extId}:`,
                e,
            );
            // Fallback: script tag
            prependScript();
        }
    } else {
        prependScript();
    }
    // Verify shim IIFE ran
    setTimeout(() => {
        try {
            const flag = iframeWin?.__civil_chrome_injected;
            console.log(
                `[extensionRuntime] post-inject check for ${extId}: civil_chrome_injected=${flag}`,
            );
        } catch (e) {
            console.log(`[extensionRuntime] post-inject check threw: ${e}`);
        }
    }, 300);
}

/** Injects the content scripts of `ext` whose match patterns cover
 *  `pageUrl`: their stylesheets, then their scripts. */
async function injectContentScripts(
    extId: string,
    manifest: ChromeManifest,
    iframeDoc: Document,
    pageUrl: string,
): Promise<void> {
    for (const rule of manifest.content_scripts ?? []) {
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

        await extensionsInjectCss(extId, iframeDoc, rule.css);
        for (const jsPath of rule.js ?? []) {
            try {
                const raw = await extensionsReadText(extId, jsPath);
                const el = iframeDoc.createElement("script");
                el.textContent = `(function(){\n${raw}\n})();`;
                (iframeDoc.head ?? iframeDoc.body)?.appendChild(el);
                console.log(
                    `[extensionRuntime] injected content script "${jsPath}" for ${extId} on ${pageUrl.slice(0, 80)}`,
                );
            } catch {}
        }
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
            const pageUrl = pageUrlHint ?? iframePageUrl(iframe, iframeDoc);

            const shim = await buildContentShim(
                ext.id,
                manifest,
                pageUrl,
                civilTabId,
            );
            runShimInFrame(iframe, iframeDoc, shim, ext.id, pageUrl);
            await injectContentScripts(ext.id, manifest, iframeDoc, pageUrl);
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
 * Escape </script> inside inlined code - the HTML parser would otherwise
 * terminate the script tag early (srcdoc parses as HTML). Also escape <!-- to
 * prevent comment-mode parsing.
 */
function scriptSafe(code: string): string {
    return code.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
}

/** Inline <script src="..."></script>, keeping its other attributes. */
async function inlineScripts(
    html: string,
    extId: string,
    pageDir: string,
): Promise<string> {
    let result = html;
    for (const [fullTag, attrs] of html.matchAll(
        /<script([^>]*)>\s*<\/script>/gi,
    )) {
        const srcMatch = /\bsrc=(["'])([^"']+)\1/i.exec(attrs);
        if (!srcMatch) continue;
        const assetPath = resolveExtensionAssetPath(srcMatch[2], pageDir);
        if (!assetPath) continue;
        // Strip src attr, keep other attrs (type, defer, async, etc.)
        const attrsWithoutSrc = attrs.replace(/\s*\bsrc=(["'])[^"']+\1/i, "");
        try {
            const safe = scriptSafe(await extensionsReadText(extId, assetPath));
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
    return result;
}

/** Inline <link rel="stylesheet" href="..."> (rel and href in any order). */
async function inlineStylesheets(
    html: string,
    extId: string,
    pageDir: string,
): Promise<string> {
    let result = html;
    for (const [fullTag, attrs] of html.matchAll(/<link([^>]+)>/gi)) {
        if (!/\brel=(["'])stylesheet\1/i.test(attrs)) continue;
        const hrefMatch = /\bhref=(["'])([^"']+)\1/i.exec(attrs);
        if (!hrefMatch) continue;
        const assetPath = resolveExtensionAssetPath(hrefMatch[2], pageDir);
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
    const withScripts = await inlineScripts(html, extId, pageDir);
    return inlineStylesheets(withScripts, extId, pageDir);
}

/** Caches the built page in OPFS for the SW to serve. */
async function cachePopupPage(key: string, html: string): Promise<void> {
    try {
        const opfsRoot = await navigator.storage.getDirectory();
        const cacheDir = await opfsRoot.getDirectoryHandle(
            "_civil_popup_cache",
            { create: true },
        );
        await writeOpfsFile(cacheDir, `${key}.html`, html);
    } catch (e) {
        console.warn("[extensionRuntime] popup cache write failed:", e);
    }
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
    const safeShim = scriptSafe(shim);
    // Embed the original page path so the shim's _buildSenderUrl() can return
    // the correct chrome-extension:// URL (e.g. options.html, not action.html).
    const safePagePath = JSON.stringify(normalizedPath).replace(
        /<\/script/gi,
        "<\\/script",
    );
    const injection = `<base href="${base}"><script>window.__CIVIL_EXT_PAGE_PATH__=${safePagePath};</script><script>${safeShim}</script>`;
    const finalHtml = injectIntoHtml(inlinedHtml, injection);

    await cachePopupPage(cacheKey ?? ext.id, finalHtml);

    return finalHtml;
}
