import { createSignal, For, Show } from "solid-js";
import SearchBarInput from "~/components/SearchBarInput";
import searchBar from "~/lib/SearchBar";
import * as s from "~/styles/SearchBar.css";

export default function SearchBarContainer(props: { inline?: boolean }) {
    const bar = searchBar();

    const [suggestions, setSuggestions] = createSignal<string[]>([]);

    const getIframe = () => {
        const frame = window.frameElement;
        if (frame instanceof HTMLIFrameElement) return frame;
        return null;
    };

    const handleSubmit = (value: string) => {
        bar.lastUrlSearched = value;
        bar.url = value;

        localStorage.setItem("last-url-searched", value);
        localStorage.setItem("url", value);

        setSuggestions([]);

        const iframe = getIframe();
        if (iframe) {
            bar.emit("submit", iframe, value);
        }
    };

    return (
        <div class={props.inline ? s.sbHostInline : s.sbHost}>
            <div class={s.sbRoot}>
                <SearchBarInput
                    onSubmit={handleSubmit}
                    onSuggestions={setSuggestions}
                    showBlur={false}
                />

                <Show when={suggestions().length > 0}>
                    <ul class={s.sbDropdown}>
                        <For each={suggestions()}>
                            {item => (
                                <li
                                    class={s.sbRow}
                                    onClick={() => handleSubmit(item)}
                                    onKeyDown={e =>
                                        e.key === "Enter" && handleSubmit(item)
                                    }
                                >
                                    {item}
                                </li>
                            )}
                        </For>
                    </ul>
                </Show>
            </div>
        </div>
    );
}
