import { createSignal, For, flush, Show } from "solid-js";

import { apps, appsAdd, appsRemove } from "~/api/apps";
import { IconClose, IconWorld } from "~/components/icons";
import Anno from "~/components/schematic/Anno";
import Field from "~/components/schematic/Field";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import { tabManager } from "~/lib/TabManager";
import type { CivilApp } from "~/types";

import * as s from "~/styles/AppsPage.css";
import * as schematic from "~/styles/schematic.css";

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
 * A grid of pinned sites. Click one, it opens — that is the whole page.
 *
 * The earlier version buried "open" inside a per-tile disclosure: clicking an
 * app expanded a detail panel, and the actual open action was a small text
 * button inside it. Two steps for the page's one purpose, with the first step
 * teaching the user that clicking an app does *not* open it. The tile face is
 * now the open button; remove is a corner control revealed on hover and
 * focus, the same grammar the bookmarks rows use.
 *
 * Also cut in the minimal pass: the "positions" framing (numbered slots,
 * zero-padded labels, a ghost grid of dashed empty positions). An empty state
 * that draws eight numbered boxes looks like a broken page to someone who
 * just wants to pin YouTube; one line of text says everything the ghosts did.
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
        // lands in the grid as a tile labelled with the escaped text. Require
        // something that actually looks like a host first.
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

    return (
        <Sheet>
            <TitleBlock title="Apps" meta={`${apps().length} pinned`} />

            {/* The equivalent screen on a managed device is a catalogue an
                administrator curates, with a request queue for anything not on
                it. This one is just a list the reader edits. */}
            <p class={schematic.lede}>
                Keep your favorite websites together. Add a web address to get
                started.
            </p>

            <Field
                label="Add a site"
                value={input()}
                onInput={setInput}
                onEnter={handleAdd}
                placeholder="youtube.com"
                hint={addError() ?? undefined}
            />
            <Show when={adding()}>
                <Anno muted class={s.addingNote}>
                    Adding…
                </Anno>
            </Show>

            <Rule weight="major" class={s.gridRule} />

            <Show
                when={apps().length > 0}
                fallback={
                    <Anno muted class={s.empty}>
                        Nothing pinned yet. Add a site above to get started.
                    </Anno>
                }
            >
                <ul class={s.grid}>
                    <For each={apps()} keyed={false}>
                        {app => (
                            <li class={s.position}>
                                <button
                                    type="button"
                                    class={s.openBtn}
                                    onClick={() => handleOpen(app())}
                                >
                                    <span class={s.iconStage}>
                                        <AppIcon
                                            icon={app().icon}
                                            name={app().name}
                                        />
                                    </span>
                                    <span class={s.name}>{app().name}</span>
                                </button>
                                <button
                                    type="button"
                                    class={s.removeBtn}
                                    aria-label={`Remove ${app().name}`}
                                    onClick={() => appsRemove(app().id)}
                                >
                                    <IconClose size={13} />
                                </button>
                            </li>
                        )}
                    </For>
                </ul>
            </Show>
        </Sheet>
    );
}
