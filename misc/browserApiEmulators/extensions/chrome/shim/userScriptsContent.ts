import { matchesAnyPattern } from "./matchPattern";
import { extUrl, getCivilBus } from "./util";

type TmScripts = Record<
    string,
    { entry?: { code?: string; script?: { name?: string } } }
>;

type RegisteredScript = {
    id?: string;
    matches?: string[];
    excludeMatches?: string[];
    js?: Array<{ file?: string; code?: string }>;
    world?: string;
};

type SendMessage = (message: unknown) => unknown;

// TM's USER_SCRIPT-world scripts are injected via nativeEval, which bypasses
// Scramjet's location proxy, so reads of `window.location.href` return the raw
// Scramjet proxy URL instead of the real page URL. window.location itself is
// non-configurable and can't be overridden. Instead we rewrite location.href
// READS in the injected code to prefer window.__cRealUrl (the real page URL,
export function patchUserScriptLocation(code: string): string {
    if (typeof code !== "string" || !code.includes("location")) return code;
    return code.replace(
        /(^|[^.\w$])((?:[A-Za-z_$][\w$]*\.)?location\.href)(?!\s*=(?!=))/g,
        (_m, pre, expr) => `${pre}(window.__cRealUrl||${expr})`,
    );
}

/** Evaluates each not-yet-run tm_scripts body; returns nothing, records in `ran`/`reported`. */
function runTmEntries(
    w: Record<string, unknown>,
    extId: string,
    ran: Set<string>,
    reported: Record<string, string>,
): void {
    const ts = w.tm_scripts as TmScripts | undefined;
    if (!ts) return;
    const nativeEval = w.__civilNativeEval as
        | ((c: string) => unknown)
        | undefined;
    for (const [uuid, rec] of Object.entries(ts)) {
        if (ran.has(uuid)) continue;
        const code = rec?.entry?.code;
        if (typeof code !== "string" || !code) continue;
        ran.add(uuid);
        const patched = patchUserScriptLocation(code);
        try {
            if (nativeEval) nativeEval(patched);
            // oxlint-disable-next-line no-eval -- global-scope evaluation is the emulated API's contract
            else (0, eval)(patched);
            reported[uuid] = rec?.entry?.script?.name ?? uuid;
        } catch (err) {
            console.warn(
                `[civil-ext:content:${extId}] direct-exec error uuid=${uuid}:`,
                err,
            );
        }
    }
}

/**
 * Report executed scripts to TM's background so the popup/badge reflect
 * them. page.js normally sends this "prepare" cleanup message after
 * injecting; since we bypass its vault, emit it ourselves. The background
 * handler records each uuid as executed+active (Oh) and refreshes the badge.
 * Re-sent every tick (not just when a script is newly executed): the message
 * rides the BroadcastChannel bus, which has no buffering, so on a full app
 * reload the background may not be listening yet when scripts first run.
 * prepare/cleanup is idempotent (Oh dedups per uuid), so repeated sends are
 * harmless and guarantee delivery once the background warms up.
 */
function reportRunning(
    sendMessage: SendMessage,
    url: string,
    reported: Record<string, string>,
    extId: string,
): void {
    if (!Object.keys(reported).length) return;
    try {
        sendMessage({
            method: "prepare",
            cleanup: true,
            url,
            scripts: { ...reported },
        });
    } catch (err) {
        console.warn(
            `[civil-ext:content:${extId}] direct-exec running-report failed:`,
            err,
        );
    }
}

/**
 * Direct-exec fallback. TM's page.js delivers @grant-none bodies through a
 * blob-URL <script> vault; the page's CSP (e.g. Google) blocks blob: scripts
 * under Scramjet, so the body silently never runs even though the handshake
 * completes. tm_scripts is already built AND URL-gated by the populator (only
 * matching scripts are present), and each entry.code is the bare userscript
 * source (mkCompat does text-only transforms, no function wrapper), so we
 * eval matching bodies directly in the page context here, skipping the
 * Scramjet-hostile vault entirely.
 */
function startDirectExec(
    extId: string,
    sendMessage: SendMessage,
    currentUrl: () => string | undefined,
): void {
    try {
        const w = window as unknown as Record<string, unknown>;
        if (w.__civilDirectExec) return;
        w.__civilDirectExec = true;
        const ran = new Set<string>();
        // Accumulated across ticks so the running-report can be re-sent even
        // after a uuid stops being "newly executed".
        const reported: Record<string, string> = {};
        let tries = 0;
        const poll = () => {
            runTmEntries(w, extId, ran, reported);
            reportRunning(
                sendMessage,
                currentUrl() ?? String(w.__cRealUrl),
                reported,
                extId,
            );
            if (++tries < 50) setTimeout(poll, 150);
        };
        setTimeout(poll, 200);
    } catch {}
}

