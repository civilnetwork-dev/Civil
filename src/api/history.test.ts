// @vitest-environment happy-dom
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setSetting } from "~/lib/settings";
import type { CivilHistoryEntry } from "~/types";

import {
    historyAdd,
    historyClear,
    historyDeleteSite,
    historyFullEvent,
    historyGetAll,
    historyGetMethod,
    historyMoveTo,
    historySetFormat,
} from "./history";
import { type LocationReport, pickBest } from "./historyStorage";
import { openCivilDB } from "./storage";

const NOW = Date.now();
const MIN = 60_000;

const page = (i: number, title = `Page ${i}`): CivilHistoryEntry => ({
    id: `e${i}`,
    url: `https://site${i}.example/`,
    title,
    visitedAt: NOW - (i + 1) * MIN,
});

/** Sixty pages of about 10 KB each: past a 512 KB limit uncompressed. */
const heavy = (from = 0) =>
    Array.from({ length: 60 }, (_, i) => page(from + i, "t".repeat(10_000)));

const visit = (n = 1000) =>
    historyAdd({
        url: `https://new${n}.example/`,
        title: "New",
        visitedAt: NOW,
    });

async function idbRecords(): Promise<{ id: string; data?: unknown }[]> {
    const db = await openCivilDB("civil-history-db", "history");
    return new Promise((resolve, reject) => {
        const req = db.transaction("history").objectStore("history").getAll();
        req.onsuccess = () => {
            db.close();
            resolve(req.result);
        };
        req.onerror = () => reject(req.error);
    });
}

async function idbPutRaw(records: object[]): Promise<void> {
    const db = await openCivilDB("civil-history-db", "history");
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("history", "readwrite");
        for (const r of records) tx.objectStore("history").put(r);
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => reject(tx.error);
    });
}

const lsPages = () =>
    JSON.parse(localStorage.getItem("civil-history") ?? "[]") as unknown[];

beforeEach(async () => {
    localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    // Through the API, so the in-memory copy of history is dropped too.
    await historyClear();
});

describe("reading what older builds wrote", () => {
    it("keeps a legacy localStorage array through the next visit", async () => {
        localStorage.setItem("civil-history", JSON.stringify([page(1)]));
        await visit();
        const all = await historyGetAll();
        expect(all.map(e => e.title)).toEqual(["New", "Page 1"]);
        expect(lsPages()).toHaveLength(2);
    });

    it("folds per-entry IndexedDB records into one segment", async () => {
        localStorage.setItem("civil-history-method", "indexeddb");
        await idbPutRaw([page(1), page(2)]);
        expect(await historyGetAll()).toHaveLength(2);
        await visit();
        const records = await idbRecords();
        expect(records.map(r => r.id)).toEqual(["civil:segment"]);
        expect(await historyGetAll()).toHaveLength(3);
    });

    it("sees a change another document made", async () => {
        await historyGetAll();
        localStorage.setItem("civil-history", JSON.stringify([page(7)]));
        window.dispatchEvent(
            new StorageEvent("storage", { key: "civil-history" }),
        );
        expect((await historyGetAll()).map(e => e.id)).toEqual(["e7"]);
    });

    it("drops malformed entries instead of handing them to the page", async () => {
        localStorage.setItem(
            "civil-history",
            JSON.stringify([page(1), { id: 5 }, { ...page(2), title: 7 }]),
        );
        const all = await historyGetAll();
        expect(all.map(e => e.id)).toEqual(["e1", "e2"]);
        expect(all[1].title).toBe("");
    });
});

describe("format", () => {
    it("round-trips compressed history in localStorage", async () => {
        setSetting("historyFormat", "compressed");
        localStorage.setItem("civil-history", JSON.stringify([page(1)]));
        await visit();
        expect(localStorage.getItem("civil-history")).toMatch(/^c1:/);
        expect((await historyGetAll()).map(e => e.title)).toEqual([
            "New",
            "Page 1",
        ]);
    });

    it("round-trips compressed history in IndexedDB as bytes", async () => {
        setSetting("historyFormat", "compressed");
        localStorage.setItem("civil-history-method", "indexeddb");
        await visit();
        const [record] = await idbRecords();
        expect(record.data).toBeInstanceOf(Uint8Array);
        expect(await historyGetAll()).toHaveLength(1);
    });

    it("refuses a format that no longer fits and changes nothing", async () => {
        setSetting("historyLimitKb", 512);
        setSetting("historyFormat", "compressed");
        localStorage.setItem("civil-history", JSON.stringify(heavy()));
        await historySetFormat("compressed");
        expect(await historySetFormat("json")).toBe(false);
        expect(localStorage.getItem("civil:history-format")).toBe("compressed");
        expect(await historyGetAll()).toHaveLength(60);
    });
});

