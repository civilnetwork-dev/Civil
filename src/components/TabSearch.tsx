// oxlint-disable jsx-a11y/no-static-element-interactions
// oxlint-disable jsx-a11y/click-events-have-key-events
import uFuzzy from "@leeoniya/ufuzzy";
import type { JSX } from "@solidjs/web";
import { Portal } from "@solidjs/web";
import { createMemo, createSignal, For, onSettled, Show } from "solid-js";

import { IconSearch, IconWorld } from "~/components/icons";
import { isNewtabUrl } from "~/lib/browserUrls";
import type { Tab } from "~/types";

import * as s from "~/styles/TabSearch.css";

const uf = new uFuzzy({ intraMode: 1, intraIns: 1 });

interface TabSearchProps {
    tabs: readonly Tab[];
    activeId: string | null;
    onActivate: (tabId: string) => void;
    onClose: () => void;
}

function renderHighlightedText(
    str: string,
    ranges: number[] | undefined,
): JSX.Element {
    if (!ranges || ranges.length === 0) return str;
    const parts: JSX.Element[] = [];
    let pos = 0;
    for (let i = 0; i < ranges.length; i += 2) {
        const start = ranges[i]!;
        const end = ranges[i + 1]!;
        if (start > pos) parts.push(str.slice(pos, start));
        parts.push(<mark class={s.matchMark}>{str.slice(start, end)}</mark>);
        pos = end;
    }
    if (pos < str.length) parts.push(str.slice(pos));
    return <>{parts}</>;
}

interface TabResult {
    tab: Tab;
    titleRanges?: number[];
    urlRanges?: number[];
}

function splitRanges(tab: Tab, ranges: number[] | undefined) {
    if (!ranges) return {};
    const sepIdx = tab.title.length + 1;
    const tr: number[] = [];
    const ur: number[] = [];
    for (let i = 0; i < ranges.length; i += 2) {
        const rs = ranges[i]!;
        const re = ranges[i + 1]!;
        if (re <= tab.title.length) {
            tr.push(rs, re);
        } else if (rs >= sepIdx) {
            ur.push(rs - sepIdx, re - sepIdx);
        }
    }
    return {
        titleRanges: tr.length ? tr : undefined,
        urlRanges: ur.length ? ur : undefined,
    };
}

function searchTabs(
    tabs: readonly Tab[],
    activeId: string | null,
    hay: string[],
    q: string,
): TabResult[] {
    if (!q) {
        return tabs
            .toSorted((a, b) =>
                a.id === activeId ? -1 : b.id === activeId ? 1 : 0,
            )
            .map(tab => ({ tab }));
    }

    const [idxs, info, order] = uf.search(hay, q, 0, 1e3);
    if (!idxs || idxs.length === 0) return [];

    const sorted = order ?? idxs;
    return sorted.map(sortedIdx => {
        const haystackIdx = info ? info.idx[sortedIdx]! : sortedIdx;
        const tab = tabs[haystackIdx]!;
        return { tab, ...splitRanges(tab, info?.ranges[sortedIdx]) };
    });
}

