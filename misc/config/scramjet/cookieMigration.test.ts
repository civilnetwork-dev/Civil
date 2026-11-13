import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { engineNames } from "$config/shared/runtimeScripts";

import { retireLegacyDatabase } from "./cookieMigration";

const savedCookies = { updatedAt: 20, cookies: "saved legacy login" };
const currentCookies = { updatedAt: 10, cookies: "existing current login" };

beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function openDatabase(name: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore("state");
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function writeCookies(name: string, cookies: unknown): Promise<void> {
    const db = await openDatabase(name);
    const transaction = db.transaction("state", "readwrite");
    transaction.objectStore("state").put(cookies, "cookies");
    await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
    });
    db.close();
}

async function readCookies(name: string): Promise<unknown> {
    const db = await openDatabase(name);
    const request = db.transaction("state").objectStore("state").get("cookies");
    const cookies = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    db.close();
    return cookies;
}

it("commits saved logins before removing the legacy database", async () => {
    await writeCookies(engineNames.legacyDatabase, savedCookies);

    await retireLegacyDatabase();

    expect(await readCookies(engineNames.database)).toEqual(savedCookies);
    await vi.waitFor(async () => {
        const databases = await indexedDB.databases();
        expect(databases.map(db => db.name)).not.toContain(
            engineNames.legacyDatabase,
        );
    });
});

it("keeps existing current cookies authoritative", async () => {
    await writeCookies(engineNames.legacyDatabase, savedCookies);
    await writeCookies(engineNames.database, currentCookies);

    await retireLegacyDatabase();

    expect(await readCookies(engineNames.database)).toEqual(currentCookies);
});

it("leaves storage alone when no legacy database exists", async () => {
    await retireLegacyDatabase();

    expect(await indexedDB.databases()).toEqual([]);
});

it("preserves fresh cookies written by a concurrent tab", async () => {
    await writeCookies(engineNames.legacyDatabase, savedCookies);
    const originalGet = IDBObjectStore.prototype.get;
    let freshWrite: Promise<void> | undefined;
    const get = vi.spyOn(IDBObjectStore.prototype, "get");
    get.mockImplementation(function (this: IDBObjectStore, key) {
        const request = originalGet.call(this, key);
        if (this.transaction.db.name === engineNames.database) {
            request.addEventListener("success", () => {
                const transaction = this.transaction.db.transaction(
                    "state",
                    "readwrite",
                );
                transaction.objectStore("state").put(currentCookies, "cookies");
                freshWrite = new Promise((resolve, reject) => {
                    transaction.oncomplete = () => resolve();
                    transaction.onabort = () => reject(transaction.error);
                });
            });
        }
        return request;
    });

    await retireLegacyDatabase();
    await freshWrite;
    get.mockRestore();

    expect(await readCookies(engineNames.database)).toEqual(currentCookies);
});

it("retains saved logins after an aborted copy and retries safely", async () => {
    await writeCookies(engineNames.legacyDatabase, savedCookies);
    const originalPut = IDBObjectStore.prototype.put;
    const put = vi.spyOn(IDBObjectStore.prototype, "put");
    put.mockImplementationOnce(function (this: IDBObjectStore, value, key) {
        const request = originalPut.call(this, value, key);
        request.addEventListener("success", () => this.transaction.abort());
        return request;
    });
    const remove = vi.spyOn(indexedDB, "deleteDatabase");

    await retireLegacyDatabase();

    expect(remove).not.toHaveBeenCalled();
    expect(await readCookies(engineNames.legacyDatabase)).toEqual(savedCookies);
    expect(await readCookies(engineNames.database)).toBeUndefined();
    put.mockRestore();
    await retireLegacyDatabase();
    expect(await readCookies(engineNames.database)).toEqual(savedCookies);
    expect(remove).toHaveBeenCalledWith(engineNames.legacyDatabase);
});