describe("limits", () => {
    it("deletes pages older than the retention across both locations", async () => {
        setSetting("historyDays", 7);
        const old = { ...page(1), visitedAt: NOW - 8 * 86_400_000 };
        localStorage.setItem("civil-history", JSON.stringify([page(2), old]));
        await idbPutRaw([{ ...page(3), visitedAt: NOW - 30 * 86_400_000 }]);
        await visit();
        expect((await historyGetAll()).map(e => e.id)).toEqual([
            expect.any(String),
            "e2",
        ]);
        expect(await idbRecords()).toEqual([]);
    });

    it("keeps at most the chosen number of pages", async () => {
        setSetting("historyMax", 1000);
        localStorage.setItem(
            "civil-history",
            JSON.stringify(Array.from({ length: 1005 }, (_, i) => page(i))),
        );
        await visit();
        const all = await historyGetAll();
        expect(all).toHaveLength(1000);
        expect(all[0].title).toBe("New");
    });

    it("saves nothing while saving is off", async () => {
        setSetting("historyEnabled", false);
        await visit();
        expect(localStorage.getItem("civil-history")).toBeNull();
    });
});

describe("sites left out of history", () => {
    it("never saves a left-out site or its subdomains", async () => {
        setSetting("historyExclude", ["youtube.com"]);
        await historyAdd({
            url: "https://m.youtube.com/watch?v=1",
            title: "Video",
            visitedAt: NOW,
        });
        await historyAdd({
            url: "https://notyoutube.com/",
            title: "Other",
            visitedAt: NOW,
        });
        expect((await historyGetAll()).map(e => e.title)).toEqual(["Other"]);
    });

    it("deletes what a site already saved, in both places", async () => {
        localStorage.setItem(
            "civil-history",
            JSON.stringify([
                { ...page(1), url: "https://www.youtube.com/a" },
                page(2),
            ]),
        );
        await idbPutRaw([{ ...page(3), url: "https://youtube.com/b" }]);
        expect(await historyDeleteSite("youtube.com")).toBe(2);
        expect((await historyGetAll()).map(e => e.id)).toEqual(["e2"]);
    });
});

