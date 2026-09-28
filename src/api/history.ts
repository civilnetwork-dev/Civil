import { lsRemove, lsSetJSON, lsSetRaw } from "~/lib/reactiveStorage";
import { getSetting, onSite, setSetting } from "~/lib/settings";
import type { CivilHistoryEntry, HistoryStorageMethod } from "~/types";

import {
    budgetFor,
    clearLocation,
    HistoryFull,
    type HistoryFormat,
    type HistoryLocation,
    HistoryUnreadable,
    LOCATIONS,
    type LocationReport,
    measureLocations,
    pickBest,
    readLocation,
    storedSize,
    writeLocation,
} from "./historyStorage";

/**
 * History, and what happens when its storage runs out.
 *
 * History can live in localStorage, in IndexedDB, or across both (see
 * historyStorage.ts). New pages go to one of them, the writer, recorded under
 * the key older builds used for the chosen method. Reads always merge both,
 * so pages written before a switch, or left behind by an interrupted move,
 * never disappear from view.
 *
 * Every write is checked against the space limit and against the browser's
 * own quota; either one running out hands the write to the policy the user
 * chose in Settings. Every visit rewrites the writer's whole segment, which
 * costs O(history size); the automatic 2 MB localStorage limit keeps that
 * small.
 * ponytail: whole-segment rewrites; split segments by month if large
 * histories make visits slow.
 */

const METHOD_KEY = "civil-history-method";
const FULL_KEY = "civil:history-full";
const CHANNEL = "civil-history";
const DAY_MS = 86_400_000;

type Segments = Record<HistoryLocation, CivilHistoryEntry[]>;

function writer(): HistoryLocation {
    try {
        return localStorage.getItem(METHOD_KEY) === "indexeddb"
            ? "indexeddb"
            : "localstorage";
    } catch {
        return "localstorage";
    }
}

const setWriter = (loc: HistoryLocation) => lsSetRaw(METHOD_KEY, loc);

const otherThan = (loc: HistoryLocation): HistoryLocation =>
    loc === "localstorage" ? "indexeddb" : "localstorage";

const newestFirst = (list: readonly CivilHistoryEntry[]) =>
    list.toSorted((a, b) => b.visitedAt - a.visitedAt);

function unique(list: readonly CivilHistoryEntry[]): CivilHistoryEntry[] {
    const seen = new Set<string>();
    return list.filter(e => !seen.has(e.id) && Boolean(seen.add(e.id)));
}

const ignoreFull = (error: unknown) => {
    if (!(error instanceof HistoryFull)) throw error;
};

/* Change notices, for every document on the origin (the History page is in a
   tab's frame; IndexedDB writes fire no storage event). */

let bus: BroadcastChannel | undefined;

function announce(): void {
    merged = null;
    try {
        (bus ??= new BroadcastChannel(CHANNEL)).postMessage("changed");
    } catch {}
}

/**
 * The merged, sorted history, kept until anything changes it. The address
 * bar searches history on every keystroke, and re-reading both locations
 * (decompressing, when compressed) each time is work a slow Chromebook feels.
 * Callers get the shared array and must not mutate it.
 */
let merged: Promise<CivilHistoryEntry[]> | null = null;
let watching = false;

export function onHistoryChange(callback: () => void): () => void {
    let channel: BroadcastChannel;
    try {
        channel = new BroadcastChannel(CHANNEL);
    } catch {
        return () => {};
    }
    channel.onmessage = () => {
        merged = null;
        callback();
    };
    return () => channel.close();
}

/**
 * One change at a time. Web Locks cover every document on the origin (the
 * browser adding a visit while the History page deletes one); where they are
 * missing, a promise chain still covers this document.
 */
let chain: Promise<unknown> = Promise.resolve();

function serial<T>(task: () => Promise<T>): Promise<T> {
    const locks = (navigator as { locks?: LockManager }).locks;
    if (locks?.request) return locks.request(CHANNEL, task);
    const run = chain.then(task, task);
    chain = run.catch(() => {});
    return run;
}

async function readAll(): Promise<{
    segs: Segments;
    broken: Set<HistoryLocation>;
}> {
    const segs: Segments = { localstorage: [], indexeddb: [] };
    const broken = new Set<HistoryLocation>();
    for (const loc of LOCATIONS) {
        try {
            segs[loc] = newestFirst(await readLocation(loc));
        } catch (error) {
            broken.add(loc);
            console.warn(`[civil] history in ${loc} can't be read:`, error);
        }
    }
    return { segs, broken };
}

