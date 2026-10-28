import { EventEmitter } from "tseep";

import { resolveUrl } from "~/lib/browserUrls";
import type { Tab } from "~/types";

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
