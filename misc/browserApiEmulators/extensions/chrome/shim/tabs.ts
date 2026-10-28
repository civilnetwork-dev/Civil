import type { DNRRule } from "../types";
import { CivilEvent } from "./event";
import {
    dispatchBrowserEvent,
    dual,
    getBiB,
    getCivilBus,
    resolved,
} from "./util";

type TabChangeInfo = chrome.tabs.OnActiveChangedInfo;
type TabActiveInfo = chrome.tabs.OnActivatedInfo;
type TabMoveInfo = chrome.tabs.OnMovedInfo;
type TabHighlightInfo = chrome.tabs.OnHighlightedInfo;
type TabDetachInfo = chrome.tabs.OnDetachedInfo;
type TabAttachInfo = chrome.tabs.OnAttachedInfo;
type TabRemoveInfo = chrome.tabs.OnRemovedInfo;
type ZoomChangeInfo = chrome.tabs.OnZoomChangeInfo;
type ZoomSettings = chrome.tabs.ZoomSettings;
type HighlightInfo = chrome.tabs.HighlightInfo;

function makeSelfTab(): chrome.tabs.Tab {
    const bib = getBiB();
    const syn = bib.currentTab;
    return {
        // Use 1 (positive) not -1 so extensions that check `id < 0` to decide
        // whether to call tabs.create don't enter a create loop.
        id: syn.id ?? 1,
        index: syn.index ?? 0,
        windowId: syn.windowId ?? 1,
        highlighted: true,
        active: syn.active ?? true,
        pinned: syn.pinned ?? false,
        audible: false,
        discarded: false,
        autoDiscardable: true,
        mutedInfo: { muted: false },
        url:
            syn.url ??
            (typeof window !== "undefined" ? window.location.href : ""),
        title:
            syn.title ??
            (typeof document !== "undefined" ? document.title : ""),
        favIconUrl: syn.favIconUrl,
        status: syn.status ?? "complete",
        incognito: syn.incognito ?? bib.incognito,
        width: typeof window !== "undefined" ? window.innerWidth : 1280,
        height: typeof window !== "undefined" ? window.innerHeight : 800,
        groupId: syn.groupId ?? -1,
        selected: true,
    } as chrome.tabs.Tab;
}

type Tab = chrome.tabs.Tab;
type KnownTab = Tab & { civilTabId?: string };
type TabCallback = (tab?: Tab) => void;

type TabsContext = {
    extId: string;
    contextId?: string;
    getDNRRules: () => DNRRule[];
    contextType?: string;
    knownTabs: Map<number, KnownTab>;
};

function tabEvents() {
    return {
        onCreated: new CivilEvent<(tab: Tab) => void>(),
        onRemoved: new CivilEvent<
            (tabId: number, removeInfo: TabRemoveInfo) => void
        >(),
        onUpdated: new CivilEvent<
            (tabId: number, changeInfo: TabChangeInfo, tab: Tab) => void
        >(),
        onActivated: new CivilEvent<(activeInfo: TabActiveInfo) => void>(),
        onMoved: new CivilEvent<
            (tabId: number, moveInfo: TabMoveInfo) => void
        >(),
        onHighlighted: new CivilEvent<
            (highlightInfo: TabHighlightInfo) => void
        >(),
        onDetached: new CivilEvent<
            (tabId: number, detachInfo: TabDetachInfo) => void
        >(),
        onAttached: new CivilEvent<
            (tabId: number, attachInfo: TabAttachInfo) => void
        >(),
        onReplaced: new CivilEvent<
            (addedTabId: number, removedTabId: number) => void
        >(),
        onZoomChange: new CivilEvent<
            (zoomChangeInfo: ZoomChangeInfo) => void
        >(),
    };
}

/** Keeps `knownTabs` current from the browser's tabs.onUpdated relays. */
function trackTabUpdates(
    { extId, knownTabs }: TabsContext,
    onUpdated: ReturnType<typeof tabEvents>["onUpdated"],
): void {
    getCivilBus(extId).addEventListener("message", event => {
        const data = event.data as {
            kind?: string;
            event?: string;
            args?: unknown[];
        };
        if (data?.kind !== "browserEvent") return;
        if (data.event !== "tabs.onUpdated") return;
        const [tabId, changeInfo, tab] = data.args ?? [];
        if (typeof tabId !== "number" || !tab) return;
        knownTabs.set(tabId, tab as KnownTab);
        onUpdated.dispatch(tabId, changeInfo as TabChangeInfo, tab as Tab);
    });
}

function matchesQuery(tab: Tab, queryInfo: chrome.tabs.QueryInfo): boolean {
    return (
        (queryInfo.active === undefined || queryInfo.active === tab.active) &&
        (queryInfo.currentWindow === undefined || queryInfo.currentWindow) &&
        (queryInfo.url === undefined ||
            (tab.url ?? "").includes(queryInfo.url as string))
    );
}

