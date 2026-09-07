import type { StorageData } from "../types";
import { CivilEvent } from "./event";
import { clone, dual, getCivilBus } from "./util";

type StorageChanges = Record<
    string,
    { oldValue?: unknown; newValue?: unknown }
>;
type StorageArea = "local" | "sync" | "session" | "managed";

type StorageBusMsg = {
    kind: "storageChanged";
    extId: string;
    area: StorageArea;
    changes: StorageChanges;
};

function openIDB(extId: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(`civil-ext-idb-${extId}`, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            for (const area of [
                "local",
                "sync",
                "session",
                "managed",
            ] as StorageArea[]) {
                if (!db.objectStoreNames.contains(area)) {
                    db.createObjectStore(area);
                }
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function idbGetAll(db: IDBDatabase, area: StorageArea): Promise<StorageData> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(area, "readonly");
        const store = tx.objectStore(area);
        const result: StorageData = {};
        const curReq = store.openCursor();
        curReq.onsuccess = e => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>)
                .result;
            if (cursor) {
                result[cursor.key as string] = cursor.value as unknown;
                cursor.continue();
            } else {
                resolve(result);
            }
        };
        curReq.onerror = () => reject(curReq.error);
    });
}

function idbSet(
    db: IDBDatabase,
    area: StorageArea,
    items: StorageData,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(area, "readwrite");
        const store = tx.objectStore(area);
        for (const [k, v] of Object.entries(items)) {
            store.put(v, k);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function idbDelete(
    db: IDBDatabase,
    area: StorageArea,
    keys: string[],
): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(area, "readwrite");
        const store = tx.objectStore(area);
        for (const k of keys) store.delete(k);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function idbClear(db: IDBDatabase, area: StorageArea): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(area, "readwrite");
        tx.objectStore(area).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

class StorageNamespace {
    private _cache: StorageData = {};
    private _db: IDBDatabase | null = null;
    private _ready: Promise<void>;
    private readonly _area: StorageArea;
    private readonly _extId: string;
    private readonly _globalOnChanged: CivilEvent<
        (changes: StorageChanges, areaName: StorageArea) => void
    >;

    constructor(
        initial: StorageData,
        area: StorageArea,
        extId: string,
        globalOnChanged: CivilEvent<
            (changes: StorageChanges, areaName: StorageArea) => void
        >,
        bus: BroadcastChannel,
    ) {
        this._area = area;
        this._extId = extId;
        this._globalOnChanged = globalOnChanged;
        this._cache = clone(initial);

        // Load from IDB on init, then seed cache
        this._ready = (async () => {
            try {
                const db = await openIDB(extId);
                this._db = db;
                // Merge: IDB wins over initial (IDB has persisted data)
                this._cache = {
                    ...this._cache,
                    ...(await idbGetAll(db, area)),
                };
            } catch (err) {
                console.warn(
                    "[civil-ext-shim] IDB init failed, using in-memory storage:",
                    err,
                );
            }
        })();

        // Listen for cross-context storage changes
        bus.addEventListener("message", (e: MessageEvent) => {
            const d = e.data as StorageBusMsg;
            if (
                d?.kind !== "storageChanged" ||
                d.extId !== extId ||
                d.area !== area
            )
                return;
            // Apply changes to our cache
            for (const [k, { newValue }] of Object.entries(d.changes)) {
                if (newValue === undefined) {
                    delete this._cache[k];
                } else {
                    this._cache[k] = newValue;
                }
            }
            globalOnChanged.dispatch(d.changes, area);
        });
    }

    get(
        keys?: string | string[] | Record<string, unknown> | null,
        cb?: (result: StorageData) => void,
    ): Promise<StorageData> {
        return dual(async () => {
            await this._ready;
            const result: StorageData = {};
            if (keys == null) {
                Object.assign(result, clone(this._cache));
            } else if (typeof keys === "string") {
                // Chrome omits missing keys from the result (does NOT set undefined)
                if (keys in this._cache)
                    result[keys] = clone(this._cache[keys]);
            } else if (Array.isArray(keys)) {
                for (const k of keys) {
                    if (k in this._cache) result[k] = clone(this._cache[k]);
                }
            } else {
                for (const [k, defaultVal] of Object.entries(keys)) {
                    result[k] =
                        k in this._cache ? clone(this._cache[k]) : defaultVal;
                }
            }
            return result;
        }, cb);
    }

    set(items: StorageData, cb?: (() => void) | null): Promise<void> {
        return dual(async () => {
            await this._ready;
            const changes: StorageChanges = {};
            for (const [k, newVal] of Object.entries(items)) {
                const oldValue =
                    k in this._cache ? clone(this._cache[k]) : undefined;
                this._cache[k] = newVal;
                changes[k] = { oldValue, newValue: clone(newVal) };
            }
            if (this._db)
                await idbSet(this._db, this._area, items).catch(() => {});
            this._globalOnChanged.dispatch(changes, this._area);
            // Broadcast to other contexts
            try {
                getCivilBus(this._extId).postMessage({
                    kind: "storageChanged",
                    extId: this._extId,
                    area: this._area,
                    changes,
                } satisfies StorageBusMsg);
            } catch {}
        }, cb ?? undefined);
    }

    remove(keys: string | string[], cb?: (() => void) | null): Promise<void> {
        return dual(async () => {
            await this._ready;
            const ks = Array.isArray(keys) ? keys : [keys];
            const changes: StorageChanges = {};
            for (const k of ks) {
                if (k in this._cache) {
                    changes[k] = {
                        oldValue: clone(this._cache[k]),
                        newValue: undefined,
                    };
                    delete this._cache[k];
                }
            }
            if (this._db)
                await idbDelete(this._db, this._area, ks).catch(() => {});
            this._globalOnChanged.dispatch(changes, this._area);
            try {
                getCivilBus(this._extId).postMessage({
                    kind: "storageChanged",
                    extId: this._extId,
                    area: this._area,
                    changes,
                } satisfies StorageBusMsg);
            } catch {}
        }, cb ?? undefined);
    }

    clear(cb?: (() => void) | null): Promise<void> {
        return dual(async () => {
            await this._ready;
            const changes: StorageChanges = {};
            for (const k of Object.keys(this._cache)) {
                changes[k] = {
                    oldValue: clone(this._cache[k]),
                    newValue: undefined,
                };
            }
            this._cache = {};
            if (this._db) await idbClear(this._db, this._area).catch(() => {});
            this._globalOnChanged.dispatch(changes, this._area);
            try {
                getCivilBus(this._extId).postMessage({
                    kind: "storageChanged",
                    extId: this._extId,
                    area: this._area,
                    changes,
                } satisfies StorageBusMsg);
            } catch {}
        }, cb ?? undefined);
    }

    getBytesInUse(
        keys?: string | string[] | null,
        cb?: (bytes: number) => void,
    ): Promise<number> {
        return dual(async () => {
            await this._ready;
            const src =
                keys == null
                    ? this._cache
                    : (Array.isArray(keys) ? keys : [keys]).reduce<StorageData>(
                          (acc, k) => {
                              if (k in this._cache) acc[k] = this._cache[k];
                              return acc;
                          },
                          {},
                      );
            let bytes = 0;
            try {
                bytes = new TextEncoder().encode(JSON.stringify(src)).length;
            } catch {}
            return bytes;
        }, cb);
    }

    _seed(data: StorageData): void {
        this._cache = clone(data);
    }
    _snapshot(): StorageData {
        return clone(this._cache);
    }
}

export function buildStorageAPI(initialData: StorageData, extId = "unknown") {
    const bus = getCivilBus(extId);
    const onChanged = new CivilEvent<
        (changes: StorageChanges, areaName: StorageArea) => void
    >();
    const local = new StorageNamespace(
        initialData,
        "local",
        extId,
        onChanged,
        bus,
    );
    const sync = new StorageNamespace({}, "sync", extId, onChanged, bus);
    const session = new StorageNamespace({}, "session", extId, onChanged, bus);
    const managed = new StorageNamespace({}, "managed", extId, onChanged, bus);

    return {
        local,
        sync,
        session,
        managed: {
            get: managed.get.bind(managed),
            getBytesInUse: managed.getBytesInUse.bind(managed),
            onChanged: new CivilEvent<
                (changes: StorageChanges, areaName: "managed") => void
            >(),
        },
        onChanged,
        _local: local,
        _session: session,
    };
}
