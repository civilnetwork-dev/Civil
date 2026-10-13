import { createSignal, For, Show } from "solid-js";

import SearchBarInput from "~/components/SearchBarInput";

import * as s from "~/styles/SearchBar.css";

export default function SearchBarContainer() {
    const [suggestions, setSuggestions] = createSignal<string[]>([]);

    const handleSubmit = (value: string) => {
        setSuggestions([]);

        // The chrome owns navigation (see the `civil:navigate` handler in
        // useIframeManager).
        window.parent.postMessage(
            { type: "civil:navigate", url: value },
            window.location.origin,
        );
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
