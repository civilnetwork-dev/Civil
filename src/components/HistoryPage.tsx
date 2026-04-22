import { TbOutlineWorld, TbOutlineX } from "solid-icons/tb";
import { createSignal, For, onMount, Show } from "solid-js";
import {
    historyClear,
    historyDelete,
    historyGetAll,
    historyGetMethod,
    historySetMethod,
} from "~/api/history";
import * as s from "~/styles/HistoryPage.css";
import type { CivilHistoryEntry, HistoryStorageMethod } from "~/types";

export default function HistoryPage() {
    const [entries, setEntries] = createSignal<CivilHistoryEntry[]>([]);
    const [method, setMethod] = createSignal<HistoryStorageMethod>(
        historyGetMethod(),
    );

    onMount(async () => {
        setEntries(await historyGetAll());
    });

    const handleClear = async () => {
        await historyClear();
        setEntries([]);
    };

    const handleDelete = async (id: string) => {
        await historyDelete(id);
        setEntries(entries().filter(e => e.id !== id));
    };

    const handleMethodChange = (m: HistoryStorageMethod) => {
        historySetMethod(m);
        setMethod(m);
    };

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        return (
            d.toLocaleDateString() +
            " " +
            d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        );
    };

    return (
        <div class={s.root}>
            <div class={s.header}>
                <span class={s.title}>History</span>
                <div class={s.controls}>
                    <select
                        class={s.methodSelect}
                        value={method()}
                        onChange={e =>
                            handleMethodChange(
                                e.currentTarget.value as HistoryStorageMethod,
                            )
                        }
                    >
                        <option value="localstorage">localStorage</option>
                        <option value="indexeddb">IndexedDB</option>
                    </select>
                    <button
                        type="button"
                        class={s.clearBtn}
                        onClick={handleClear}
                    >
                        Clear All
                    </button>
                </div>
            </div>

            <Show when={entries().length === 0}>
                <p class={s.empty}>No history yet.</p>
            </Show>

            <div class={s.list}>
                <For each={entries()}>
                    {entry => (
                        <div class={s.entry}>
                            <Show
                                when={entry.favicon}
                                fallback={
                                    <TbOutlineWorld
                                        size={16}
                                        class={s.favicon}
                                    />
                                }
                            >
                                <img
                                    src={entry.favicon}
                                    class={s.favicon}
                                    alt=""
                                    onError={e => {
                                        (
                                            e.currentTarget as HTMLImageElement
                                        ).style.display = "none";
                                    }}
                                />
                            </Show>
                            <div class={s.entryInfo}>
                                <div class={s.entryTitle}>
                                    {entry.title || entry.url}
                                </div>
                                <div class={s.entryUrl}>{entry.url}</div>
                            </div>
                            <span class={s.entryTime}>
                                {formatTime(entry.visitedAt)}
                            </span>
                            <button
                                type="button"
                                class={s.deleteBtn}
                                title="Remove"
                                onClick={() => handleDelete(entry.id)}
                            >
                                <TbOutlineX size={14} />
                            </button>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
}