function tabQueries({ contextType, knownTabs }: TabsContext) {
    const isBackground = contextType === "background";
    return {
        query: (
            queryInfo: chrome.tabs.QueryInfo,
            cb?: (tabs: Tab[]) => void,
        ): Promise<Tab[]> =>
            dual(() => {
                // In background context: only query knownTabs (populated via
                // tabs.onUpdated bus events). Never fall back to
                // window.location.href which would be the background iframe
                // URL, not a real page URL.
                const candidates =
                    knownTabs.size > 0
                        ? [...knownTabs.values()]
                        : isBackground
                          ? []
                          : [makeSelfTab()];
                return Promise.resolve(
                    candidates.filter(tab => matchesQuery(tab, queryInfo)),
                );
            }, cb),
        get: (tabId: number, cb?: (tab: Tab) => void): Promise<Tab> =>
            dual(
                () => Promise.resolve(knownTabs.get(tabId) ?? makeSelfTab()),
                cb,
            ),
        // Chrome spec: getCurrent() returns undefined when called from a
        // background context (SW / background page has no associated tab).
        getCurrent: (cb?: TabCallback): Promise<Tab | undefined> =>
            dual(
                () => Promise.resolve(isBackground ? undefined : makeSelfTab()),
                cb,
            ),
    };
}

/** A navigation into a tab the extension's own rules exclude skips them. */
function navigationUrl(
    url: string,
    tabId: number | undefined,
    getDNRRules: () => DNRRule[],
): string {
    const isExcludedFromDNR =
        tabId !== undefined &&
        getDNRRules().some(rule =>
            (rule.condition?.excludedTabIds as number[] | undefined)?.includes(
                tabId,
            ),
        );
    return isExcludedFromDNR && !url.includes("#bypass=true")
        ? `${url}#bypass=true`
        : url;
}

function updateTab(
    { knownTabs, getDNRRules }: TabsContext,
    tabId: number | undefined,
    props: chrome.tabs.UpdateProperties | undefined,
): Tab {
    const tab = tabId === undefined ? undefined : knownTabs.get(tabId);
    if (props?.url) {
        dispatchBrowserEvent(getBiB().navigateEvent, {
            tabId: tab?.civilTabId,
            url: navigationUrl(props.url, tabId, getDNRRules),
        });
    }
    return tab ?? makeSelfTab();
}

function tabNavigation(ctx: TabsContext) {
    return {
        create: (
            props: chrome.tabs.CreateProperties,
            cb?: (tab: Tab) => void,
        ): Promise<Tab> =>
            dual(() => {
                if (props.url) {
                    dispatchBrowserEvent(getBiB().newTabEvent, {
                        url: props.url,
                    });
                }
                return Promise.resolve(makeSelfTab());
            }, cb),
        update: (
            tabIdOrProps: number | chrome.tabs.UpdateProperties,
            propsOrCb?: chrome.tabs.UpdateProperties | TabCallback,
            maybeCb?: TabCallback,
        ): Promise<Tab | undefined> => {
            const byId = typeof tabIdOrProps === "number";
            const props = byId
                ? (propsOrCb as chrome.tabs.UpdateProperties)
                : tabIdOrProps;
            const cb = byId ? maybeCb : (propsOrCb as TabCallback | undefined);
            const tabId = byId ? tabIdOrProps : undefined;
            return dual(
                () => Promise.resolve(updateTab(ctx, tabId, props)),
                cb,
            );
        },
        remove: (tabIds: number | number[], cb?: () => void): Promise<void> => {
            const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
            dispatchBrowserEvent(getBiB().closeTabEvent, { chromeTabIds: ids });
            return resolved(undefined, cb);
        },
    };
}

/**
 * Broadcast via bus so extension pages (dashboard, popup, offscreen) and
 * content scripts all receive tab-targeted messages. In real Chrome,
 * tabs.sendMessage targets a specific tab's content scripts; in BIB we
 * broadcast to all contexts on the bus since tab identities are synthetic.
 */
function messageTabs(
    extId: string,
    contextId: string | undefined,
    message: unknown,
): Promise<unknown> {
    const bus = getCivilBus(extId);
    const reqId = `tab-${Math.random().toString(36).slice(2)}`;
    const sender = {
        id: extId,
        url: typeof window !== "undefined" ? window.location.href : "",
    };
    return new Promise<unknown>(resolve => {
        const handler = (e: MessageEvent) => {
            const d = e.data as {
                kind?: string;
                reqId?: string;
                response?: unknown;
            };
            if (d?.kind === "sendResponse" && d.reqId === reqId) {
                bus.removeEventListener("message", handler);
                resolve(d.response);
            }
        };
        bus.addEventListener("message", handler);
        bus.postMessage({
            kind: "sendMessageToTab",
            reqId,
            // Use the same contextId as the runtime so the background's
            // `if (data.from === _contextId) return;` guard correctly
            // drops echoes of our own sendMessage broadcasts.
            from:
                contextId ??
                `tabs-sendmsg-${Math.random().toString(36).slice(2)}`,
            contextType: "content",
            message,
            sender,
        });
        setTimeout(() => {
            bus.removeEventListener("message", handler);
            resolve(undefined);
        }, 5000);
    });
}