function save(
    loc: HistoryLocation,
    entries: readonly CivilHistoryEntry[],
    format: HistoryFormat = getSetting("historyFormat"),
): Promise<number> {
    return writeLocation(
        loc,
        entries,
        format,
        budgetFor(loc, getSetting("historyLimitKb")),
    );
}

/**
 * Applies "delete pages older than" and "keep at most" across both locations.
 * Returns the locations whose segment changed.
 */
function prune(segs: Segments): Set<HistoryLocation> {
    const days = getSetting("historyDays");
    const max = getSetting("historyMax");
    const cutoff = days ? Date.now() - days * DAY_MS : -Infinity;
    const keep = new Set(
        newestFirst([...segs.localstorage, ...segs.indexeddb])
            .filter(e => e.visitedAt >= cutoff)
            .slice(0, max || undefined),
    );
    const changed = new Set<HistoryLocation>();
    for (const loc of LOCATIONS) {
        const next = segs[loc].filter(e => keep.has(e));
        if (next.length === segs[loc].length) continue;
        segs[loc] = next;
        changed.add(loc);
    }
    return changed;
}

/* What happened the last time storage ran out */

const FULL_ACTIONS = [
    "trim",
    "wipe",
    "wipe-best",
    "spill",
    "compress",
    "stop",
] as const;
export type FullAction = (typeof FULL_ACTIONS)[number];

export interface FullEvent {
    at: number;
    action: FullAction;
    /** Pages removed to make room. */
    removed: number;
    /** Where history is being saved now. */
    location: HistoryLocation;
}

function record(
    action: FullAction,
    removed: number,
    location: HistoryLocation,
): void {
    try {
        lsSetJSON(FULL_KEY, { at: Date.now(), action, removed, location });
    } catch {}
}

export function historyFullEvent(): FullEvent | null {
    try {
        const e = JSON.parse(localStorage.getItem(FULL_KEY) ?? "null");
        if (
            e &&
            Number.isFinite(e.at) &&
            FULL_ACTIONS.includes(e.action) &&
            Number.isInteger(e.removed) &&
            LOCATIONS.includes(e.location)
        )
            return e as FullEvent;
    } catch {}
    return null;
}

export function historyDismissFullEvent(): void {
    try {
        lsRemove(FULL_KEY);
    } catch {}
    announce();
}

/* Running out of room */

/**
 * Removes the oldest pages until the segment fits: a tenth at a time, or in
 * one step when the write reported how far over the limit it was. Returns how
 * many pages went. An empty segment that still does not fit (localStorage
 * filled by something else) throws.
 */
async function trimToFit(
    loc: HistoryLocation,
    segs: Segments,
): Promise<number> {
    let removed = 0;
    let ratio = 0.9;
    for (;;) {
        const list = segs[loc];
        const keep = Math.max(
            0,
            Math.min(list.length - 1, Math.floor(list.length * ratio)),
        );
        removed += list.length - keep;
        segs[loc] = list.slice(0, keep);
        try {
            await save(loc, segs[loc]);
            return removed;
        } catch (error) {
            if (!(error instanceof HistoryFull) || !segs[loc].length) {
                throw error;
            }
            ratio = Number.isFinite(error.size)
                ? Math.min(0.9, (error.budget / error.size) * 0.9)
                : 0.9;
        }
    }
}

/** Save, trimming only if the segment does not fit. */
async function fit(loc: HistoryLocation, segs: Segments): Promise<number> {
    try {
        await save(loc, segs[loc]);
        return 0;
    } catch (error) {
        ignoreFull(error);
        return trimToFit(loc, segs);
    }
}

const oldest = (list: readonly CivilHistoryEntry[]) =>
    list.length ? list[list.length - 1].visitedAt : Infinity;

