import { createSignal, onSettled, Show } from "solid-js";

import { IconArrowRight, IconSearch } from "~/components/icons";
import { WS_URL } from "~/lib/browserHelpers";
import genBCKey from "~/lib/genBCKey";
import { getSetting } from "~/lib/settings";
import { hasServiceWorker } from "~/lib/swUtils";

import * as s from "~/styles/SearchBar.css";

const isProbablyUrl = (value: string) => {
    try {
        void new URL(value);
        return true;
    } catch {}
    return /^[\w-]+\.[a-z]{2,}/i.test(value);
};

interface Props {
    onSubmit: (value: string) => void;
    onSuggestions: (suggestions: string[]) => void;
}

/** Live suggestions over a WebSocket, when the setting allows them. */
function openSuggestionSocket(
    onSuggestions: (suggestions: string[]) => void,
): WebSocket | null {
    if (!getSetting("suggestLive")) return null;
    const ws = new WebSocket(WS_URL);
    ws.onmessage = event => {
        try {
            const { suggestions } = JSON.parse(event.data);
            if (suggestions && Array.isArray(suggestions))
                onSuggestions(suggestions);
        } catch {}
    };
    return ws;
}

function SearchForm(props: {
    query: string;
    supported: boolean;
    inputRef: (el: HTMLInputElement) => void;
    onInput: (value: string) => void;
    onSubmit: () => void;
}) {
    return (
        <form
            class={s.sbInputWrapper}
            onSubmit={e => {
                e.preventDefault();
                props.onSubmit();
            }}
        >
            <IconSearch size={20} class={s.sbSearchIcon} />
            <input
                ref={props.inputRef}
                class={s.sbInput}
                value={props.query}
                onInput={e => props.onInput(e.currentTarget.value)}
                placeholder={
                    props.supported
                        ? "Search or enter a web address"
                        : "Not available in this browser"
                }
                aria-label="Search or enter a web address"
                aria-describedby={
                    props.supported ? undefined : "sb-unsupported"
                }
                disabled={!props.supported}
                spellcheck="false"
                autocomplete="off"
                data-enable-grammarly="false"
            />
            <button
                type="submit"
                class={s.sbButton}
                aria-label="Browse"
                disabled={!props.supported}
            >
                <span class={s.sbButtonLabel}>Browse</span>
                <IconArrowRight size={18} />
            </button>
        </form>
    );
}

function requestSuggestions(
    ws: WebSocket | null,
    value: string,
    onSuggestions: Props["onSuggestions"],
) {
    if (value && !isProbablyUrl(value)) {
        if (ws?.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ q: value }));
    } else {
        onSuggestions([]);
    }
}

function UnsupportedNotice() {
    return (
        <p id="sb-unsupported" class={s.sbNotice} role="status">
            This browser does not support service workers. Civil cannot open
            sites without them. Use a different browser.
        </p>
    );
}

export default function SearchBarInput(props: Props) {
    const [query, setQuery] = createSignal("");
    // Read after hydration: the server has no navigator, and every proxy
    // engine in Civil needs a service worker.
    const [supported, setSupported] = createSignal(true);
    let ws: WebSocket | null = null;
    let inputRef: HTMLInputElement | undefined;

    const channel = new BroadcastChannel(genBCKey("typed_search"));
    const broadcast = (value: string) =>
        channel.postMessage({ type: "input", value });

    const handleInput = (value: string) => {
        setQuery(value);
        broadcast(value);
        requestSuggestions(ws, value, props.onSuggestions);
    };

    const handleSubmit = (value = query()) => {
        value = value.trim();
        if (!value) return;
        broadcast(value);
        props.onSubmit(value);
    };

    onSettled(() => {
        setSupported(hasServiceWorker());
        ws = openSuggestionSocket(props.onSuggestions);
        channel.onmessage = event => {
            if (event.data?.type === "input" && inputRef) {
                inputRef.value = event.data.value;
                setQuery(event.data.value);
            }
        };

        return () => {
            ws?.close();
            channel.close();
        };
    });

    return (
        <>
            <SearchForm
                query={query()}
                supported={supported()}
                inputRef={el => (inputRef = el)}
                onInput={handleInput}
                onSubmit={() => handleSubmit()}
            />
            <Show when={!supported()}>
                <UnsupportedNotice />
            </Show>
        </>
    );
}
