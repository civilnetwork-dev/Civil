import type { JSX } from "@solidjs/web";

import * as s from "~/styles/icons.css";

type IconProps = { size?: number; class?: string };

/**
 * A single 16-unit grid, stroke, and motion contract across every screen.
 *
 * Each glyph is drawn three times from the one path source: an extrusion
 * offset down and right in a darker tone, a lit rim offset up and left, and
 * the face on top. Together they read as a small raised solid lit from the
 * upper left. On hover the face and rim lift while the extrusion stays put, so
 * the solid visibly deepens. Colour still comes only from `currentColor`.
 */
function icon(name: string, body: () => JSX.Element, fill = false) {
    return (props: IconProps) => (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            width={props.size ?? 16}
            height={props.size ?? 16}
            class={[s.icon, props.class]}
            data-icon={name}
            aria-hidden="true"
            fill={fill ? "currentColor" : "none"}
            stroke={fill ? "none" : "currentColor"}
            stroke-width={1.35}
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <g class={s.depth}>{body()}</g>
            <g class={s.rim}>{body()}</g>
            <g class={s.face}>{body()}</g>
        </svg>
    );
}

const CIRCLE =
    "M8 2.5C11.04 2.5 13.5 4.96 13.5 8C13.5 11.04 11.04 13.5 8 13.5C4.96 13.5 2.5 11.04 2.5 8C2.5 4.96 4.96 2.5 8 2.5Z";
const BOOKMARK = "M4 2.5h8v11l-4-3-4 3z";
const PANEL =
    "M4 2.5h8C13 2.5 13.5 3 13.5 4v8C13.5 13 13 13.5 12 13.5H4C3 13.5 2.5 13 2.5 12V4C2.5 3 3 2.5 4 2.5Z";

