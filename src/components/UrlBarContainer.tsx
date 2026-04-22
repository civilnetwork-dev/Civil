import { createSignal, For, Show } from "solid-js";
import SearchBarInput from "~/components/SearchBarInput";
import searchBar from "~/lib/SearchBar";
import { resolveUrl, tabManager } from "~/lib/TabManager";
import * as s from "~/styles/SearchBar.css";

export default function SearchBar() {
    const bar = searchBar();
    const [suggestions, setSuggestions] = createSignal<string[]>([]);

    const handleSubmit = (value: string) => {
        bar.lastUrlSearched = value;
        bar.url = value;
        localStorage.setItem("last-url-searched", value);
        localStorage.setItem("url", value);
        setSuggestions([]);

        const resolvedUrl = resolveUrl(value);
        const activeId = tabManager.activeId;

        if (activeId) {
            tabManager.updateTab(activeId, {
                url: resolvedUrl,
                isLoading: true,
                title: "Loading...",
            });
            const event = new CustomEvent("browser:navigate", {
                detail: { tabId: activeId, url: resolvedUrl },
                bubbles: true,
            });
            document.dispatchEvent(event);
        } else {
            const tab = tabManager.createTab(resolvedUrl);
            tabManager.activateTab(tab.id);
        }
    };

    return (
        <div class={s.sbHost}>
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
