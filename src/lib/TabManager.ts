import { EventEmitter } from "tseep";

export interface Tab {
    id: string;
    url: string;
    title: string;
    favicon?: string;
    isLoading: boolean;
}

export const BROWSER_URLS: Record<string, string> = {
    "browser:newtab": `${window.location.origin}/newtab`,
    "browser:settings": `${window.location.origin}/settings`,
    "browser:history": `${window.location.origin}/history`,
    "browser:apps": `${window.location.origin}/apps`,
    "browser:extensions": `${window.location.origin}/extensions`,
    "browser:bookmarks": `${window.location.origin}/bookmarks`,
    "browser:blank": "about:blank",
};

export function resolveUrl(url: string) {
    if (BROWSER_URLS[url]) return BROWSER_URLS[url];

    const browserMatch = url.match(/^browser:(.+)$/);
    if (browserMatch) {
        const key = `browser:${browserMatch[1]}`;
        return (
            BROWSER_URLS[key] ?? `${window.location.origin}/${browserMatch[1]}`
        );
    }
    return url;
}

export function isNewtabUrl(url: string) {
    const newtab = BROWSER_URLS["browser:newtab"];
    return (
        url === newtab ||
        url === `${window.location.origin}/newtab` ||
        url === "browser:newtab" ||
        url === "browser://newtab"
    );
}

export function isInternalUrl(url: string): boolean {
    if (url === "about:blank" || url.startsWith("browser:")) return true;
    try {
        const origin =
            typeof window !== "undefined" ? window.location.origin : "";
        if (origin && url.startsWith(`${origin}/civil-ext/`)) return true;
        // Pre-shimmed extension pages cached by buildExtensionPageSrcDoc.
        if (origin && url.startsWith(`${origin}/action-popup/`)) return true;
        // Options-page variant: served at /options-tab/ so TM's pathname check
        // `indexOf("/options") === 0` passes, enabling full dashboard UI.
        if (origin && url.startsWith(`${origin}/options-tab/`)) return true;
        // Ask-page variant: served at /ask-tab/ so TM's pathname check
        // `indexOf("/ask") === 0` passes for the install confirmation dialog.
        if (origin && url.startsWith(`${origin}/ask-tab/`)) return true;
    } catch {}
    return Object.values(BROWSER_URLS).some(v => url === v);
}

type TabManagerEvents = {
    tabAdded: (tab: Tab) => void;
    tabRemoved: (id: string) => void;
    tabActivated: (id: string) => void;
    tabUpdated: (tab: Tab) => void;
    tabMoved: (id: string, toIndex: number) => void;
};

class TabManager extends EventEmitter<TabManagerEvents> {
    private _tabs: Tab[] = [];
    private _activeId: string | null = null;

    get tabs() {
        return this._tabs;
    }

    get activeId() {
        return this._activeId;
    }

    get activeTab() {
        return this._tabs.find(t => t.id === this._activeId);
    }

    createTab(url: string = "browser:newtab") {
        const resolved = resolveUrl(url);
        const tab: Tab = {
            id: crypto.randomUUID(),
            url: resolved,
            title: url.startsWith("browser:")
                ? url
                      .replace("browser:", "")
                      .replace(/^\w/, c => c.toUpperCase())
                : "New Tab",
            isLoading: true,
        };
        this._tabs = [...this._tabs, tab];
        this.emit("tabAdded", tab);
        return tab;
    }

    removeTab(id: string) {
        const idx = this._tabs.findIndex(t => t.id === id);
        if (idx === -1) return;
        this._tabs = this._tabs.filter(t => t.id !== id);
        this.emit("tabRemoved", id);

        if (this._activeId === id) {
            const next = this._tabs[Math.min(idx, this._tabs.length - 1)];
            if (next) this.activateTab(next.id);
            else this._activeId = null;
        }
    }

    activateTab(id: string) {
        this._activeId = id;
        this.emit("tabActivated", id);
    }

    updateTab(id: string, patch: Partial<Omit<Tab, "id">>) {
        this._tabs = this._tabs.map(t =>
            t.id === id ? { ...t, ...patch } : t,
        );
        const updated = this._tabs.find(t => t.id === id);
        if (updated) this.emit("tabUpdated", updated);
    }

    moveTab(id: string, toIndex: number) {
        const from = this._tabs.findIndex(t => t.id === id);
        if (from === -1) return;
        const arr = [...this._tabs];
        const [tab] = arr.splice(from, 1);
        arr.splice(toIndex, 0, tab);
        this._tabs = arr;
        this.emit("tabMoved", id, toIndex);
    }
}

export const tabManager = new TabManager();
