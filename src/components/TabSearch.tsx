/** biome-ignore-all lint/a11y/noStaticElementInteractions: tab search */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: tab search */
import uFuzzy from "@leeoniya/ufuzzy";
import { Portal } from "@solidjs/web";
import { TbOutlineSearch, TbOutlineWorld } from "solid-icons/tb";
import type { JSX } from "solid-js";
import { createMemo, createSignal, For, onSettled, Show } from "solid-js";
import type { Tab } from "~/lib/TabManager";
import { isNewtabUrl } from "~/lib/TabManager";
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

export default function TabSearch(props: TabSearchProps) {
    const [query, setQuery] = createSignal("");
    const [cursor, setCursor] = createSignal(0);
    const [leaving, setLeaving] = createSignal(false);
    let inputRef!: HTMLInputElement;
    let listRef!: HTMLDivElement;

    const haystack = createMemo(() =>
        props.tabs.map(t => `${t.title}\0${t.url}`),
    );

    const results = createMemo<
        { tab: Tab; titleRanges?: number[]; urlRanges?: number[] }[]
    >(() => {
        const q = query().trim();
        if (!q) {
            return [...props.tabs]
                .sort((a, b) =>
                    a.id === props.activeId
                        ? -1
                        : b.id === props.activeId
                          ? 1
                          : 0,
                )
                .map(tab => ({ tab }));
        }

        const hay = haystack();
        const [idxs, info, order] = uf.search(hay, q, 0, 1e3);
        if (!idxs || idxs.length === 0) return [];

        const sorted = order ?? idxs;
        return sorted.map(sortedIdx => {
            const haystackIdx = info ? info.idx[sortedIdx]! : sortedIdx;
            const tab = props.tabs[haystackIdx]!;
            const ranges = info?.ranges[sortedIdx];

            const sepIdx = tab.title.length + 1;
            let titleRanges: number[] | undefined;
            let urlRanges: number[] | undefined;

            if (ranges) {
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
                if (tr.length) titleRanges = tr;
                if (ur.length) urlRanges = ur;
            }

            return { tab, titleRanges, urlRanges };
        });
    });

    const close = () => {
        setLeaving(true);
        setTimeout(props.onClose, 210);
    };

    const scrollCursorIntoView = (idx: number) => {
        const child = listRef?.children[idx] as HTMLElement | undefined;
        child?.scrollIntoView({ block: "nearest" });
    };

    onSettled(() => {
        inputRef?.focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                close();
                return;
            }
            const res = results();
            if (e.key === "ArrowDown") {
                e.preventDefault();
                const next = Math.min(cursor() + 1, res.length - 1);
                setCursor(next);
                scrollCursorIntoView(next);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const prev = Math.max(cursor() - 1, 0);
                setCursor(prev);
                scrollCursorIntoView(prev);
            } else if (e.key === "Enter") {
                e.preventDefault();
                const item = res[cursor()];
                if (item) {
                    props.onActivate(item.tab.id);
                    close();
                }
            }
        };

        window.addEventListener("keydown", onKey, { capture: true });
        return () =>
            window.removeEventListener("keydown", onKey, { capture: true });
    });

    return (
        <Portal>
            <div
                class={[s.backdrop, { [s.backdropLeaving]: leaving() }]}
                onMouseDown={e => {
                    if (e.target === e.currentTarget) close();
                }}
            >
                <div class={[s.panel, { [s.panelLeaving]: leaving() }]}>
                    <div class={s.inputRow}>
                        <span class={s.searchIcon}>
                            <TbOutlineSearch size={16} />
                        </span>
                        <input
                            ref={inputRef}
                            class={s.input}
                            type="text"
                            placeholder="Search tabs…"
                            value={query()}
                            onInput={e => {
                                setQuery(e.currentTarget.value);
                                setCursor(0);
                            }}
                            spellcheck={false}
                            autocomplete="off"
                        />
                        <span class={s.hint}>
                            {`${results().length} ${results().length === 1 ? "tab" : "tabs"}`}
                        </span>
                    </div>

                    <div class={s.results} ref={listRef!}>
                        <For each={results()}>
                            {(item, idx) => {
                                const isActive = () =>
                                    item().tab.id === props.activeId;
                                const isCursor = () => idx() === cursor();
                                const isNewtab = () =>
                                    isNewtabUrl(item().tab.url);
                                return (
                                    <div
                                        class={[
                                            s.resultItem,
                                            {
                                                [s.resultItemActive]:
                                                    isCursor(),
                                            },
                                            {
                                                [s.resultItemCurrent]:
                                                    isActive(),
                                            },
                                        ]}
                                        onMouseEnter={() => {
                                            setCursor(idx());
                                        }}
                                        onClick={() => {
                                            props.onActivate(item().tab.id);
                                            close();
                                        }}
                                    >
                                        <Show
                                            when={item().tab.favicon}
                                            fallback={
                                                <span class={s.faviconFallback}>
                                                    <TbOutlineWorld size={13} />
                                                </span>
                                            }
                                        >
                                            <img
                                                class={s.favicon}
                                                src={item().tab.favicon}
                                                alt=""
                                            />
                                        </Show>

                                        <div class={s.resultText}>
                                            <span class={s.resultTitle}>
                                                {renderHighlightedText(
                                                    item().tab.title,
                                                    item().titleRanges,
                                                )}
                                            </span>
                                            <Show when={!isNewtab()}>
                                                <span class={s.resultUrl}>
                                                    {renderHighlightedText(
                                                        item().tab.url,
                                                        item().urlRanges,
                                                    )}
                                                </span>
                                            </Show>
                                        </div>

                                        <Show when={isActive()}>
                                            <span class={s.tabBadge}>
                                                current
                                            </span>
                                        </Show>
                                    </div>
                                );
                            }}
                        </For>

                        <Show
                            when={
                                query().trim().length > 0 &&
                                results().length === 0
                            }
                        >
                            <div class={s.emptyState}>
                                No tabs match "{query()}"
                            </div>
                        </Show>
                    </div>

                    <div class={s.footer}>
                        <span class={s.footerKey}>
                            <kbd class={s.kbd}>↑</kbd>{" "}
                            <kbd class={s.kbd}>↓</kbd> navigate
                        </span>
                        <span class={s.footerKey}>
                            <kbd class={s.kbd}>↵</kbd> switch
                        </span>
                        <span class={s.footerKey}>
                            <kbd class={s.kbd}>Esc</kbd> close
                        </span>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