describe("when space runs out", () => {
    beforeEach(() => {
        setSetting("historyLimitKb", 512);
        localStorage.setItem("civil-history", JSON.stringify(heavy()));
    });

    it("removes the oldest pages", async () => {
        await visit();
        const all = await historyGetAll();
        expect(all[0].title).toBe("New");
        expect(all.length).toBeLessThan(61);
        expect(localStorage.getItem("civil-history")!.length).toBeLessThan(
            512 * 1024,
        );
        expect(historyFullEvent()).toMatchObject({
            action: "trim",
            removed: 61 - all.length,
        });
    });

    it("starts over in the same place", async () => {
        setSetting("historyWhenFull", "wipe");
        await visit();
        expect((await historyGetAll()).map(e => e.title)).toEqual(["New"]);
        expect(historyGetMethod()).toBe("localstorage");
        expect(historyFullEvent()).toMatchObject({
            action: "wipe",
            removed: 60,
        });
    });

    it("starts over in the best place", async () => {
        setSetting("historyWhenFull", "wipe-best");
        await idbPutRaw([page(99)]);
        await visit();
        expect((await historyGetAll()).map(e => e.title)).toEqual(["New"]);
        expect(historyFullEvent()).toMatchObject({
            action: "wipe-best",
            removed: 61,
            location: historyGetMethod(),
        });
    });

    it("continues in the other place, keeping everything", async () => {
        setSetting("historyWhenFull", "spill");
        await visit();
        expect(historyGetMethod()).toBe("indexeddb");
        expect(await historyGetAll()).toHaveLength(61);
        expect(lsPages()).toHaveLength(60);
        expect(historyFullEvent()).toMatchObject({
            action: "spill",
            removed: 0,
        });
    });

    it("turns both places into one ring once both are full", async () => {
        setSetting("historyWhenFull", "spill");
        // IndexedDB holds the newer pages; localStorage the oldest ones.
        localStorage.setItem("civil-history", JSON.stringify(heavy(100)));
        await idbPutRaw([
            {
                id: "civil:segment",
                data: JSON.stringify(
                    heavy().map(e => ({ ...e, id: `i${e.id}` })),
                ),
            },
        ]);
        localStorage.setItem("civil-history-method", "indexeddb");
        await visit();
        expect(historyGetMethod()).toBe("localstorage");
        const all = await historyGetAll();
        expect(all[0].title).toBe("New");
        expect(all.some(e => e.id === "ie0")).toBe(true);
        expect(all.some(e => e.id === "e159")).toBe(false);
        expect(historyFullEvent()?.action).toBe("spill");
    });

    it("compresses before removing anything", async () => {
        setSetting("historyWhenFull", "compress");
        await visit();
        expect(localStorage.getItem("civil-history")).toMatch(/^c1:/);
        expect(localStorage.getItem("civil:history-format")).toBe("compressed");
        expect(await historyGetAll()).toHaveLength(61);
        expect(historyFullEvent()).toMatchObject({
            action: "compress",
            removed: 0,
        });
    });

    it("stops saving and touches nothing", async () => {
        setSetting("historyWhenFull", "stop");
        const before = localStorage.getItem("civil-history");
        await visit();
        expect(localStorage.getItem("civil-history")).toBe(before);
        expect(historyFullEvent()?.action).toBe("stop");
    });

    it("treats the browser's own quota error as full", async () => {
        setSetting("historyLimitKb", -1);
        localStorage.setItem(
            "civil-history",
            JSON.stringify(Array.from({ length: 50 }, (_, i) => page(i))),
        );
        const realSet = localStorage.setItem.bind(localStorage);
        const spy = vi
            .spyOn(localStorage, "setItem")
            .mockImplementation((key: string, value: string) => {
                if (key === "civil-history" && value.length > 2000) {
                    throw new DOMException("full", "QuotaExceededError");
                }
                realSet(key, value);
            });
        await visit();
        spy.mockRestore();
        const all = await historyGetAll();
        expect(all[0].title).toBe("New");
        expect(localStorage.getItem("civil-history")!.length).toBeLessThan(
            2001,
        );
        expect(historyFullEvent()?.action).toBe("trim");
    });

    it("clears history and the notice together", async () => {
        await visit();
        await historyClear();
        expect(await historyGetAll()).toEqual([]);
        expect(historyFullEvent()).toBeNull();
    });
});

describe("moving", () => {
    it("writes the new copy before clearing the old one", async () => {
        localStorage.setItem("civil-history", JSON.stringify([page(1)]));
        expect(await historyMoveTo("indexeddb")).toEqual({ ok: true });
        expect(localStorage.getItem("civil-history")).toBeNull();
        expect(historyGetMethod()).toBe("indexeddb");
        expect((await historyGetAll()).map(e => e.id)).toEqual(["e1"]);
    });

    it("leaves history where it was when it does not fit", async () => {
        setSetting("historyLimitKb", 512);
        localStorage.setItem("civil-history", JSON.stringify(heavy()));
        // Over the limit in the target too, so the move must fail.
        expect(await historyMoveTo("indexeddb")).toEqual({
            ok: false,
            reason: "full",
        });
        expect(lsPages()).toHaveLength(60);
        expect(historyGetMethod()).toBe("localstorage");
    });

    it("never writes over history it cannot read", async () => {
        localStorage.setItem("civil-history-method", "indexeddb");
        await idbPutRaw([
            { id: "civil:segment", data: new Uint8Array([1, 2, 3, 4]) },
        ]);
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        await visit();
        warn.mockRestore();
        const [record] = await idbRecords();
        expect(record.data).toEqual(new Uint8Array([1, 2, 3, 4]));
    });
});

describe("pickBest", () => {
    const report = (
        location: "localstorage" | "indexeddb",
        room: number,
        ms: number,
        available = true,
    ): LocationReport => ({
        location,
        available,
        room,
        writeMs: ms,
        readMs: ms,
    });

    it("takes the faster location among those with room", () => {
        expect(
            pickBest(
                [report("localstorage", 1e6, 5), report("indexeddb", 1e9, 2)],
                5e5,
            ),
        ).toBe("indexeddb");
    });

    it("skips a faster location without room", () => {
        expect(
            pickBest(
                [report("localstorage", 1e5, 1), report("indexeddb", 1e9, 9)],
                5e5,
            ),
        ).toBe("indexeddb");
    });

    it("takes the roomiest when none has enough, and ignores broken ones", () => {
        expect(
            pickBest(
                [
                    report("localstorage", 3e5, 1),
                    report("indexeddb", 9e9, 1, false),
                ],
                5e5,
            ),
        ).toBe("localstorage");
    });
});
