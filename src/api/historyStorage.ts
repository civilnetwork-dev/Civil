import { lsRemove, lsSetRaw } from "~/lib/reactiveStorage";
import type { CivilHistoryEntry, HistoryStorageMethod } from "~/types";

import { openCivilDB } from "./storage";

/**
 * Where history physically lives, and nothing about what history means.
 *
 * Each location holds one segment of the history as a single payload: the
 * `civil-history` localStorage key, or one record in the IndexedDB store.
 * A payload says what it is (JSON text starts with `[`, compressed text with
 * `c1:`, IndexedDB keeps compressed bytes as bytes), so a change of format
 * never strands data written in the old one.
 */

export type HistoryLocation = HistoryStorageMethod;
export const LOCATIONS: readonly HistoryLocation[] = [
    "localstorage",
    "indexeddb",
];
export type HistoryFormat = "json" | "compressed";

const HISTORY_LS_KEY = "civil-history";
const DB_NAME = "civil-history-db";
const STORE = "history";
/** The segment's record. Older builds stored one record per entry instead. */
const SEGMENT_ID = "civil:segment";
const PROBE_ID = "civil:probe";
const COMPRESSED = "c1:";

/** What localStorage holds per origin, in characters, in every major engine. */
const LS_QUOTA = 5_000_000;
/**
 * Automatic budget in localStorage. The quota is shared with bookmarks,
 * extensions and the tab session, and a history that filled it would make
 * all of those fail to save.
 */
const LS_AUTO_BUDGET = 2 * 1024 * 1024;

/** A write that does not fit: over the space limit, or refused by the browser. */
export class HistoryFull extends Error {
    constructor(
        readonly location: HistoryLocation,
        /** Payload size, or NaN when the browser refused without saying. */
        readonly size: number,
        readonly budget: number,
    ) {
        super(`history is full in ${location}`);
    }
}

/** Stored data this build cannot read. Writing over it would destroy it. */
export class HistoryUnreadable extends Error {}

export function budgetFor(loc: HistoryLocation, limitKb: number): number {
    if (limitKb === -1) return Infinity;
    if (limitKb === 0)
        return loc === "localstorage" ? LS_AUTO_BUDGET : Infinity;
    return limitKb * 1024;
}

const isQuotaError = (error: unknown) => {
    const name = (error as { name?: unknown } | null)?.name;
    return (
        name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED"
    );
};

/* Codec */

type Payload = string | Uint8Array;

const payloadSize = (p: Payload) =>
    typeof p === "string" ? p.length : p.byteLength;

async function pipe(
    bytes: Uint8Array<ArrayBuffer>,
    through: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
    const writer = through.writable.getWriter();
    void writer.write(bytes).catch(() => {});
    void writer.close().catch(() => {});
    const reader = through.readable.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        length += value.byteLength;
    }
    const out = new Uint8Array(length);
    let at = 0;
    for (const chunk of chunks) {
        out.set(chunk, at);
        at += chunk.byteLength;
    }
    return out;
}

function toBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

const fromBase64 = (text: string) =>
    Uint8Array.from(atob(text), c => c.charCodeAt(0));

async function encode(
    entries: readonly CivilHistoryEntry[],
    format: HistoryFormat,
    loc: HistoryLocation,
): Promise<Payload> {
    const text = JSON.stringify(entries);
    if (format === "json") return text;
    const bytes = await pipe(
        new TextEncoder().encode(text),
        new CompressionStream("deflate-raw"),
    );
    return loc === "localstorage" ? COMPRESSED + toBase64(bytes) : bytes;
}

