import { createMemo, createSignal, For, Show } from "solid-js";

import { bookmarks, bookmarksRemove } from "~/api/bookmarks";
import {
    IconBookmark,
    IconClock,
    IconClose,
    IconTrash,
    IconWorld,
} from "~/components/icons";
import Anno from "~/components/schematic/Anno";
import Lookup from "~/components/schematic/Lookup";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import { ArmedKey } from "~/components/SettingControls";
import Specimen from "~/components/Specimen";
import { tabManager } from "~/lib/TabManager";
import type { CivilBookmark } from "~/types";

import * as s from "~/styles/BookmarksPage.css";
import * as schematic from "~/styles/schematic.css";

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function Stamp(props: { favicon?: string }) {
    const [failed, setFailed] = createSignal(false);
    return (
        <Show
            when={props.favicon && !failed()}
            fallback={
                <div class={s.stampFallback}>
                    <IconWorld size={13} />
                </div>
            }
        >
            <div class={s.stamp}>
                <img
                    src={props.favicon}
                    class={s.stampImg}
                    alt=""
                    onError={() => setFailed(true)}
                />
            </div>
        </Show>
    );
}

/** Compact and absolute: "3 Aug" beats "11 days ago" for scanning a column. */
function savedOn(ts: number) {
    return new Date(ts).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
    });
}

function openBookmark(bm: CivilBookmark) {
    const existing = tabManager.tabs.find(t => t.url === bm.url);
    if (existing) {
        tabManager.activateTab(existing.id);
    } else {
        const t = tabManager.createTab(bm.url);
        tabManager.activateTab(t.id);
    }
}

function useBookmarkList() {
    const [search, setSearch] = createSignal("");
    const [scope, setScope] = createSignal<"all" | "recent">("all");

    // The set the current scope selects, before the lookup narrows it. The
    // count reads against this so a search that matches nothing doesn't render
    // as "0 saved" while six are stored.
    const inScope = createMemo(() => {
        const list = bookmarks();
        if (scope() !== "recent") return list;
        const cutoff = Date.now() - RECENT_WINDOW_MS;
        return list.filter(b => b.addedAt >= cutoff);
    });

    const listed = createMemo(() => {
        let list = inScope();
        const q = search().toLowerCase().trim();
        if (q)
            list = list.filter(
                b =>
                    b.title.toLowerCase().includes(q) ||
                    b.url.toLowerCase().includes(q),
            );
        return list.toSorted((a, b) => b.addedAt - a.addedAt);
    });

    /**
     * One text node, not a row of spans. A live region announces `textContent`,
     * and separately-styled number and word spans leave no whitespace between
     * them in the DOM — the exact bug History shipped.
     */
    const countLabel = createMemo(() =>
        search().trim()
            ? `${listed().length} of ${inScope().length} shown`
            : `${inScope().length} saved`,
    );

    return { search, setSearch, scope, setScope, inScope, listed, countLabel };
}

type BookmarkList = ReturnType<typeof useBookmarkList>;

function ScopeSwitch(props: { list: BookmarkList }) {
    return (
        <div class={s.scopeSwitch}>
            <button
                type="button"
                class={
                    props.list.scope() === "all"
                        ? s.scopeBtn.on
                        : s.scopeBtn.off
                }
                aria-pressed={props.list.scope() === "all" ? "true" : "false"}
                onClick={() => props.list.setScope("all")}
            >
                <IconBookmark size={13} />
                All
            </button>
            <button
                type="button"
                class={
                    props.list.scope() === "recent"
                        ? s.scopeBtn.on
                        : s.scopeBtn.off
                }
                aria-pressed={
                    props.list.scope() === "recent" ? "true" : "false"
                }
                onClick={() => props.list.setScope("recent")}
            >
                <IconClock size={13} />
                Recent
            </button>
        </div>
    );
}

