/**
 * chrome.bookmarks. No real bookmark store here, but unlike history or
 * downloads (api/deviceApis.ts's `buildEmptyCollections`, genuinely nothing
 * to seed), a filter can be *configured* through one: impero reads its
 * school code from a bookmark titled "impero" whose URL carries a
 * `school_code` query parameter — a school's IT admin pushes it via policy
 * the same way a managed Chromebook pushes any other bookmark. `search({})`
 * (real Chrome: no query fields set, matches everything) is the only method
 * this vendor calls; the rest stay simple recorded no-ops, same shape as
 * the other harmless bookmark mutations no bundle here depends on.
 */

interface SeedBookmark {
    id: string;
    title: string;
    url: string;
}

export function buildBookmarks(seed: { title: string; url: string }[] = []) {
    const tree: SeedBookmark[] = seed.map((b, i) => ({
        id: String(i + 1),
        title: b.title,
        url: b.url,
    }));

    return {
        search: async () => tree,
        getTree: async () => tree,
        getChildren: async () => tree,
        getRecent: async () => tree,
        getSubTree: async () => tree,
        get: async () => [],
        create: async () => ({ id: "1", title: "" }),
        move: async () => ({ id: "1", title: "" }),
        update: async () => ({ id: "1", title: "" }),
        remove: async () => {},
        removeTree: async () => {},
        onCreated: emptyEvent(),
        onRemoved: emptyEvent(),
        onChanged: emptyEvent(),
        onMoved: emptyEvent(),
    };
}

function emptyEvent() {
    return {
        addListener: () => {},
        removeListener: () => {},
        hasListener: () => false,
    };
}
