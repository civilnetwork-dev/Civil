import type { Accessor } from "solid-js";

import { createReactiveKey, lsRemove, lsSetRaw } from "~/lib/reactiveStorage";

/**
 * Every choice Civil makes on the user's behalf, as one typed registry.
 *
 * Each setting is its own localStorage key. The legacy keys keep their names
 * and raw encoding (`transport`, `search`), because the separately bundled
 * scramjet bootstrap (misc/config/scramjet/scramjetInit.ts) reads them
 * directly. Everything is validated on the way out: localStorage is shared
 * with every script on the origin, proxied pages included, so a value that is
 * not one this build knows falls back to the default instead of reaching the
 * code that acts on it.
 *
 * Defaults are the behaviour Civil had before Settings existed, so an update
 * changes nothing until the user does. The one deliberate exception is the
 * Wisp version (see `wispVersion`).
 */

interface Def<T> {
    readonly key: string;
    readonly fallback: T;
    readonly options?: readonly T[];
    parse(raw: string): T | undefined;
    format(value: T): string;
}

function choice<const T extends string>(
    key: string,
    options: readonly T[],
    fallback: T,
): Def<T> {
    return {
        key,
        fallback,
        options,
        parse: raw => (options.includes(raw as T) ? (raw as T) : undefined),
        format: value => value,
    };
}

function flag(key: string, fallback: boolean): Def<boolean> {
    return {
        key,
        fallback,
        parse: raw =>
            raw === "true" ? true : raw === "false" ? false : undefined,
        format: String,
    };
}

/** An integer; limited to `options` when given, otherwise any n >= 0. */
function num(
    key: string,
    fallback: number,
    options?: readonly number[],
): Def<number> {
    return {
        key,
        fallback,
        options,
        parse: raw => {
            const n = raw.trim() === "" ? NaN : Number(raw);
            if (!Number.isInteger(n)) return undefined;
            if (options) return options.includes(n) ? n : undefined;
            return n >= 0 ? n : undefined;
        },
        format: String,
    };
}

/** Free text; `valid` guards values an imported file could smuggle in. */
function text(
    key: string,
    valid: (value: string) => boolean = () => true,
): Def<string> {
    return {
        key,
        fallback: "",
        parse: raw => (valid(raw) ? raw : undefined),
        format: value => value,
    };
}

function json<T>(
    key: string,
    fallback: T,
    check: (value: unknown) => T | undefined,
): Def<T> {
    return {
        key,
        fallback,
        parse: raw => {
            try {
                return check(JSON.parse(raw));
            } catch {
                return undefined;
            }
        },
        format: value => JSON.stringify(value),
    };
}

export const TRANSPORTS = ["epoxy", "libcurl", "bare"] as const;
export type TransportName = (typeof TRANSPORTS)[number];

export const isTransport = (value: unknown): value is TransportName =>
    TRANSPORTS.includes(value as TransportName);

/** Per-site transport pins, keyed by bare hostname (no `www.`). */
type SiteRules = Readonly<Record<string, TransportName>>;

const siteRules = (value: unknown): SiteRules | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    return Object.fromEntries(
        Object.entries(value).filter(
            ([host, t]) => normalizeHost(host) === host && isTransport(t),
        ),
    ) as SiteRules;
};

const hostList = (value: unknown): readonly string[] | undefined =>
    Array.isArray(value)
        ? value.filter(
              (host): host is string =>
                  typeof host === "string" && normalizeHost(host) === host,
          )
        : undefined;

/** Whether `url` belongs to the site `rule` names: the host or a subdomain. */
export function onSite(url: string, rule: string): boolean {
    const host = normalizeHost(url);
    return host !== null && (host === rule || host.endsWith(`.${rule}`));
}

