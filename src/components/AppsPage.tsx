import { TbOutlinePlus, TbOutlineWorld, TbOutlineX } from "solid-icons/tb";
import { createSignal, For, Show } from "solid-js";
import { apps, appsAdd, appsRemove } from "~/api/apps";
import { tabManager } from "~/lib/TabManager";
import * as s from "~/styles/AppsPage.css";
import * as l from "~/styles/layout.css";
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
    const [input, setInput] = createSignal("");
    const [adding, setAdding] = createSignal(false);
    const [addError, setAddError] = createSignal<string | null>(null);

    const handleAdd = async () => {
        const raw = input().trim();
        if (!raw) return;

        // `new URL()` alone accepts almost anything once a scheme is bolted
        // on: "not a valid url" becomes the host "not%20a%20valid%20url",
        // which then lands in the grid as a tile labelled with the escaped
        // text. Require something that actually looks like a host first.
        let url: URL;
        try {
            url = new URL(
                /^[a-z][\w+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`,
            );
        } catch {
            setAddError(
                "That doesn't look like a web address. Try youtube.com",
            );
            return;
        }
        if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)) {
            setAddError(
                "That doesn't look like a web address. Try youtube.com",
            );
            return;
        }

        setAdding(true);
        setAddError(null);
        try {
            await appsAdd(url.toString());
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
    };

    return (
        <div class={s.root}>
            <header class={l.masthead}>
                <div class={l.mastheadTop}>
                    <div class={l.mastheadTitleGroup}>
                        <span class={l.eyebrow}>
                            <span class={l.eyebrowMark} />
                            Launcher
                        </span>
                        <h1 class={l.pageTitle}>Apps</h1>
                    </div>
                    <Show when={apps().length > 0}>
                        <span class={l.pageMeta}>{apps().length} pinned</span>
                    </Show>
                </div>
                <div class={l.mastheadRule} />
            </header>
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
                    {adding() ? "Adding…" : "Add app"}
                </button>
            </div>
            <Show when={addError()}>
                <p class={s.errorMsg}>{addError()}</p>
            </Show>
            <Show when={apps().length === 0}>
                <div class={s.empty}>
                    <div class={s.emptyGhostTile}>
                        <TbOutlinePlus size={28} />
                    </div>
                    <p class={s.emptyText}>
                        No apps added yet. Enter a URL above.
                    </p>
                </div>
            </Show>
            <div class={s.grid}>
                <For each={apps()} keyed={false}>
                    {app => (
                        // biome-ignore lint/a11y/noStaticElementInteractions: biome breaking my project lmao
                        // biome-ignore lint/a11y/useKeyWithClickEvents: biome breaking my project lmao
                        <div
                            class={s.appCard}
                            onClick={() => handleOpen(app())}
                        >
                            <button
                                type="button"
                                class={s.removeBtn}
                                title="Remove"
                                onClick={e => handleRemove(e, app().id)}
                            >
                                <TbOutlineX size={11} />
                            </button>
                            <div class={s.appIconStage}>
                                <AppIcon icon={app().icon} name={app().name} />
                            </div>
                            <div class={s.appNameBar}>{app().name}</div>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
}
