import { createRoot, createSignal } from "solid-js";
import type { CivilBookmark } from "~/types";

const LS_KEY = "civil-bookmarks";

function load(): CivilBookmark[] {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
    } catch {
        return [];
    }
}

function save(bms: CivilBookmark[]): void {
    localStorage.setItem(LS_KEY, JSON.stringify(bms));
}

const [bookmarks, setBookmarks] = createRoot(() =>
    createSignal<CivilBookmark[]>(typeof window !== "undefined" ? load() : []),
);

if (typeof window !== "undefined") {
    window.addEventListener("storage", e => {
        if (e.key === LS_KEY) setBookmarks(load());
    });
}

export { bookmarks };

export function bookmarksGetAll(): CivilBookmark[] {
    return bookmarks();
}

export function bookmarksAdd(
    url: string,
    title: string,
    favicon?: string,
): CivilBookmark {
    const bookmark: CivilBookmark = {
        id: crypto.randomUUID(),
        url,
        title: title || url,
        favicon,
        addedAt: Date.now(),
    };
    const next = [...bookmarks(), bookmark];
    save(next);
    setBookmarks(next);
    return bookmark;
}

export function bookmarksRemove(id: string): void {
    const next = bookmarks().filter(b => b.id !== id);
    save(next);
    setBookmarks(next);
}

export function bookmarksIsBookmarked(url: string): boolean {
    return bookmarks().some(b => b.url === url);
}

export function bookmarksGetByUrl(url: string): CivilBookmark | null {
    return bookmarks().find(b => b.url === url) ?? null;
}
