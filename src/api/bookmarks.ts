import { createReactiveJSON, lsSetJSON } from "~/lib/reactiveStorage";
import type { CivilBookmark } from "~/types";

const LS_KEY = "civil-bookmarks";

function save(bms: CivilBookmark[]): void {
    lsSetJSON(LS_KEY, bms);
}

/** Live, reactive bookmarks list. Updates on add/remove in any tab. */
const bookmarks = createReactiveJSON<CivilBookmark[]>(LS_KEY, []);

export { bookmarks };

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
    save([...bookmarks(), bookmark]);
    return bookmark;
}

export function bookmarksRemove(id: string): void {
    save(bookmarks().filter(b => b.id !== id));
}

export function bookmarksIsBookmarked(url: string): boolean {
    return bookmarks().some(b => b.url === url);
}
