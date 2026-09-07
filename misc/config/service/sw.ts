import type { UVConfig } from "@titaniumnetwork-dev/ultraviolet";
import mime from "mime/lite";
import genProxyPath from "$config/shared/genProxyPath";
import { decode, encode, init } from "$config/shared/wasmDencode";

declare global {
    interface Window {
        __uv$config: Partial<UVConfig>;
        UVServiceWorker: any;
    }
}

importScripts("/uv/uv.bundle.js");
importScripts("/uv/uv.sw.js");
importScripts("/scramjetController/controller.sw.js");

const UV_PREFIX = genProxyPath("/~/", "uv");

if (navigator.userAgent.includes("Firefox")) {
    Object.defineProperty(globalThis, "crossOriginIsolated", {
        value: true,
        writable: true,
    });
}

const ready = init().then(() => {
    const spf = genProxyPath("/", "uv");

    const files = ["uv.handler.js", "uv.client.js", "uv.bundle.js", "uv.sw.js"];
    const fileProps = Object.fromEntries(
        files.map(file => {
            const propName = file.split(".")[1];
            return [propName, `${spf}${file}`];
        }),
    );

    self.__uv$config = {
        prefix: UV_PREFIX,
        encodeUrl: encode,
        decodeUrl: decode,
        ...fileProps,
        config: "/uv_config.js",
    };

    return {
        uv: new self.UVServiceWorker(),
    };
});

const CIVIL_EXT_RE = /^\/civil-ext\/([^/]+)\/(.+)$/;

/**
 * Check OPFS for static and runtime DNR navigation-redirect rules.
 * If a matching redirect rule is found for the given original URL, returns the
 * Civil-equivalent redirect URL (converting chrome-extension:// to /civil-ext/).
 * Called for main-frame navigate requests to intercept *.user.js installs.
 */
