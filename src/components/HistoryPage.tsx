import { createMemo, createSignal, For, onSettled, Show } from "solid-js";

import {
    HISTORY_LS_KEY,
    historyClear,
    historyDelete,
    historyGetAll,
} from "~/api/history";
import { IconClose, IconSearch, IconWorld } from "~/components/icons";
import Anno from "~/components/schematic/Anno";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import { onLsChange } from "~/lib/reactiveStorage";
import { tabManager } from "~/lib/TabManager";
import type { CivilHistoryEntry } from "~/types";

import * as s from "~/styles/HistoryPage.css";
import * as schematic from "~/styles/schematic.css";

export default function HistoryPage() {
    const [entries, setEntries] = createSignal<CivilHistoryEntry[]>([]);
    const [query, setQuery] = createSignal("");
    let filterInput: HTMLInputElement | undefined;

    // Filtering feeds the day charts as well as the list, so typing a domain
    // turns every day's header into "when did I visit this" rather than just
    // hiding rows.
    const matches = createMemo(() => {
        const q = query().trim().toLowerCase();
        if (!q) return entries();
        return entries().filter(
            e =>
                e.url.toLowerCase().includes(q) ||
                (e.title ?? "").toLowerCase().includes(q),
        );
    });

    const reload = () => {
        void historyGetAll().then(all => setEntries(all));
    };

    // Initial load + live-update the localStorage-backed history when it
    // changes here or in another tab; the returned unsubscribe runs on unmount.
    // (IndexedDB writes don't touch localStorage, so that path still relies on
    // the explicit reloads in the handlers below.)
    onSettled(() => {
        reload();
        return onLsChange(HISTORY_LS_KEY, reload);
    });

    // Clearing history can't be undone, so the button asks once before doing
    // it. An inline two-step keeps the confirmation in the same place as the
    // action instead of throwing a modal over the page.
    const [confirmingClear, setConfirmingClear] = createSignal(false);
    let confirmTimer: ReturnType<typeof setTimeout> | undefined;

    const handleClear = async () => {
        if (!confirmingClear()) {
            setConfirmingClear(true);
            confirmTimer = setTimeout(() => setConfirmingClear(false), 4000);
            return;
        }
        clearTimeout(confirmTimer);
        setConfirmingClear(false);
        await historyClear();
        setEntries([]);
    };

    const handleDelete = async (id: string) => {
        await historyDelete(id);
        setEntries(entries().filter(e => e.id !== id));
    };

    /**
     * Clicking an entry opens the page — the expectation every browser's
     * history page has trained. This page previously could not navigate at
     * all: clicking an entry opened a disclosure showing the full URL and a
     * remove link, so the one thing a user comes to history to do was the one
     * thing it did not offer.
     */
    const handleOpen = (entry: CivilHistoryEntry) => {
        const existing = tabManager.tabs.find(t => t.url === entry.url);
        if (existing) {
            tabManager.activateTab(existing.id);
        } else {
            const t = tabManager.createTab(entry.url);
            tabManager.activateTab(t.id);
        }
    };

    // "/" jumps to the filter the way it does in a pager, but only when the
    // user isn't already typing somewhere.
    onSettled(() => {
        const onKey = (ev: KeyboardEvent) => {
            if (ev.key !== "/" || ev.metaKey || ev.ctrlKey || ev.altKey) return;
            const t = ev.target as HTMLElement | null;
            if (
                t &&
                (t.isContentEditable ||
                    ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))
            )
                return;
            ev.preventDefault();
            filterInput?.focus();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    /**
     * Hostname only. A full URL in the row would push the timestamp column off
     * the sheet on long paths; the full address is the row's hover title.
     */
    const hostOf = (url: string) => {
        try {
            return new URL(url).hostname.replace(/^www\./, "");
        } catch {
            return url;
        }
    };

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const dayLabel = (ts: number) => {
        const d = new Date(ts);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === today.toDateString()) return "Today";
        if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
        return d.toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
        });
    };

    // Entries arrive newest-first; group consecutive same-day entries under
    // one rule so the timeline reads as days, not one undifferentiated list.
    //
    // Each group also carries a 24-slot tally of when in that day the visits
    // happened. The header renders it as a small chart, which turns a date
    // caption into an actual readout of the day's shape - the page already
    // holds the timestamps, it just wasn't showing what they say.
    const groupedByDay = createMemo(() => {
        const groups: {
            label: string;
            items: CivilHistoryEntry[];
            hours: number[];
            peak: number;
        }[] = [];
        for (const e of matches()) {
            const label = dayLabel(e.visitedAt);
            let last = groups[groups.length - 1];
            if (!last || last.label !== label) {
                last = {
                    label,
                    items: [],
                    hours: Array.from({ length: 24 }, () => 0),
                    peak: 0,
                };
                groups.push(last);
            }
            last.items.push(e);
            const h = new Date(e.visitedAt).getHours();
            last.hours[h] += 1;
            if (last.hours[h] > last.peak) last.peak = last.hours[h];
        }
        return groups;
    });

    /**
     * The same counts the visual scope line shows, as one sentence. Kept next to
     * the memos it reads so the two cannot report different numbers.
     */
    const scopeSentence = createMemo(() => {
        const total = entries().length;
        const days = groupedByDay().length;
        const scope = query().trim() ? `${matches().length} of ` : "";
        return `${scope}${total} ${total === 1 ? "page" : "pages"} across ${days} ${days === 1 ? "day" : "days"}`;
    });

    return (
        <Sheet>
            {/* The storage-backend Select (localStorage vs IndexedDB) that
                used to sit here was a developer control in a user page: no
                student can weigh that choice, and offering it suggests they
                should. The API keeps whatever method is stored; only the
                chooser is gone. */}
            <TitleBlock
                title="History"
                actions={
                    <div class={s.titleActions}>
                        <Show when={entries().length > 0}>
                            <button
                                type="button"
                                class={`${s.clearBtn}${confirmingClear() ? ` ${s.clearBtnArmed}` : ""}`}
                                onClick={handleClear}
                            >
                                {/* The armed state names the real scope. A
                                    filtered view shows a handful of rows, so
                                    "clear" alone reads as "clear these" when
                                    it actually deletes the whole record. */}
                                {confirmingClear()
                                    ? `Click again to delete ${String(entries().length)}`
                                    : "Clear all"}
                            </button>
                        </Show>
                    </div>
                }
            />

            <Show when={entries().length > 0}>
                <p class={schematic.lede}>
                    Find a page you visited earlier. Your history is stored on
                    this device.
                </p>

                <div class={s.scopeRow}>
                    <div class={s.filterField}>
                        <IconSearch size={15} class={s.filterIcon} />
                        <input
                            ref={filterInput}
                            class={s.filterInput}
                            type="text"
                            value={query()}
                            placeholder="Filter by title or address"
                            aria-label="Filter history"
                            onInput={e => setQuery(e.currentTarget.value)}
                            onKeyDown={e => {
                                if (e.key === "Escape") {
                                    setQuery("");
                                    e.currentTarget.blur();
                                }
                            }}
                        />
                        <Show when={query()}>
                            <button
                                type="button"
                                class={s.filterClear}
                                title="Clear filter"
                                onClick={() => {
                                    setQuery("");
                                    filterInput?.focus();
                                }}
                            >
                                <IconClose size={13} />
                            </button>
                        </Show>
                        <Show when={!query()}>
                            <kbd class={s.filterHint}>/</kbd>
                        </Show>
                    </div>
                    {/* One text node, so the live region reads exactly what
                        the eye does. The previous markup styled numbers and
                        words as separate spans, which announced "3pages2days"
                        and needed an aria-hidden copy plus a hidden sibling
                        to repair — two structures saying one sentence. */}
                    <p class={s.scopeStat} aria-live="polite">
                        {scopeSentence()}
                    </p>
                </div>
            </Show>

            <Show when={entries().length === 0}>
                <Rule weight="hair" />
                <div class={s.empty}>
                    <Anno class={s.emptyText}>
                        No history yet. Pages you visit will show up here.
                    </Anno>
                </div>
            </Show>

            <Show when={entries().length > 0 && matches().length === 0}>
                <Rule weight="hair" />
                <div class={s.empty}>
                    <Anno class={s.emptyText}>
                        No pages match “{query().trim()}”.
                    </Anno>
                    <button
                        type="button"
                        class={s.emptyAction}
                        onClick={() => {
                            setQuery("");
                            filterInput?.focus();
                        }}
                    >
                        Clear filter
                    </button>
                </div>
            </Show>

            <div class={s.list}>
                <For each={groupedByDay()} keyed={false}>
                    {group => (
                        <div class={s.dayGroup}>
                            <Rule
                                label={group().label}
                                weight="hair"
                                class={s.dayRuleEl}
                            />
                            <div class={s.dayMetrics}>
                                {/* Presentational: the count beside it is the
                                    accessible summary of the same data. */}
                                <span class={s.dayMeter} aria-hidden="true">
                                    <For each={group().hours} keyed={false}>
                                        {(n, i) => (
                                            <span
                                                class={`${s.dayMeterBar}${n() > 0 ? ` ${s.dayMeterBarOn}` : ""}${i % 6 === 0 ? ` ${s.dayMeterBarTick}` : ""}`}
                                                title={`${String(i).padStart(2, "0")}:00 — ${String(n())} ${n() === 1 ? "page" : "pages"}`}
                                                style={{
                                                    // Lit hours start at 35%
                                                    // of the plot rather than
                                                    // at zero: scaled from 0,
                                                    // a one-visit hour landed
                                                    // within a pixel of the
                                                    // empty-hour stub and the
                                                    // two were unreadable.
                                                    "--fill":
                                                        n() > 0
                                                            ? `${Math.round(35 + (n() / group().peak) * 65)}%`
                                                            : "0%",
                                                }}
                                            />
                                        )}
                                    </For>
                                </span>
                                <Anno class={s.dayCount}>
                                    {String(group().items.length)}{" "}
                                    <span class={s.dayCountUnit}>
                                        {group().items.length === 1
                                            ? "page"
                                            : "pages"}
                                    </span>
                                </Anno>
                            </div>
                            <div class={s.entries}>
                                <For each={group().items} keyed={false}>
                                    {entry => (
                                        <div class={s.entry}>
                                            <button
                                                type="button"
                                                class={s.entrySummary}
                                                title={entry().url}
                                                onClick={() =>
                                                    handleOpen(entry())
                                                }
                                            >
                                                <Show
                                                    when={entry().favicon}
                                                    fallback={
                                                        <IconWorld
                                                            size={16}
                                                            class={s.favicon}
                                                        />
                                                    }
                                                >
                                                    <img
                                                        src={entry().favicon}
                                                        class={s.favicon}
                                                        alt=""
                                                        onError={e => {
                                                            (
                                                                e.currentTarget as HTMLImageElement
                                                            ).style.display =
                                                                "none";
                                                        }}
                                                    />
                                                </Show>
                                                <span class={s.entryTitle}>
                                                    {entry().title ||
                                                        entry().url}
                                                </span>
                                                <span class={s.entryHost}>
                                                    {hostOf(entry().url)}
                                                </span>
                                                <span class={s.entryStamp}>
                                                    {formatTime(
                                                        entry().visitedAt,
                                                    )}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                class={s.deleteBtn}
                                                aria-label={`Remove ${entry().title || entry().url} from history`}
                                                onClick={() =>
                                                    handleDelete(entry().id)
                                                }
                                            >
                                                <IconClose size={14} />
                                            </button>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>
                    )}
                </For>
            </div>
        </Sheet>
    );
}
