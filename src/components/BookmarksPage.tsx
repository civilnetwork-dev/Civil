import { createMemo, createSignal, For, Show } from "solid-js";
import { bookmarks, bookmarksRemove } from "~/api/bookmarks";
import {
    IconBookmark,
    IconClock,
    IconClose,
    IconSearch,
    IconTrash,
    IconWorld,
} from "~/components/icons";
import Anno from "~/components/schematic/Anno";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import { tabManager } from "~/lib/TabManager";
import * as s from "~/styles/BookmarksPage.css";
import * as schematic from "~/styles/schematic.css";
import type { CivilBookmark } from "~/types";

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

export default function BookmarksPage() {
    const [search, setSearch] = createSignal("");
    const [scope, setScope] = createSignal<"all" | "recent">("all");
    let lookupInput: HTMLInputElement | undefined;

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
        return list.slice().sort((a, b) => b.addedAt - a.addedAt);
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

    /** Compact and absolute: "3 Aug" beats "11 days ago" for scanning a column. */
    const savedOn = (ts: number) =>
        new Date(ts).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
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

    // Deleting every bookmark in view can't be undone, so the button asks once
    // first — the same inline two-step used on History.
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
        // Clears what is listed, not the whole store: the label sits next to a
        // scope selector and a lookup, so "clear" can only sensibly mean these.
        for (const b of listed()) bookmarksRemove(b.id);
    };

    return (
        <Sheet>
            <TitleBlock
                title="Bookmarks"
                // The lookup row states this same count in a live region a few
                // pixels below. Printing it twice on one screen is noise, and
                // the lookup's copy is the one that responds to a search.
                meta={undefined}
                actions={
                    <div class={s.titleActions}>
                        <div class={s.scopeSwitch}>
                            <button
                                type="button"
                                class={
                                    scope() === "all"
                                        ? s.scopeBtn.on
                                        : s.scopeBtn.off
                                }
                                aria-pressed={
                                    scope() === "all" ? "true" : "false"
                                }
                                onClick={() => setScope("all")}
                            >
                                <IconBookmark size={13} />
                                all
                            </button>
                            <button
                                type="button"
                                class={
                                    scope() === "recent"
                                        ? s.scopeBtn.on
                                        : s.scopeBtn.off
                                }
                                aria-pressed={
                                    scope() === "recent" ? "true" : "false"
                                }
                                onClick={() => setScope("recent")}
                            >
                                <IconClock size={13} />
                                recent
                            </button>
                        </div>
                        <Show when={listed().length > 0}>
                            <button
                                type="button"
                                class={`${s.clearBtn}${confirmingClear() ? ` ${s.clearBtnArmed}` : ""}`}
                                onClick={handleClearAll}
                            >
                                <IconTrash size={13} />
                                {confirmingClear()
                                    ? "click again to delete"
                                    : "clear"}
                            </button>
                        </Show>
                    </div>
                }
            />

            <p class={schematic.lede}>
                Saved to this device, not to a district console. Yours to keep,
                rename, or delete — no approval, no sync you did not ask for.
            </p>

            <div class={s.lookup}>
                <IconSearch size={15} class={s.lookupIcon} />
                <input
                    ref={lookupInput}
                    class={s.lookupInput}
                    type="text"
                    value={search()}
                    placeholder="Search title or address"
                    aria-label="Search bookmarks"
                    onInput={e => setSearch(e.currentTarget.value)}
                    onKeyDown={e => {
                        if (e.key === "Escape") {
                            setSearch("");
                            e.currentTarget.blur();
                        }
                    }}
                />
                <Show when={search()}>
                    <button
                        type="button"
                        class={s.lookupClear}
                        title="Clear search"
                        onClick={() => {
                            setSearch("");
                            lookupInput?.focus();
                        }}
                    >
                        <IconClose size={13} />
                    </button>
                </Show>
                <span class={s.lookupCount} aria-live="polite">
                    {countLabel()}
                </span>
            </div>

            <Rule
                label={scope() === "recent" ? "last 7 days" : undefined}
                weight="major"
            />

            <Show when={listed().length === 0}>
                <div class={s.empty}>
                    <Anno muted>
                        {search()
                            ? `nothing matches “${search()}”`
                            : scope() === "recent"
                              ? "nothing bookmarked in the last week"
                              : "no bookmarks yet — saved to this device, not to a console"}
                    </Anno>
                    {/* A dead end otherwise: the list is empty and the only way
                        back is to find the lookup again. */}
                    <Show when={search()}>
                        <button
                            type="button"
                            class={s.emptyAction}
                            onClick={() => {
                                setSearch("");
                                lookupInput?.focus();
                            }}
                        >
                            clear search
                        </button>
                    </Show>
                </div>
            </Show>

            <ul class={s.register}>
                <For each={listed()} keyed={false}>
                    {bm => (
                        <li class={s.row}>
                            <button
                                type="button"
                                class={s.openBtn}
                                onClick={() => handleOpen(bm())}
                            >
                                <Stamp favicon={bm().favicon} />
                                <span class={s.entry}>
                                    <span class={s.entryTitle}>
                                        {bm().title}
                                    </span>
                                    <span class={s.entryUrl}>{bm().url}</span>
                                </span>
                                {/* The date column is what the RECENT scope
                                    exists to answer. */}
                                <span class={s.entryAdded}>
                                    {savedOn(bm().addedAt)}
                                </span>
                            </button>
                            <button
                                type="button"
                                class={s.removeBtn}
                                aria-label={`Remove bookmark ${bm().title}`}
                                onClick={() => bookmarksRemove(bm().id)}
                            >
                                <IconClose size={14} />
                            </button>
                        </li>
                    )}
                </For>
            </ul>
        </Sheet>
    );
}
