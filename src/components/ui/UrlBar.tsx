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
import { resolveUrl } from "~/lib/browserUrls";
import { getSetting } from "~/lib/settings";
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

function useSuggestionSocket(onList: (list: string[]) => void) {
    let ws: WebSocket | null = null;

    const open = () => {
        if (ws && ws.readyState === WebSocket.OPEN) return;
        ws = new WebSocket(WS_URL);
        ws.onmessage = ev => {
            try {
                const { suggestions: list } = JSON.parse(ev.data);
                if (Array.isArray(list)) onList(list);
            } catch {}
        };
    };

    const close = () => {
        ws?.close();
        ws = null;
    };

    const send = (q: string) => {
        open();
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ q }));
    };

    return { open, close, send };
}

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
function useBlurGuard() {
    let suppressBlur = false;
    const arm = () => {
        suppressBlur = true;
        window.addEventListener(
            "pointerup",
            () => {
                suppressBlur = false;
            },
            { once: true },
        );
    };
    return {
        arm,
        release: () => {
            suppressBlur = false;
        },
        suppressed: () => suppressBlur,
    };
}

function useSuggestionLists() {
    const [suggestions, setSuggestions] = createSignal<string[]>([]);
    const [historySuggestions, setHistorySuggestions] = createSignal<
        CivilHistoryEntry[]
    >([]);
    return {
        suggestions,
        setSuggestions,
        historySuggestions,
        setHistorySuggestions,
        clearSuggestions: () => {
            setSuggestions([]);
            setHistorySuggestions([]);
        },
    };
}

function useOmnibox(props: UrlBarProps) {
    const [editing, setEditing] = createSignal(false);
    const [draft, setDraft] = createSignal("");
    const {
        suggestions,
        setSuggestions,
        historySuggestions,
        setHistorySuggestions,
        clearSuggestions,
    } = useSuggestionLists();
    const socket = useSuggestionSocket(setSuggestions);

    const commit = (value = draft()) => {
        const v = value.trim();
        if (!v) {
            setEditing(false);
            clearSuggestions();
            return;
        }
        clearSuggestions();
        setEditing(false);
        socket.close();
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
            socket.send(v);
        } else {
            setSuggestions([]);
        }
    };

    const display = () =>
        editing() ? draft() : props.isNewtab ? "" : displayUrl(props.value);

    return {
        editing,
        setEditing,
        setDraft,
        suggestions,
        historySuggestions,
        socket,
        clearSuggestions,
        commit,
        handleInput,
        display,
    };
}

type Omnibox = ReturnType<typeof useOmnibox>;

function omniboxHandlers(
    props: UrlBarProps,
    omni: Omnibox,
    guard: ReturnType<typeof useBlurGuard>,
    blurInput: () => void,
) {
    return {
        onFocus: (e: FocusEvent & { target: HTMLInputElement }) => {
            omni.setEditing(true);
            omni.socket.open();
            omni.setDraft(props.isNewtab ? "" : props.value);
            e.target.select();
        },
        onBlur: () => {
            if (guard.suppressed()) return;
            omni.setEditing(false);
            omni.clearSuggestions();
            omni.socket.close();
        },
        onKeyDown: (e: KeyboardEvent) => {
            if (e.key === "Enter") omni.commit();
            if (e.key === "Escape") {
                omni.clearSuggestions();
                omni.setEditing(false);
                blurInput();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                blurInput();
                props.onTabSearch();
            }
        },
    };
}

function NavButtons(props: UrlBarProps) {
    return (
        <>
            <button
                type="button"
                class={[
                    s.urlbarNavBtn,
                    { [s.urlbarNavBtnDim]: !props.canBack },
                ]}
                title="Back"
                disabled={!props.canBack}
                onClick={() => props.onBack()}
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
                onClick={() => props.onForward()}
            >
                <IconForward size={17} />
            </button>
            <button
                type="button"
                class={s.urlbarNavBtn}
                title="Reload"
                onClick={() => props.onRefresh()}
            >
                <IconRefresh size={17} />
            </button>

            <button
                type="button"
                class={s.urlbarNavBtn}
                title="Search tabs (Ctrl+K)"
                onClick={() => props.onTabSearch()}
            >
                <IconSearch size={15} />
            </button>
        </>
    );
}

