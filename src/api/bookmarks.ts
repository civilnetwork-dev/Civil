import type { CivilBookmark } from "~/types";

const LS_KEY = "civil-bookmarks";

function load(): CivilBookmark[] {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
    } catch {
        return [];
    }
}

function save(bookmarks: CivilBookmark[]): void {
    localStorage.setItem(LS_KEY, JSON.stringify(bookmarks));
}

export function bookmarksGetAll(): CivilBookmark[] {
    return load();
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
    const all = load();
    all.push(bookmark);
    save(all);
    return bookmark;
}

export function bookmarksRemove(id: string): void {
    save(load().filter(b => b.id !== id));
}

export function bookmarksIsBookmarked(url: string): boolean {
    return load().some(b => b.url === url);
}

export function bookmarksGetByUrl(url: string): CivilBookmark | null {
    return load().find(b => b.url === url) ?? null;
}
