import { createSignal } from "solid-js";

import { BROWSER_URLS } from "~/lib/browserUrls";
import type { Tab } from "~/types";

export function gstaticFavicon(url: string, size = 32): string {
    return `/api/favicon?url=${encodeURIComponent(url)}&size=${size}`;
}

export const WS_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/suggestions`;

export function displayUrl(raw: string): string {
    try {
        const u = new URL(raw);
        return u.hostname + u.pathname + u.search;
    } catch {
        return raw;
    }
}

export function isProbablyUrl(v: string): boolean {
    try {
        void new URL(v);
        return true;
    } catch {}
    return /^[\w-]+\.[a-z]{2,}/i.test(v);
}

export function normalizeNav(term: string): string {
    try {
        void new URL(term);
        return term;
    } catch {}
    if (/^[\w-]+\.[a-z]{2,}/i.test(term)) return `https://${term}`;
    return term;
}

interface TabHistoryEntry {
    stack: string[];
    cursor: number;
}

/**
 * Push a visited URL. Deduped against the entry at the current cursor, so
 * it's safe to call from BOTH programmatic navigation and the iframe load
 * handler (every Scramjet frame change), and re-loading the same URL during
 * back/forward doesn't corrupt the stack. Returns whether anything changed.
 */
function pushEntry(h: TabHistoryEntry, url: string): boolean {
    if (h.stack[h.cursor] === url) return false;
    h.stack = h.stack.slice(0, h.cursor + 1);
    h.stack.push(url);
    h.cursor = h.stack.length - 1;
    return true;
}

/** Moves the cursor by `step` when that stays inside the stack, returning
 *  the URL to load there, or null if not possible. */
function moveCursor(h: TabHistoryEntry, step: 1 | -1): string | null {
    const next = h.cursor + step;
    if (next < 0 || next > h.stack.length - 1) return null;
    h.cursor = next;
    return h.stack[next] ?? null;
}

export function createTabHistory() {
    const historyMap = new Map<string, TabHistoryEntry>();
    // Bumped on every stack/cursor change so canBack/canForward stay reactive.
    const [version, setVersion] = createSignal(0);
    const bump = () => setVersion(v => v + 1);

    const getHistory = (id: string): TabHistoryEntry => {
        if (!historyMap.has(id)) historyMap.set(id, { stack: [], cursor: -1 });
        return historyMap.get(id)!;
    };

    const pushHistory = (id: string, url: string) => {
        if (pushEntry(getHistory(id), url)) bump();
    };

    const step = (id: string | null, by: 1 | -1): string | null => {
        if (!id) return null;
        const h = getHistory(id);
        const cursor = h.cursor;
        const url = moveCursor(h, by);
        if (h.cursor !== cursor) bump();
        return url;
    };

    const canBack = (id: string | null): boolean => {
        version();
        return id ? getHistory(id).cursor > 0 : false;
    };

    const canForward = (id: string | null): boolean => {
        version();
        if (!id) return false;
        const h = getHistory(id);
        return h.cursor < h.stack.length - 1;
    };

    return {
        historyMap,
        getHistory,
        pushHistory,
        back: (id: string | null) => step(id, -1),
        forward: (id: string | null) => step(id, 1),
        canBack,
        canForward,
        version,
    };
}

const STORAGE_KEY = "browser-session";

export function saveSession(tabs: readonly Tab[], activeId: string | null) {
    try {
        const serialized = tabs.map(t => {
            const browserKey = Object.entries(BROWSER_URLS).find(
                ([, v]) => v === t.url,
            )?.[0];
            return {
                url: browserKey ?? t.url,
                title: t.title,
                favicon: t.favicon,
            };
        });
        const activeIndex = activeId
            ? tabs.findIndex(t => t.id === activeId)
            : 0;
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ tabs: serialized, activeIndex }),
        );
    } catch {}
}

export function loadSession(): {
    tabs: { url: string; title: string; favicon?: string }[];
    activeIndex: number;
} | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const session = JSON.parse(raw);
        if (Array.isArray(session.tabs) && session.tabs.length > 0)
            return session;
    } catch {}
    return null;
}
