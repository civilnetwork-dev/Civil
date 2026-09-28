import { createSignal, onSettled } from "solid-js";

import { IconArrowRight, IconSearch } from "~/components/icons";
import { WS_URL } from "~/lib/browserHelpers";
import genBCKey from "~/lib/genBCKey";
import { getSetting } from "~/lib/settings";

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

export default function SearchBarInput(props: Props) {
    const [query, setQuery] = createSignal("");
    let ws: WebSocket | null = null;
    let inputRef: HTMLInputElement | undefined;

    const bcKey = genBCKey("typed_search");
    const channel = new BroadcastChannel(bcKey);
    const broadcast = (value: string) =>
        channel.postMessage({ type: "input", value });

    const handleInput = (value: string) => {
        setQuery(value);
        broadcast(value);
        if (!value) {
            props.onSuggestions([]);
            return;
        }
        if (!isProbablyUrl(value)) {
            if (ws?.readyState === WebSocket.OPEN)
                ws.send(JSON.stringify({ q: value }));
        } else {
            props.onSuggestions([]);
        }
    };

    const handleSubmit = (value = query()) => {
        value = value.trim();
        if (!value) return;
        broadcast(value);
        props.onSubmit(value);
    };

    onSettled(() => {
        if (getSetting("suggestLive")) {
            ws = new WebSocket(WS_URL);
            ws.onmessage = event => {
                try {
                    const { suggestions } = JSON.parse(event.data);
                    if (suggestions && Array.isArray(suggestions))
                        props.onSuggestions(suggestions);
                } catch {}
            };
        }
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
        <form
            class={s.sbInputWrapper}
            onSubmit={e => {
                e.preventDefault();
                handleSubmit();
            }}
        >
            <IconSearch size={20} class={s.sbSearchIcon} />
            <input
                ref={inputRef}
                class={s.sbInput}
                value={query()}
                onInput={e => handleInput(e.currentTarget.value)}
                placeholder="Search or enter a web address"
                aria-label="Search or enter a web address"
                spellcheck="false"
                autocomplete="off"
                data-enable-grammarly="false"
            />
            <button type="submit" class={s.sbButton} aria-label="Browse">
                <span class={s.sbButtonLabel}>Browse</span>
                <IconArrowRight size={18} />
            </button>
        </form>
    );
}