/**
 * Runs one userScript's code in this page with the preamble ahead of it, by
 * the native eval Scramjet never wrapped when one was saved.
 */
function runUserScriptCode(code: string, pageUrl: string): void {
    const targetWin = window as unknown as Record<string, unknown>;

    // Get the native eval saved before Scramjet runs.
    const nativeEval = targetWin.__civilNativeEval as
        | ((code: string) => unknown)
        | undefined;

    // Combined preamble: patch eval/Function to native
    // (so TM's runner doesn't go through Scramjet's
    // rewriter), rewrite Scramjet proxy URLs in
    // sendMessage calls, and expose real page URL.
    // Both MAIN and USER_SCRIPT worlds run in the same
    // window (Scramjet proxy iframe), so window.postMessage
    // between them works without any bridge.
    const _preamble = buildUserScriptPreamble(pageUrl);
    // window.location can't be redefined and nativeEval
    // bypasses Scramjet's location proxy, so TM's
    // injected USER_SCRIPT code would read the raw
    // proxy URL. Rewrite its location reads to prefer
    // window.__cRealUrl (set in the preamble).
    const _injectCode = patchUserScriptLocation(code);
    if (nativeEval) {
        // nativeEval is a stored reference, not the
        // eval keyword, so calling it is always an
        // indirect eval → global scope.
        nativeEval(_preamble);
        nativeEval(_injectCode);
    } else {
        try {
            // Indirect eval → global scope (not this function's scope).
            // `(0, eval)`, not `const e = eval; e(...)`: rolldown inlines that
            // alias back into a direct eval when it bundles the shim.
            // oxlint-disable-next-line no-eval -- global-scope evaluation is the emulated API's contract
            (0, eval)(_preamble + ";" + _injectCode);
        } catch {
            // eslint-disable-next-line no-new-func
            new Function(_preamble + ";" + _injectCode)();
        }
    }
}

const USER_SCRIPT_PREAMBLE = `(function(){
try {
  var __nEv=window.__civilNativeEval;
  if(__nEv){
    try{Object.defineProperty(window,'eval',{value:__nEv,writable:true,configurable:true});}catch(_){window.eval=__nEv;}
    try{
      var __nFn=__nEv('(function(){return Function})')();
      Object.defineProperty(window,'Function',{value:__nFn,writable:true,configurable:true});
    }catch(_){}
  }
  var __cRealUrl=__CIVIL_REAL_URL__;
  // window.location cannot be redefined (non-configurable) on the real
  // window, and our nativeEval injection bypasses Scramjet's location
  // proxy, so TM's USER_SCRIPT-world code reads the raw proxy URL. We can't
  // fix the global; instead we expose the real URL + a fake Location object
  // on window, and string-patch each injected script's location reads to
  // prefer window.__cRealUrl (see patchUserScriptLocation in the content
  // injector). The TM tm_scripts populator gates each @match on
  // window.location.href, so without this it skips every script.
  window.__cRealUrl=__cRealUrl;
  try{
    var __cU=new URL(__cRealUrl);
    var __cFakeLoc={
      href:__cU.href,protocol:__cU.protocol,host:__cU.host,
      hostname:__cU.hostname,port:__cU.port,pathname:__cU.pathname,
      search:__cU.search,hash:__cU.hash,origin:__cU.origin,
      toString:function(){return __cU.href;},
      assign:function(x){return window.location.assign(x);},
      replace:function(x){return window.location.replace(x);},
      reload:function(){return window.location.reload();}
    };
    window.__cFakeLoc=__cFakeLoc;
  }catch(_){}
  var __cRe=/^\\/~\\/(scramjet|uv)\\//;
  var __cReAbs=new RegExp('^https?:\\/\\/[^/]+\\/~\\/(scramjet|uv)\\/');
  function __cRewrite(obj) {
    if(!obj||typeof obj!=='object') return obj;
    var o={};
    var ks=Object.keys(obj);
    for(var i=0;i<ks.length;i++){
      var k=ks[i],v=obj[k];
      if(typeof v==='string'&&(__cRe.test(v)||__cReAbs.test(v))){o[k]=__cRealUrl;}
      else if(v&&typeof v==='object'&&!Array.isArray(v)){o[k]=__cRewrite(v);}
      else{o[k]=v;}
    }
    return o;
  }
  var __cChr=window.chrome;
  if(__cChr&&__cChr.runtime){
    if(__cChr.runtime.sendMessage){
      var __cOrig=__cChr.runtime.sendMessage.bind(__cChr.runtime);
      __cChr.runtime.sendMessage=function(){
        var a=Array.prototype.slice.call(arguments);
        if(typeof a[0]==='object'&&a[0]!==null){a[0]=__cRewrite(a[0]);}
        else if(typeof a[0]==='string'&&a[1]&&typeof a[1]==='object'){a[1]=__cRewrite(a[1]);}
        return __cOrig.apply(__cChr.runtime,a);
      };
    }
    if(__cChr.runtime.connect){
      var __cConnOrig=__cChr.runtime.connect.bind(__cChr.runtime);
      __cChr.runtime.connect=function(){
        var port=__cConnOrig.apply(__cChr.runtime,arguments);
        if(port&&port.postMessage){
          var __cPMOrig=port.postMessage.bind(port);
          port.postMessage=function(msg){
            if(msg&&typeof msg==='object') msg=__cRewrite(msg);
            return __cPMOrig(msg);
          };
        }
        return port;
      };
    }
  }
} catch(_){}
})();`;

