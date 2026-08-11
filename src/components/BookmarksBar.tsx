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
import { isNewtabUrl } from "~/lib/TabManager";
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

export default function BookmarksBar(props: BookmarksBarProps) {
    const isNewtab = () => isNewtabUrl(props.activeUrl);
    const isBookmarked = () =>
        !isNewtab() && bookmarksIsBookmarked(props.activeUrl);

    const handleAdd = () => {
        if (isNewtab() || !props.activeUrl) return;
        if (isBookmarked()) {
            const b = bookmarks().find(b => b.url === props.activeUrl);
            if (b) bookmarksRemove(b.id);
        } else {
            bookmarksAdd(
                props.activeUrl,
                props.activeTitle,
                props.activeFavicon,
            );
        }
    };

    const handleRemove = (e: MouseEvent, id: string) => {
        e.stopPropagation();
        bookmarksRemove(id);
    };

    return (
        <div class={s.bar}>
            <Show when={bookmarks().length === 0}>
                <span class={s.emptyHint}>Bookmark a page to pin it here</span>
            </Show>
            <For each={bookmarks()} keyed={false}>
                {bm => (
                    <button
                        type="button"
                        class={s.bookmark}
                        title={bm().url}
                        onClick={() => props.onNavigate(bm().url)}
                    >
                        <BookmarkFavicon favicon={bm().favicon} />
                        <span class={s.bookmarkLabel}>{bm().title}</span>
                        {/** biome-ignore lint/a11y/noStaticElementInteractions: biome breaking my project lmao */}
                        {/** biome-ignore lint/a11y/useKeyWithClickEvents: biome breaking my project lmao */}
                        <span
                            class={s.bookmarkRemove}
                            onClick={e =>
                                handleRemove(e as MouseEvent, bm().id)
                            }
                        >
                            <IconClose size={10} />
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
                        fallback={<IconBookmarkOutline size={13} />}
                    >
                        <IconBookmarkFilled size={13} />
                    </Show>
                </button>
            </Show>
        </div>
    );
}