async function checkDNRNavRedirect(
    originalUrl: string,
): Promise<string | null> {
    try {
        const opfsRoot = await navigator.storage.getDirectory();
        let navDir: FileSystemDirectoryHandle;
        try {
            navDir = await opfsRoot.getDirectoryHandle("_civil_dnr_nav");
        } catch {
            return null; // directory doesn't exist yet
        }
        for await (const [fileName, handle] of (
            navDir as FileSystemDirectoryHandle & {
                entries(): AsyncIterable<[string, FileSystemHandle]>;
            }
        ).entries()) {
            if (!fileName.endsWith(".json") || handle.kind !== "file") continue;
            try {
                const file = await (handle as FileSystemFileHandle).getFile();
                const stored = JSON.parse(await file.text()) as
                    | unknown[]
                    | { extensionId?: string; rules?: unknown[] };
                const rules = Array.isArray(stored)
                    ? stored
                    : (stored.rules ?? []);
                const extId = Array.isArray(stored)
                    ? fileName.slice(0, -5)
                    : (stored.extensionId ?? fileName.split(".")[0]);
                for (const rule of rules) {
                    const r = rule as Record<string, unknown>;
                    const action = r.action as
                        | Record<string, unknown>
                        | undefined;
                    const cond = r.condition as
                        | Record<string, unknown>
                        | undefined;
                    if (action?.type !== "redirect") continue;

                    const resourceTypes = cond?.resourceTypes as
                        | string[]
                        | undefined;
                    if (
                        resourceTypes &&
                        !resourceTypes.includes("main_frame")
                    ) {
                        continue;
                    }
                    const requestMethods = cond?.requestMethods as
                        | string[]
                        | undefined;
                    if (
                        requestMethods &&
                        !requestMethods.some(
                            method => method.toLowerCase() === "get",
                        )
                    ) {
                        continue;
                    }

                    let parsedUrl: URL;
                    try {
                        parsedUrl = new URL(originalUrl);
                    } catch {
                        continue;
                    }
                    const requestDomains = cond?.requestDomains as
                        | string[]
                        | undefined;
                    if (
                        requestDomains &&
                        !requestDomains.some(
                            domain =>
                                parsedUrl.hostname === domain ||
                                parsedUrl.hostname.endsWith(`.${domain}`),
                        )
                    ) {
                        continue;
                    }
                    const excludedRequestDomains =
                        cond?.excludedRequestDomains as string[] | undefined;
                    if (
                        excludedRequestDomains?.some(
                            domain =>
                                parsedUrl.hostname === domain ||
                                parsedUrl.hostname.endsWith(`.${domain}`),
                        )
                    ) {
                        continue;
                    }

                    // Match URL against condition
                    const urlFilter = cond?.urlFilter as string | undefined;
                    const regexFilter = cond?.regexFilter as string | undefined;
                    let matched = false;
                    if (regexFilter) {
                        try {
                            matched = new RegExp(regexFilter, "i").test(
                                originalUrl,
                            );
                        } catch {
                            /* invalid regex */
                        }
                    } else if (urlFilter) {
                        // Simple glob: * = wildcard, treat as substring match for common patterns
                        const escaped = urlFilter
                            .replace(/[.+?^${}()[\]\\]/g, "\\$&")
                            .replace(/\*/g, ".*");
                        try {
                            matched = new RegExp(escaped, "i").test(
                                originalUrl,
                            );
                        } catch {
                            /* invalid */
                        }
                    }
                    if (!matched) continue;
                    const redirect = action?.redirect as
                        | Record<string, unknown>
                        | undefined;
                    let redirectUrl: string | null = null;
                    if (redirect?.url && typeof redirect.url === "string") {
                        redirectUrl = redirect.url;
                    } else if (redirect?.regexSubstitution && regexFilter) {
                        try {
                            const flags = cond?.isUrlFilterCaseSensitive
                                ? ""
                                : "i";
                            // DNR uses \0 (full match), \1, \2 … for capture groups.
                            // JS String.replace uses $& / $1 / $2 …  Convert:
                            const jsSub = (redirect.regexSubstitution as string)
                                .replace(/\\0/g, "$$&")
                                .replace(/\\([1-9])/g, "$$$1");
                            redirectUrl = originalUrl.replace(
                                new RegExp(regexFilter, flags),
                                jsSub,
                            );
                        } catch {}
                    } else if (
                        redirect?.extensionPath &&
                        typeof redirect.extensionPath === "string"
                    ) {
                        // Extension-relative path, possibly with placeholders
                        const path = (redirect.extensionPath as string)
                            .replace(/^\//, "")
                            .replace(
                                /\[\[SPEC_URL\]\]|%SPEC_URL%/g,
                                encodeURIComponent(originalUrl),
                            )
                            .replace(
                                /\[\[URL\]\]|%URL%/g,
                                encodeURIComponent(originalUrl),
                            );
                        redirectUrl = `${self.location.origin}/civil-ext/${extId}/${path}`;
                    }
                    if (redirectUrl) {
                        redirectUrl = redirectUrl.replace(
                            /^chrome-extension:\/\/([^/]+)\//,
                            `${self.location.origin}/civil-ext/$1/`,
                        );
                        return redirectUrl;
                    }
                }
            } catch {}
        }
    } catch {}
    return null;
}

function proxyRedirectUrl(requestUrl: string, targetUrl: string): string {
    const origin = self.location.origin;
    const uvPrefix = self.__uv$config.prefix as string;

    if (requestUrl.startsWith(origin + uvPrefix)) {
        return `${origin}${uvPrefix}${self.__uv$config.encodeUrl!(targetUrl)}`;
    }
    if (requestUrl.startsWith(origin + SCRAMJET_PREFIX)) {
        const requestPath = new URL(requestUrl).pathname;
        const framePrefix = requestPath.slice(
            0,
            requestPath.lastIndexOf("/") + 1,
        );
        return `${origin}${framePrefix}${encode(targetUrl)}`;
    }
    return targetUrl;
}

async function serveCivilExt(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const match = CIVIL_EXT_RE.exec(url.pathname);
    if (!match) return null;

    const [, extId, filePath] = match;

    try {
        const opfsRoot = await navigator.storage.getDirectory();
        const parts = `extensions/${extId}/${filePath}`
            .split("/")
            .filter(Boolean);

        let dir: FileSystemDirectoryHandle = opfsRoot;
        for (let i = 0; i < parts.length - 1; i++) {
            dir = await dir.getDirectoryHandle(parts[i]!);
        }
        const fileName = parts[parts.length - 1]!;
        const fileHandle = await dir.getFileHandle(fileName);
        const file = await fileHandle.getFile();

        const contentType =
            mime.getType(filePath) ?? "application/octet-stream";

        if (contentType === "text/html") {
            let html = await file.text();
            try {
                const shimDir =
                    await opfsRoot.getDirectoryHandle("_civil_shim");

                const shimJsHandle = await shimDir.getFileHandle("shim.js");
                const shimJsFile = await shimJsHandle.getFile();
                const shimSrc = await shimJsFile.text();

                const optsHandle = await shimDir.getFileHandle(
                    `${extId}_opts.json`,
                );
                const optsFile = await optsHandle.getFile();
                const optsJson = await optsFile.text();

                const safeOpts = optsJson.replace(/<\/script/gi, "<\\/script");
                const safeShim = shimSrc.replace(/<\/script/gi, "<\\/script");

                const frameSpoof = `<script>
(function(){
  try {
    Object.defineProperty(window,'top',{get:function(){return window;},configurable:true});
    Object.defineProperty(window,'parent',{get:function(){return window;},configurable:true});
    Object.defineProperty(window,'frameElement',{get:function(){return null;},configurable:true});
  } catch(e){}
})();
</script>`;

                const injection = `${frameSpoof}<script>window.__CIVIL_SHIM_OPTIONS__=${safeOpts};</script><script>${safeShim}</script>`;

                if (/<head[^>]*>/i.test(html)) {
                    html = html.replace(
                        /<head([^>]*)>/i,
                        (_m, a: string) => `<head${a}>${injection}`,
                    );
                } else if (/<html[^>]*>/i.test(html)) {
                    html = html.replace(
                        /<html([^>]*)>/i,
                        (_m, a: string) => `<html${a}>${injection}`,
                    );
                } else {
                    html = injection + html;
                }
            } catch {}
            return new Response(html, {
                status: 200,
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }

        return new Response(file, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Length": String(file.size),
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch {
        return new Response("Extension file not found", { status: 404 });
    }
}

const CIVIL_CHII_PREAMBLE = `<script>
(function(){
  try {
    if (!window.__civilNativeWebSocket) {
      window.__civilNativeWebSocket = window.WebSocket;
    }
    if (!window.__civilNativeFetch) {
      window.__civilNativeFetch = window.fetch && window.fetch.bind(window);
    }
    if (!window.__civilNativeXHR) {
      window.__civilNativeXHR = window.XMLHttpRequest;
    }
    if (!window.__civilNativeMessageChannel) {
      window.__civilNativeMessageChannel = window.MessageChannel;
    }
    if (!window.__civilNativeMessagePort) {
      window.__civilNativeMessagePort = window.MessagePort;
    }
    // Save native BroadcastChannel before Scramjet wraps its prototype.postMessage.
    // Scramjet rewrites BroadcastChannel.prototype.postMessage to inject a
    // $scramjet$messagetype wrapper around every message payload.  Our extension
    // bus messages must be delivered unwrapped, so we capture the native
    // constructor and the native postMessage/addEventListener here, before
    // Scramjet's controller.inject.js runs.
    if (!window.__civilNativeBroadcastChannel && window.BroadcastChannel) {
      window.__civilNativeBroadcastChannel = window.BroadcastChannel;
      try {
        window.__civilNativeBCPostMessage = window.BroadcastChannel.prototype.postMessage;
        window.__civilNativeBCAddEventListener = window.BroadcastChannel.prototype.addEventListener;
      } catch(e2) {}
    }
    // Save native eval before Scramjet wraps it, so the content shim can
    // execute injected userscript code without going through Scramjet's
    // JS rewriter (which would rewrite location/window refs but silently
    // prevent script-tag-based injection from executing).
    if (!window.__civilNativeEval) {
      try { window.__civilNativeEval = eval; } catch(e3) {}
    }
    // Save the real window's event APIs before Scramjet proxies \`window\`. The
    // Chii DevTools bridge dispatches CustomEvents between the injected client
    // and the host on the real contentWindow; via Scramjet's window proxy those
    // events never reach the host's listener, so the injected client uses these
    // unproxied references instead.
    if (!window.__civilNativeDispatchEvent) {
      try {
        window.__civilNativeWindow = window;
        window.__civilNativeAddEventListener = window.addEventListener.bind(window);
        window.__civilNativeRemoveEventListener = window.removeEventListener.bind(window);
        window.__civilNativeDispatchEvent = window.dispatchEvent.bind(window);
        window.__civilNativeCustomEvent = window.CustomEvent;
      } catch(e4) {}
    }
  } catch(e) {}
})();
</script>`;

/**
 * Minimal chrome.runtime.sendMessage stub injected at document_start into every
 * proxied HTML page.  This lets sites like Greasyfork detect installed
 * userscript managers (Tampermonkey) synchronously during page parse, long
 * before injectExtensionShimsIntoIframe fires after the load event.
 *
 * Design constraints:
 *   - Uses only `var` (never const/let) so Scramjet's client-side script
 *     rewriter can re-evaluate this tag without hitting SyntaxErrors.
 *   - Re-entry guard (__civil_ext_stub) makes re-evaluation a no-op.
 *   - SW has no access to OPFS, so the stub can't know which extensions are
 *     installed.  Instead it intercepts ALL sendMessage(stringId, ...) calls
 *     and routes them to the civil-ext-bus-{extId} BroadcastChannel.  If no
 *     background is running for that ID the message is silently ignored.
 *   - The full shim (injected after load) replaces window.chrome entirely;
 *     __civil_chrome_injected stays unset so the full shim initialises normally.
 */
const CIVIL_EXT_DETECT_STUB = `<script>
(function() {
  // Relay a log message to Civil's top-level window console (visible in main
  // DevTools without needing to switch frame context).
  function civilLog() {
    var msg = '[civil-ext-stub] ' + Array.prototype.join.call(arguments, ' ');
    try {
      if (window.top && window.top !== window) {
        window.top.dispatchEvent(new CustomEvent('__civilDebug', { detail: msg }));
      }
    } catch(e) {}
    console.log(msg);
  }
  if (window.__civil_ext_stub) return;
  window.__civil_ext_stub = true;
  civilLog('STUB INSTALLED on', location.href.slice(0, 80));
  try {
    if (!window.chrome) window.chrome = {};
    if (!window.chrome.runtime) window.chrome.runtime = {};
    // Mark so the stub doesn't self-overwrite if this block somehow runs twice.
    if (window.chrome.runtime.__civil_stub) return;
    window.chrome.runtime.__civil_stub = true;
    // Use native BroadcastChannel saved by CIVIL_CHII_PREAMBLE before Scramjet
    // wraps BroadcastChannel.prototype.postMessage.  Scramjet's wrapper injects
    // a {$scramjet$messagetype, $scramjet$data} envelope around every message,
    // which breaks the extension bus protocol (runtime.ts checks data.kind).
    var _NativeBC = window.__civilNativeBroadcastChannel || (typeof BroadcastChannel !== 'undefined' ? BroadcastChannel : null);
    var _nativeBCPost = window.__civilNativeBCPostMessage || (_NativeBC && _NativeBC.prototype.postMessage);
    var _nativeBCListen = window.__civilNativeBCAddEventListener || (_NativeBC && _NativeBC.prototype.addEventListener);
    var _origSend = window.chrome.runtime.sendMessage;
    window.chrome.runtime.sendMessage = function(extIdOrMsg, msgOrOpts, optsOrCb, maybeCb) {
      // Only intercept external calls: sendMessage(extId:string, msg, ...)
      if (typeof extIdOrMsg !== 'string') {
        civilLog('sendMessage (internal) - passing through');
        if (typeof _origSend === 'function') return _origSend.apply(window.chrome.runtime, arguments);
        return;
      }
      civilLog('sendMessage (external) extId=' + extIdOrMsg + ' NativeBC=' + !!_NativeBC + ' nativeBCPost=' + !!_nativeBCPost);
      if (!_NativeBC || !_nativeBCPost) {
        civilLog('WARN: no native BC - falling back');
        if (typeof _origSend === 'function') return _origSend.apply(window.chrome.runtime, arguments);
        return;
      }
      var extId = extIdOrMsg;
      var message = msgOrOpts;
      var callback = typeof optsOrCb === 'function' ? optsOrCb
                   : typeof maybeCb  === 'function' ? maybeCb
                   : null;
      try {
        var reqId = Math.random().toString(36).slice(2);
        var bus = new _NativeBC('civil-ext-bus-' + extId);
        var done = false;
        var onMsg = function(e) {
          var d = e.data;
          // Unwrap Scramjet envelope if present on incoming messages
          if (d && d.$scramjet$data !== undefined) d = d.$scramjet$data;
          if (!d || d.kind !== 'sendResponse' || d.reqId !== reqId) return;
          done = true;
          _nativeBCListen
            ? bus.removeEventListener('message', onMsg)
            : bus.removeEventListener('message', onMsg);
          try { bus.close(); } catch(ex) {}
          if (callback) { try { callback(d.response); } catch(ex2) {} }
        };
        // Use native addEventListener to avoid Scramjet callback wrapping
        if (_nativeBCListen) {
          _nativeBCListen.call(bus, 'message', onMsg);
        } else {
          bus.addEventListener('message', onMsg);
        }
        // Use native postMessage to bypass Scramjet's $scramjet$ envelope
        civilLog('posting sendMessageExternal reqId=' + reqId + ' to civil-ext-bus-' + extId);
        _nativeBCPost.call(bus, {
          kind: 'sendMessageExternal',
          reqId: reqId,
          from: 'civil-stub-' + reqId,
          contextType: 'content',
          message: message,
          sender: { url: (typeof location !== 'undefined' ? location.href : '') }
        });
        // Close after 3 s to avoid leaking the channel if the background
        // never responds (e.g. the extension is not actually installed).
        setTimeout(function() {
          if (!done) { try { bus.close(); } catch(ex) {} }
        }, 3000);
      } catch(ex3) {
        // BroadcastChannel not available or postMessage failed - fall back.
        if (typeof _origSend === 'function') _origSend.apply(window.chrome.runtime, arguments);
      }
    };
    // Expose chrome.runtime.id so pages that check it know an extension context
    // is present.  Left empty string - the real value is set by the full shim.
    if (!window.chrome.runtime.id) window.chrome.runtime.id = '';
  } catch(e) {}
  // Inject window.external keys for userscript managers (Tampermonkey etc).
  // Greasyfork detects TM via window.external?.Tampermonkey (set by TM content
  // script at document_start in real Chrome).  Civil runs content scripts after
  // page load, which is too late.  We bridge this by reading a localStorage key
  // written by syncExternalKeys() in extensions.ts whenever an extension is
  // installed/toggled, then setting window.external synchronously here.
  try {
    var _extKeysRaw = localStorage.getItem('civil-ext-external-keys');
    civilLog('civil-ext-external-keys raw:', _extKeysRaw, '| civil-extensions exists:', !!localStorage.getItem('civil-extensions'));
    if (_extKeysRaw) {
      var _extKeys = JSON.parse(_extKeysRaw);
      if (!window.external) {
        try { Object.defineProperty(window, 'external', { value: {}, writable: true, configurable: true }); } catch(_de) { window.external = {}; }
      }
      for (var _ek in _extKeys) {
        try { window.external[_ek] = _extKeys[_ek]; } catch(_ee) {}
      }
      civilLog('window.external keys injected:', Object.keys(_extKeys).join(', '));
    }
  } catch(_ke) {}
})();
</script>`;

const CIVIL_ERROR_COUNTER = `<script>
(function(){
  try {
    var W = window.__civilNativeWindow || window;
    if (W.__civilErrCounterInstalled) return;
    W.__civilErrCounterInstalled = true;
    W.__civilConsoleErrors = 0;
    W.__civilRewriterErrors = 0;
    var RX = new RegExp(["scramjet","ultraviolet","rewrit","__uv","unrewrite","oxc","proxy"].join("|"), "i");
    function argsToStr(a){
      try {
        return Array.prototype.map.call(a, function(x){
          return (x && x.stack) || String(x);
        }).join(' ');
      } catch(e) { return ''; }
    }
    // console.error / uncaught: count all; tag rewriter-looking ones.
    function bumpError(text){
      try {
        W.__civilConsoleErrors++;
        if (text && RX.test(String(text))) W.__civilRewriterErrors++;
      } catch(e) {}
    }
    function bumpWarn(text){
      try {
        if (text && RX.test(String(text))) {
          W.__civilConsoleErrors++;
          W.__civilRewriterErrors++;
        }
      } catch(e) {}
    }
    try {
      var _e = console.error;
      console.error = function(){
        bumpError(argsToStr(arguments));
        return _e.apply(console, arguments);
      };
    } catch(e) {}
    try {
      var _w = console.warn;
      console.warn = function(){
        bumpWarn(argsToStr(arguments));
        return _w.apply(console, arguments);
      };
    } catch(e) {}
    // Failed proxied requests: non-OK (>=400) responses + network failures on
    // fetch/XHR (Scramjet routes subresources via XHR through the SW, so these
    // catch the 500s) + failed resource element loads.
    W.__civilFailedRequests = 0;
    try {
      var _fetch = W.fetch;
      if (typeof _fetch === 'function') {
        W.fetch = function(){
          var p;
          try { p = _fetch.apply(this, arguments); }
          catch(e) { try { W.__civilFailedRequests++; } catch(_) {} throw e; }
          try {
            return p.then(function(r){
              try {
                if (r && typeof r.status === 'number' && r.status >= 400) {
                  W.__civilFailedRequests++;
                }
              } catch(e) {}
              return r;
            }, function(err){
              try { W.__civilFailedRequests++; } catch(e) {}
              throw err;
            });
          } catch(e) { return p; }
        };
      }
    } catch(e) {}
    try {
      var XHR = W.XMLHttpRequest;
      if (XHR && XHR.prototype && !XHR.prototype.__civilWrapped) {
        XHR.prototype.__civilWrapped = true;
        var _open = XHR.prototype.open;
        XHR.prototype.open = function(){
          try {
            this.addEventListener('load', function(){
              try { if (this.status >= 400) W.__civilFailedRequests++; } catch(e) {}
            });
            this.addEventListener('error', function(){
              try { W.__civilFailedRequests++; } catch(e) {}
            });
          } catch(e) {}
          return _open.apply(this, arguments);
        };
      }
    } catch(e) {}
    var add = W.__civilNativeAddEventListener || W.addEventListener.bind(W);
    try {
      add('error', function(ev){
        try {
          var t = ev && ev.target;
          // Resource element (img/script/link/iframe) failed to load.
          if (t && t !== W && t.tagName) {
            W.__civilFailedRequests++;
            return;
          }
        } catch(e) {}
        bumpError((ev && (ev.message || (ev.error && ev.error.stack))) || '');
      }, true);
    } catch(e) {}
    try {
      add('unhandledrejection', function(ev){
        bumpError((ev && ev.reason && (ev.reason.stack || ev.reason.message)) || '');
      });
    } catch(e) {}
  } catch(e) {}
})();
</script>`;

async function injectChiiPreamble(
    response: Response,
    originalUrl?: string,
    requestMode?: RequestMode,
): Promise<Response> {
    try {
        const ct = response.headers.get("content-type") || "";

        const isUserScript =
            requestMode === "navigate" &&
            originalUrl &&
            /\.user\.(js|ts)(\?[^#]*)?$/i.test(originalUrl.split("#")[0]);
        if (isUserScript) {
            const js = await response.text();
            if (js.includes("// ==UserScript==")) {
                const escaped = js
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
                const html = `<!DOCTYPE html>
<html>
<head>
${CIVIL_CHII_PREAMBLE}
${CIVIL_EXT_DETECT_STUB}
<meta charset="utf-8">
<title>Installing userscript…</title>
</head>
<body>
<pre id="civil-userscript-source" style="white-space:pre-wrap;word-break:break-all;font-size:12px">${escaped}</pre>
</body>
</html>`;
                const headers = new Headers();
                headers.set("Content-Type", "text/html; charset=utf-8");
                headers.set("Cache-Control", "no-store");
                return new Response(html, { status: 200, headers });
            }
            return response;
        }

        if (!ct.toLowerCase().includes("text/html")) return response;

        const text = await response.text();

        var injection =
            CIVIL_CHII_PREAMBLE + CIVIL_ERROR_COUNTER + CIVIL_EXT_DETECT_STUB;
        let modified: string;
        if (/<head[^>]*>/i.test(text)) {
            modified = text.replace(/<head([^>]*)>/i, `<head$1>${injection}`);
        } else if (/<html[^>]*>/i.test(text)) {
            modified = text.replace(/<html([^>]*)>/i, `<html$1>${injection}`);
        } else {
            modified = injection + text;
        }

        const headers = new Headers(response.headers);
        headers.delete("content-length");
        return new Response(modified, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    } catch {
        return response;
    }
}

const SCRAMJET_PREFIX = "/~/scramjet/";

function decodeScramjetUrl(s: string): string {
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
}

/** The real-origin `/civil-ext/` request a proxied URL decodes to, or null. */
function unwrapCivilExt(originalUrl: string): Request | null {
    try {
        const target = new URL(originalUrl);
        if (
            target.origin === self.location.origin &&
            target.pathname.startsWith("/civil-ext/")
        ) {
            return new Request(target.href);
        }
    } catch {}
    return null;
}

function decodeProxiedUrl(encodedUrl: string): string | null {
    try {
        const origin = self.location.origin;
        const uvPrefix = self.__uv$config.prefix as string;

        if (encodedUrl.startsWith(origin + uvPrefix)) {
            const encoded = encodedUrl.slice((origin + uvPrefix).length);
            return self.__uv$config.decodeUrl!(encoded.split("?")[0]);
        } else if (encodedUrl.startsWith(origin + SCRAMJET_PREFIX)) {
            const afterPrefix = encodedUrl
                .slice((origin + SCRAMJET_PREFIX).length)
                .split("?")[0];
            const segments = afterPrefix.split("/").filter(Boolean);
            const lastSegment = segments[segments.length - 1];
            if (!lastSegment) return null;
            return decodeScramjetUrl(lastSegment);
        }
    } catch {}
    return null;
}

const bannedCache = new Map<string, { banned: boolean; expiresAt: number }>();

async function checkBanned(originalUrl: string): Promise<boolean> {
    let hostname: string;
    try {
        hostname = new URL(originalUrl).hostname
            .toLowerCase()
            .replace(/^www\./, "");
    } catch {
        return false;
    }

    const cached = bannedCache.get(hostname);
    if (cached && Date.now() < cached.expiresAt) return cached.banned;

    try {
        const res = await fetch(
            `/api/check-banned?url=${encodeURIComponent(originalUrl)}`,
        );
        const data: { banned: boolean } = await res.json();
        bannedCache.set(hostname, {
            banned: data.banned,
            expiresAt: Date.now() + 5 * 60 * 1000,
        });
        return data.banned;
    } catch {
        return false;
    }
}

/**
 * Build the block response for a restricted domain: /ban redirect for a
 * top-level document navigation (recording a strike), 403 otherwise.
 *
 * Gate on request.destination === "document", not request.mode === "navigate".
 * A subframe navigation also has mode "navigate". So a page that embeds a
 * restricted tracker host redirects that iframe to /ban, boots the whole app
 * inside the tracker frame, and posts a violation strike the user did not earn.
 * Only a top-level navigation has destination "document". An embedded frame has
 * destination "iframe".
 */
function bannedBlockResponse(target: string, request: Request): Response {
    if (request.destination === "document") {
        let hostname = target;
        try {
            hostname = new URL(target).hostname;
        } catch {}
        void fetch(`${self.location.origin}/api/violations`, {
            method: "POST",
            credentials: "include",
            keepalive: true,
        }).catch(() => {});
        return Response.redirect(
            `${self.location.origin}/ban?reason=${encodeURIComponent(`${hostname} is restricted by this proxy`)}`,
            302,
        );
    }
    return new Response(null, { status: 403 });
}

/**
 * Inspect a proxied response for a redirect (3xx) whose target is a restricted
 * domain and block it. Closes the search-result / interstitial bypass: a request
 * to an allowed URL (e.g. google.com/url?q=<banned>) whose response redirects to
 * a banned domain would otherwise never be seen by the request-side checkBanned.
 * Handles both proxy-rewritten Location values (/~/scramjet/<enc>) and absolute
 * real URLs.
 */
async function guardBannedRedirect(
    response: Response,
    request: Request,
): Promise<Response | null> {
    if (response.status < 300 || response.status >= 400) return null;
    const loc = response.headers.get("location");
    if (!loc) return null;

    let abs = loc;
    try {
        abs = new URL(loc, request.url).href;
    } catch {}

    let target = decodeProxiedUrl(abs);
    if (!target && /^https?:\/\//i.test(abs)) target = abs;
    if (!target) return null;

    if (!(await checkBanned(target))) return null;
    return bannedBlockResponse(target, request);
}

async function swResponse(event: FetchEvent) {
    const { request } = event;
    const url = new URL(request.url);

    if (url.protocol === "chrome-extension:") {
        try {
            return await fetch(request);
        } catch {
            return new Response(null, {
                status: 200,
                headers: { "x-civil-probe-miss": "1" },
            });
        }
    }

    if (url.pathname.startsWith("/civil-ext/")) {
        const extResponse = await serveCivilExt(request);
        if (extResponse) return extResponse;
    }

    if (url.pathname === "/chii" || url.pathname.startsWith("/chii/")) {
        return fetch(request);
    }

    if (url.pathname === "/civil-ext-bg-frame") {
        return new Response(
            "<!DOCTYPE html><html><head></head><body></body></html>",
            {
                status: 200,
                headers: {
                    "Content-Type": "text/html",
                    "Cache-Control": "no-store",
                },
            },
        );
    }

    if (
        url.pathname.startsWith("/action-popup/") ||
        url.pathname.startsWith("/options-tab/") ||
        url.pathname.startsWith("/ask-tab/")
    ) {
        const prefix = url.pathname.startsWith("/options-tab/")
            ? "/options-tab/"
            : url.pathname.startsWith("/ask-tab/")
              ? "/ask-tab/"
              : "/action-popup/";
        const cacheKey = url.pathname.slice(prefix.length);
        try {
            const opfsRoot = await navigator.storage.getDirectory();
            const cacheDir =
                await opfsRoot.getDirectoryHandle("_civil_popup_cache");
            const fileHandle = await cacheDir.getFileHandle(`${cacheKey}.html`);
            const file = await fileHandle.getFile();
            const html = await file.text();
            return new Response(html, {
                status: 200,
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Cache-Control": "no-store",
                },
            });
        } catch {
            return new Response("Popup not ready", { status: 503 });
        }
    }

    const isUvRequest = url.pathname.startsWith(UV_PREFIX);
    const isScramjetRequest = url.pathname.startsWith(SCRAMJET_PREFIX);
    if (!isUvRequest && !isScramjetRequest) {
        return fetch(request);
    }

    let uv: InstanceType<typeof self.UVServiceWorker>;
    try {
        ({ uv } = await ready);
    } catch (error) {
        console.error("[civil-sw] Proxy runtime initialization failed:", error);
        return new Response("Proxy runtime initialization failed", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
    }

    const originalUrl = decodeProxiedUrl(request.url);

    // An extension content script running inside a proxied page asks for its
    // own files by `chrome.runtime.getURL`, which the shim resolves to the real
    // origin (`/civil-ext/<id>/...`). Scramjet rewrites that fetch like any
    // other, so it arrives here prefixed, and its request handler refuses to
    // proxy the real origin: "attempted to fetch from same origin". Unwrap it
    // and serve the file from OPFS as the unprefixed path would have. Only this
    // path: a proxied page must not reach Civil's own API with the user's
    // cookies.
    if (originalUrl) {
        const extRequest = unwrapCivilExt(originalUrl);
        if (extRequest) {
            const extResponse = await serveCivilExt(extRequest);
            if (extResponse) return extResponse;
        }
    }

    if (
        originalUrl &&
        request.mode === "navigate" &&
        !originalUrl.includes("#bypass=true") &&
        /\.user\.(js|ts)(\?[^#]*)?$/i.test(originalUrl.split("#")[0])
    ) {
        const dnrRedirect = await checkDNRNavRedirect(originalUrl);
        if (dnrRedirect) {
            return Response.redirect(
                proxyRedirectUrl(request.url, dnrRedirect),
                302,
            );
        }
    }

    if (originalUrl && (await checkBanned(originalUrl))) {
        return bannedBlockResponse(originalUrl, request);
    }

    if (isUvRequest) {
        const response = await uv.fetch(event);
        const blocked = await guardBannedRedirect(response, request);
        if (blocked) return blocked;
        return injectChiiPreamble(
            response,
            originalUrl ?? undefined,
            request.mode,
        );
    } else if (
        isScramjetRequest &&
        ($scramjetController as any).shouldRoute(event)
    ) {
        const response = (await ($scramjetController as any).route(
            event,
        )) as Response;
        const blocked = await guardBannedRedirect(response, request);
        if (blocked) return blocked;
        return injectChiiPreamble(
            response,
            originalUrl ?? undefined,
            request.mode,
        );
    }

    return await fetch(request);
}

self.addEventListener("install", (event: ExtendableEvent) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event: ExtendableEvent) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event: FetchEvent) => {
    event.respondWith(
        swResponse(event).catch(() => {
            const raw = event.request.url;
            const decoded = decodeProxiedUrl(raw);
            if (
                raw.startsWith("chrome-extension:") ||
                decoded?.startsWith("chrome-extension:")
            ) {
                return new Response(null, {
                    status: 200,
                    headers: { "x-civil-probe-miss": "1" },
                });
            }
            return new Response(null, {
                status: 502,
                statusText: "Proxy fetch failed",
            });
        }),
    );
});
