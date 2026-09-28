import { createSignal, For, Show } from "solid-js";

import { historySearch } from "~/api/history";
import {
    IconArrowLeft,
    IconArrowRight,
    IconClock,
    IconForward,
    IconLock,
    IconRefresh,
    IconSearch,
} from "~/components/icons";
import { displayUrl, isProbablyUrl, WS_URL } from "~/lib/browserHelpers";
import { getSetting } from "~/lib/settings";
import { resolveUrl } from "~/lib/TabManager";
import type { CivilHistoryEntry } from "~/types";

import * as s from "~/styles/BrowserChrome.css";

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

    /**
     * Hold the input's blur while a suggestion row is being pressed, so the
     * list isn't torn down before the click lands.
     *
     * The flag is cleared on the next pointer release wherever it happens,
     * not in the row's click handler: if the press is cancelled by dragging
     * off the row, `click` never fires, and a flag left set would suppress
     * every future blur - wedging the bar in editing state so it keeps
     * showing a stale draft instead of the page's real URL.
     */
    const armSuppressBlur = () => {
        suppressBlur = true;
        window.addEventListener(
            "pointerup",
            () => {
                suppressBlur = false;
            },
            { once: true },
        );
    };

    const openWs = () => {
        if (ws && ws.readyState === WebSocket.OPEN) return;
        ws = new WebSocket(WS_URL);
        ws.onmessage = ev => {
            try {
                const { suggestions: list } = JSON.parse(ev.data);
                if (Array.isArray(list)) setSuggestions(list);
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
        if (getSetting("suggestHistory")) {
            historySearch(v)
                .then(setHistorySuggestions)
                .catch(() => setHistorySuggestions([]));
        }
        if (getSetting("suggestLive") && !isProbablyUrl(v)) {
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
                <IconArrowLeft size={17} />
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
                <IconForward size={17} />
            </button>
            <button
                type="button"
                class={s.urlbarNavBtn}
                title="Reload"
                onClick={props.onRefresh}
            >
                <IconRefresh size={17} />
            </button>

            <button
                type="button"
                class={s.urlbarNavBtn}
                title="Search tabs (Ctrl+K)"
                onClick={props.onTabSearch}
            >
                <IconSearch size={15} />
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
                            <IconLock size={12} />
                        </span>
                    </Show>
                    <input
                        ref={inputRef}
                        class={s.urlbarInput}
                        type="text"
                        aria-label="Address bar"
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
                        spellcheck="false"
                        autocomplete="off"
                    />
                    <button
                        type="button"
                        class={s.urlbarGoBtn}
                        title="Go"
                        onClick={() => commit()}
                        onMouseDown={e => e.preventDefault()}
                    >
                        <IconArrowRight size={14} />
                    </button>
                </div>

                <Show
                    when={
                        historySuggestions().length > 0 ||
                        suggestions().length > 0
                    }
                >
                    <ul class={s.urlbarSuggestions} role="listbox">
                        <For each={historySuggestions()} keyed={false}>
                            {entry => (
                                <li
                                    class={s.urlbarHistoryRow}
                                    role="option"
                                    aria-selected="false"
                                    aria-label={entry().title || entry().url}
                                    onMouseDown={armSuppressBlur}
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
                                            <IconClock
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
                        <For each={suggestions()} keyed={false}>
                            {suggestion => (
                                <li
                                    class={s.urlbarSuggestionRow}
                                    role="option"
                                    aria-selected="false"
                                    onMouseDown={armSuppressBlur}
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
