import { createSignal, For, flush, Show } from "solid-js";
import { apps, appsAdd, appsRemove } from "~/api/apps";
import { IconWorld } from "~/components/icons";
import Anno from "~/components/schematic/Anno";
import Field from "~/components/schematic/Field";
import Plate from "~/components/schematic/Plate";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import Unfold from "~/components/schematic/Unfold";
import { tabManager } from "~/lib/TabManager";
import * as s from "~/styles/AppsPage.css";
import type { CivilApp } from "~/types";

const GHOST_POSITIONS = 8;

function AppIcon(props: { icon: string | null; name: string }) {
    const [failed, setFailed] = createSignal(false);
    return (
        <Show
            when={props.icon && !failed()}
            fallback={
                <div class={s.iconFallback}>
                    <IconWorld size={24} />
                </div>
            }
        >
            <img
                src={props.icon!}
                class={s.icon}
                alt=""
                onError={() => setFailed(true)}
            />
        </Show>
    );
}

/**
 * The parts plate.
 *
 * Each app is a numbered position on a ruled field rather than a card in a
 * grid. Metadata and the remove action live inside the position's unfold, which
 * is what lets a plate of forty items read as calm at rest.
 */
export default function AppsPage() {
    const [input, setInput] = createSignal("");
    const [adding, setAdding] = createSignal(false);
    const [addError, setAddError] = createSignal<string | null>(null);

    const handleAdd = async () => {
        // A plain, untracked read of a signal (this call included — event
        // handlers run outside any reactive computation) only ever sees the
        // last *committed* value; a write from the keystroke that landed a
        // moment ago is still sitting in a pending slot until the runtime's
        // own microtask flush commits it. In real typing that flush has
        // always already happened by the time Enter is pressed, but Field's
        // `onEnter` fires synchronously off the same keydown that could, in
        // principle, race a same-tick `input` write — forcing the flush here
        // guarantees `input()` below reflects the latest keystroke rather
        // than the one before it.
        flush();
        const raw = input().trim();
        if (!raw) return;

        // `new URL()` alone accepts almost anything once a scheme is bolted on:
        // "not a valid url" becomes the host "not%20a%20valid%20url", which then
        // lands in the plate as a position labelled with the escaped text.
        // Require something that actually looks like a host first.
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

    const position = (index: number) => String(index + 1).padStart(2, "0");

    return (
        <Sheet>
            <TitleBlock
                eyebrow="launcher"
                title="Apps"
                meta={`${apps().length} pinned`}
            />

            <Field
                label="add item"
                value={input()}
                onInput={setInput}
                onEnter={handleAdd}
                placeholder="youtube.com"
                hint={addError() ?? undefined}
            />
            <Show when={adding()}>
                <Anno muted class={s.addingNote}>
                    adding…
                </Anno>
            </Show>

            <Rule label="positions" weight="major" class={s.gridRule} />

            <Show
                when={apps().length > 0}
                fallback={
                    <div class={s.ghostGrid}>
                        <For
                            each={Array.from({ length: GHOST_POSITIONS })}
                            keyed={false}
                        >
                            {(_, i) => (
                                <div class={s.ghost} data-ghost>
                                    <Anno muted>{position(i)}</Anno>
                                </div>
                            )}
                        </For>
                        <p class={s.ghostNote}>
                            <Anno muted>
                                no positions filled — add an address above
                            </Anno>
                        </p>
                    </div>
                }
            >
                <ul class={s.grid}>
                    <For each={apps()} keyed={false}>
                        {(app, i) => (
                            <Plate as="li" class={s.position}>
                                <Unfold
                                    label={`${app().name} detail`}
                                    summary={
                                        <span class={s.summary}>
                                            <Anno muted>{position(i)}</Anno>
                                            <span class={s.iconStage}>
                                                <AppIcon
                                                    icon={app().icon}
                                                    name={app().name}
                                                />
                                            </span>
                                            <span class={s.name}>
                                                {app().name}
                                            </span>
                                        </span>
                                    }
                                >
                                    <div class={s.detail}>
                                        <Anno muted>
                                            {new URL(app().url).hostname}
                                        </Anno>
                                        <div class={s.detailActions}>
                                            <button
                                                type="button"
                                                class={s.detailBtn}
                                                onClick={() =>
                                                    handleOpen(app())
                                                }
                                            >
                                                open
                                            </button>
                                            <button
                                                type="button"
                                                class={s.detailBtnDanger}
                                                onClick={() =>
                                                    appsRemove(app().id)
                                                }
                                            >
                                                remove
                                            </button>
                                        </div>
                                    </div>
                                </Unfold>
                            </Plate>
                        )}
                    </For>
                </ul>
            </Show>
        </Sheet>
    );
}
