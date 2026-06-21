import { BiRegularLeftArrowAlt, BiRegularRightArrowAlt } from "solid-icons/bi";
import {
    TbOutlineArrowRight,
    TbOutlineClock,
    TbOutlineLock,
    TbOutlineRefresh,
    TbOutlineSearch,
} from "solid-icons/tb";
import { createSignal, For, Show } from "solid-js";
import { historySearch } from "~/api/history";
import { displayUrl, isProbablyUrl, WS_URL } from "~/lib/browserHelpers";
import { resolveUrl } from "~/lib/TabManager";
import * as s from "~/styles/BrowserChrome.css";
import type { CivilHistoryEntry } from "~/types";

interface UrlBarProps {
    value: string;
    canBack: boolean;
    canForward: boolean;
    isNewtab: boolean;
    onNavigate: (url: string) => void;
    onBack: () => void;
    onForward: () => void;
    onRefresh: () => void;
    onTabSearch: () => void;
}

export function UrlBar(props: UrlBarProps) {
    const [editing, setEditing] = createSignal(false);
    const [draft, setDraft] = createSignal("");
    const [suggestions, setSuggestions] = createSignal<string[]>([]);
    const [historySuggestions, setHistorySuggestions] = createSignal<
        CivilHistoryEntry[]
    >([]);
    let ws: WebSocket | null = null;
    let inputRef: HTMLInputElement | undefined;
    let suppressBlur = false;

    const openWs = () => {
        if (ws && ws.readyState === WebSocket.OPEN) return;
        ws = new WebSocket(WS_URL);
        ws.onmessage = ev => {
            try {
                const { suggestions: s } = JSON.parse(ev.data);
                if (Array.isArray(s)) setSuggestions(s);
            } catch {}
        };
    };

    const closeWs = () => {
        ws?.close();
        ws = null;
    };

    const display = () =>
        editing() ? draft() : props.isNewtab ? "" : displayUrl(props.value);

    const clearSuggestions = () => {
        setSuggestions([]);
        setHistorySuggestions([]);
    };

    const commit = (value = draft()) => {
        const v = value.trim();
        if (!v) {
            setEditing(false);
            clearSuggestions();
            return;
        }
        clearSuggestions();
        setEditing(false);
        closeWs();
        const resolved = resolveUrl(v);
        props.onNavigate(resolved !== v ? resolved : v);
    };

    const handleInput = (v: string) => {
        setDraft(v);
        if (!v) {
            clearSuggestions();
            return;
        }
        // History search always runs
        historySearch(v)
            .then(setHistorySuggestions)
            .catch(() => setHistorySuggestions([]));
        if (!isProbablyUrl(v)) {
            openWs();
            if (ws?.readyState === WebSocket.OPEN)
                ws.send(JSON.stringify({ q: v }));
        } else {
            setSuggestions([]);
        }
    };

    return (
        <div class={s.urlbar}>
            <button
                type="button"
                class={[
                    s.urlbarNavBtn,
                    { [s.urlbarNavBtnDim]: !props.canBack },
                ]}
                title="Back"
                disabled={!props.canBack}
                onClick={props.onBack}
            >
                <BiRegularLeftArrowAlt size={17} />
            </button>
            <button
                type="button"
                class={[
                    s.urlbarNavBtn,
                    { [s.urlbarNavBtnDim]: !props.canForward },
                ]}
                title="Forward"
                disabled={!props.canForward}
                onClick={props.onForward}
            >
                <BiRegularRightArrowAlt size={17} />
            </button>
            <button
                type="button"
                class={s.urlbarNavBtn}
                title="Reload"
                onClick={props.onRefresh}
            >
                <TbOutlineRefresh size={17} />
            </button>

            <button
                type="button"
                class={s.urlbarNavBtn}
                title="Search tabs (Ctrl+K)"
                onClick={props.onTabSearch}
            >
                <TbOutlineSearch size={15} />
            </button>

            <div class={s.urlbarOmniboxWrap}>
                <div
                    class={[
                        s.urlbarOmnibox,
                        {
                            [s.urlbarOmniboxFocus]:
                                editing() ||
                                suggestions().length > 0 ||
                                historySuggestions().length > 0,
                        },
                    ]}
                >
                    <Show when={!props.isNewtab && !editing()}>
                        <span class={s.urlbarLock}>
                            <TbOutlineLock size={12} />
                        </span>
                    </Show>
                    <input
                        ref={inputRef}
                        class={s.urlbarInput}
                        type="text"
                        value={display()}
                        placeholder={
                            props.isNewtab || editing()
                                ? "Search or enter address"
                                : ""
                        }
                        onFocus={e => {
                            setEditing(true);
                            openWs();
                            setDraft(props.isNewtab ? "" : props.value);
                            e.target.select();
                        }}
                        onInput={e => handleInput(e.target.value)}
                        onBlur={() => {
                            if (suppressBlur) return;
                            setEditing(false);
                            clearSuggestions();
                            closeWs();
                        }}
                        onKeyDown={e => {
                            if (e.key === "Enter") commit();
                            if (e.key === "Escape") {
                                clearSuggestions();
                                setEditing(false);
                                inputRef?.blur();
                            }
                            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                                e.preventDefault();
                                inputRef?.blur();
                                props.onTabSearch();
                            }
                        }}
                        spellcheck={false}
                        autocomplete="off"
                    />
                    <button
                        type="button"
                        class={s.urlbarGoBtn}
                        title="Go"
                        onClick={() => commit()}
                        onMouseDown={e => e.preventDefault()}
                    >
                        <TbOutlineArrowRight size={14} />
                    </button>
                </div>

                <Show
                    when={
                        historySuggestions().length > 0 ||
                        suggestions().length > 0
                    }
                >
                    <ul class={s.urlbarSuggestions}>
                        <For each={historySuggestions()}>
                            {entry => (
                                <li
                                    class={s.urlbarHistoryRow}
                                    onMouseDown={() => {
                                        suppressBlur = true;
                                    }}
                                    onClick={() => {
                                        suppressBlur = false;
                                        commit(entry().url);
                                        inputRef?.blur();
                                    }}
                                    onKeyDown={e => {
                                        if (e.key === "Enter") {
                                            suppressBlur = false;
                                            commit(entry().url);
                                            inputRef?.blur();
                                        }
                                    }}
                                >
                                    <Show
                                        when={entry().favicon}
                                        fallback={
                                            <TbOutlineClock
                                                size={14}
                                                class={s.urlbarHistoryFavicon}
                                            />
                                        }
                                    >
                                        <img
                                            src={entry().favicon}
                                            class={s.urlbarHistoryFavicon}
                                            alt=""
                                            onError={e => {
                                                (
                                                    e.currentTarget as HTMLImageElement
                                                ).style.display = "none";
                                            }}
                                        />
                                    </Show>
                                    <div class={s.urlbarHistoryInfo}>
                                        <div class={s.urlbarHistoryTitle}>
                                            {entry().title || entry().url}
                                        </div>
                                        <div class={s.urlbarHistoryUrl}>
                                            {entry().url}
                                        </div>
                                    </div>
                                </li>
                            )}
                        </For>
                        <Show
                            when={
                                historySuggestions().length > 0 &&
                                suggestions().length > 0
                            }
                        >
                            <div class={s.urlbarSuggestionDivider} />
                        </Show>
                        <For each={suggestions()}>
                            {suggestion => (
                                <li
                                    class={s.urlbarSuggestionRow}
                                    onMouseDown={() => {
                                        suppressBlur = true;
                                    }}
                                    onClick={() => {
                                        suppressBlur = false;
                                        commit(suggestion());
                                        inputRef?.blur();
                                    }}
                                    onKeyDown={e => {
                                        if (e.key === "Enter") {
                                            suppressBlur = false;
                                            commit(suggestion());
                                            inputRef?.blur();
                                        }
                                    }}
                                >
                                    {suggestion()}
                                </li>
                            )}
                        </For>
                    </ul>
                </Show>
            </div>
        </div>
    );
}