/** Keeps only well-formed entries: this data is readable by any script here. */
function entriesFrom(value: unknown): CivilHistoryEntry[] {
    if (!Array.isArray(value)) return [];
    const out: CivilHistoryEntry[] = [];
    for (const e of value) {
        if (
            !e ||
            typeof e.id !== "string" ||
            typeof e.url !== "string" ||
            typeof e.visitedAt !== "number"
        )
            continue;
        out.push({
            id: e.id,
            url: e.url,
            title: typeof e.title === "string" ? e.title : "",
            visitedAt: e.visitedAt,
            ...(typeof e.favicon === "string" ? { favicon: e.favicon } : {}),
        });
    }
    return out;
}

async function decode(payload: unknown): Promise<CivilHistoryEntry[]> {
    let text: string;
    try {
        if (payload instanceof Uint8Array) {
            text = new TextDecoder().decode(
                await pipe(
                    new Uint8Array(payload),
                    new DecompressionStream("deflate-raw"),
                ),
            );
        } else if (typeof payload === "string") {
            text = payload.startsWith(COMPRESSED)
                ? new TextDecoder().decode(
                      await pipe(
                          fromBase64(payload.slice(COMPRESSED.length)),
                          new DecompressionStream("deflate-raw"),
                      ),
                  )
                : payload;
        } else {
            return [];
        }
    } catch (error) {
        throw new HistoryUnreadable(String(error));
    }
    try {
        return entriesFrom(JSON.parse(text));
    } catch {
        // Plain text that is not JSON was damaged beyond reading already, so
        // there is nothing left to protect by refusing to write over it.
        return [];
    }
}

/* IndexedDB */

async function transact<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
    const db = await openCivilDB(DB_NAME, STORE);
    return new Promise<T | undefined>((resolve, reject) => {
        let request: IDBRequest<T> | void;
        const fail = (error: unknown) => {
            db.close();
            reject(error);
        };
        try {
            const tx = db.transaction(STORE, mode);
            request = run(tx.objectStore(STORE));
            tx.oncomplete = () => {
                db.close();
                resolve(request ? request.result : undefined);
            };
            tx.onerror = event =>
                fail((event.target as IDBRequest | null)?.error ?? tx.error);
            tx.onabort = () => fail(tx.error);
        } catch (error) {
            fail(error);
        }
    });
}

/* Locations */

export async function readLocation(
    loc: HistoryLocation,
): Promise<CivilHistoryEntry[]> {
    if (loc === "localstorage") {
        const raw = localStorage.getItem(HISTORY_LS_KEY);
        return raw === null ? [] : decode(raw);
    }
    const records =
        (await transact<unknown[]>("readonly", store => store.getAll())) ?? [];
    const segment = records.find(
        r => (r as { id?: unknown }).id === SEGMENT_ID,
    ) as { data?: unknown } | undefined;
    // Older builds kept one record per entry; they read as one more segment
    // and fold into the real one on the next write.
    const legacy = entriesFrom(
        records.filter(r => (r as { id?: unknown }).id !== SEGMENT_ID),
    );
    const entries = segment ? await decode(segment.data) : [];
    return legacy.length ? [...entries, ...legacy] : entries;
}

/** Replace a location's segment. Throws HistoryFull when it does not fit. */
export async function writeLocation(
    loc: HistoryLocation,
    entries: readonly CivilHistoryEntry[],
    format: HistoryFormat,
    budget: number,
): Promise<number> {
    // Nothing to keep frees the location outright, which always fits.
    if (!entries.length) {
        await clearLocation(loc);
        return 0;
    }
    const payload = await encode(entries, format, loc);
    const size = payloadSize(payload);
    if (size > budget) throw new HistoryFull(loc, size, budget);
    try {
        if (loc === "localstorage") {
            lsSetRaw(HISTORY_LS_KEY, payload as string);
        } else {
            await transact("readwrite", store => {
                store.clear();
                store.put({ id: SEGMENT_ID, data: payload });
            });
        }
    } catch (error) {
        if (isQuotaError(error)) throw new HistoryFull(loc, NaN, budget);
        throw error;
    }
    return size;
}