/**
 * The script that runs before each userScript TM injects: it points eval and
 * Function back at the native ones (so TM's runner skips Scramjet's
 * rewriter), rewrites Scramjet proxy URLs in sendMessage calls, and exposes
 * the page's real URL.
 */
function buildUserScriptPreamble(realUrl: string): string {
    const safeUrl = JSON.stringify(realUrl);
    return USER_SCRIPT_PREAMBLE.replace("__CIVIL_REAL_URL__", () => safeUrl);
}

/** Loads one userScript file into this page by a script tag. */
function appendUserScriptFile(extId: string, file: string): void {
    const el = document.createElement("script");
    el.type = "text/javascript";
    el.src = file.startsWith("http") ? file : extUrl(extId, file);
    (document.head ?? document.documentElement).appendChild(el);
}

function shouldInject(
    s: RegisteredScript,
    pageUrl: string,
    injected: Set<string>,
): boolean {
    if (!s.js?.length) return false;
    if (s.id && injected.has(s.id)) return false;
    if (s.matches && !matchesAnyPattern(s.matches, pageUrl)) return false;
    if (s.excludeMatches && matchesAnyPattern(s.excludeMatches, pageUrl))
        return false;
    return true;
}

function injectScript(s: RegisteredScript, pageUrl: string, extId: string) {
    for (const jsEntry of s.js ?? []) {
        try {
            if (jsEntry.code) {
                runUserScriptCode(jsEntry.code, pageUrl);
            } else if (jsEntry.file) {
                appendUserScriptFile(extId, jsEntry.file);
            }
        } catch (err) {
            console.warn(
                `[civil-ext:content:${extId}] userScript inject error:`,
                err,
            );
        }
    }
}

/**
 * Content context: listen for userScript registrations broadcast by the
 * background (via our userScripts.register override). Execute matching
 * scripts in the page context, mirroring Chrome's userScripts injection.
 * Send "contentReady" AFTER registering the listener so that scripts
 * registered before this page loaded are replayed by the background.
 */
export function listenForUserScripts(
    extId: string,
    currentUrl: () => string | undefined,
    sendMessage: SendMessage,
): void {
    const bus = getCivilBus(extId);
    // Dedup: background re-broadcasts the full accumulated script set on
    // every register() call AND on contentReady replay. Without dedup,
    // content.js/page.js get injected multiple times → the second
    // content.js reinstalls its window.pagejs setter AFTER page.js already
    // assigned, so the setter waits forever for an assignment that already
    // happened → bridge stuck (no throw). Inject each script id once.
    const injected = new Set<string>();
    bus.addEventListener("message", (e: MessageEvent) => {
        const data = e.data as { kind?: string; scripts?: unknown[] };
        if (data?.kind !== "userScriptRegister" || !data.scripts) return;
        // Prefer bib.currentTab.url (baked in at inject time by
        // injectExtensionShimsIntoIframe with the real decoded URL)
        // over window.location.href, which returns the scramjet proxy
        // URL for scripts injected from the parent frame.
        const pageUrl =
            currentUrl() ??
            (typeof window !== "undefined" ? window.location.href : "");
        for (const script of data.scripts as RegisteredScript[]) {
            if (!shouldInject(script, pageUrl, injected)) continue;
            if (script.id) injected.add(script.id);
            injectScript(script, pageUrl, extId);
        }
        startDirectExec(extId, sendMessage, currentUrl);
    });
    // Announce this content page is ready. Background replays any
    // userScripts registered before this shim was injected.
    bus.postMessage({ kind: "contentReady" });
}
