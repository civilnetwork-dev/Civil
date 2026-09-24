import { createSignal, For, Show } from "solid-js";

import SearchBarInput from "~/components/SearchBarInput";
import searchBar from "~/lib/SearchBar";

import * as s from "~/styles/SearchBar.css";

export default function SearchBarContainer() {
    const bar = searchBar();

    const [suggestions, setSuggestions] = createSignal<string[]>([]);

    const handleSubmit = (value: string) => {
        bar.lastUrlSearched = value;
        bar.url = value;

        localStorage.setItem("last-url-searched", value);
        localStorage.setItem("url", value);

        setSuggestions([]);

        // Inside a tab's frame the chrome owns navigation (see the
        // `civil:navigate` handler in useIframeManager); this document's own
        // scramjet controller has no frame to route through.
        if (typeof window !== "undefined" && window.self !== window.top) {
            window.parent.postMessage(
                { type: "civil:navigate", url: value },
                window.location.origin,
            );
            return;
        }

        const iframe = window.frameElement;
        if (iframe instanceof HTMLIFrameElement) {
            bar.emit("submit", iframe, value);
        }
    };

    return (
        <div class={s.sbRoot}>
            <SearchBarInput
                onSubmit={handleSubmit}
                onSuggestions={setSuggestions}
            />

            <Show when={suggestions().length > 0}>
                <ul class={s.sbDropdown} aria-label="Search suggestions">
                    <For each={suggestions()} keyed={false}>
                        {item => (
                            <li>
                                <button
                                    type="button"
                                    class={s.sbRow}
                                    onClick={() => handleSubmit(item())}
                                >
                                    {item()}
                                </button>
                            </li>
                        )}
                    </For>
                </ul>
            </Show>
        </div>
    );
}
