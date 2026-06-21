import type { CivilHistoryEntry, HistoryStorageMethod } from "~/types";
import { idbClear, idbDelete, idbGetAll, idbPut, openCivilDB } from "./storage";

const LS_KEY = "civil-history";
const DB_NAME = "civil-history-db";
const STORE = "history";

function getMethod(): HistoryStorageMethod {
    return (
        (localStorage.getItem(
            "civil-history-method",
        ) as HistoryStorageMethod) ?? "localstorage"
    );
}

function lsLoad(): CivilHistoryEntry[] {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
    } catch {
        return [];
    }
}

function lsSave(entries: CivilHistoryEntry[]): void {
    localStorage.setItem(LS_KEY, JSON.stringify(entries));
}

async function getDB(): Promise<IDBDatabase> {
    return openCivilDB(DB_NAME, STORE);
}

export async function historyAdd(
    entry: Omit<CivilHistoryEntry, "id">,
): Promise<void> {
    const full: CivilHistoryEntry = { ...entry, id: crypto.randomUUID() };
    if (getMethod() === "localstorage") {
        const entries = lsLoad();
        entries.unshift(full);
        lsSave(entries.slice(0, 5000));
    } else {
        const db = await getDB();
        await idbPut(db, STORE, full);
    }
}

export async function historyGetAll(): Promise<CivilHistoryEntry[]> {
    if (getMethod() === "localstorage") {
        return lsLoad();
    }
    const db = await getDB();
    const all = await idbGetAll<CivilHistoryEntry>(db, STORE);
    return all.sort((a, b) => b.visitedAt - a.visitedAt);
}

export async function historyDelete(id: string): Promise<void> {
    if (getMethod() === "localstorage") {
        lsSave(lsLoad().filter(e => e.id !== id));
    } else {
        const db = await getDB();
        await idbDelete(db, STORE, id);
    }
}

export async function historyClear(): Promise<void> {
    if (getMethod() === "localstorage") {
        lsSave([]);
    } else {
        const db = await getDB();
        await idbClear(db, STORE);
    }
}

export function historySetMethod(method: HistoryStorageMethod): void {
    localStorage.setItem("civil-history-method", method);
}

export function historyGetMethod(): HistoryStorageMethod {
    return getMethod();
}

export async function historySearch(
    query: string,
    limit = 6,
): Promise<CivilHistoryEntry[]> {
    const q = query.toLowerCase();
    const all = await historyGetAll();
    const seen = new Set<string>();
    const out: CivilHistoryEntry[] = [];
    for (const entry of all) {
        if (out.length >= limit) break;
        if (/\/~\/(uv|scramjet)\//.test(entry.url)) continue;
        if (seen.has(entry.url)) continue;
        if (
            entry.url.toLowerCase().includes(q) ||
            (entry.title ?? "").toLowerCase().includes(q)
        ) {
            seen.add(entry.url);
            out.push(entry);
        }
    }
    return out;
}
