import { TbOutlineWorld, TbOutlineX } from "solid-icons/tb";
import { createSignal, For, onMount, Show } from "solid-js";
import { appsAdd, appsGetAll, appsRemove } from "~/api/apps";
import { tabManager } from "~/lib/TabManager";
import * as s from "~/styles/AppsPage.css";
import type { CivilApp } from "~/types";

function AppIcon(props: { icon: string | null; name: string }) {
    const [failed, setFailed] = createSignal(false);
    return (
        <Show
            when={props.icon && !failed()}
            fallback={
                <div class={s.appIconFallback}>
                    <TbOutlineWorld size={28} />
                </div>
            }
        >
            <img
                src={props.icon!}
                class={s.appIcon}
                alt={props.name}
                onError={() => setFailed(true)}
            />
        </Show>
    );
}

export default function AppsPage() {
    const [apps, setApps] = createSignal<CivilApp[]>([]);
    const [input, setInput] = createSignal("");
    const [adding, setAdding] = createSignal(false);
    const [addError, setAddError] = createSignal<string | null>(null);

    onMount(() => setApps(appsGetAll()));

    const handleAdd = async () => {
        const raw = input().trim();
        if (!raw) return;
        setAdding(true);
        setAddError(null);
        try {
            let url = raw;
            try {
                new URL(url);
            } catch {
                url = `https://${url}`;
            }
            await appsAdd(url);
            setApps(appsGetAll());
            setInput("");
        } catch (e) {
            setAddError(e instanceof Error ? e.message : "Failed to add app");
        } finally {
            setAdding(false);
        }
    };

    const handleOpen = (app: CivilApp) => {
        const existing = tabManager.tabs.find(t => t.url === app.url);
        if (existing) {
            tabManager.activateTab(existing.id);
        } else {
            const t = tabManager.createTab(app.url);
            tabManager.activateTab(t.id);
        }
    };

    const handleRemove = (e: MouseEvent, id: string) => {
        e.stopPropagation();
        appsRemove(id);
        setApps(appsGetAll());
    };

    return (
        <div class={s.root}>
            <div class={s.header}>
                <span class={s.title}>Apps</span>
            </div>
            <div class={s.addBar}>
                <input
                    class={s.addInput}
                    type="text"
                    placeholder="Enter app URL (e.g. youtube.com)"
                    value={input()}
                    onInput={e => setInput(e.currentTarget.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter") handleAdd();
                    }}
                />
                <button
                    type="button"
                    class={s.addBtn}
                    onClick={handleAdd}
                    disabled={adding() || !input().trim()}
                >
                    {adding() ? "Adding…" : "Add App"}
                </button>
            </div>
            <Show when={addError()}>
                <p class={s.errorMsg}>{addError()}</p>
            </Show>
            <Show when={apps().length === 0}>
                <p class={s.empty}>No apps added yet. Enter a URL above.</p>
            </Show>
            <div class={s.grid}>
                <For each={apps()}>
                    {app => (
                        // biome-ignore lint/a11y/noStaticElementInteractions: biome breaking my project lmao
                        // biome-ignore lint/a11y/useKeyWithClickEvents: biome breaking my project lmao
                        <div class={s.appCard} onClick={() => handleOpen(app)}>
                            <button
                                type="button"
                                class={s.removeBtn}
                                title="Remove"
                                onClick={e => handleRemove(e, app.id)}
                            >
                                <TbOutlineX size={11} />
                            </button>
                            <AppIcon icon={app.icon} name={app.name} />
                            <span class={s.appName}>{app.name}</span>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
}
