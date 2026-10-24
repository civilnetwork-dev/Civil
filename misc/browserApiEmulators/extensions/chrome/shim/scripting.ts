import { matchesAnyPattern } from "./matchPattern";
import { extUrl, getBiB, getCivilBus, resolved } from "./util";

type ExecBusMsg =
    | {
          kind: "executeScript";
          reqId: string;
          tabId: number | null;
          code?: string;
          files?: string[];
          funcStr?: string;
          args?: unknown[];
      }
    | { kind: "executeScriptResult"; reqId: string; results: unknown[] }
    | {
          kind: "contentScriptRegister";
          scripts: chrome.scripting.RegisteredContentScript[];
      };

/** A script or stylesheet path from an extension: absolute URLs stay as they
 *  are, relative ones resolve against the extension. */
function extensionAssetUrl(extId: string, file: string): string {
    return file.startsWith("http") ? file : extUrl(extId, file);
}

/** Adds the registered content scripts whose patterns cover this page. */
function injectRegisteredScripts(
    extId: string,
    scripts: chrome.scripting.RegisteredContentScript[],
): void {
    const pageUrl =
        getBiB().currentTab?.url ??
        (typeof window !== "undefined" ? window.location.href : "");
    console.log(
        `[civil-ext:scripting:content:${extId}] contentScriptRegister received`,
        scripts,
        "pageUrl=",
        pageUrl,
    );
    for (const script of scripts) {
        const patterns = script.matches;
        if (patterns && !matchesAnyPattern(patterns, pageUrl)) continue;
        for (const file of script.js ?? []) {
            try {
                const el = document.createElement("script");
                // Resolve relative paths to extension URL
                el.src = extensionAssetUrl(extId, file);
                document.head?.appendChild(el);
            } catch {}
        }
        for (const file of script.css ?? []) {
            try {
                const el = document.createElement("link");
                el.rel = "stylesheet";
                el.href = extensionAssetUrl(extId, file);
                document.head?.appendChild(el);
            } catch {}
        }
    }
}

/** Runs a background's executeScript request in this page and returns what
 *  it produced. A request that throws produces nothing. */
function runInjection(
    extId: string,
    {
        code,
        files,
        funcStr,
        args,
    }: Extract<ExecBusMsg, { kind: "executeScript" }>,
): unknown[] {
    const results: unknown[] = [];
    try {
        if (funcStr) {
            // eslint-disable-next-line no-new-func
            const fn = new Function(`return (${funcStr})`)() as (
                ...a: unknown[]
            ) => unknown;
            results.push(fn(...(args ?? [])));
        } else if (code) {
            // eslint-disable-next-line no-new-func
            results.push(new Function(code)());
        } else if (files) {
            for (const file of files) {
                const s = document.createElement("script");
                s.src = extensionAssetUrl(extId, file);
                document.head?.appendChild(s);
            }
        }
    } catch (err) {
        console.warn("[civil-ext-shim] executeScript from bus threw:", err);
    }
    return results;
}

