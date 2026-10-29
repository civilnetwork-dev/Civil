import { createMemo, createSignal, For, flush, Show } from "solid-js";

import { apps, appsAdd, appsRemove } from "~/api/apps";
import { IconApps, IconClose, IconPlus, IconWorld } from "~/components/icons";
import Anno from "~/components/schematic/Anno";
import Field from "~/components/schematic/Field";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import Specimen from "~/components/Specimen";
import {
    CATALOG,
    type CatalogApp,
    CATEGORIES,
    type Category,
} from "~/lib/appCatalog";
import { gstaticFavicon } from "~/lib/browserHelpers";
import { openInBrowser } from "~/lib/openInBrowser";
import { getSetting } from "~/lib/settings";
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

/** Same site, whatever the path or a leading www. */
const siteOf = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
};

const BAD_ADDRESS = "That doesn't look like a web address. Try youtube.com";

// `new URL()` alone accepts almost anything once a scheme is bolted on:
// "not a valid url" becomes the host "not%20a%20valid%20url", which then
// lands in the grid as a tile labelled with the escaped text. Require
// something that actually looks like a host first.
function parseAppUrl(raw: string): URL | null {
    let url: URL;
    try {
        url = new URL(
            /^[a-z][\w+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`,
        );
    } catch {
        return null;
    }
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname) ? url : null;
}

/** In this tab or a new one, as Settings says ("Open apps in"). */
function openApp(url: string) {
    openInBrowser(url, { newTab: getSetting("appsOpenIn") === "new" });
}

function useAddApp() {
    const [input, setInput] = createSignal("");
    const [adding, setAdding] = createSignal(false);
    const [addError, setAddError] = createSignal<string | null>(null);

    const handleAdd = async () => {
        // A plain, untracked read of a signal (this call included: event
        // handlers run outside any reactive computation) only ever sees the
        // last *committed* value; a write from the keystroke that landed a
        // moment ago is still sitting in a pending slot until the runtime's
        // own microtask flush commits it. In real typing that flush has
        // always already happened by the time Enter is pressed, but Field's
        // `onEnter` fires synchronously off the same keydown that could, in
        // principle, race a same-tick `input` write: forcing the flush here
        // guarantees `input()` below reflects the latest keystroke rather
        // than the one before it.
        flush();
        const raw = input().trim();
        if (!raw) return;

        const url = parseAppUrl(raw);
        if (!url) {
            setAddError(BAD_ADDRESS);
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

    return { input, setInput, adding, addError, handleAdd };
}

function useShelf() {
    const [category, setCategory] = createSignal<Category | null>(null);

    const shelf = createMemo(() =>
        CATALOG.filter(app => !category() || app.category === category()),
    );
    const pinned = createMemo(
        () => new Set(apps().map(app => siteOf(app.url))),
    );

    const pickRandom = () => {
        const list = shelf();
        if (list.length)
            openApp(list[Math.floor(Math.random() * list.length)].url);
    };

    return { category, setCategory, shelf, pinned, pickRandom };
}

type Shelf = ReturnType<typeof useShelf>;

function AppTile(props: { app: CivilApp }) {
    return (
        <li class={s.position}>
            <button
                type="button"
                class={s.openBtn}
                onClick={() => openApp(props.app.url)}
            >
                <span class={s.iconStage}>
                    <AppIcon icon={props.app.icon} name={props.app.name} />
                </span>
                <span class={s.name}>{props.app.name}</span>
            </button>
            <button
                type="button"
                class={s.removeBtn}
                aria-label={`Remove ${props.app.name}`}
                onClick={() => appsRemove(props.app.id)}
            >
                <IconClose size={13} />
            </button>
        </li>
    );
}

function NoApps() {
    return (
        <div class={s.empty}>
            <Specimen icon={IconApps} tint="stone" size={64} />
            <Anno muted>
                Nothing pinned yet. Add a site above, or pin one from the shelf
                below.
            </Anno>
        </div>
    );
}

function PinnedApps() {
    const add = useAddApp();

    return (
        <section aria-labelledby="pins-heading">
            <h2 id="pins-heading" class={s.sectionTitle}>
                Your apps
            </h2>
            <Field
                label="Add a site"
                value={add.input()}
                onInput={add.setInput}
                onEnter={add.handleAdd}
                placeholder="youtube.com"
                hint={add.addError() ?? undefined}
            />
            <Show when={add.adding()}>
                <Anno muted class={s.addingNote}>
                    Adding…
                </Anno>
            </Show>

            <Show when={apps().length > 0} fallback={<NoApps />}>
                <ul class={s.grid} data-pins>
                    <For each={apps()} keyed={false}>
                        {app => <AppTile app={app()} />}
                    </For>
                </ul>
            </Show>
        </section>
    );
}

function CategoryChips(props: { shelf: Shelf }) {
    return (
        <div class={schematic.chips} role="group" aria-label="Show">
            <button
                type="button"
                class={schematic.chip}
                aria-pressed={
                    props.shelf.category() === null ? "true" : "false"
                }
                onClick={() => props.shelf.setCategory(null)}
            >
                All
            </button>
            <For each={CATEGORIES}>
                {name => (
                    <button
                        type="button"
                        class={schematic.chip}
                        aria-pressed={
                            props.shelf.category() === name ? "true" : "false"
                        }
                        onClick={() => props.shelf.setCategory(name)}
                    >
                        {name}
                    </button>
                )}
            </For>
        </div>
    );
}

function ShelfCard(props: { app: CatalogApp; pinned: boolean }) {
    return (
        <div class={s.card}>
            <button
                type="button"
                class={s.cardOpen}
                onClick={() => openApp(props.app.url)}
            >
                <span class={s.cardIcon}>
                    <AppIcon
                        icon={gstaticFavicon(props.app.url, 64)}
                        name={props.app.name}
                    />
                </span>
                <span class={s.cardText}>
                    <span class={s.cardName}>{props.app.name}</span>
                    <span class={s.cardNote}>{props.app.note}</span>
                </span>
            </button>
            <Show when={!props.pinned}>
                <button
                    type="button"
                    class={s.pinBtn}
                    aria-label={`Pin ${props.app.name}`}
                    onClick={() => void appsAdd(props.app.url)}
                >
                    <IconPlus size={14} />
                </button>
            </Show>
        </div>
    );
}

function PopularShelf(props: { shelf: Shelf }) {
    return (
        <section aria-labelledby="shelf-heading">
            <h2 id="shelf-heading" class={s.sectionTitle}>
                Popular
            </h2>
            <CategoryChips shelf={props.shelf} />
            <div class={s.shelf}>
                <For each={props.shelf.shelf()}>
                    {app => (
                        <ShelfCard
                            app={app}
                            pinned={props.shelf.pinned().has(siteOf(app.url))}
                        />
                    )}
                </For>
            </div>
        </section>
    );
}

/**
 * Two shelves: the reader's own pins, and a built-in shelf of popular sites
 * filtered by chips. Clicking either opens the site, in this tab or a new one
 * as Settings says ("Open apps in"); it goes through the chrome, which owns
 * the tabs (see openInBrowser).
 *
 * Depth means ownership: a pinned app is a raised stone tile, the shelf's
 * entries lie flat until pinned.
 *
 * Also cut in the minimal pass: the "positions" framing (numbered slots,
 * zero-padded labels, a ghost grid of dashed empty positions). An empty state
 * that draws eight numbered boxes looks like a broken page to someone who
 * just wants to pin YouTube; one line of text says everything the ghosts did.
 */
export default function AppsPage() {
    const shelf = useShelf();

    return (
        <Sheet>
            <TitleBlock
                title="Apps"
                meta={`${apps().length} pinned`}
                icon={IconApps}
                tint="cobalt"
                actions={
                    <button
                        type="button"
                        class={s.randomKey}
                        onClick={shelf.pickRandom}
                    >
                        Random pick
                    </button>
                }
            />

            <PinnedApps />
            <PopularShelf shelf={shelf} />
            <p class={schematic.lede}>
                Sites open in{" "}
                {getSetting("appsOpenIn") === "new" ? "a new tab" : "this tab"}.
                You can change that in Settings.
            </p>
        </Sheet>
    );
}
