import type { JSX } from "@solidjs/web";
import { For } from "solid-js";

import {
    IconApps,
    IconBookmark,
    IconClock,
    IconPuzzle,
    IconSearch,
    IconSliders,
    IconWorld,
} from "~/components/icons";
import { Wordmark } from "~/components/Wordmark";

import * as s from "~/styles/AppShell.css";

type Destination = { path: string; label: string; icon: typeof IconWorld };

const PLACES: Destination[] = [
    { path: "/newTab", label: "New Tab", icon: IconWorld },
    { path: "/apps", label: "Apps", icon: IconApps },
    { path: "/bookmarks", label: "Bookmarks", icon: IconBookmark },
    { path: "/history", label: "History", icon: IconClock },
    { path: "/extensions", label: "Extensions", icon: IconPuzzle },
    { path: "/checkFilters", label: "Filter check", icon: IconSearch },
];
const SETTINGS: Destination = {
    path: "/settings",
    label: "Settings",
    icon: IconSliders,
};

/**
 * The one frame every Civil page sits in: a sidebar of destinations beside
 * the page, so New Tab, Apps, History and the rest read as one app rather
 * than separate sheets.
 *
 * The pages are their own documents inside a tab's frame, so moving between
 * them is the chrome's job: a click inside the browser asks the parent to
 * load `browser:<page>` in the same tab (keeping that tab's history and title
 * right), and a page opened on its own keeps plain links.
 *
 * The active row wears the Doorway's lit door: one cobalt shape that slides
 * to whichever row is current, rather than a coloured bar on each row.
 */
const inFrame = () =>
    typeof window !== "undefined" && window.self !== window.top;

function go(event: MouseEvent, path: string) {
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
        { type: "civil:navigate", url: `browser:${path.slice(1)}` },
        window.location.origin,
    );
}

export default function AppShell(props: { children: JSX.Element }) {
    const here = typeof window === "undefined" ? "" : window.location.pathname;
    const all = [...PLACES, SETTINGS];
    const index = all.findIndex(d => d.path === here);

    const row = (d: Destination) => (
        <a
            href={d.path}
            class={s.row}
            aria-current={d.path === here ? "page" : undefined}
            onClick={event => go(event, d.path)}
        >
            <d.icon size={16} class={s.rowIcon} />
            <span>{d.label}</span>
        </a>
    );

    return (
        <div class={s.shell}>
            <nav class={s.sidebar} aria-label="Civil">
                <a
                    href="/newTab"
                    class={s.brand}
                    aria-label="Civil Proxy, New Tab"
                    onClick={event => go(event, "/newTab")}
                >
                    <Wordmark width={164} />
                </a>
                <div
                    class={s.places}
                    style={{ "--door": String(Math.max(index, 0)) }}
                >
                    <span
                        class={s.door}
                        data-hidden={index < 0 || index >= PLACES.length}
                        aria-hidden="true"
                    />
                    <For each={PLACES}>{row}</For>
                </div>
                <div class={s.foot}>{row(SETTINGS)}</div>
            </nav>
            <div class={s.main}>{props.children}</div>
        </div>
    );
}