function HistorySuggestion(props: {
    entry: CivilHistoryEntry;
    onPress: () => void;
    onChoose: () => void;
}) {
    return (
        <li
            class={s.urlbarHistoryRow}
            role="option"
            aria-selected="false"
            aria-label={props.entry.title || props.entry.url}
            onMouseDown={() => props.onPress()}
            onClick={() => props.onChoose()}
            onKeyDown={e => {
                if (e.key === "Enter") props.onChoose();
            }}
        >
            <Show
                when={props.entry.favicon}
                fallback={
                    <IconClock size={14} class={s.urlbarHistoryFavicon} />
                }
            >
                <img
                    src={props.entry.favicon}
                    class={s.urlbarHistoryFavicon}
                    alt=""
                    onError={e => {
                        (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                    }}
                />
            </Show>
            <div class={s.urlbarHistoryInfo}>
                <div class={s.urlbarHistoryTitle}>
                    {props.entry.title || props.entry.url}
                </div>
                <div class={s.urlbarHistoryUrl}>{props.entry.url}</div>
            </div>
        </li>
    );
}

function Suggestions(props: {
    omni: Omnibox;
    onPress: () => void;
    onChoose: (url: string) => void;
}) {
    return (
        <ul class={s.urlbarSuggestions} role="listbox">
            <For each={props.omni.historySuggestions()} keyed={false}>
                {entry => (
                    <HistorySuggestion
                        entry={entry()}
                        onPress={props.onPress}
                        onChoose={() => props.onChoose(entry().url)}
                    />
                )}
            </For>
            <Show
                when={
                    props.omni.historySuggestions().length > 0 &&
                    props.omni.suggestions().length > 0
                }
            >
                <div class={s.urlbarSuggestionDivider} />
            </Show>
            <For each={props.omni.suggestions()} keyed={false}>
                {suggestion => (
                    <li
                        class={s.urlbarSuggestionRow}
                        role="option"
                        aria-selected="false"
                        onMouseDown={() => props.onPress()}
                        onClick={() => props.onChoose(suggestion())}
                        onKeyDown={e => {
                            if (e.key === "Enter") props.onChoose(suggestion());
                        }}
                    >
                        {suggestion()}
                    </li>
                )}
            </For>
        </ul>
    );
}

function OmniboxField(props: {
    bar: UrlBarProps;
    omni: Omnibox;
    handlers: ReturnType<typeof omniboxHandlers>;
    focused: boolean;
    inputRef: (el: HTMLInputElement) => void;
}) {
    return (
        <div
            class={[s.urlbarOmnibox, { [s.urlbarOmniboxFocus]: props.focused }]}
        >
            <Show when={!props.bar.isNewtab && !props.omni.editing()}>
                <span class={s.urlbarLock}>
                    <IconLock size={12} />
                </span>
            </Show>
            <input
                ref={props.inputRef}
                class={s.urlbarInput}
                type="text"
                aria-label="Address bar"
                value={props.omni.display()}
                placeholder={
                    props.bar.isNewtab || props.omni.editing()
                        ? "Search or enter address"
                        : ""
                }
                onFocus={e => props.handlers.onFocus(e)}
                onInput={e => props.omni.handleInput(e.target.value)}
                onBlur={() => props.handlers.onBlur()}
                onKeyDown={e => props.handlers.onKeyDown(e)}
                spellcheck="false"
                autocomplete="off"
            />
            <button
                type="button"
                class={s.urlbarGoBtn}
                title="Go"
                onClick={() => props.omni.commit()}
                onMouseDown={e => e.preventDefault()}
            >
                <IconArrowRight size={14} />
            </button>
        </div>
    );
}

export function UrlBar(props: UrlBarProps) {
    const omni = useOmnibox(props);
    const guard = useBlurGuard();
    let inputRef: HTMLInputElement | undefined;
    const blurInput = () => inputRef?.blur();
    const handlers = omniboxHandlers(props, omni, guard, blurInput);

    const choose = (url: string) => {
        guard.release();
        omni.commit(url);
        blurInput();
    };

    const hasSuggestions = () =>
        omni.historySuggestions().length > 0 || omni.suggestions().length > 0;

    return (
        <div class={s.urlbar}>
            <NavButtons {...props} />

            <div class={s.urlbarOmniboxWrap}>
                <OmniboxField
                    bar={props}
                    omni={omni}
                    handlers={handlers}
                    focused={omni.editing() || hasSuggestions()}
                    inputRef={el => (inputRef = el)}
                />

                <Show when={hasSuggestions()}>
                    <Suggestions
                        omni={omni}
                        onPress={guard.arm}
                        onChoose={choose}
                    />
                </Show>
            </div>
        </div>
    );
}