const done = (cb?: () => void): Promise<void> => resolved(undefined, cb);

/** Page operations this shim cannot perform on a synthetic tab. */
function tabPageNoops() {
    return {
        executeScript: (
            _a: unknown,
            _b?: unknown,
            cb?: (r: unknown[]) => void,
        ) => resolved([] as unknown[], cb),
        insertCSS: (_a: unknown, _b?: unknown, cb?: () => void) => done(cb),
        captureVisibleTab: (
            _a?: unknown,
            _b?: unknown,
            cb?: (url: string) => void,
        ): Promise<string> => resolved("", cb),
        detectLanguage: (
            _tabId: number,
            cb?: (lang: string) => void,
        ): Promise<string> =>
            resolved(
                typeof navigator !== "undefined"
                    ? navigator.language || "en"
                    : "en",
                cb,
            ),
        discard: (_tabId?: number, cb?: TabCallback) =>
            resolved(undefined as Tab | undefined, cb),
        duplicate: (_tabId: number, cb?: TabCallback) =>
            resolved(makeSelfTab() as Tab | undefined, cb),
        highlight: (
            _info: HighlightInfo,
            cb?: (w: chrome.windows.Window) => void,
        ): Promise<chrome.windows.Window> =>
            resolved(
                {
                    id: 1,
                    focused: true,
                    alwaysOnTop: false,
                    incognito: false,
                    state: "normal",
                    type: "normal",
                } as chrome.windows.Window,
                cb,
            ),
        move: (
            _tabIds: number | number[],
            _moveProperties: chrome.tabs.MoveProperties,
            cb?: (t: Tab | Tab[]) => void,
        ): Promise<Tab | Tab[]> => resolved(makeSelfTab() as Tab | Tab[], cb),
        reload: (_a?: unknown, _b?: unknown, cb?: () => void) => done(cb),
        goBack: (_tabId?: number, cb?: () => void) => done(cb),
        goForward: (_tabId?: number, cb?: () => void) => done(cb),
    };
}

/** Zoom, the MV2 window queries, and tab groups. */
function tabZoomAndLegacy() {
    return {
        setZoom: (_a: number, _b?: number | (() => void), cb?: () => void) =>
            done(cb),
        getZoom: (_tabId?: number, cb?: (z: number) => void): Promise<number> =>
            resolved(1, cb),
        setZoomSettings: (_tabId: number, _z: ZoomSettings, cb?: () => void) =>
            done(cb),
        getZoomSettings: (
            _tabId?: number,
            cb?: (z: ZoomSettings) => void,
        ): Promise<ZoomSettings> =>
            resolved(
                {
                    mode: "automatic",
                    scope: "per-origin",
                    defaultZoomFactor: 1,
                } as ZoomSettings,
                cb,
            ),
        getAllInWindow: (_windowId?: number, cb?: (tabs: Tab[]) => void) =>
            resolved([makeSelfTab()], cb),
        getSelected: (_windowId?: number, cb?: (tab: Tab) => void) =>
            resolved(makeSelfTab(), cb),
        // chrome.tabs.group / ungroup (MV3 tab groups)
        group: (
            _options: { tabIds: number | number[]; groupId?: number },
            cb?: (groupId: number) => void,
        ): Promise<number> => resolved(-1, cb),
        ungroup: (_tabIds: number | number[], cb?: () => void) => done(cb),
    };
}

export function buildTabsAPI(
    extId: string,
    contextId?: string,
    getDNRRules: () => DNRRule[] = () => [],
    contextType?: string,
) {
    const ctx: TabsContext = {
        extId,
        contextId,
        getDNRRules,
        contextType,
        knownTabs: new Map(),
    };
    const events = tabEvents();
    trackTabUpdates(ctx, events.onUpdated);

    return {
        ...tabQueries(ctx),
        ...tabNavigation(ctx),
        sendMessage: (
            _tabId: number,
            message: unknown,
            optionsOrCb?:
                | chrome.tabs.MessageSendOptions
                | ((response: unknown) => void),
            maybeCb?: (response: unknown) => void,
        ): Promise<unknown> => {
            const cb =
                typeof optionsOrCb === "function" ? optionsOrCb : maybeCb;
            return dual(() => messageTabs(extId, contextId, message), cb);
        },
        ...tabPageNoops(),
        ...tabZoomAndLegacy(),
        ...events,
        TAB_ID_NONE: -1,
    };
}