function useTabSearchKeys(opts: {
    results: () => TabResult[];
    cursor: () => number;
    setCursor: (idx: number) => void;
    scrollTo: (idx: number) => void;
    choose: (item: TabResult) => void;
    close: () => void;
}) {
    const move = (idx: number) => {
        opts.setCursor(idx);
        opts.scrollTo(idx);
    };

    const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            e.preventDefault();
            opts.close();
            return;
        }
        const res = opts.results();
        if (e.key === "ArrowDown") {
            e.preventDefault();
            move(Math.min(opts.cursor() + 1, res.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            move(Math.max(opts.cursor() - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const item = res[opts.cursor()];
            if (item) opts.choose(item);
        }
    };

    onSettled(() => {
        window.addEventListener("keydown", onKey, { capture: true });
        return () =>
            window.removeEventListener("keydown", onKey, { capture: true });
    });
}

function ResultRow(props: {
    item: TabResult;
    activeId: string | null;
    isCursor: boolean;
    onHover: () => void;
    onChoose: () => void;
}) {
    const isActive = () => props.item.tab.id === props.activeId;
    const isNewtab = () => isNewtabUrl(props.item.tab.url);
    return (
        <div
            class={[
                s.resultItem,
                { [s.resultItemActive]: props.isCursor },
                { [s.resultItemCurrent]: isActive() },
            ]}
            onMouseEnter={() => props.onHover()}
            onClick={() => props.onChoose()}
        >
            <Show
                when={props.item.tab.favicon}
                fallback={
                    <span class={s.faviconFallback}>
                        <IconWorld size={13} />
                    </span>
                }
            >
                <img class={s.favicon} src={props.item.tab.favicon} alt="" />
            </Show>

            <div class={s.resultText}>
                <span class={s.resultTitle}>
                    {renderHighlightedText(
                        props.item.tab.title,
                        props.item.titleRanges,
                    )}
                </span>
                <Show when={!isNewtab()}>
                    <span class={s.resultUrl}>
                        {renderHighlightedText(
                            props.item.tab.url,
                            props.item.urlRanges,
                        )}
                    </span>
                </Show>
            </div>

            <Show when={isActive()}>
                <span class={s.tabBadge}>Current</span>
            </Show>
        </div>
    );
}

function SearchFooter() {
    return (
        <div class={s.footer}>
            <span class={s.footerKey}>
                <kbd class={s.kbd}>↑</kbd> <kbd class={s.kbd}>↓</kbd> navigate
            </span>
            <span class={s.footerKey}>
                <kbd class={s.kbd}>↵</kbd> switch
            </span>
            <span class={s.footerKey}>
                <kbd class={s.kbd}>Esc</kbd> close
            </span>
        </div>
    );
}

function SearchInputRow(props: {
    query: string;
    count: number;
    inputRef: (el: HTMLInputElement) => void;
    onInput: (value: string) => void;
}) {
    return (
        <div class={s.inputRow}>
            <span class={s.searchIcon}>
                <IconSearch size={16} />
            </span>
            <input
                ref={props.inputRef}
                class={s.input}
                type="text"
                placeholder="Search tabs…"
                value={props.query}
                onInput={e => props.onInput(e.currentTarget.value)}
                spellcheck="false"
                autocomplete="off"
            />
            <span class={s.hint}>
                {`${props.count} ${props.count === 1 ? "tab" : "tabs"}`}
            </span>
        </div>
    );
}

function ResultList(props: {
    results: TabResult[];
    query: string;
    activeId: string | null;
    cursor: number;
    setCursor: (idx: number) => void;
    choose: (item: TabResult) => void;
    listRef: (el: HTMLDivElement) => void;
}) {
    return (
        <div class={s.results} ref={props.listRef}>
            <For each={props.results} keyed={false}>
                {(item, idx) => (
                    <ResultRow
                        item={item()}
                        activeId={props.activeId}
                        isCursor={idx === props.cursor}
                        onHover={() => props.setCursor(idx)}
                        onChoose={() => props.choose(item())}
                    />
                )}
            </For>

            <Show
                when={
                    props.query.trim().length > 0 && props.results.length === 0
                }
            >
                <div class={s.emptyState}>No tabs match "{props.query}"</div>
            </Show>
        </div>
    );
}

function useTabSearch(props: TabSearchProps) {
    const [query, setQuery] = createSignal("");
    const [cursor, setCursor] = createSignal(0);
    const [leaving, setLeaving] = createSignal(false);
    let inputRef!: HTMLInputElement;
    let listRef!: HTMLDivElement;

    const haystack = createMemo(() =>
        props.tabs.map(t => `${t.title}\0${t.url}`),
    );

    const results = createMemo<TabResult[]>(() =>
        searchTabs(props.tabs, props.activeId, haystack(), query().trim()),
    );

    const close = () => {
        setLeaving(true);
        setTimeout(props.onClose, 210);
    };

    const choose = (item: TabResult) => {
        props.onActivate(item.tab.id);
        close();
    };

    onSettled(() => {
        inputRef?.focus();
    });

    useTabSearchKeys({
        results,
        cursor,
        setCursor,
        scrollTo: idx => {
            const child = listRef?.children[idx] as HTMLElement | undefined;
            child?.scrollIntoView({ block: "nearest" });
        },
        choose,
        close,
    });

    return {
        query,
        setQuery,
        cursor,
        setCursor,
        leaving,
        results,
        close,
        choose,
        setInput: (el: HTMLInputElement) => (inputRef = el),
        setList: (el: HTMLDivElement) => (listRef = el),
    };
}

export default function TabSearch(props: TabSearchProps) {
    const search = useTabSearch(props);

    return (
        <Portal>
            <div
                class={[s.backdrop, { [s.backdropLeaving]: search.leaving() }]}
                onMouseDown={e => {
                    if (e.target === e.currentTarget) search.close();
                }}
            >
                <div class={[s.panel, { [s.panelLeaving]: search.leaving() }]}>
                    <SearchInputRow
                        query={search.query()}
                        count={search.results().length}
                        inputRef={search.setInput}
                        onInput={value => {
                            search.setQuery(value);
                            search.setCursor(0);
                        }}
                    />

                    <ResultList
                        results={search.results()}
                        query={search.query()}
                        activeId={props.activeId}
                        cursor={search.cursor()}
                        setCursor={search.setCursor}
                        choose={search.choose}
                        listRef={search.setList}
                    />

                    <SearchFooter />
                </div>
            </div>
        </Portal>
    );
}
