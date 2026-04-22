import type { Tab } from "~/lib/TabManager";
import { BROWSER_URLS } from "~/lib/TabManager";

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
        new URL(v);
        return true;
    } catch {}
    return /^[\w-]+\.[a-z]{2,}/i.test(v);
}

export function normalizeNav(term: string): string {
    try {
        new URL(term);
        return term;
    } catch {}
    if (/^[\w-]+\.[a-z]{2,}/i.test(term)) return `https://${term}`;
    return term;
}

export interface TabHistoryEntry {
    stack: string[];
    cursor: number;
}

export function createTabHistory() {
    const historyMap = new Map<string, TabHistoryEntry>();

    const getHistory = (id: string): TabHistoryEntry => {
        if (!historyMap.has(id)) historyMap.set(id, { stack: [], cursor: -1 });
        return historyMap.get(id)!;
    };

    const pushHistory = (id: string, url: string) => {
        const h = getHistory(id);
        h.stack = h.stack.slice(0, h.cursor + 1);
        h.stack.push(url);
        h.cursor = h.stack.length - 1;
    };

    const canBack = (id: string | null): boolean =>
        id ? getHistory(id).cursor > 0 : false;

    const canForward = (id: string | null): boolean => {
        if (!id) return false;
        const h = getHistory(id);
        return h.cursor < h.stack.length - 1;
    };

    return { historyMap, getHistory, pushHistory, canBack, canForward };
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
