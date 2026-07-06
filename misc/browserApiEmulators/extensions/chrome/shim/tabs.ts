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

export function buildTabsAPI(
    extId: string,
    contextId?: string,
    getDNRRules: () => DNRRule[] = () => [],
    contextType?: string,
) {
    const knownTabs = new Map<
        number,
        chrome.tabs.Tab & { civilTabId?: string }
    >();
    const onCreated = new CivilEvent<(tab: chrome.tabs.Tab) => void>();
    const onRemoved = new CivilEvent<
        (tabId: number, removeInfo: TabRemoveInfo) => void
    >();
    const onUpdated = new CivilEvent<
        (tabId: number, changeInfo: TabChangeInfo, tab: chrome.tabs.Tab) => void
    >();
    const onActivated = new CivilEvent<(activeInfo: TabActiveInfo) => void>();
    const onMoved = new CivilEvent<
        (tabId: number, moveInfo: TabMoveInfo) => void
    >();
    const onHighlighted = new CivilEvent<
        (highlightInfo: TabHighlightInfo) => void
    >();
    const onDetached = new CivilEvent<
        (tabId: number, detachInfo: TabDetachInfo) => void
    >();
    const onAttached = new CivilEvent<
        (tabId: number, attachInfo: TabAttachInfo) => void
    >();
    const onReplaced = new CivilEvent<
        (addedTabId: number, removedTabId: number) => void
    >();
    const onZoomChange = new CivilEvent<
        (zoomChangeInfo: ZoomChangeInfo) => void
    >();

    getCivilBus(extId).addEventListener("message", event => {
        const data = event.data as {
            kind?: string;
            event?: string;
            args?: unknown[];
        };
        if (data?.kind !== "browserEvent") return;

        if (data.event === "tabs.onUpdated") {
            const [tabId, changeInfo, tab] = data.args ?? [];
            if (typeof tabId !== "number" || !tab) return;
            knownTabs.set(
                tabId,
                tab as chrome.tabs.Tab & { civilTabId?: string },
            );
            onUpdated.dispatch(
                tabId,
                changeInfo as TabChangeInfo,
                tab as chrome.tabs.Tab,
            );
        }
    });

    function query(
        queryInfo: chrome.tabs.QueryInfo,
        cb?: (tabs: chrome.tabs.Tab[]) => void,
    ): Promise<chrome.tabs.Tab[]> {
        return dual(() => {
            // In background context: only query knownTabs (populated via
            // tabs.onUpdated bus events). Never fall back to window.location.href
            // which would be the background iframe URL, not a real page URL.
            const isBackground = contextType === "background";
            const candidates =
                knownTabs.size > 0
                    ? [...knownTabs.values()]
                    : isBackground
                      ? []
                      : [makeSelfTab()];
            return Promise.resolve(
                candidates.filter(
                    tab =>
                        (queryInfo.active === undefined ||
                            queryInfo.active === tab.active) &&
                        (queryInfo.currentWindow === undefined ||
                            queryInfo.currentWindow) &&
                        (queryInfo.url === undefined ||
                            (tab.url ?? "").includes(queryInfo.url as string)),
                ),
            );
        }, cb);
    }

    function get(
        tabId: number,
        cb?: (tab: chrome.tabs.Tab) => void,
    ): Promise<chrome.tabs.Tab> {
        return dual(
            () => Promise.resolve(knownTabs.get(tabId) ?? makeSelfTab()),
            cb,
        );
    }

    function getCurrent(
        cb?: (tab?: chrome.tabs.Tab) => void,
    ): Promise<chrome.tabs.Tab | undefined> {
        // Chrome spec: getCurrent() returns undefined when called from a
        // background context (SW / background page has no associated tab).
        if (contextType === "background") {
            return dual(() => Promise.resolve(undefined), cb);
        }
        return dual(() => Promise.resolve(makeSelfTab()), cb);
    }

    function create(
        props: chrome.tabs.CreateProperties,
        cb?: (tab: chrome.tabs.Tab) => void,
    ): Promise<chrome.tabs.Tab> {
        return dual(() => {
            const bib = getBiB();
            if (props.url) {
                dispatchBrowserEvent(bib.newTabEvent, { url: props.url });
            }
            return Promise.resolve(makeSelfTab());
        }, cb);
    }

    function update(
        tabIdOrProps: number | chrome.tabs.UpdateProperties,
        propsOrCb?:
            | chrome.tabs.UpdateProperties
            | ((tab?: chrome.tabs.Tab) => void),
        maybeCb?: (tab?: chrome.tabs.Tab) => void,
    ): Promise<chrome.tabs.Tab | undefined> {
        const props =
            typeof tabIdOrProps === "number"
                ? (propsOrCb as chrome.tabs.UpdateProperties)
                : tabIdOrProps;
        const cb =
            typeof tabIdOrProps === "number"
                ? maybeCb
                : (propsOrCb as ((tab?: chrome.tabs.Tab) => void) | undefined);
        return dual(() => {
            const bib = getBiB();
            const tabId =
                typeof tabIdOrProps === "number" ? tabIdOrProps : undefined;
            const tab = tabId === undefined ? undefined : knownTabs.get(tabId);
            if (props?.url) {
                const isExcludedFromDNR =
                    tabId !== undefined &&
                    getDNRRules().some(rule =>
                        (
                            rule.condition?.excludedTabIds as
                                | number[]
                                | undefined
                        )?.includes(tabId),
                    );
                const url =
                    isExcludedFromDNR && !props.url.includes("#bypass=true")
                        ? `${props.url}#bypass=true`
                        : props.url;
                dispatchBrowserEvent(bib.navigateEvent, {
                    tabId: tab?.civilTabId,
                    url,
                });
            }
            return Promise.resolve(tab ?? makeSelfTab());
        }, cb);
    }

    function remove(tabIds: number | number[], cb?: () => void): Promise<void> {
        const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
        const bib = getBiB();
        dispatchBrowserEvent(bib.closeTabEvent, { chromeTabIds: ids });
        return resolved(undefined, cb);
    }

    function sendMessage(
        _tabId: number,
        message: unknown,
        optionsOrCb?:
            | chrome.tabs.MessageSendOptions
            | ((response: unknown) => void),
        maybeCb?: (response: unknown) => void,
    ): Promise<unknown> {
        const cb = typeof optionsOrCb === "function" ? optionsOrCb : maybeCb;
        // Broadcast via bus so extension pages (dashboard, popup, offscreen) and
        // content scripts all receive tab-targeted messages. In real Chrome,
        // tabs.sendMessage targets a specific tab's content scripts; in BIB we
        // broadcast to all contexts on the bus since tab identities are synthetic.
        return dual(() => {
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
        }, cb);
    }

    function executeScript(
        _a: unknown,
        _b?: unknown,
        cb?: (r: unknown[]) => void,
    ): Promise<unknown[]> {
        return resolved([], cb);
    }
    function insertCSS(
        _a: unknown,
        _b?: unknown,
        cb?: () => void,
    ): Promise<void> {
        return resolved(undefined, cb);
    }

    function captureVisibleTab(
        _a?: unknown,
        _b?: unknown,
        cb?: (url: string) => void,
    ): Promise<string> {
        return resolved("", cb);
    }
    function detectLanguage(
        _tabId: number,
        cb?: (lang: string) => void,
    ): Promise<string> {
        return resolved(
            typeof navigator !== "undefined"
                ? navigator.language || "en"
                : "en",
            cb,
        );
    }

    function discard(
        _tabId?: number,
        cb?: (tab?: chrome.tabs.Tab) => void,
    ): Promise<chrome.tabs.Tab | undefined> {
        return resolved(undefined, cb);
    }
    function duplicate(
        _tabId: number,
        cb?: (tab?: chrome.tabs.Tab) => void,
    ): Promise<chrome.tabs.Tab | undefined> {
        return resolved(makeSelfTab(), cb);
    }

    function highlight(
        _info: HighlightInfo,
        cb?: (w: chrome.windows.Window) => void,
    ): Promise<chrome.windows.Window> {
        return resolved(
            {
                id: 1,
                focused: true,
                alwaysOnTop: false,
                incognito: false,
                state: "normal",
                type: "normal",
            } as chrome.windows.Window,
            cb,
        );
    }

    function move(
        _tabIds: number | number[],
        _moveProperties: chrome.tabs.MoveProperties,
        cb?: (t: chrome.tabs.Tab | chrome.tabs.Tab[]) => void,
    ): Promise<chrome.tabs.Tab | chrome.tabs.Tab[]> {
        return resolved(makeSelfTab(), cb);
    }

    function reload(
        _a?: unknown,
        _b?: unknown,
        cb?: () => void,
    ): Promise<void> {
        return resolved(undefined, cb);
    }
    function goBack(_tabId?: number, cb?: () => void): Promise<void> {
        return resolved(undefined, cb);
    }
    function goForward(_tabId?: number, cb?: () => void): Promise<void> {
        return resolved(undefined, cb);
    }

    function setZoom(
        _a: number,
        _b?: number | (() => void),
        cb?: () => void,
    ): Promise<void> {
        return resolved(undefined, cb);
    }
    function getZoom(
        _tabId?: number,
        cb?: (z: number) => void,
    ): Promise<number> {
        return resolved(1, cb);
    }
    function setZoomSettings(
        _tabId: number,
        _z: ZoomSettings,
        cb?: () => void,
    ): Promise<void> {
        return resolved(undefined, cb);
    }
    function getZoomSettings(
        _tabId?: number,
        cb?: (z: ZoomSettings) => void,
    ): Promise<ZoomSettings> {
        return resolved(
            {
                mode: "automatic",
                scope: "per-origin",
                defaultZoomFactor: 1,
            } as ZoomSettings,
            cb,
        );
    }

    function getAllInWindow(
        _windowId?: number,
        cb?: (tabs: chrome.tabs.Tab[]) => void,
    ): Promise<chrome.tabs.Tab[]> {
        return resolved([makeSelfTab()], cb);
    }
    function getSelected(
        _windowId?: number,
        cb?: (tab: chrome.tabs.Tab) => void,
    ): Promise<chrome.tabs.Tab> {
        return resolved(makeSelfTab(), cb);
    }

    // chrome.tabs.group / ungroup (MV3 tab groups)
    function group(
        _options: { tabIds: number | number[]; groupId?: number },
        cb?: (groupId: number) => void,
    ): Promise<number> {
        return resolved(-1, cb);
    }
    function ungroup(
        _tabIds: number | number[],
        cb?: () => void,
    ): Promise<void> {
        return resolved(undefined, cb);
    }

    return {
        query,
        get,
        getCurrent,
        create,
        update,
        remove,
        sendMessage,
        executeScript,
        insertCSS,
        captureVisibleTab,
        detectLanguage,
        discard,
        duplicate,
        highlight,
        move,
        reload,
        goBack,
        goForward,
        setZoom,
        getZoom,
        setZoomSettings,
        getZoomSettings,
        getAllInWindow,
        getSelected,
        group,
        ungroup,
        onCreated,
        onRemoved,
        onUpdated,
        onActivated,
        onMoved,
        onHighlighted,
        onDetached,
        onAttached,
        onReplaced,
        onZoomChange,
        TAB_ID_NONE: -1,
    };
}
