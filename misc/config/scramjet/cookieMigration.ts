import { engineNames } from "$config/shared/runtimeScripts";

function openCookieStore(name: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        // Version and store name are the controller's own: it opens the same
        // database with the same schema.
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains("state")) {
                request.result.createObjectStore("state");
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function cookieRecord(
    db: IDBDatabase,
    mode: IDBTransactionMode,
    use: (store: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("state", mode);
        const request = use(transaction.objectStore("state"));
        let result: unknown;
        request.onsuccess = () => {
            result = request.result;
        };
        // A successful put request can still be rolled back before commit.
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = transaction.onerror = () =>
            reject(transaction.error ?? new Error("Cookie transaction failed"));
    });
}

/**
 * The controller keeps proxied sites' cookies in IndexedDB. Earlier builds
 * named that database after the engine, and Aristotle Student matches
 * /scramjet/ against `indexedDB.databases()`. Move the saved cookies to the
 * neutral name once, then delete the old database, so nobody loses a login.
 */
export async function retireLegacyDatabase(): Promise<void> {
    const { database, legacyDatabase } = engineNames;
    let legacy: IDBDatabase | undefined;
    let current: IDBDatabase | undefined;
    try {
        const known = await indexedDB.databases?.();
        if (known && !known.some(db => db.name === legacyDatabase)) return;

        legacy = await openCookieStore(legacyDatabase);
        const saved = await cookieRecord(legacy, "readonly", store =>
            store.get("cookies"),
        );
        if (saved) {
            current = await openCookieStore(database);
            // Keep newer cookies if this build already saved some.
            // Check and copy in one transaction so another tab cannot write
            // fresh cookies between the check and an unconditional put.
            await cookieRecord(current, "readwrite", store => {
                const request = store.get("cookies");
                request.addEventListener("success", () => {
                    if (!request.result) store.put(saved, "cookies");
                });
                return request;
            });
        }
        indexedDB.deleteDatabase(legacyDatabase);
    } catch (error) {
        console.warn("[civil] could not move saved cookies", error);
    } finally {
        legacy?.close();
        current?.close();
    }
}
