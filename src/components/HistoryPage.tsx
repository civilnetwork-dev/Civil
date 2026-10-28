import { createMemo, createSignal, For, onSettled, Show } from "solid-js";

import {
    historyClear,
    historyDelete,
    historyGetAll,
    onHistoryChange,
} from "~/api/history";
import HistoryFullNotice from "~/components/HistoryFullNotice";
import { IconClock, IconClose, IconWorld } from "~/components/icons";
import Anno from "~/components/schematic/Anno";
import Lookup from "~/components/schematic/Lookup";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import { ArmedKey } from "~/components/SettingControls";
import Specimen from "~/components/Specimen";
import { tabManager } from "~/lib/TabManager";
import type { CivilHistoryEntry } from "~/types";

import * as s from "~/styles/HistoryPage.css";
import * as schematic from "~/styles/schematic.css";

/**
 * Clicking an entry opens the page — the expectation every browser's
 * history page has trained. This page previously could not navigate at
 * all: clicking an entry opened a disclosure showing the full URL and a
 * remove link, so the one thing a user comes to history to do was the one
 * thing it did not offer.
 */
function openEntry(entry: CivilHistoryEntry) {
    const existing = tabManager.tabs.find(t => t.url === entry.url);
    if (existing) {
        tabManager.activateTab(existing.id);
    } else {
        const t = tabManager.createTab(entry.url);
        tabManager.activateTab(t.id);
    }
}

/**
 * Hostname only. A full URL in the row would push the timestamp column off
 * the sheet on long paths; the full address is the row's hover title.
 */
function hostOf(url: string) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
}

function formatTime(ts: number) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(ts: number) {
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
}

interface DayGroup {
    label: string;
    items: CivilHistoryEntry[];
    hours: number[];
    peak: number;
}

// Entries arrive newest-first; group consecutive same-day entries under
// one rule so the timeline reads as days, not one undifferentiated list.
//
// Each group also carries a 24-slot tally of when in that day the visits
// happened. The header renders it as a small chart, which turns a date
// caption into an actual readout of the day's shape - the page already
// holds the timestamps, it just wasn't showing what they say.
function groupByDay(entries: CivilHistoryEntry[]): DayGroup[] {
    const groups: DayGroup[] = [];
    for (const e of entries) {
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
}

function scopeSentenceOf(total: number, days: number, matched: number | null) {
    const scope = matched !== null ? `${matched} of ` : "";
    return `${scope}${total} ${total === 1 ? "page" : "pages"} across ${days} ${days === 1 ? "day" : "days"}`;
}

function filterEntries(entries: CivilHistoryEntry[], query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
        e =>
            e.url.toLowerCase().includes(q) ||
            (e.title ?? "").toLowerCase().includes(q),
    );
}

function useHistory() {
    const [entries, setEntries] = createSignal<CivilHistoryEntry[]>([]);
    const [query, setQuery] = createSignal("");

    // Filtering feeds the day charts as well as the list, so typing a domain
    // turns every day's header into "when did I visit this" rather than just
    // hiding rows.
    const matches = createMemo(() => filterEntries(entries(), query()));

    const reload = () => {
        void historyGetAll().then(all => setEntries(all));
    };

    // Initial load, then live updates whenever history changes in any
    // document on the origin, whichever location it is saved in; the
    // returned unsubscribe runs on unmount.
    onSettled(() => {
        reload();
        return onHistoryChange(reload);
    });

    const clear = async () => {
        await historyClear();
        setEntries([]);
    };

    const remove = async (id: string) => {
        await historyDelete(id);
        setEntries(entries().filter(e => e.id !== id));
    };

    const groupedByDay = createMemo(() => groupByDay(matches()));

    /**
     * The same counts the visual scope line shows, as one sentence. Kept next to
     * the memos it reads so the two cannot report different numbers.
     */
    const scopeSentence = createMemo(() =>
        scopeSentenceOf(
            entries().length,
            groupedByDay().length,
            query().trim() ? matches().length : null,
        ),
    );

    return {
        entries,
        query,
        setQuery,
        matches,
        clear,
        remove,
        groupedByDay,
        scopeSentence,
    };
}

type HistoryState = ReturnType<typeof useHistory>;

// "/" jumps to the filter the way it does in a pager, but only when the
// user isn't already typing somewhere.
function useSlashFocus(focus: () => void) {
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
            focus();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });
}

function HistoryActions(props: { history: HistoryState }) {
    return (
        <div class={schematic.titleBlockActions}>
            {/* Clearing history can't be undone, so the button asks once
                before doing it. An inline two-step keeps the confirmation in
                the same place as the action instead of throwing a modal over
                the page. */}
            <Show when={props.history.entries().length > 0}>
                {/* The armed state names the real scope. A filtered view
                    shows a handful of rows, so "clear" alone reads as "clear
                    these" when it actually deletes the whole record. */}
                <ArmedKey
                    label="Clear all"
                    armedLabel={`Click again to delete ${String(props.history.entries().length)}`}
                    onConfirm={() => void props.history.clear()}
                />
            </Show>
        </div>
    );
}

function FilterRow(props: {
    history: HistoryState;
    inputRef: (el: HTMLInputElement) => void;
}) {
    return (
        <div class={s.scopeRow}>
            <div class={s.filterField}>
                <Lookup
                    value={props.history.query()}
                    placeholder="Filter by title or address"
                    label="Filter history"
                    clearTitle="Clear filter"
                    onChange={props.history.setQuery}
                    inputRef={props.inputRef}
                />
                <Show when={!props.history.query()}>
                    <kbd class={s.filterHint}>/</kbd>
                </Show>
            </div>
            {/* One text node, so the live region reads exactly what
                the eye does. The previous markup styled numbers and
                words as separate spans, which announced "3pages2days"
                and needed an aria-hidden copy plus a hidden sibling
                to repair — two structures saying one sentence. */}
            <p class={s.scopeStat} aria-live="polite">
                {props.history.scopeSentence()}
            </p>
        </div>
    );
}

