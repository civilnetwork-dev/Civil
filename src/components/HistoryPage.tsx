import { createMemo, createSignal, For, onSettled, Show } from "solid-js";
import {
    HISTORY_LS_KEY,
    historyClear,
    historyDelete,
    historyGetAll,
    historyGetMethod,
    historySetMethod,
} from "~/api/history";
import { IconClose, IconSearch, IconWorld } from "~/components/icons";
import Anno from "~/components/schematic/Anno";
import Plate from "~/components/schematic/Plate";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import Unfold from "~/components/schematic/Unfold";
import { onLsChange } from "~/lib/reactiveStorage";
import * as s from "~/styles/HistoryPage.css";
import * as schematic from "~/styles/schematic.css";
import type { CivilHistoryEntry, HistoryStorageMethod } from "~/types";
import { Select } from "./ui/Select";

export default function HistoryPage() {
    const [entries, setEntries] = createSignal<CivilHistoryEntry[]>([]);
    const [method, setMethod] = createSignal<HistoryStorageMethod>(
        historyGetMethod(),
    );
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

    // Each backend holds its own records, so the switch has to re-read.
    // Without the reload the page kept showing the previous store's entries
    // under the new store's name.
    const handleMethodChange = (m: HistoryStorageMethod) => {
        historySetMethod(m);
        setMethod(m);
        reload();
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
                    hours: new Array(24).fill(0),
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
            <TitleBlock
                eyebrow="archive"
                title="History"
                meta={`${String(entries().length)} entries`}
                actions={
                    <div class={s.titleActions}>
                        <Select
                            value={method()}
                            options={[
                                {
                                    value: "localstorage",
                                    label: "localStorage",
                                },
                                { value: "indexeddb", label: "IndexedDB" },
                            ]}
                            onChange={handleMethodChange}
                        />
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
                                    ? `click again to delete ${String(entries().length)}`
                                    : "clear all"}
                            </button>
                        </Show>
                    </div>
                }
            />

            <Show when={entries().length > 0}>
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
                    {/* The visual scope line lays its numbers and words out as
                        separate spans so they can be sized and coloured
                        independently, but that leaves no whitespace between
                        them in the DOM — a live region over this markup
                        announces "3pages2days". So the columns are hidden from
                        the accessibility tree and the announcement is carried
                        by a visually-hidden sibling that reads as a sentence.
                        Measured in a browser; happy-dom computes no layout and
                        no test can see the difference. */}
                    <p class={s.scopeStat} aria-hidden="true">
                        <Show when={query().trim()}>
                            <span class={s.scopeStatNum}>
                                {String(matches().length)}
                            </span>
                            <span class={s.scopeStatWord}>of</span>
                        </Show>
                        <span class={s.scopeStatNum}>
                            {String(entries().length)}
                        </span>
                        <span class={s.scopeStatWord}>
                            {entries().length === 1 ? "page" : "pages"}
                        </span>
                        <span class={s.scopeStatSep} />
                        <span class={s.scopeStatNum}>
                            {String(groupedByDay().length)}
                        </span>
                        <span class={s.scopeStatWord}>
                            {groupedByDay().length === 1 ? "day" : "days"}
                        </span>
                    </p>
                    <p class={schematic.srOnly} aria-live="polite">
                        {scopeSentence()}
                    </p>
                </div>
            </Show>

            <Show when={entries().length === 0}>
                <Rule label="record" weight="hair" />
                <div class={s.empty}>
                    <Anno class={s.emptyText}>
                        no history yet — and no copy of it anywhere else
                    </Anno>
                </div>
            </Show>

            <Show when={entries().length > 0 && matches().length === 0}>
                <Rule label="record" weight="hair" />
                <div class={s.empty}>
                    <Anno class={s.emptyText}>
                        nothing recorded matches “{query().trim()}”
                    </Anno>
                    <button
                        type="button"
                        class={s.emptyAction}
                        onClick={() => {
                            setQuery("");
                            filterInput?.focus();
                        }}
                    >
                        clear filter
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
                                        <Plate class={s.entry}>
                                            <Unfold
                                                label={`${entry().title || entry().url} detail`}
                                                summary={
                                                    <span
                                                        class={s.entrySummary}
                                                    >
                                                        <Show
                                                            when={
                                                                entry().favicon
                                                            }
                                                            fallback={
                                                                <IconWorld
                                                                    size={16}
                                                                    class={
                                                                        s.favicon
                                                                    }
                                                                />
                                                            }
                                                        >
                                                            <img
                                                                src={
                                                                    entry()
                                                                        .favicon
                                                                }
                                                                class={
                                                                    s.favicon
                                                                }
                                                                alt=""
                                                                onError={e => {
                                                                    (
                                                                        e.currentTarget as HTMLImageElement
                                                                    ).style.display =
                                                                        "none";
                                                                }}
                                                            />
                                                        </Show>
                                                        <span
                                                            class={s.entryTitle}
                                                        >
                                                            {entry().title ||
                                                                entry().url}
                                                        </span>
                                                    </span>
                                                }
                                            >
                                                <div class={s.entryDetail}>
                                                    <Anno
                                                        muted
                                                        class={s.entryUrl}
                                                    >
                                                        {entry().url}
                                                    </Anno>
                                                    <div
                                                        class={
                                                            s.entryDetailActions
                                                        }
                                                    >
                                                        <Anno
                                                            class={s.entryTime}
                                                        >
                                                            {formatTime(
                                                                entry()
                                                                    .visitedAt,
                                                            )}
                                                        </Anno>
                                                        <button
                                                            type="button"
                                                            class={s.deleteBtn}
                                                            onClick={() =>
                                                                handleDelete(
                                                                    entry().id,
                                                                )
                                                            }
                                                        >
                                                            remove
                                                        </button>
                                                    </div>
                                                </div>
                                            </Unfold>
                                        </Plate>
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
