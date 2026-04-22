import type { Tab } from "~/lib/TabManager";
import { tabManager } from "~/lib/TabManager";
import type {
    CivilTabCreateProperties,
    CivilTabInfo,
    CivilTabQueryInfo,
    CivilTabUpdateProperties,
} from "~/types";

function toInfo(
    tab: Tab,
    index: number,
    activeId: string | null,
): CivilTabInfo {
    return {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        favicon: tab.favicon,
        active: tab.id === activeId,
        index,
    };
}

/**
 * Get a tab by its ID.
 */
export function tabsGet(id: string): CivilTabInfo | null {
    const tabs = tabManager.tabs;
    const idx = tabs.findIndex(t => t.id === id);
    if (idx === -1) return null;
    return toInfo(tabs[idx], idx, tabManager.activeId);
}

/**
 * Query tabs matching given criteria.
 */
export function tabsQuery(query: CivilTabQueryInfo): CivilTabInfo[] {
    return tabManager.tabs
        .map((t, i) => toInfo(t, i, tabManager.activeId))
        .filter(t => {
            if (query.active !== undefined && t.active !== query.active)
                return false;
            if (query.url && !t.url.includes(query.url)) return false;
            if (
                query.title &&
                !t.title.toLowerCase().includes(query.title.toLowerCase())
            )
                return false;
            return true;
        });
}

/**
 * Create a new tab.
 */
export function tabsCreate(props: CivilTabCreateProperties = {}): CivilTabInfo {
    const t = tabManager.createTab(props.url ?? "browser:newtab");
    if (props.active !== false) tabManager.activateTab(t.id);
    return toInfo(t, tabManager.tabs.length - 1, tabManager.activeId);
}

/**
 * Update an existing tab.
 */
export function tabsUpdate(
    id: string,
    props: CivilTabUpdateProperties,
): CivilTabInfo | null {
    const tab = tabManager.tabs.find(t => t.id === id);
    if (!tab) return null;
    if (props.url) {
        tabManager.updateTab(id, { url: props.url });
        document.dispatchEvent(
            new CustomEvent("browser:navigate", {
                detail: { tabId: id, url: props.url },
            }),
        );
    }
    if (props.active) tabManager.activateTab(id);
    return tabsGet(id);
}

/**
 * Remove (close) a tab by ID.
 */
export function tabsRemove(id: string): void {
    tabManager.removeTab(id);
}

/**
 * Move a tab to a new index.
 */
export function tabsMove(id: string, index: number): CivilTabInfo | null {
    tabManager.moveTab(id, index);
    return tabsGet(id);
}

/**
 * Activate (focus) a tab by ID.
 */
export function tabsActivate(id: string): void {
    tabManager.activateTab(id);
}

/**
 * Get the currently active tab info.
 */
export function tabsGetActive(): CivilTabInfo | null {
    const id = tabManager.activeId;
    if (!id) return null;
    return tabsGet(id);
}

/**
 * Get all tabs.
 */
export function tabsGetAll(): CivilTabInfo[] {
    return tabManager.tabs.map((t, i) => toInfo(t, i, tabManager.activeId));
}

/**
 * Subscribe to tab events.
 */
export function tabsOnCreated(cb: (tab: CivilTabInfo) => void): () => void {
    const handler = (tab: Tab) =>
        cb(toInfo(tab, tabManager.tabs.length - 1, tabManager.activeId));
    tabManager.on("tabAdded", handler);
    return () => tabManager.off("tabAdded", handler);
}

/**
 * Subscribe to tab removal events.
 */
export function tabsOnRemoved(cb: (id: string) => void): () => void {
    tabManager.on("tabRemoved", cb);
    return () => tabManager.off("tabRemoved", cb);
}

/**
 * Subscribe to tab update events.
 */
export function tabsOnUpdated(cb: (tab: CivilTabInfo) => void): () => void {
    const handler = (tab: Tab) => {
        const idx = tabManager.tabs.findIndex(t => t.id === tab.id);
        cb(toInfo(tab, idx, tabManager.activeId));
    };
    tabManager.on("tabUpdated", handler);
    return () => tabManager.off("tabUpdated", handler);
}

/**
 * Subscribe to tab activation events.
 */
export function tabsOnActivated(cb: (id: string) => void): () => void {
    tabManager.on("tabActivated", cb);
    return () => tabManager.off("tabActivated", cb);
}