export const IconArrowLeft = icon("left", () => (
    <>
        <path d="M13 8H3" />
        <path d="M7 4L3 8l4 4" />
    </>
));
export const IconArrowRight = icon("right", () => (
    <>
        <path d="M3 8h10" />
        <path d="M9 4l4 4-4 4" />
    </>
));
export const IconForward = icon("right", () => (
    <>
        <path d="M3 8h10" />
        <path d="M9 4l4 4-4 4" />
    </>
));
export const IconRefresh = icon("refresh", () => (
    <>
        <path d="M12.5 5C11.5 3 9.5 2.5 8 2.5C5 2.5 2.5 5 2.5 8M3.5 11C4.5 13 6.5 13.5 8 13.5C11 13.5 13.5 11 13.5 8" />
        <path d="M12.5 2v3h-3M3.5 14v-3h3" />
    </>
));
export const IconPlus = icon("plus", () => (
    <>
        <path d="M8 2.5v11" />
        <path d="M2.5 8h11" />
    </>
));
export const IconClose = icon("close", () => (
    <>
        <path d="M3.5 3.5l9 9" />
        <path d="M12.5 3.5l-9 9" />
    </>
));
export const IconChevronDown = icon("down", () => (
    <path d="M3.5 5.75L8 10.25l4.5-4.5" />
));
export const IconSearch = icon("search", () => (
    <>
        <path d="M6.5 2.25C8.85 2.25 10.75 4.15 10.75 6.5C10.75 8.85 8.85 10.75 6.5 10.75C4.15 10.75 2.25 8.85 2.25 6.5C2.25 4.15 4.15 2.25 6.5 2.25Z" />
        <path d="M9.75 9.75l4 4" />
    </>
));
export const IconLock = icon("lock", () => (
    <>
        <path d="M5 7V5C5 3 6 3 8 3C10 3 11 3 11 5v2" />
        <path d="M3.5 7h9v6h-9z" />
        <path d="M8 9.5v1" />
    </>
));
export const IconWorld = icon("world", () => (
    <>
        <path d={CIRCLE} />
        <path d="M8 2.5C11.5 5 11.5 11 8 13.5C4.5 11 4.5 5 8 2.5Z" />
        <path d="M2.5 8h11" />
    </>
));
export const IconLink = icon("link", () => (
    <>
        <path d="M6.5 9.5l-1 1C2.5 13.5 .5 9.5 3.5 7.5l2-2" />
        <path d="M9.5 6.5l1-1C13.5 2.5 15.5 6.5 12.5 8.5l-2 2" />
        <path d="M6 10l4-4" />
    </>
));
export const IconArrowUpRight = icon("out", () => (
    <>
        <path d="M4 12l8-8" />
        <path d="M5 4h7v7" />
    </>
));
export const IconCheck = icon(
    "check",
    () => (
        <path fill-rule="evenodd" d="M2 2h12v12H2z M4 8l3 3 5-5-1-1-4 4-2-2z" />
    ),
    true,
);
export const IconAlert = icon(
    "alert",
    () => (
        <path
            fill-rule="evenodd"
            d="M8 2L14 14H2z M7.25 6h1.5v4h-1.5z M7.25 11h1.5v1.5h-1.5z"
        />
    ),
    true,
);
export const IconBan = icon("ban", () => (
    <>
        <path d={CIRCLE} />
        <path d="M4 12L12 4" />
    </>
));
export const IconSpinner = icon("spinner", () => (
    <path d="M13.5 8C13.5 11.04 11.04 13.5 8 13.5C4.96 13.5 2.5 11.04 2.5 8C2.5 4.96 4.96 2.5 8 2.5" />
));
export const IconSpinnerFilled = icon(
    "spinner",
    () => <path fill-rule="evenodd" d="M2 2h12v12H2z M5 5h6v6H5z" />,
    true,
);
export const IconBookmark = icon("bookmark", () => (
    <>
        <path d={BOOKMARK} />
        <path d="M6 5.5h4" />
    </>
));
export const IconBookmarkFilled = icon(
    "bookmark",
    () => <path d={BOOKMARK} />,
    true,
);
export const IconBookmarkOutline = icon("bookmark", () => (
    <path d={BOOKMARK} />
));
export const IconPuzzle = icon("puzzle", () => (
    <>
        <path d="M2.5 6h3V4C5.5 2 8.5 2 8.5 4v2h5v3h-2v2h2v2.5h-11Z" />
        <path d="M6 10h2v3.5" />
    </>
));
export const IconClock = icon("clock", () => (
    <>
        <path d={CIRCLE} />
        <path d="M8 4.5V8h3.5" />
    </>
));
export const IconTrash = icon("trash", () => (
    <>
        <path d="M3 4.5h10M6 4.5V2.5h4v2" />
        <path d="M4.5 6.5v7h7v-7" />
        <path d="M8 7v4" />
    </>
));
// Four tiles, so the New Tab shortcut reads as "apps" rather than "a window".
export const IconApps = icon("apps", () => (
    <>
        <path d="M2.5 2.5h5v5h-5z" />
        <path d="M8.5 2.5h5v5h-5z" />
        <path d="M2.5 8.5h5v5h-5z" />
        <path d="M8.5 8.5h5v5h-5z" />
    </>
));
// Three faders, so Settings reads as "adjust" rather than a machine part.
export const IconSliders = icon("sliders", () => (
    <>
        <path d="M2.5 3.5h11" />
        <path d="M5 2v3" />
        <path d="M2.5 8h11" />
        <path d="M10.5 6.5v3" />
        <path d="M2.5 12.5h11" />
        <path d="M7 11v3" />
    </>
));
export const IconLayoutNavbar = icon("panel-top", () => (
    <>
        <path d={PANEL} />
        <path d="M2.5 6h11" />
    </>
));
export const IconLayoutBottom = icon("panel-bottom", () => (
    <>
        <path d={PANEL} />
        <path d="M2.5 10h11" />
    </>
));
export const IconLayoutSidebar = icon("panel-left", () => (
    <>
        <path d={PANEL} />
        <path d="M6.5 2.5v11" />
    </>
));
export const IconLayoutSidebarRight = icon("panel-right", () => (
    <>
        <path d={PANEL} />
        <path d="M9.5 2.5v11" />
    </>
));
export const IconUpload = icon("upload", () => (
    <>
        <path d="M8 11V3M4.5 6.5L8 3l3.5 3.5" />
        <path d="M2.5 13h11" />
    </>
));
export const IconLoader = icon("loader", () => (
    <>
        <path d="M8 2v2M8 12v2M2 8h2M12 8h2" />
        <path d="M3.757 3.757L5.172 5.172M12.243 3.757L10.828 5.172M3.757 12.243L5.172 10.828M12.243 12.243L10.828 10.828" />
    </>
));
export const IconLoaderDots = icon(
    "dots",
    () => (
        <>
            <path d="M3 7h2v2H3z" />
            <path d="M7 7h2v2H7z" />
            <path d="M11 7h2v2h-2z" />
        </>
    ),
    true,
);
// Preserve the third-party mark.
export const IconPatreon = icon(
    "patreon",
    () => (
        <path d="M2.2 2.9C2.2 2.4 2.6 2 3.1 2h1.6c.5 0 .9.4.9.9v10.2c0 .5-.4.9-.9.9H3.1c-.5 0-.9-.4-.9-.9zM9.8 2.2c2.5 0 4.5 1.9 4.5 4.4 0 2.6-1.9 4.4-4.4 4.4-2.8 0-5.1-1.9-5.1-4.4 0-2.6 2.4-4.4 5-4.4z" />
    ),
    true,
);