async function whenFull(
    loc: HistoryLocation,
    segs: Segments,
    entry: CivilHistoryEntry,
    broken: Set<HistoryLocation>,
): Promise<void> {
    switch (getSetting("historyWhenFull")) {
        case "trim":
            return record("trim", await trimToFit(loc, segs), loc);

        case "wipe": {
            const removed = segs[loc].length - 1;
            segs[loc] = [entry];
            return record("wipe", removed + (await fit(loc, segs)), loc);
        }

        case "wipe-best": {
            const removed =
                segs.localstorage.length + segs.indexeddb.length - 1;
            for (const l of LOCATIONS) {
                await clearLocation(l).catch(() => {});
                segs[l] = [];
            }
            const best = pickBest(
                await measureLocations(0, getSetting("historyLimitKb")),
                256 * 1024,
            );
            setWriter(best);
            segs[best] = [entry];
            return record("wipe-best", removed + (await fit(best, segs)), best);
        }

        case "spill": {
            const other = otherThan(loc);
            if (broken.has(other)) {
                return record("trim", await trimToFit(loc, segs), loc);
            }
            segs[loc] = segs[loc].filter(e => e !== entry);
            segs[other] = [entry, ...segs[other]];
            try {
                await save(other, segs[other]);
                setWriter(other);
                return record("spill", 0, other);
            } catch (error) {
                ignoreFull(error);
            }
            // Both are full. Carry on where the oldest pages are, so the two
            // locations turn over as one ring.
            const target =
                oldest(segs.localstorage) <= oldest(segs.indexeddb)
                    ? "localstorage"
                    : "indexeddb";
            if (target !== other) {
                segs[other] = segs[other].filter(e => e !== entry);
                segs[target] = [entry, ...segs[target]];
            }
            const removed = await trimToFit(target, segs);
            setWriter(target);
            return record("spill", removed, target);
        }

        case "compress": {
            if (getSetting("historyFormat") !== "compressed") {
                setSetting("historyFormat", "compressed");
                try {
                    await save(loc, segs[loc]);
                    const other = otherThan(loc);
                    if (!broken.has(other) && segs[other].length) {
                        await save(other, segs[other]).catch(ignoreFull);
                    }
                    return record("compress", 0, loc);
                } catch (error) {
                    ignoreFull(error);
                }
            }
            return record("compress", await trimToFit(loc, segs), loc);
        }

        case "stop":
            // The new page is not saved and nothing is removed. Later visits
            // try again, so saving resumes once the user makes room.
            return record("stop", 0, loc);
    }
}

async function addNow(entry: CivilHistoryEntry): Promise<void> {
    const { segs, broken } = await readAll();
    const loc = writer();
    if (broken.has(loc)) {
        throw new HistoryUnreadable(`history in ${loc} can't be read`);
    }
    segs[loc] = [entry, ...segs[loc]];
    for (const other of prune(segs)) {
        if (other === loc || broken.has(other)) continue;
        await save(other, segs[other]).catch(ignoreFull);
    }
    try {
        await save(loc, segs[loc]);
    } catch (error) {
        ignoreFull(error);
        await whenFull(loc, segs, entry, broken);
    }
}

/* Public API */

export async function historyAdd(
    entry: Omit<CivilHistoryEntry, "id">,
): Promise<void> {
    if (!getSetting("historyEnabled")) return;
    if (getSetting("historyExclude").some(site => onSite(entry.url, site))) {
        return;
    }
    try {
        await serial(() => addNow({ ...entry, id: crypto.randomUUID() }));
        announce();
    } catch (error) {
        // A visit that could not be recorded must not break the visit.
        console.warn("[civil] history entry not saved:", error);
    }
}

export function historyGetAll(): Promise<CivilHistoryEntry[]> {
    if (!watching) {
        watching = true;
        // Changes from other documents: this API's own notice, or any
        // localStorage write at all (a tab still running an older build).
        onHistoryChange(() => {});
        window.addEventListener("storage", () => {
            merged = null;
        });
    }
    merged ??= readAll().then(({ segs }) =>
        unique(newestFirst([...segs.localstorage, ...segs.indexeddb])),
    );
    return merged;
}

export async function historyDelete(id: string): Promise<void> {
    await serial(async () => {
        const { segs, broken } = await readAll();
        for (const loc of LOCATIONS) {
            if (broken.has(loc)) continue;
            const next = segs[loc].filter(e => e.id !== id);
            if (next.length !== segs[loc].length) await save(loc, next);
        }
    });
    announce();
}

