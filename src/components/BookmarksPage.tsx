import { createMemo, createSignal, For, Show } from "solid-js";
import { bookmarks, bookmarksRemove } from "~/api/bookmarks";
import {
    IconBookmark,
    IconClock,
    IconClose,
    IconTrash,
    IconWorld,
} from "~/components/icons";
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
                    <IconWorld size={13} />
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
    const [search, setSearch] = createSignal("");
    const [filter, setFilter] = createSignal<"all" | "recent">("all");

    // The set the current sidebar filter selects, before the search box
    // narrows it. The header counts against this so a search that matches
    // nothing doesn't render as "All Bookmarks (0)" while six are stored.
    const inScope = createMemo(() => {
        const list = bookmarks();
        if (filter() !== "recent") return list;
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return list.filter(b => b.addedAt >= cutoff);
    });

    const filtered = createMemo(() => {
        let list = inScope();
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
    };

    // Deleting every bookmark in view can't be undone, so the button asks
    // once first - same inline two-step used on History.
    const [confirmingClear, setConfirmingClear] = createSignal(false);
    let confirmTimer: ReturnType<typeof setTimeout> | undefined;

    const handleClearAll = () => {
        if (!confirmingClear()) {
            setConfirmingClear(true);
            confirmTimer = setTimeout(() => setConfirmingClear(false), 4000);
            return;
        }
        clearTimeout(confirmTimer);
        setConfirmingClear(false);
        for (const b of filtered()) bookmarksRemove(b.id);
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
                    <IconBookmark size={15} /> All Bookmarks
                </button>
                <button
                    type="button"
                    class={`${s.sidebarItem}${filter() === "recent" ? ` ${s.sidebarItemActive}` : ""}`}
                    onClick={() => setFilter("recent")}
                >
                    <IconClock size={15} /> Recently Added
                </button>
            </div>

            <div class={s.main}>
                <div class={s.mainHeader}>
                    <div class={s.mainTitleGroup}>
                        <span class={s.mainEyebrow}>
                            <span class={s.mainEyebrowMark} />
                            Collection
                        </span>
                        <span class={s.mainTitle}>
                            {filter() === "recent"
                                ? "Recently Added"
                                : "All Bookmarks"}{" "}
                            <span class={s.mainCount}>
                                {search().trim()
                                    ? `(${filtered().length} of ${inScope().length})`
                                    : `(${inScope().length})`}
                            </span>
                        </span>
                    </div>
                    <div class={s.mainActions}>
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
                                class={`${s.clearBtn}${confirmingClear() ? ` ${s.clearBtnArmed}` : ""}`}
                                onClick={handleClearAll}
                            >
                                <IconTrash size={14} />
                                {confirmingClear()
                                    ? "Click again to delete"
                                    : "Clear"}
                            </button>
                        </Show>
                    </div>
                </div>

                <Show when={filtered().length === 0}>
                    <div class={s.empty}>
                        <span class={s.emptyRibbon} />
                        <p class={s.emptyText}>
                            {search()
                                ? `Nothing matches “${search()}”.`
                                : filter() === "recent"
                                  ? "Nothing bookmarked in the last week."
                                  : "No bookmarks yet."}
                        </p>
                        {/* A dead end otherwise: the list is empty and the
                            only way back is to find the search box again. */}
                        <Show when={search()}>
                            <button
                                type="button"
                                class={s.emptyAction}
                                onClick={() => setSearch("")}
                            >
                                Clear search
                            </button>
                        </Show>
                    </div>
                </Show>

                <div class={s.list}>
                    <For each={filtered()} keyed={false}>
                        {bm => (
                            // biome-ignore lint/a11y/useKeyWithClickEvents: biome breaking my project lmao
                            // biome-ignore lint/a11y/noStaticElementInteractions: biome breaking my project lmao
                            <div
                                class={s.card}
                                onClick={() => handleOpen(bm())}
                            >
                                <BookmarkFavicon favicon={bm().favicon} />
                                <div class={s.cardInfo}>
                                    <div class={s.cardTitle}>{bm().title}</div>
                                    <div class={s.cardUrl}>{bm().url}</div>
                                </div>
                                <button
                                    type="button"
                                    class={s.removeBtn}
                                    title="Remove bookmark"
                                    onClick={e => handleRemove(e, bm().id)}
                                >
                                    <IconClose size={15} />
                                </button>
                            </div>
                        )}
                    </For>
                </div>
            </div>
        </div>
    );
}
