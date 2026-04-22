export const civilStorage: typeof localStorage = localStorage;

export function openCivilDB(
    dbName: string,
    storeName: string,
    version = 1,
): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, version);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: "id" });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function idbGet<T>(
    db: IDBDatabase,
    storeName: string,
    key: string,
): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
    });
}

export async function idbPut(
    db: IDBDatabase,
    storeName: string,
    value: unknown,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.put(value);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function idbDelete(
    db: IDBDatabase,
    storeName: string,
    key: string,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function idbGetAll<T>(
    db: IDBDatabase,
    storeName: string,
): Promise<T[]> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
    });
}

export async function idbClear(
    db: IDBDatabase,
    storeName: string,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}
