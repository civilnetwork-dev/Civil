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

type RegisteredScript = chrome.scripting.RegisteredContentScript;
type InjectionResult = chrome.scripting.InjectionResult<unknown>;

function toInjectionResult(result: unknown): InjectionResult {
    return { frameId: 0, result, documentId: "" } as InjectionResult;
}

/** Background: store registered content scripts and replay them to new
 *  content pages that send "contentReady". */
function replayToNewPages(
    bus: BroadcastChannel,
    registered: Map<string, RegisteredScript>,
): void {
    bus.addEventListener("message", (e: MessageEvent) => {
        const d = e.data as { kind?: string };
        if (d?.kind !== "contentReady") return;
        const scripts = [...registered.values()];
        if (scripts.length) {
            bus.postMessage({
                kind: "contentScriptRegister",
                scripts,
            } satisfies ExecBusMsg);
        }
    });
}

/** Content page: inject registered scripts and run the background's
 *  executeScript requests, answering each with its results. */
function serveBackgroundRequests(bus: BroadcastChannel, extId: string): void {
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

/** Background: asks the pages over the bus and waits up to 3 s for one to answer. */
function executeViaBus(
    bus: BroadcastChannel,
    inj: Record<string, unknown>,
    tabId: number | null,
): Promise<InjectionResult[]> {
    const reqId = Math.random().toString(36).slice(2);
    const funcStr =
        typeof inj.func === "function"
            ? (inj.func as () => unknown).toString()
            : undefined;
    return new Promise<InjectionResult[]>(resolve => {
        const onResult = (e: MessageEvent) => {
            const d = e.data as ExecBusMsg;
            if (d?.kind === "executeScriptResult" && d.reqId === reqId) {
                bus.removeEventListener("message", onResult);
                resolve(d.results.map(toInjectionResult));
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
    });
}

/** Content/popup context: execute locally. */
async function executeLocally(
    inj: Record<string, unknown>,
    extId: string,
): Promise<InjectionResult[]> {
    if (typeof inj.func === "function") {
        try {
            const args = (inj.args ?? []) as unknown[];
            const result = await (inj.func as (...a: unknown[]) => unknown)(
                ...args,
            );
            return [toInjectionResult(result)];
        } catch (e) {
            console.warn(
                "[civil-ext-shim] scripting.executeScript func threw:",
                e,
            );
            return [];
        }
    }
    for (const file of (inj.files as string[] | undefined) ?? []) {
        try {
            const script = document.createElement("script");
            // Resolve relative paths to extension URL
            script.src = extensionAssetUrl(extId, file);
            document.head?.appendChild(script);
        } catch {}
    }
    return [];
}

/** chrome.scripting's dynamic content script registrations. */
class ContentScriptRegistry {
    readonly scripts = new Map<string, RegisteredScript>();

    constructor(
        private readonly bus: BroadcastChannel,
        private readonly isBackground: boolean,
    ) {}

    register(scripts: RegisteredScript[], cb?: () => void) {
        for (const s of scripts) {
            if (s.id) this.scripts.set(s.id, s);
        }
        // Background: broadcast so active content pages inject immediately;
        // new content pages will get them via the contentReady handshake.
        if (this.isBackground) {
            this.bus.postMessage({
                kind: "contentScriptRegister",
                scripts,
            } satisfies ExecBusMsg);
        }
        return resolved(undefined, cb);
    }

    unregister(filter?: { ids?: string[] }, cb?: () => void) {
        if (!filter?.ids) {
            this.scripts.clear();
        } else {
            for (const id of filter.ids) this.scripts.delete(id);
        }
        return resolved(undefined, cb);
    }

    get(
        filter?: { ids?: string[] } | ((s: RegisteredScript[]) => void),
        cb?: (scripts: RegisteredScript[]) => void,
    ) {
        if (typeof filter === "function") {
            cb = filter;
            filter = undefined;
        }
        const all = [...this.scripts.values()];
        const ids = filter?.ids;
        const result = ids ? all.filter(s => ids.includes(s.id ?? "")) : all;
        return resolved(result, cb);
    }

    update(scripts: RegisteredScript[], cb?: () => void) {
        for (const s of scripts) {
            if (s.id && this.scripts.has(s.id)) {
                this.scripts.set(s.id, { ...this.scripts.get(s.id)!, ...s });
            }
        }
        return resolved(undefined, cb);
    }
}

export function buildScriptingAPI(contextType = "content", extId = "unknown") {
    const bus = getCivilBus(extId);
    const isBackground = contextType === "background";
    const registry = new ContentScriptRegistry(bus, isBackground);

    if (isBackground) replayToNewPages(bus, registry.scripts);
    else serveBackgroundRequests(bus, extId);

    function executeScript(
        injection: chrome.scripting.ScriptInjection<unknown[], unknown>,
        cb?: (results: InjectionResult[]) => void,
    ): Promise<InjectionResult[]> {
        const inj = injection as unknown as Record<string, unknown>;
        const tabId =
            (inj.target as { tabId?: number } | undefined)?.tabId ?? null;
        const run = isBackground
            ? executeViaBus(bus, inj, tabId)
            : executeLocally(inj, extId);
        return run.then(r => {
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

    return {
        executeScript,
        insertCSS,
        removeCSS: (
            _injection: chrome.scripting.CSSInjection,
            cb?: () => void,
        ) => resolved(undefined, cb),
        registerContentScripts: registry.register.bind(registry),
        unregisterContentScripts: registry.unregister.bind(registry),
        getRegisteredContentScripts: registry.get.bind(registry),
        updateContentScripts: registry.update.bind(registry),
        ExecutionWorld: {
            ISOLATED: "ISOLATED",
            MAIN: "MAIN",
            USER_SCRIPT: "USER_SCRIPT",
        } as const,
    };
}
