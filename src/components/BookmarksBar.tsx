import { FaRegularBookmark, FaSolidBookmark } from "solid-icons/fa";
import { TbOutlineWorld, TbOutlineX } from "solid-icons/tb";
import { createSignal, For, onMount, Show } from "solid-js";
import {
    bookmarksAdd,
    bookmarksGetAll,
    bookmarksIsBookmarked,
    bookmarksRemove,
} from "~/api/bookmarks";
import { isNewtabUrl } from "~/lib/TabManager";
import * as s from "~/styles/BookmarksBar.css";
import type { CivilBookmark } from "~/types";

function BookmarkFavicon(props: { favicon?: string }) {
    const [failed, setFailed] = createSignal(false);
    return (
        <Show
            when={props.favicon && !failed()}
            fallback={
                <span class={s.bookmarkFaviconFallback}>
                    <TbOutlineWorld size={11} />
                </span>
            }
        >
            <img
                src={props.favicon}
                class={s.bookmarkFavicon}
                alt=""
                onError={() => setFailed(true)}
            />
        </Show>
    );
}

interface BookmarksBarProps {
    activeUrl: string;
    activeTitle: string;
    activeFavicon?: string;
    onNavigate: (url: string) => void;
}

export default function BookmarksBar(props: BookmarksBarProps) {
    const [bookmarks, setBookmarks] = createSignal<CivilBookmark[]>([]);
    const isNewtab = () => isNewtabUrl(props.activeUrl);
    const isBookmarked = () =>
        !isNewtab() && bookmarksIsBookmarked(props.activeUrl);

    onMount(() => setBookmarks(bookmarksGetAll()));

    const refresh = () => setBookmarks(bookmarksGetAll());

    const handleAdd = () => {
        if (isNewtab() || !props.activeUrl) return;
        if (isBookmarked()) {
            const b = bookmarksGetAll().find(b => b.url === props.activeUrl);
            if (b) {
                bookmarksRemove(b.id);
                refresh();
            }
        } else {
            bookmarksAdd(
                props.activeUrl,
                props.activeTitle,
                props.activeFavicon,
            );
            refresh();
        }
    };

    const handleRemove = (e: MouseEvent, id: string) => {
        e.stopPropagation();
        bookmarksRemove(id);
        refresh();
    };

    return (
        <div class={s.bar}>
            <Show when={bookmarks().length === 0}>
                <span class={s.emptyHint}>Bookmarks bar</span>
            </Show>
            <For each={bookmarks()}>
                {bm => (
                    <button
                        type="button"
                        class={s.bookmark}
                        title={bm.url}
                        onClick={() => props.onNavigate(bm.url)}
                    >
                        <BookmarkFavicon favicon={bm.favicon} />
                        <span class={s.bookmarkLabel}>{bm.title}</span>
                        {/** biome-ignore lint/a11y/noStaticElementInteractions: biome breaking my project lmao */}
                        {/** biome-ignore lint/a11y/useKeyWithClickEvents: biome breaking my project lmao */}
                        <span
                            class={s.bookmarkRemove}
                            onClick={e => handleRemove(e as MouseEvent, bm.id)}
                        >
                            <TbOutlineX size={10} />
                        </span>
                    </button>
                )}
            </For>
            <Show when={!isNewtab() && props.activeUrl}>
                <div class={s.separator} />
                <button
                    type="button"
                    class={s.addBookmarkBtn}
                    title={
                        isBookmarked()
                            ? "Remove bookmark"
                            : "Bookmark this page"
                    }
                    onClick={handleAdd}
                >
                    <Show
                        when={isBookmarked()}
                        fallback={<FaRegularBookmark size={13} />}
                    >
                        <FaSolidBookmark size={13} />
                    </Show>
                </button>
            </Show>
        </div>
    );
}
