// Relative, not `$config/`: vite.config.ts bundles this shim with a bare
// rolldown call that resolves no aliases.
import { getExtensionFile } from "../../../../config/shared/extensionFile";
import { userScripts } from "./apis";
import { extUrl, getCivilBus } from "./util";

type JsEntry = { file?: string; code?: string };
type ScriptDef = { id?: string; js?: JsEntry[]; [k: string]: unknown };
type WorldScript = { world?: string; [k: string]: unknown };

const TM_SCRIPTS_PREFIX = "window.tm_scripts=window.tm_scripts||null;";

/** USER_SCRIPT world first, then MAIN, then the rest. */
function sortByWorld(scripts: WorldScript[]): WorldScript[] {
    const order = (w: string | undefined) =>
        w === "USER_SCRIPT" ? 0 : w === "MAIN" ? 1 : 2;
    return scripts.toSorted((a, b) => order(a.world) - order(b.world));
}

function patchFrameCheck(file: string | undefined, code: string): string {
    if (!file || !/(?:^|\/)(?:content|page)\.js$/.test(file)) return code;
    return code.replace(/[A-Za-z_$][\w$]*==[A-Za-z_$][\w$]*\.top\b/g, "(!0)");
}

/**
 * Load a file's raw text via fetch, falling back to direct OPFS read (the
 * path the SW uses to store ext files). Returns null if both fail.
 */
async function loadRaw(extId: string, file: string): Promise<string | null> {
    try {
        const url = file.startsWith("http") ? file : extUrl(extId, file);
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 8000);
        const resp = await fetch(url, { signal: ac.signal }).finally(() =>
            clearTimeout(t),
        );
        if (resp.ok) return await resp.text();
    } catch {
        /* fall through to OPFS */
    }
    try {
        return await (await getExtensionFile(extId, file)).text();
    } catch {
        return null;
    }
}

async function resolveJsEntry(extId: string, entry: JsEntry): Promise<JsEntry> {
    if (entry.file) {
        const raw = await loadRaw(extId, entry.file);
        return raw != null ? { code: patchFrameCheck(entry.file, raw) } : entry;
    }
    // In userscripts-dynamic mode TM inlines content.js into a {code} entry
    // built as `window.tm_scripts=window.tm_scripts||null;` + (await
    // fetch(getURL("content.js"))).text(). In BiB the background's own fetch
    // of its content.js returns empty, so only the ~133 char prefix+sourceURL
    // stub survives and the bridge (which installs the window.pagejs setter to
    // complete the page.js handshake) never runs. Detect that stub and splice
    // in the real content.js, which we CAN load.
    if (
        typeof entry.code === "string" &&
        entry.code.includes(TM_SCRIPTS_PREFIX) &&
        entry.code.length < 4000
    ) {
        const raw = await loadRaw(extId, "content.js");
        if (raw != null && raw.length > 4000) {
            return {
                code:
                    `${TM_SCRIPTS_PREFIX}\n` +
                    patchFrameCheck("content.js", raw) +
                    `\n//# sourceURL=${extUrl(extId, "content.js")}\n`,
            };
        }
    }
    return entry;
}

async function resolveScript(extId: string, s: ScriptDef): Promise<ScriptDef> {
    if (!s.js?.length) return s;
    const js = await Promise.all(s.js.map(e => resolveJsEntry(extId, e)));
    return { ...s, js };
}

/** Registered scripts, kept in the batches register() received them in. */
class UserScriptStore {
    readonly batches: unknown[][] = [];
    readonly ids = new Set<string>();

    sorted(): WorldScript[] {
        return sortByWorld(this.batches.flat() as WorldScript[]);
    }

    add(batch: ScriptDef[]): void {
        this.batches.push(batch);
        for (const s of batch) if (s?.id) this.ids.add(s.id);
    }

    remove(ids: string[] | undefined): void {
        if (!ids) {
            this.batches.length = 0;
            this.ids.clear();
            return;
        }
        for (const id of ids) this.ids.delete(id);
        // Rebuild the batches without the unregistered scripts.
        for (let i = this.batches.length - 1; i >= 0; i--) {
            this.batches[i] = (this.batches[i] as { id?: string }[]).filter(
                s => !s.id || !ids.includes(s.id),
            );
            if (this.batches[i].length === 0) this.batches.splice(i, 1);
        }
    }
}

/** Broadcasts the whole sorted set, coalescing calls made within 100 ms. */
function debouncedBroadcast(bus: BroadcastChannel, store: UserScriptStore) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return () => {
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            const all = store.sorted();
            if (!all.length) return;
            bus.postMessage({ kind: "userScriptRegister", scripts: all });
        }, 100);
    };
}

/**
 * chrome.userScripts in the background. register() must NOT inject into the
 * background iframe's document: it stores registrations and broadcasts them.
 * It also listens for "contentReady" from content shims, so it can replay
 * stored scripts to pages that load AFTER register() was first called.
 */
export function buildBackgroundUserScripts(extId: string) {
    const bus = getCivilBus(extId);
    const store = new UserScriptStore();
    const scheduleBroadcast = debouncedBroadcast(bus, store);

    bus.addEventListener("message", (ev: MessageEvent) => {
        if ((ev.data as { kind?: string })?.kind !== "contentReady") return;
        const all = store.sorted();
        if (all.length > 0) {
            bus.postMessage({ kind: "userScriptRegister", scripts: all });
        }
    });

    return {
        ...userScripts,
        register: async (scripts: unknown[], cb?: () => void) => {
            const resolved = await Promise.all(
                (scripts as ScriptDef[]).map(s => resolveScript(extId, s)),
            );
            store.add(resolved);
            // Debounced so concurrent register() calls (common when TM
            // registers page.js and content.js in separate calls) reach
            // content as one complete, ordered userScriptRegister message
            // with USER_SCRIPT before MAIN.
            scheduleBroadcast();
            if (cb) cb();
        },
        unregister: (filter?: { ids?: string[] }, cb?: () => void) => {
            store.remove(filter?.ids);
            if (cb) cb();
            return Promise.resolve();
        },
        getScripts: (_filter?: unknown, cb?: (s: unknown[]) => void) => {
            const all = store.batches.flat();
            if (cb) cb(all);
            return Promise.resolve(all);
        },
    };
}