function NoHistory() {
    return (
        <>
            <Rule weight="hair" />
            <div class={s.empty}>
                <Specimen icon={IconClock} tint="stone" size={64} />
                <Anno class={s.emptyText}>
                    No history yet. Pages you visit will show up here.
                </Anno>
            </div>
        </>
    );
}

function NoMatches(props: { query: string; onClear: () => void }) {
    return (
        <>
            <Rule weight="hair" />
            <div class={s.empty}>
                <Anno class={s.emptyText}>
                    No pages match “{props.query.trim()}”.
                </Anno>
                <button
                    type="button"
                    class={s.emptyAction}
                    onClick={() => props.onClear()}
                >
                    Clear filter
                </button>
            </div>
        </>
    );
}

function NoMatchesFor(props: { history: HistoryState; onClear: () => void }) {
    return (
        <Show
            when={
                props.history.entries().length > 0 &&
                props.history.matches().length === 0
            }
        >
            <NoMatches
                query={props.history.query()}
                onClear={() => props.onClear()}
            />
        </Show>
    );
}

function DayMeter(props: { group: DayGroup }) {
    return (
        <>
            {/* Presentational: the count beside it is the
                accessible summary of the same data. */}
            <span class={s.dayMeter} aria-hidden="true">
                <For each={props.group.hours} keyed={false}>
                    {(n, i) => (
                        <span
                            class={`${s.dayMeterBar}${n() > 0 ? ` ${s.dayMeterBarOn}` : ""}${i % 6 === 0 ? ` ${s.dayMeterBarTick}` : ""}`}
                            title={`${String(i).padStart(2, "0")}:00 — ${String(n())} ${n() === 1 ? "page" : "pages"}`}
                            style={{
                                // Lit hours start at 35% of the plot rather
                                // than at zero: scaled from 0, a one-visit
                                // hour landed within a pixel of the
                                // empty-hour stub and the two were
                                // unreadable.
                                "--fill":
                                    n() > 0
                                        ? `${Math.round(35 + (n() / props.group.peak) * 65)}%`
                                        : "0%",
                            }}
                        />
                    )}
                </For>
            </span>
            <Anno class={s.dayCount}>
                {String(props.group.items.length)}{" "}
                <span class={s.dayCountUnit}>
                    {props.group.items.length === 1 ? "page" : "pages"}
                </span>
            </Anno>
        </>
    );
}

function HistoryRow(props: {
    entry: CivilHistoryEntry;
    onDelete: (id: string) => void;
}) {
    return (
        <div class={s.entry}>
            <button
                type="button"
                class={s.entrySummary}
                title={props.entry.url}
                onClick={() => openEntry(props.entry)}
            >
                <Show
                    when={props.entry.favicon}
                    fallback={<IconWorld size={16} class={s.favicon} />}
                >
                    <img
                        src={props.entry.favicon}
                        class={s.favicon}
                        alt=""
                        onError={e => {
                            (
                                e.currentTarget as HTMLImageElement
                            ).style.display = "none";
                        }}
                    />
                </Show>
                <span class={s.entryTitle}>
                    {props.entry.title || props.entry.url}
                </span>
                <span class={s.entryHost}>{hostOf(props.entry.url)}</span>
                <span class={s.entryStamp}>
                    {formatTime(props.entry.visitedAt)}
                </span>
            </button>
            <button
                type="button"
                class={s.deleteBtn}
                aria-label={`Remove ${props.entry.title || props.entry.url} from history`}
                onClick={() => props.onDelete(props.entry.id)}
            >
                <IconClose size={14} />
            </button>
        </div>
    );
}

function DaySection(props: {
    group: DayGroup;
    onDelete: (id: string) => void;
}) {
    return (
        <div class={s.dayGroup}>
            <Rule label={props.group.label} weight="hair" class={s.dayRuleEl} />
            <div class={s.dayMetrics}>
                <DayMeter group={props.group} />
            </div>
            <div class={s.entries}>
                <For each={props.group.items} keyed={false}>
                    {entry => (
                        <HistoryRow entry={entry()} onDelete={props.onDelete} />
                    )}
                </For>
            </div>
        </div>
    );
}

export default function HistoryPage() {
    const history = useHistory();
    let filterInput: HTMLInputElement | undefined;

    useSlashFocus(() => filterInput?.focus());

    return (
        <Sheet>
            {/* The storage-backend Select (localStorage vs IndexedDB) that
                used to sit here was a developer control in a user page: no
                student can weigh that choice, and offering it suggests they
                should. It lives in Settings now, with the rest of history's
                storage choices, for the people who do want to weigh it. */}
            <TitleBlock
                title="History"
                icon={IconClock}
                tint="juniper"
                actions={<HistoryActions history={history} />}
            />

            <HistoryFullNotice />

            <Show when={history.entries().length > 0}>
                <p class={schematic.lede}>
                    Find a page you visited earlier. Your history is stored on
                    this device.
                </p>

                <FilterRow
                    history={history}
                    inputRef={el => (filterInput = el)}
                />
            </Show>

            <Show when={history.entries().length === 0}>
                <NoHistory />
            </Show>

            <NoMatchesFor
                history={history}
                onClear={() => {
                    history.setQuery("");
                    filterInput?.focus();
                }}
            />

            <div class={s.list}>
                <For each={history.groupedByDay()} keyed={false}>
                    {group => (
                        <DaySection
                            group={group()}
                            onDelete={id => void history.remove(id)}
                        />
                    )}
                </For>
            </div>
        </Sheet>
    );
}