export const SETTINGS = {
    search: choice(
        "search",
        ["google", "ddg", "bing", "brave", "searx", "custom"],
        "google",
    ),
    searchTemplate: text(
        "civil:search-template",
        value => !value || isSearchTemplate(value),
    ),
    suggestLive: flag("civil:suggest-live", true),
    suggestHistory: flag("civil:suggest-history", true),

    transportAuto: flag("civil:transport-auto", true),
    transport: choice("transport", TRANSPORTS, "epoxy"),
    transportSites: json<SiteRules>(
        "civil:transport-sites",
        Object.freeze({}),
        siteRules,
    ),
    transportFailover: flag("civil:transport-failover", true),
    transportRemember: flag("civil:transport-remember", true),
    /** Seconds before a proxied load counts as failed; 0 never gives up. */
    navTimeout: num("civil:nav-timeout", 15, [10, 15, 30, 60, 0]),
    /**
     * Epoxy's Wisp protocol. Version 2 is the owner's chosen default: it
     * handles more sites, more reliably, with less latency. "auto" takes the
     * best-proxy probe's per-site pick. misc/config/scramjet/scramjetInit.ts
     * reads this key raw for the first transport, so keep its default in
     * step with this one.
     */
    wispVersion: choice("civil:wisp-version", ["2", "1", "auto"], "2"),

    historyEnabled: flag("civil:history-enabled", true),
    historyLocation: choice(
        "civil:history-location",
        ["auto", "localstorage", "indexeddb"],
        "auto",
    ),
    historyFormat: choice(
        "civil:history-format",
        ["json", "compressed"],
        "json",
    ),
    /** KB; 0 is automatic, -1 is whatever the browser allows. */
    historyLimitKb: num(
        "civil:history-limit-kb",
        0,
        [0, 512, 1024, 2048, 4096, 16384, 65536, -1],
    ),
    historyWhenFull: choice(
        "civil:history-when-full",
        ["trim", "wipe", "wipe-best", "spill", "compress", "stop"],
        "trim",
    ),
    /** Delete pages older than this many days; 0 keeps them forever. */
    historyDays: num("civil:history-days", 0),
    /** Keep at most this many pages; 0 is unlimited. */
    historyMax: num("civil:history-max", 0, [0, 1000, 5000, 10000, 50000]),
    /** Sites never saved to history, each covering its subdomains. */
    historyExclude: json<readonly string[]>(
        "civil:history-exclude",
        Object.freeze([]),
        hostList,
    ),

    startup: choice("civil:startup", ["restore", "newtab", "page"], "restore"),
    startupUrl: text(
        "civil:startup-url",
        value => !value || isStartPage(value),
    ),
    bookmarksBar: choice(
        "civil:bookmarks-bar",
        ["always", "newtab", "never"],
        "always",
    ),
    motion: choice("civil:motion", ["system", "reduce"], "system"),

    compatReports: flag("civil:compat-reports", true),
    filterDetect: flag("civil:filter-detect", true),
    /** PostHog product analytics, and the district lookup that feeds it. */
    analytics: flag("civil:analytics", true),
    /** The ad scripts on the browser page. Offered in Settings only. */
    ads: flag("civil:ads", true),
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> =
    (typeof SETTINGS)[K] extends Def<infer T> ? T : never;

const def = <K extends SettingKey>(key: K) =>
    SETTINGS[key] as unknown as Def<SettingValue<K>>;

export function getSetting<K extends SettingKey>(key: K): SettingValue<K> {
    const d = def(key);
    let raw: string | null = null;
    try {
        raw = localStorage.getItem(d.key);
    } catch {}
    return (raw === null ? undefined : d.parse(raw)) ?? d.fallback;
}

/**
 * Store a value. Returns false when the browser refused the write (storage
 * full or blocked), so a caller can say the change did not stick.
 */
export function setSetting<K extends SettingKey>(
    key: K,
    value: SettingValue<K>,
): boolean {
    const d = def(key);
    const raw = d.format(value);
    // An imported file can hand any type to a setting whose format passes
    // values straight through.
    if (typeof raw !== "string" || d.parse(raw) === undefined) return false;
    try {
        lsSetRaw(d.key, raw);
        return true;
    } catch {
        return false;
    }
}

const live = new Map<SettingKey, Accessor<unknown>>();

/**
 * A live accessor, updated by writes from this document and from every other
 * one on the origin (the settings page runs inside a tab's frame, and the
 * native `storage` event carries its writes to the browser around it).
 */
export function useSetting<K extends SettingKey>(
    key: K,
): Accessor<SettingValue<K>> {
    let accessor = live.get(key);
    if (!accessor) {
        accessor = createReactiveKey(SETTINGS[key].key, () => getSetting(key));
        live.set(key, accessor);
    }
    return accessor as Accessor<SettingValue<K>>;
}

/** Back to defaults. Settings only: history, bookmarks and tabs are data. */
export function resetSettings(): void {
    for (const d of Object.values(SETTINGS)) {
        try {
            lsRemove(d.key);
        } catch {}
    }
}

const SETUP_KEY = "civil:setup-complete";

/**
 * True for a first-time visitor. Anyone with a saved tab session has used
 * Civil before, so they are marked done rather than sent through setup.
 * Blocked storage answers false: setup could never be completed, and the
 * redirect would trap the visitor in it.
 */
export function needsSetup(): boolean {
    try {
        if (localStorage.getItem(SETUP_KEY) !== null) return false;
        if (localStorage.getItem("browser-session") !== null) {
            markSetupComplete("existing");
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

export function markSetupComplete(stamp = new Date().toISOString()): void {
    try {
        lsSetRaw(SETUP_KEY, stamp);
    } catch {}
}

/** A hostname as the site rules and the best-proxy cache key it. */
export function normalizeHost(input: string): string | null {
    let raw = input.trim();
    if (!raw) return null;
    if (!/^[a-z][\w+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
    try {
        const host = new URL(raw).hostname.toLowerCase();
        if (!host.includes(".")) return null;
        return host.startsWith("www.") ? host.slice(4) : host;
    } catch {
        return null;
    }
}

export const SEARCH_ENGINES = {
    google: { label: "Google", template: "https://www.google.com/search?q=%s" },
    ddg: { label: "DuckDuckGo", template: "https://duckduckgo.com/?q=%s" },
    bing: { label: "Bing", template: "https://www.bing.com/search?q=%s" },
    brave: {
        label: "Brave Search",
        template: "https://search.brave.com/search?q=%s",
    },
    searx: { label: "SearX", template: "https://searx.org/search?q=%s" },
} as const;

/**
 * A page Civil may open at startup: a `browser:` page, a web address, or a
 * bare domain. Nothing that runs script or leaves the web.
 */
export function isStartPage(value: string): boolean {
    return (
        /^browser:[\w-]+$/.test(value) ||
        /^https?:\/\/\S+$/i.test(value) ||
        /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(value)
    );
}

/** A custom engine must be a web address with `%s` where the query goes. */
export function isSearchTemplate(template: string): boolean {
    if (!template.includes("%s")) return false;
    try {
        return /^https?:$/.test(new URL(template.replace("%s", "q")).protocol);
    } catch {
        return false;
    }
}

/** The address a search for `term` goes to under the current settings. */
export function searchUrl(term: string): string {
    const engine = getSetting("search");
    const custom = getSetting("searchTemplate");
    const template =
        engine === "custom"
            ? isSearchTemplate(custom)
                ? custom
                : SEARCH_ENGINES.google.template
            : SEARCH_ENGINES[engine].template;
    return template.replace("%s", encodeURIComponent(term));
}
