import type { HistoryLocation } from "~/api/historyStorage";
import type { Option } from "~/components/SettingControls";
import {
    SEARCH_ENGINES,
    type SettingKey,
    type SettingValue,
    type TransportName,
} from "~/lib/settings";

/** The words Settings and setup use for every choice, in one place. */

type Choices<K extends SettingKey> = Option<SettingValue<K>>[];

export const SEARCH_OPTIONS: Choices<"search"> = [
    ...(Object.keys(SEARCH_ENGINES) as (keyof typeof SEARCH_ENGINES)[]).map(
        value => ({ value, label: SEARCH_ENGINES[value].label }),
    ),
    { value: "custom", label: "Custom" },
];

export const TRANSPORT_OPTIONS: Option<TransportName>[] = [
    { value: "epoxy", label: "Epoxy" },
    { value: "libcurl", label: "libcurl" },
    { value: "bare", label: "Bare" },
];

export const TRANSPORT_NOTES: Record<TransportName, string> = {
    epoxy: "Fast and light. Connects over a WebSocket, and pages stay encrypted between you and the site.",
    libcurl:
        "Heavier, but loads some sites Epoxy can't. Also a WebSocket, also encrypted between you and the site.",
    bare: "Plain web requests, for networks that block WebSockets. Civil's server fetches each page for you, so it can see them.",
};

/** How one method or Wisp version does on the four things worth comparing. */
export interface Traits {
    sites: string;
    reliability: string;
    speed: string;
    latency: string;
}

export const TRAIT_NAMES: Record<keyof Traits, string> = {
    sites: "Site support",
    reliability: "Reliability",
    speed: "Speed",
    latency: "Latency",
};

export const TRANSPORT_TRAITS: Record<TransportName, Traits> = {
    epoxy: {
        sites: "Most sites",
        reliability: "Steady wherever WebSockets work",
        speed: "The fastest method",
        latency: "Low",
    },
    libcurl: {
        sites: "Some sites Epoxy can't load",
        reliability: "Steady wherever WebSockets work",
        speed: "Slower, since it's heavier than Epoxy",
        latency: "A little higher than Epoxy",
    },
    bare: {
        sites: "Most sites, though chat and other live features still need WebSockets",
        reliability: "The one method that works where WebSockets are blocked",
        speed: "Quick to start, with almost nothing to download",
        latency:
            "Rises when Civil's server is busy, since it fetches every page",
    },
};

export const WISP_OPTIONS: Choices<"wispVersion"> = [
    { value: "2", label: "Version 2" },
    { value: "1", label: "Version 1" },
];

export const WISP_NOTE =
    "How Epoxy talks to Civil's server. Version 1 is the older protocol, for a network where version 2 misbehaves. libcurl and Bare aren't affected.";

export const WISP_TRAITS: Record<SettingValue<"wispVersion">, Traits> = {
    "2": {
        sites: "More than version 1",
        reliability: "Higher than version 1",
        speed: "Pages start sooner",
        latency: "Lower than version 1",
    },
    "1": {
        sites: "Fewer than version 2",
        reliability:
            "Lower, but it gets through some networks that break version 2",
        speed: "Pages start a little later",
        latency: "Higher than version 2",
    },
};

export const TIMEOUT_OPTIONS: Choices<"navTimeout"> = [
    { value: 10, label: "10 seconds" },
    { value: 15, label: "15 seconds" },
    { value: 30, label: "30 seconds" },
    { value: 60, label: "1 minute" },
    { value: 0, label: "Never" },
];

export const PLACE_NAMES: Record<HistoryLocation, string> = {
    localstorage: "local storage",
    indexeddb: "IndexedDB",
};

export const LOCATION_OPTIONS: Choices<"historyLocation"> = [
    { value: "auto", label: "Automatic" },
    { value: "localstorage", label: "Local storage" },
    { value: "indexeddb", label: "IndexedDB" },
];

export const FORMAT_OPTIONS: Choices<"historyFormat"> = [
    { value: "json", label: "Plain (JSON)" },
    { value: "compressed", label: "Compressed" },
];

export const LIMIT_OPTIONS: Choices<"historyLimitKb"> = [
    { value: 0, label: "Automatic" },
    { value: 512, label: "512 KB" },
    { value: 1024, label: "1 MB" },
    { value: 2048, label: "2 MB" },
    { value: 4096, label: "4 MB" },
    { value: 16384, label: "16 MB" },
    { value: 65536, label: "64 MB" },
    { value: -1, label: "As much as the browser allows" },
];

export const WHEN_FULL_OPTIONS: Choices<"historyWhenFull"> = [
    { value: "trim", label: "Remove the oldest pages" },
    { value: "wipe", label: "Start over in the same place" },
    { value: "wipe-best", label: "Start over in the best place" },
    { value: "spill", label: "Continue in the other place" },
    { value: "compress", label: "Compress, then remove the oldest" },
    { value: "stop", label: "Stop saving new pages" },
];

export const WHEN_FULL_NOTES: Record<
    SettingValue<"historyWhenFull">,
    string
> = {
    trim: "Keeps as much recent history as fits, removing the oldest pages a tenth at a time.",
    wipe: "Deletes all history and keeps saving in the same place.",
    "wipe-best":
        "Deletes all history, checks which place has room and reads and writes fastest, and carries on there.",
    spill: "Keeps everything by saving new pages in the other place. When both are full, the oldest pages go.",
    compress:
        "Switches history to the compressed format to make room, and removes the oldest pages only if that isn't enough.",
    stop: "Leaves your history exactly as it is and stops adding pages until there is room again.",
};

export const DAY_PRESETS = [0, 1, 7, 30, 90, 365] as const;

export const dayLabel = (days: number) =>
    days === 0
        ? "Never"
        : days === 1
          ? "1 day"
          : days === 365
            ? "1 year"
            : `${days.toLocaleString()} days`;

export const MAX_OPTIONS: Choices<"historyMax"> = [
    { value: 0, label: "No limit" },
    { value: 1000, label: "1,000 pages" },
    { value: 5000, label: "5,000 pages" },
    { value: 10000, label: "10,000 pages" },
    { value: 50000, label: "50,000 pages" },
];

export const STARTUP_OPTIONS: Choices<"startup"> = [
    { value: "restore", label: "Restore your tabs" },
    { value: "newtab", label: "Open a new tab" },
    { value: "page", label: "Open a specific page" },
];

export const BAR_OPTIONS: Choices<"bookmarksBar"> = [
    { value: "always", label: "Always show" },
    { value: "newtab", label: "Show on new tabs only" },
    { value: "never", label: "Hide" },
];

export const APPS_OPEN_OPTIONS: Choices<"appsOpenIn"> = [
    { value: "current", label: "This tab" },
    { value: "new", label: "A new tab" },
];

export const MOTION_OPTIONS: Choices<"motion"> = [
    { value: "system", label: "Match this device" },
    { value: "reduce", label: "Reduce motion" },
];

/** Integer days for a custom retention, or a sentence saying what's wrong. */
export function checkDays(value: string): string | null {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 && n <= 36500
        ? null
        : "Enter a whole number of days, from 1 to 36,500.";
}
