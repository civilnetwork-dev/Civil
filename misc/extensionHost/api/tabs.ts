/**
 * chrome.tabs, reduced to the one thing that's real in this host: a single
 * synthetic tab representing "the page under test", whose URL the harness
 * controls via `setTabUrl`. There is no real window/tab management — no
 * navigation, no opening new tabs — because there is no browser underneath.
 *
 * ponytail: multi-tab support is out of scope. Every filter-check extension
 * inspected cares about "what page is the user looking at right now", not
 * about managing multiple tabs; add real multi-tab tracking if a vendor
 * bundle turns out to need `tabs.onCreated`/`tabs.onRemoved`.
 */

import type { SyntheticTab } from "../../browserApiEmulators/extensions/chrome/types";

export function buildTabs(getTab: () => SyntheticTab) {
    const matches = (
        tab: SyntheticTab,
        query: Record<string, unknown>,
    ): boolean => {
        if ("active" in query && query.active !== tab.active) return false;
        if (
            "url" in query &&
            typeof query.url === "string" &&
            query.url !== tab.url
        )
            return false;
        return true;
    };

    return {
        query: async (query: Record<string, unknown> = {}) => {
            const tab = getTab();
            return matches(tab, query) ? [tab] : [];
        },
        get: async (tabId: number) => {
            const tab = getTab();
            if (tab.id !== tabId) throw new Error(`No tab with id ${tabId}`);
            return tab;
        },
        getCurrent: async () => getTab(),
        sendMessage: async () => {
            // No content-script realm to deliver into in this host — see
            // scripting.ts for the same boundary. Resolves undefined, the
            // same result Chrome gives when no listener responds.
            return undefined;
        },
        // MV2's content-script injection, the pair `chrome.scripting`
        // replaced in MV3. Recorded no-ops for the same reason
        // `scripting.executeScript` is one — there is no DOM to inject into —
        // but present rather than stubbed, because MV2 bundles promisify the
        // namespace at startup and then call `tabs.executeScriptAsync`, which
        // only exists if `executeScript` did.
        executeScript: async () => [],
        insertCSS: async () => {},
        removeCSS: async () => {},
        // Navigation and tab lifecycle: there is one synthetic tab and no
        // browser to act on, so these record nothing and change nothing.
        // They return the tab where Chrome returns a tab, so a caller that
        // reads the result back gets an object rather than undefined.
        create: async () => getTab(),
        // `update(tabId, props)` or `update(props)` for the active tab —
        // real Chrome accepts both shapes. A `url` is the one property this
        // host's synthetic tab can honestly reflect back (a redirect is a
        // redirect whether a content script writes `location.href` or the
        // background calls this); everything else about "navigating" a
        // headless tab with no renderer is out of scope, same as `create`.
        update: async (
            tabIdOrProps?: number | Record<string, unknown>,
            maybeProps?: Record<string, unknown>,
        ) => {
            const props =
                typeof tabIdOrProps === "number" ? maybeProps : tabIdOrProps;
            const tab = getTab();
            if (typeof props?.url === "string") tab.url = props.url;
            return tab;
        },
        reload: async () => {},
        remove: async () => {},
        discard: async () => getTab(),
        duplicate: async () => getTab(),
        highlight: async () => ({ id: 1, tabs: [getTab()] }),
        move: async () => getTab(),
        goBack: async () => {},
        goForward: async () => {},
        detectLanguage: async () => "en",
        captureVisibleTab: async () => "",
        getZoom: async () => 1,
        setZoom: async () => {},
        onCreated: {
            addListener: () => {},
            removeListener: () => {},
            hasListener: () => false,
        },
        onUpdated: {
            addListener: () => {},
            removeListener: () => {},
            hasListener: () => false,
        },
        onActivated: {
            addListener: () => {},
            removeListener: () => {},
            hasListener: () => false,
        },
        onRemoved: {
            addListener: () => {},
            removeListener: () => {},
            hasListener: () => false,
        },
    };
}