export async function clearLocation(loc: HistoryLocation): Promise<void> {
    if (loc === "localstorage") lsRemove(HISTORY_LS_KEY);
    else await transact("readwrite", store => store.clear());
}

/** The stored payload's size, which is what the space limit counts. */
export async function storedSize(loc: HistoryLocation): Promise<number> {
    if (loc === "localstorage") {
        return localStorage.getItem(HISTORY_LS_KEY)?.length ?? 0;
    }
    const records =
        (await transact<unknown[]>("readonly", store => store.getAll())) ?? [];
    return records.reduce<number>((sum, r) => {
        const data = (r as { data?: unknown }).data;
        if (typeof data === "string" || data instanceof Uint8Array) {
            return sum + payloadSize(data);
        }
        return sum + JSON.stringify(r).length;
    }, 0);
}

/* Ranking */

export interface LocationReport {
    location: HistoryLocation;
    available: boolean;
    /** Room history could grow into here, in the same units as its size. */
    room: number;
    writeMs: number;
    readMs: number;
}

/**
 * The fastest location with room for `need`; when none has that much room,
 * the one with the most.
 */
export function pickBest(
    reports: readonly LocationReport[],
    need: number,
): HistoryLocation {
    const usable = reports.filter(r => r.available);
    if (!usable.length) return "localstorage";
    const roomy = usable.filter(r => r.room >= need);
    if (roomy.length) {
        return roomy.reduce((a, b) =>
            b.writeMs + b.readMs < a.writeMs + a.readMs ? b : a,
        ).location;
    }
    return usable.reduce((a, b) => (b.room > a.room ? b : a)).location;
}

function localStorageUsed(): number {
    let used = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key === null || key === HISTORY_LS_KEY) continue;
        used += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
    return used;
}

async function probe(
    loc: HistoryLocation,
    sample: string,
): Promise<{ available: boolean; writeMs: number; readMs: number }> {
    try {
        const t0 = performance.now();
        if (loc === "localstorage") {
            localStorage.setItem(PROBE_ID, sample);
            const t1 = performance.now();
            localStorage.getItem(PROBE_ID);
            const t2 = performance.now();
            localStorage.removeItem(PROBE_ID);
            return { available: true, writeMs: t1 - t0, readMs: t2 - t1 };
        }
        await transact("readwrite", store => {
            store.put({ id: PROBE_ID, data: sample });
        });
        const t1 = performance.now();
        await transact("readonly", store => store.get(PROBE_ID));
        const t2 = performance.now();
        await transact("readwrite", store => {
            store.delete(PROBE_ID);
        });
        return { available: true, writeMs: t1 - t0, readMs: t2 - t1 };
    } catch (error) {
        // Full is still a working location, just one without room.
        return {
            available: isQuotaError(error),
            writeMs: Infinity,
            readMs: Infinity,
        };
    }
}

/**
 * Measures both locations: whether they work, how much room each has for
 * history under `limitKb`, and how long writing and reading a payload of
 * history's current size takes.
 */
export async function measureLocations(
    currentSize: number,
    limitKb: number,
): Promise<LocationReport[]> {
    const sample = "x".repeat(
        Math.min(Math.max(currentSize, 64 * 1024), 256 * 1024),
    );
    const reports: LocationReport[] = [];
    for (const loc of LOCATIONS) {
        const result = await probe(loc, sample);
        let free = 0;
        if (result.available) {
            if (loc === "localstorage") {
                free = Math.max(0, LS_QUOTA - localStorageUsed());
            } else {
                const estimate = await navigator.storage
                    ?.estimate?.()
                    .catch(() => undefined);
                free = estimate?.quota
                    ? Math.max(0, estimate.quota - (estimate.usage ?? 0)) +
                      (await storedSize(loc).catch(() => 0))
                    : Infinity;
            }
        }
        reports.push({
            location: loc,
            ...result,
            room: Math.min(free, budgetFor(loc, limitKb)),
        });
    }
    return reports;
}
