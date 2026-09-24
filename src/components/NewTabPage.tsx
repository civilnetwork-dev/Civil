import { For, Show } from "solid-js";

import {
    IconApps,
    IconArrowUpRight,
    IconBookmark,
    IconClock,
    IconPuzzle,
    IconWorld,
} from "~/components/icons";
import { Wordmark } from "~/components/Wordmark";

import SearchBarContainer from "./SearchBarContainer";

import * as s from "~/styles/NewTabPage.css";

const HOME_URL = "/";

const shortcuts = [
    {
        title: "Apps",
        description: "Your favorite places",
        href: "/apps",
        icon: IconApps,
    },
    {
        title: "Bookmarks",
        description: "Keep the good stuff",
        href: "/bookmarks",
        icon: IconBookmark,
    },
    {
        title: "History",
        description: "Pick up where you left off",
        href: "/history",
        icon: IconClock,
    },
    {
        title: "Extensions",
        description: "Make it your own",
        href: "/extensions",
        icon: IconPuzzle,
    },
];

export default function NewTabPage() {
    const inFrame = () =>
        typeof window !== "undefined" && window.self !== window.top;

    // Internal navigation belongs to the parent, which owns the active tab.
    const openPage = (event: MouseEvent, href: string) => {
        if (
            !inFrame() ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
        )
            return;
        event.preventDefault();
        window.parent.postMessage(
            { type: "civil:navigate", url: `browser:${href.slice(1)}` },
            window.location.origin,
        );
    };

    return (
        <main class={s.page}>
            <header class={s.header}>
                <a
                    class={s.brand}
                    href="/"
                    aria-label="Civil home"
                    onClick={event => openPage(event, "/newtab")}
                >
                    <Wordmark width={140} />
                </a>
                <a
                    class={s.utilityLink}
                    href="/checkfilters"
                    onClick={event => openPage(event, "/checkfilters")}
                >
                    Filter check <IconArrowUpRight size={15} />
                </a>
            </header>
            <section class={s.content} aria-labelledby="welcome-heading">
                <div class={s.welcome}>
                    <div class={s.emblem} aria-hidden="true">
                        <IconWorld size={28} />
                    </div>
                    <h1 id="welcome-heading" class={s.heading}>
                        A little space to explore.
                    </h1>
                    <p class={s.description}>
                        Search for something new, or go somewhere you love.
                    </p>
                </div>
                <Show when={!inFrame()}>
                    <a class={s.openBrowser} href={HOME_URL}>
                        Open Civil browser <IconArrowUpRight size={18} />
                    </a>
                </Show>
                <Show when={inFrame()}>
                    <div class={s.searchSeat}>
                        <SearchBarContainer />
                    </div>
                </Show>
                <nav class={s.shortcuts} aria-label="Your browser">
                    <For each={shortcuts}>
                        {shortcut => (
                            <a
                                class={s.shortcut}
                                href={shortcut.href}
                                onClick={event =>
                                    openPage(event, shortcut.href)
                                }
                            >
                                <span class={s.shortcutIcon}>
                                    <shortcut.icon size={22} />
                                </span>
                                <span class={s.shortcutTitle}>
                                    {shortcut.title}
                                </span>
                                <span class={s.shortcutDescription}>
                                    {shortcut.description}
                                </span>
                            </a>
                        )}
                    </For>
                </nav>
            </section>
            <footer class={s.footer}>
                Ads keep Civil free and open source.
            </footer>
        </main>
    );
}
