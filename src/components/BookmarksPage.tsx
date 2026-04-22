import {
    TbOutlineBookmark,
    TbOutlineTrash,
    TbOutlineWorld,
    TbOutlineX,
} from "solid-icons/tb";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { bookmarksGetAll, bookmarksRemove } from "~/api/bookmarks";
import { tabManager } from "~/lib/TabManager";
import * as s from "~/styles/BookmarksPage.css";
import type { CivilBookmark } from "~/types";

function BookmarkFavicon(props: { favicon?: string }) {
    const [failed, setFailed] = createSignal(false);
    return (
        <Show
            when={props.favicon && !failed()}
            fallback={
                <div class={s.cardFaviconFallback}>
                    <TbOutlineWorld size={13} />
                </div>
            }
        >
            <img
                src={props.favicon}
                class={s.cardFavicon}
                alt=""
                onError={() => setFailed(true)}
            />
        </Show>
    );
}

export default function BookmarksPage() {
    const [bookmarks, setBookmarks] = createSignal<CivilBookmark[]>([]);
    const [search, setSearch] = createSignal("");
    const [filter, setFilter] = createSignal<"all" | "recent">("all");

    onMount(() => setBookmarks(bookmarksGetAll()));

    const refresh = () => setBookmarks(bookmarksGetAll());

    const filtered = createMemo(() => {
        let list = bookmarks();
        if (filter() === "recent") {
            const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
            list = list.filter(b => b.addedAt >= cutoff);
        }
        const q = search().toLowerCase().trim();
        if (q)
            list = list.filter(
                b =>
                    b.title.toLowerCase().includes(q) ||
                    b.url.toLowerCase().includes(q),
            );
        return list.slice().sort((a, b) => b.addedAt - a.addedAt);
    });

    const handleOpen = (bm: CivilBookmark) => {
        const existing = tabManager.tabs.find(t => t.url === bm.url);
        if (existing) {
            tabManager.activateTab(existing.id);
        } else {
            const t = tabManager.createTab(bm.url);
            tabManager.activateTab(t.id);
        }
    };

    const handleRemove = (e: MouseEvent, id: string) => {
        e.stopPropagation();
        bookmarksRemove(id);
        refresh();
    };

    const handleClearAll = () => {
        filtered().forEach(b => {
            bookmarksRemove(b.id);
        });
        refresh();
    };

    return (
        <div class={s.root}>
            <div class={s.sidebar}>
                <p class={s.sidebarTitle}>Bookmarks</p>
                <button
                    type="button"
                    class={`${s.sidebarItem}${filter() === "all" ? ` ${s.sidebarItemActive}` : ""}`}
                    onClick={() => setFilter("all")}
                >
                    <TbOutlineBookmark size={15} />
                    All Bookmarks
                </button>
                <button
                    type="button"
                    class={`${s.sidebarItem}${filter() === "recent" ? ` ${s.sidebarItemActive}` : ""}`}
                    onClick={() => setFilter("recent")}
                >
                    Recently Added
                </button>
            </div>

            <div class={s.main}>
                <div class={s.mainHeader}>
                    <span class={s.mainTitle}>
                        {filter() === "recent"
                            ? "Recently Added"
                            : "All Bookmarks"}{" "}
                        <span
                            style={{
                                color: `var(--civil-color-overlay1)`,
                                "font-size": "16px",
                                "font-weight": "400",
                            }}
                        >
                            ({filtered().length})
                        </span>
                    </span>
                    <div
                        style={{
                            display: "flex",
                            gap: "10px",
                            "align-items": "center",
                        }}
                    >
                        <input
                            class={s.searchInput}
                            type="text"
                            placeholder="Search bookmarks…"
                            value={search()}
                            onInput={e => setSearch(e.currentTarget.value)}
                        />
                        <Show when={filtered().length > 0}>
                            <button
                                type="button"
                                class={s.clearBtn}
                                onClick={handleClearAll}
                            >
                                <TbOutlineTrash size={14} />
                                Clear
                            </button>
                        </Show>
                    </div>
                </div>

                <Show when={filtered().length === 0}>
                    <p class={s.empty}>
                        {search()
                            ? "No bookmarks match your search."
                            : "No bookmarks yet."}
                    </p>
                </Show>

                <div class={s.list}>
                    <For each={filtered()}>
                        {bm => (
                            // biome-ignore lint/a11y/useKeyWithClickEvents: biome breaking my project lmao
                            // biome-ignore lint/a11y/noStaticElementInteractions: biome breaking my project lmao
                            <div class={s.card} onClick={() => handleOpen(bm)}>
                                <BookmarkFavicon favicon={bm.favicon} />
                                <div class={s.cardInfo}>
                                    <div class={s.cardTitle}>{bm.title}</div>
                                    <div class={s.cardUrl}>{bm.url}</div>
                                </div>
                                <button
                                    type="button"
                                    class={s.removeBtn}
                                    title="Remove bookmark"
                                    onClick={e => handleRemove(e, bm.id)}
                                >
                                    <TbOutlineX size={15} />
                                </button>
                            </div>
                        )}
                    </For>
                </div>
            </div>
        </div>
    );
}