export function buildScriptingAPI(contextType = "content", extId = "unknown") {
    const _registeredScripts = new Map<
        string,
        chrome.scripting.RegisteredContentScript
    >();
    const bus = getCivilBus(extId);

    // Background: store registered content scripts and replay to new content
    // pages that send "contentReady". Also broadcast immediately for pages
    // already active.
    if (contextType === "background") {
        bus.addEventListener("message", (e: MessageEvent) => {
            const d = e.data as { kind?: string };
            if (d?.kind !== "contentReady") return;
            const scripts = [..._registeredScripts.values()];
            if (scripts.length) {
                bus.postMessage({
                    kind: "contentScriptRegister",
                    scripts,
                } satisfies ExecBusMsg);
            }
        });
    }

    // Content page: receive contentScriptRegister and inject matching scripts.
    if (contextType !== "background") {
        bus.addEventListener("message", (e: MessageEvent) => {
            const data = e.data as ExecBusMsg;

            if (data?.kind === "contentScriptRegister") {
                injectRegisteredScripts(extId, data.scripts);
                return;
            }

            if (data?.kind !== "executeScript") return;
            bus.postMessage({
                kind: "executeScriptResult",
                reqId: data.reqId,
                results: runInjection(extId, data),
            } satisfies ExecBusMsg);
        });
    }

    function executeScript(
        injection: chrome.scripting.ScriptInjection<unknown[], unknown>,
        cb?: (results: chrome.scripting.InjectionResult<unknown>[]) => void,
    ): Promise<chrome.scripting.InjectionResult<unknown>[]> {
        return (async () => {
            const inj = injection as unknown as Record<string, unknown>;
            const tabId =
                (inj.target as { tabId?: number } | undefined)?.tabId ?? null;

            // If background, broadcast to page contexts
            if (contextType === "background") {
                const reqId = Math.random().toString(36).slice(2);
                let funcStr: string | undefined;
                if (typeof inj.func === "function") {
                    funcStr = (inj.func as () => unknown).toString();
                }
                return new Promise<chrome.scripting.InjectionResult<unknown>[]>(
                    resolve => {
                        const onResult = (e: MessageEvent) => {
                            const d = e.data as ExecBusMsg;
                            if (
                                d?.kind === "executeScriptResult" &&
                                d.reqId === reqId
                            ) {
                                bus.removeEventListener("message", onResult);
                                resolve(
                                    d.results.map(
                                        result =>
                                            ({
                                                frameId: 0,
                                                result,
                                                documentId: "",
                                            }) as chrome.scripting.InjectionResult<unknown>,
                                    ),
                                );
                            }
                        };
                        bus.addEventListener("message", onResult);
                        bus.postMessage({
                            kind: "executeScript",
                            reqId,
                            tabId,
                            code: inj.code as string | undefined,
                            files: inj.files as string[] | undefined,
                            funcStr,
                            args: inj.args as unknown[] | undefined,
                        } satisfies ExecBusMsg);
                        setTimeout(() => {
                            bus.removeEventListener("message", onResult);
                            resolve([]);
                        }, 3000);
                    },
                );
            }

            // Content/popup context: execute locally
            if (typeof inj.func === "function") {
                try {
                    const args = (inj.args ?? []) as unknown[];
                    const result = await (
                        inj.func as (...a: unknown[]) => unknown
                    )(...args);
                    return [
                        {
                            frameId: 0,
                            result,
                            documentId: "",
                        } as chrome.scripting.InjectionResult<unknown>,
                    ];
                } catch (e) {
                    console.warn(
                        "[civil-ext-shim] scripting.executeScript func threw:",
                        e,
                    );
                    return [];
                }
            }
            const files = inj.files as string[] | undefined;
            if (files) {
                for (const file of files) {
                    try {
                        const script = document.createElement("script");
                        // Resolve relative paths to extension URL
                        script.src = extensionAssetUrl(extId, file);
                        document.head?.appendChild(script);
                    } catch {}
                }
            }
            return [];
        })().then(r => {
            if (cb) cb(r);
            return r;
        });
    }

    function insertCSS(
        injection: chrome.scripting.CSSInjection,
        cb?: () => void,
    ): Promise<void> {
        const inj = injection as unknown as Record<string, unknown>;
        if (inj.css) {
            const el = document.createElement("style");
            el.textContent = inj.css as string;
            document.head?.appendChild(el);
        }
        return resolved(undefined, cb);
    }

    function removeCSS(
        _injection: chrome.scripting.CSSInjection,
        cb?: () => void,
    ) {
        return resolved(undefined, cb);
    }

    function registerContentScripts(
        scripts: chrome.scripting.RegisteredContentScript[],
        cb?: () => void,
    ) {
        for (const s of scripts) {
            if (s.id) _registeredScripts.set(s.id, s);
        }
        // Background: broadcast so active content pages inject immediately;
        // new content pages will get them via the contentReady handshake.
        if (contextType === "background") {
            bus.postMessage({
                kind: "contentScriptRegister",
                scripts,
            } satisfies ExecBusMsg);
        }
        return resolved(undefined, cb);
    }

    function unregisterContentScripts(
        filter?: { ids?: string[] },
        cb?: () => void,
    ) {
        if (!filter?.ids) {
            _registeredScripts.clear();
        } else {
            for (const id of filter.ids) _registeredScripts.delete(id);
        }
        return resolved(undefined, cb);
    }

    function getRegisteredContentScripts(
        filter?:
            | { ids?: string[] }
            | ((s: chrome.scripting.RegisteredContentScript[]) => void),
        cb?: (scripts: chrome.scripting.RegisteredContentScript[]) => void,
    ) {
        if (typeof filter === "function") {
            cb = filter;
            filter = undefined;
        }
        const all = [..._registeredScripts.values()];
        const result = (filter as { ids?: string[] } | undefined)?.ids
            ? all.filter(s =>
                  ((filter as { ids?: string[] }).ids ?? []).includes(
                      s.id ?? "",
                  ),
              )
            : all;
        return resolved(result, cb);
    }

    function updateContentScripts(
        scripts: chrome.scripting.RegisteredContentScript[],
        cb?: () => void,
    ) {
        for (const s of scripts) {
            if (s.id && _registeredScripts.has(s.id)) {
                _registeredScripts.set(s.id, {
                    ..._registeredScripts.get(s.id)!,
                    ...s,
                });
            }
        }
        return resolved(undefined, cb);
    }

    return {
        executeScript,
        insertCSS,
        removeCSS,
        registerContentScripts,
        unregisterContentScripts,
        getRegisteredContentScripts,
        updateContentScripts,
        ExecutionWorld: {
            ISOLATED: "ISOLATED",
            MAIN: "MAIN",
            USER_SCRIPT: "USER_SCRIPT",
        } as const,
    };
}
