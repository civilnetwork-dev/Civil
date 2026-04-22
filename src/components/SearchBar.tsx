import { createEffect, createSignal, For, Show } from "solid-js";
import SearchBarInput from "~/components/SearchBarInput.tsx";
import searchBar from "~/lib/SearchBar";
import * as s from "~/styles/SearchBar.css";

export default function SearchBar() {
    const bar = searchBar();

    const [suggestions, setSuggestions] = createSignal<string[]>([]);
    const [hasSubmitted, setHasSubmitted] = createSignal(false);
    const [iframeUrl, setIframeUrl] = createSignal("");
    const [iframeVisible, setIframeVisible] = createSignal(false);

    let iframeRef: HTMLIFrameElement | undefined;
    let hostRef: HTMLDivElement | undefined;

    const showIframe = () => hasSubmitted() && iframeUrl() !== "";

    createEffect(() => {
        if (!hostRef) return;
        hostRef.style.alignItems = showIframe() ? "flex-start" : "center";
    });

    const handleSubmit = (value: string) => {
        bar.lastUrlSearched = value;
        bar.url = value;
        localStorage.setItem("last-url-searched", value);
        localStorage.setItem("url", value);
        setSuggestions([]);
        setHasSubmitted(true);
        setIframeUrl(value);
        setTimeout(() => setIframeVisible(true), 60);
        setTimeout(() => {
            if (!iframeRef) return;
            bar.emit("submit", iframeRef, value);
        }, 0);
    };

    return (
        <div ref={hostRef} class={s.sbHost}>
            <div class={s.sbRoot}>
                <SearchBarInput
                    onSubmit={handleSubmit}
                    onSuggestions={setSuggestions}
                    showBlur={showIframe()}
                />

                <Show when={suggestions().length > 0}>
                    <ul
                        class={s.sbDropdown}
                        classList={{ [s.sbDropdownBlur]: showIframe() }}
                    >
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

                <Show when={showIframe()}>
                    <iframe
                        ref={iframeRef}
                        title="Search suggestions"
                        class="sb-frame"
                        classList={{ "sb-frame--visible": iframeVisible() }}
                    />
                </Show>
            </div>
        </div>
    );
}
