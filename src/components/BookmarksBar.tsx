import { createSignal, For, Show } from "solid-js";

import {
    bookmarks,
    bookmarksAdd,
    bookmarksIsBookmarked,
    bookmarksRemove,
} from "~/api/bookmarks";
import {
    IconBookmarkFilled,
    IconBookmarkOutline,
    IconClose,
    IconWorld,
} from "~/components/icons";
import { isNewtabUrl } from "~/lib/browserUrls";
import type { CivilBookmark } from "~/types";

import * as s from "~/styles/BookmarksBar.css";

function BookmarkFavicon(props: { favicon?: string }) {
    const [failed, setFailed] = createSignal(false);
    return (
        <Show
            when={props.favicon && !failed()}
            fallback={
                <span class={s.bookmarkFaviconFallback}>
                    <IconWorld size={11} />
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

function BookmarkChip(props: {
    bookmark: CivilBookmark;
    onNavigate: (url: string) => void;
}) {
    return (
        <button
            type="button"
            class={s.bookmark}
            title={props.bookmark.url}
            onClick={() => props.onNavigate(props.bookmark.url)}
        >
            <BookmarkFavicon favicon={props.bookmark.favicon} />
            <span class={s.bookmarkLabel}>{props.bookmark.title}</span>
            {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- remove control sits inside the bookmark's own button row */}
            <span
                class={s.bookmarkRemove}
                onClick={e => {
                    e.stopPropagation();
                    bookmarksRemove(props.bookmark.id);
                }}
            >
                <IconClose size={10} />
            </span>
        </button>
    );
}

export default function BookmarksBar(props: BookmarksBarProps) {
    const isNewtab = () => isNewtabUrl(props.activeUrl);
    const isBookmarked = () =>
        !isNewtab() && bookmarksIsBookmarked(props.activeUrl);

    const handleAdd = () => {
        if (isNewtab() || !props.activeUrl) return;
        if (isBookmarked()) {
            const existing = bookmarks().find(bm => bm.url === props.activeUrl);
            if (existing) bookmarksRemove(existing.id);
        } else {
            bookmarksAdd(
                props.activeUrl,
                props.activeTitle,
                props.activeFavicon,
            );
        }
    };

    return (
        <div class={s.bar}>
            <Show when={bookmarks().length === 0}>
                <span class={s.emptyHint}>Bookmark a page to pin it here</span>
            </Show>
            <For each={bookmarks()} keyed={false}>
                {bm => (
                    <BookmarkChip
                        bookmark={bm()}
                        onNavigate={props.onNavigate}
                    />
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
                        fallback={<IconBookmarkOutline size={13} />}
                    >
                        <IconBookmarkFilled size={13} />
                    </Show>
                </button>
            </Show>
        </div>
    );
}
