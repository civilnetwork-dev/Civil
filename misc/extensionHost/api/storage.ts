/** chrome.storage.{local,sync,session}. In-memory only — no IndexedDB, since
 *  there's no page for IndexedDB to belong to. */

import type { ExtensionState, StorageArea } from "../state";
import { crossRealm } from "./clone";

type Keys = string | string[] | Record<string, unknown> | null | undefined;

function selectKeys(
    map: Map<string, unknown>,
    keys: Keys,
): Record<string, unknown> {
    if (keys == null) return Object.fromEntries(map);
    if (typeof keys === "string")
        return map.has(keys) ? { [keys]: map.get(keys) } : {};
    if (Array.isArray(keys)) {
        const out: Record<string, unknown> = {};
        for (const k of keys) if (map.has(k)) out[k] = map.get(k);
        return out;
    }
    // Object form: each key is a default, returned when the stored value is absent.
    const out: Record<string, unknown> = {};
    for (const [k, def] of Object.entries(keys))
        out[k] = map.has(k) ? map.get(k) : def;
    return out;
}

function buildArea(state: ExtensionState, area: StorageArea) {
    const map = state.storage[area];
    return {
        get: async (keys?: Keys) => selectKeys(map, keys),
        set: async (items: Record<string, unknown>) => {
            for (const [k, v] of Object.entries(items))
                map.set(k, crossRealm(v));
        },
        remove: async (keys: string | string[]) => {
            for (const k of Array.isArray(keys) ? keys : [keys]) map.delete(k);
        },
        clear: async () => map.clear(),
        getBytesInUse: async () =>
            JSON.stringify(Object.fromEntries(map)).length,
    };
}

/** The enterprise-policy area. Read-only by design in Chrome: it is written
 *  by the device's admin console, never by the extension, and a `set` on it
 *  rejects. Five of the tracked filters read their configuration from here —
 *  allowlists, block categories, the tenant to report to — so seeding it is
 *  how a test puts an extension into the state a real managed Chromebook
 *  would. `LoadOptions.managedStorage` is what fills it. */
function buildManagedArea(state: ExtensionState) {
    const area = buildArea(state, "managed");
    return {
        get: area.get,
        getBytesInUse: area.getBytesInUse,
        set: async () => {
            throw new Error("storage.managed is read-only");
        },
        remove: async () => {
            throw new Error("storage.managed is read-only");
        },
        clear: async () => {
            throw new Error("storage.managed is read-only");
        },
        // A real, present key (not absent), so `withFallback` — which only
        // catches missing properties — would not have caught its absence:
        // `chrome.storage.managed.onChanged.addListener(...)` in a real
        // bundle (linewizeConnect) read `.addListener` off `undefined` and
        // threw, same failure class stub.ts exists to prevent, one level
        // deeper than that wrapping reaches.
        onChanged: {
            addListener: () => {},
            removeListener: () => {},
            hasListener: () => false,
        },
    };
}

export function buildStorage(state: ExtensionState) {
    return {
        local: buildArea(state, "local"),
        sync: buildArea(state, "sync"),
        session: buildArea(state, "session"),
        managed: buildManagedArea(state),
        onChanged: {
            addListener: () => {},
            removeListener: () => {},
            hasListener: () => false,
        },
    };
}