/** Deletes every page from `site` or its subdomains. Returns how many went. */
export async function historyDeleteSite(site: string): Promise<number> {
    let removed = 0;
    await serial(async () => {
        const { segs, broken } = await readAll();
        for (const loc of LOCATIONS) {
            if (broken.has(loc)) continue;
            const next = segs[loc].filter(e => !onSite(e.url, site));
            if (next.length === segs[loc].length) continue;
            removed += segs[loc].length - next.length;
            await save(loc, next);
        }
    });
    announce();
    return removed;
}

export async function historyClear(): Promise<void> {
    await serial(async () => {
        for (const loc of LOCATIONS) await clearLocation(loc).catch(() => {});
    });
    historyDismissFullEvent();
}

/** Apply retention and the page cap now, rather than on the next visit. */
export async function historyApplyLimits(): Promise<void> {
    await serial(async () => {
        const { segs, broken } = await readAll();
        for (const loc of prune(segs)) {
            if (!broken.has(loc)) await save(loc, segs[loc]).catch(ignoreFull);
        }
    });
    announce();
}

export type MoveResult = { ok: true } | { ok: false; reason: "full" | "error" };

/**
 * Moves every page to `target` and saves there from now on. The new copy is
 * written first and the old one cleared only after that succeeds, so a move
 * that does not fit leaves history exactly where it was.
 */
export async function historyMoveTo(
    target: HistoryLocation,
): Promise<MoveResult> {
    const result = await serial(async (): Promise<MoveResult> => {
        const { segs, broken } = await readAll();
        const source = otherThan(target);
        if (broken.has(target)) return { ok: false, reason: "error" };
        try {
            await save(
                target,
                unique(newestFirst([...segs[target], ...segs[source]])),
            );
        } catch (error) {
            return {
                ok: false,
                reason: error instanceof HistoryFull ? "full" : "error",
            };
        }
        if (!broken.has(source)) await clearLocation(source).catch(() => {});
        setWriter(target);
        return { ok: true };
    });
    announce();
    return result;
}

/**
 * Rewrites history in `format`. If any location would no longer fit, the
 * locations already rewritten go back to the old format and nothing changes.
 */
export async function historySetFormat(
    format: HistoryFormat,
): Promise<boolean> {
    const previous = getSetting("historyFormat");
    const ok = await serial(async () => {
        const { segs, broken } = await readAll();
        const done: HistoryLocation[] = [];
        for (const loc of LOCATIONS) {
            if (broken.has(loc) || !segs[loc].length) continue;
            try {
                await save(loc, segs[loc], format);
                done.push(loc);
            } catch {
                for (const l of done) {
                    await save(l, segs[l], previous).catch(() => {});
                }
                return false;
            }
        }
        setSetting("historyFormat", format);
        return true;
    });
    announce();
    return ok;
}

export interface HistoryStatus {
    /** Where new pages are saved. */
    writer: HistoryLocation;
    pages: Record<HistoryLocation, number>;
    /** Stored size, in the units the space limit counts. */
    size: Record<HistoryLocation, number>;
}

export async function historyStatus(): Promise<HistoryStatus> {
    const { segs } = await readAll();
    const size = { localstorage: 0, indexeddb: 0 };
    for (const loc of LOCATIONS)
        size[loc] = await storedSize(loc).catch(() => 0);
    return {
        writer: writer(),
        pages: {
            localstorage: segs.localstorage.length,
            indexeddb: segs.indexeddb.length,
        },
        size,
    };
}

export async function historyRankLocations(): Promise<{
    best: HistoryLocation;
    reports: LocationReport[];
}> {
    let size = 0;
    for (const loc of LOCATIONS) size += await storedSize(loc).catch(() => 0);
    const reports = await measureLocations(size, getSetting("historyLimitKb"));
    return { best: pickBest(reports, Math.max(2 * size, 256 * 1024)), reports };
}

/** Ranks both locations and moves history to the better one. */
export async function historyAutoLocate(): Promise<{
    best: HistoryLocation;
    reports: LocationReport[];
    moved: MoveResult;
}> {
    const ranking = await historyRankLocations();
    const moved: MoveResult =
        ranking.best === writer()
            ? { ok: true }
            : await historyMoveTo(ranking.best);
    return { ...ranking, moved };
}

export function historySetMethod(method: HistoryStorageMethod): void {
    setSetting("historyLocation", method);
    void historyMoveTo(method);
}

export function historyGetMethod(): HistoryStorageMethod {
    return writer();
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
