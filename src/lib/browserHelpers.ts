import { createSignal } from "solid-js";

import type { Tab } from "~/lib/TabManager";
import { BROWSER_URLS } from "~/lib/TabManager";

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

export function createTabHistory() {
    const historyMap = new Map<string, TabHistoryEntry>();
    // Bumped on every stack/cursor change so canBack/canForward stay reactive.
    const [version, setVersion] = createSignal(0);
    const bump = () => setVersion(v => v + 1);

    const getHistory = (id: string): TabHistoryEntry => {
        if (!historyMap.has(id)) historyMap.set(id, { stack: [], cursor: -1 });
        return historyMap.get(id)!;
    };

    // Push a visited URL. Deduped against the entry at the current cursor, so
    // it's safe to call from BOTH programmatic navigation and the iframe load
    // handler (every Scramjet frame change), and re-loading the same URL during
    // back/forward doesn't corrupt the stack.
    const pushHistory = (id: string, url: string) => {
        const h = getHistory(id);
        if (h.stack[h.cursor] === url) return;
        h.stack = h.stack.slice(0, h.cursor + 1);
        h.stack.push(url);
        h.cursor = h.stack.length - 1;
        bump();
    };

    // Move the cursor and return the URL to load, or null if not possible.
    const back = (id: string | null): string | null => {
        if (!id) return null;
        const h = getHistory(id);
        if (h.cursor <= 0) return null;
        h.cursor--;
        bump();
        return h.stack[h.cursor] ?? null;
    };

    const forward = (id: string | null): string | null => {
        if (!id) return null;
        const h = getHistory(id);
        if (h.cursor >= h.stack.length - 1) return null;
        h.cursor++;
        bump();
        return h.stack[h.cursor] ?? null;
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
        back,
        forward,
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