function BookmarkActions(props: { list: BookmarkList }) {
    return (
        <div class={s.titleActions}>
            <ScopeSwitch list={props.list} />
            {/* Deleting every bookmark in view can't be undone, so the button
                asks once first — the same inline two-step used on History. */}
            <Show when={props.list.listed().length > 0}>
                <ArmedKey
                    icon={<IconTrash size={13} />}
                    label="Clear"
                    armedLabel="Click again to delete"
                    onConfirm={() => {
                        // Clears what is listed, not the whole store: the
                        // label sits next to a scope selector and a lookup, so
                        // "clear" can only sensibly mean these.
                        for (const b of props.list.listed())
                            bookmarksRemove(b.id);
                    }}
                />
            </Show>
        </div>
    );
}

function NoBookmarks(props: { list: BookmarkList; onClearSearch: () => void }) {
    return (
        <div class={s.empty}>
            <Specimen icon={IconBookmark} tint="stone" size={64} />
            <Anno muted>
                {props.list.search()
                    ? `No bookmarks match “${props.list.search()}”.`
                    : props.list.scope() === "recent"
                      ? "Nothing bookmarked in the last week."
                      : "No bookmarks yet. Save a page from the bookmarks bar and it will show up here."}
            </Anno>
            {/* A dead end otherwise: the list is empty and the only way
                back is to find the lookup again. */}
            <Show when={props.list.search()}>
                <button
                    type="button"
                    class={s.emptyAction}
                    onClick={() => props.onClearSearch()}
                >
                    Clear search
                </button>
            </Show>
        </div>
    );
}

function BookmarkRow(props: { bm: CivilBookmark }) {
    return (
        <li class={s.row}>
            <button
                type="button"
                class={s.openBtn}
                onClick={() => openBookmark(props.bm)}
            >
                <Stamp favicon={props.bm.favicon} />
                <span class={s.entry}>
                    <span class={s.entryTitle}>{props.bm.title}</span>
                    <span class={s.entryUrl}>{props.bm.url}</span>
                </span>
                {/* The date column is what the RECENT scope exists to
                    answer. */}
                <span class={s.entryAdded}>{savedOn(props.bm.addedAt)}</span>
            </button>
            <button
                type="button"
                class={s.removeBtn}
                aria-label={`Remove bookmark ${props.bm.title}`}
                onClick={() => bookmarksRemove(props.bm.id)}
            >
                <IconClose size={14} />
            </button>
        </li>
    );
}

export default function BookmarksPage() {
    const list = useBookmarkList();
    let lookupInput: HTMLInputElement | undefined;

    const clearSearch = () => {
        list.setSearch("");
        lookupInput?.focus();
    };

    return (
        <Sheet>
            <TitleBlock
                title="Bookmarks"
                icon={IconBookmark}
                tint="calcite"
                // The lookup row states this same count in a live region a few
                // pixels below. Printing it twice on one screen is noise, and
                // the lookup's copy is the one that responds to a search.
                meta={undefined}
                actions={<BookmarkActions list={list} />}
            />

            <p class={schematic.lede}>
                Your saved pages, all in one place. Search to find a favorite.
            </p>

            <div class={s.lookup}>
                <Lookup
                    value={list.search()}
                    placeholder="Search title or address"
                    label="Search bookmarks"
                    clearTitle="Clear search"
                    onChange={list.setSearch}
                    inputRef={el => (lookupInput = el)}
                />
                <span class={s.lookupCount} aria-live="polite">
                    {list.countLabel()}
                </span>
            </div>

            <Rule
                label={list.scope() === "recent" ? "Last 7 days" : undefined}
                weight="major"
            />

            <Show when={list.listed().length === 0}>
                <NoBookmarks list={list} onClearSearch={clearSearch} />
            </Show>

            <ul class={s.register}>
                <For each={list.listed()} keyed={false}>
                    {bm => <BookmarkRow bm={bm()} />}
                </For>
            </ul>
        </Sheet>
    );
}
