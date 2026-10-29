import {
    createMemo,
    createSignal,
    createStore,
    For,
    onCleanup,
    onSettled,
    Show,
} from "solid-js";

import { extensionCivilTabIdFromChromeId } from "~/api/extensionRuntime";
import BookmarksBar from "~/components/BookmarksBar";
import { ChiiPanel } from "~/components/ChiiPanel";
import { useContextMenu } from "~/components/ContextMenu";
import ExtensionIconBar from "~/components/ExtensionIconBar";
import {
    IconPlus,
    IconPuzzle,
    IconSliders,
    IconWorld,
} from "~/components/icons";
import Specimen from "~/components/Specimen";
import TabSearch from "~/components/TabSearch";
import { TabPill } from "~/components/ui/TabPill";
import { UrlBar } from "~/components/ui/UrlBar";
import {
    createTabHistory,
    loadSession,
    saveSession,
} from "~/lib/browserHelpers";
import { isInternalUrl, isNewtabUrl } from "~/lib/browserUrls";
import { cleanupChiiArtifacts } from "~/lib/chii";
import { OPEN_ON_START_KEY } from "~/lib/openInBrowser";
import searchBar from "~/lib/SearchBar";
import { getSetting, useSetting } from "~/lib/settings";
import { tabManager } from "~/lib/TabManager";
import { createIframeManager } from "~/lib/useIframeManager";
import { registerTabMonitor } from "~/lib/useTabDrag";
import type { Tab } from "~/types";

import * as s from "~/styles/BrowserChrome.css";

/** An extension page a `tabs.create` URL asks for. */
type ExtensionPageTarget = {
    extId: string;
    pagePath: string;
    hashSearch: string;
};

/** Tampermonkey's extension ids across its store listings and channels. */
const TAMPERMONKEY_IDS = new Set([
    "dhdgffkkebhmkfjojejmpbldmpobfkfo",
    "lcmhijbkigalmkeommnijlpobloojgfn",
    "gcalenpjmijncebpfijmoaglllgpjagf",
    "iikmkjmpaadaobahmlepeloendndfphd",
    "clngdbkpkpeebahjckkjfobafhncgmne",
]);

/**
 * The extension page a URL names: `/civil-ext/<id>/<page>.html` on this
 * origin, or `chrome-extension://<id>/<page>.html`, either with any query
 * and hash it carries.
 */
function extensionPageTarget(
    url: string,
    origin: string,
): ExtensionPageTarget | null {
    // Pattern (a): same-origin /civil-ext/{extId}/{page}.html
    let parsed: URL | null = null;
    try {
        parsed = new URL(url, origin);
    } catch {}
    const civilMatch = /^\/civil-ext\/([^/]+)\/(.+\.html?)/.exec(
        parsed?.pathname ?? "",
    );
    if (parsed && civilMatch && url.startsWith(origin)) {
        return {
            extId: civilMatch[1]!,
            pagePath: civilMatch[2]!,
            hashSearch: parsed.search + parsed.hash,
        };
    }

    // Pattern (b): chrome-extension://{extId}/{page}.html[#hash]
    const ceMatch = /^chrome-extension:\/\/([^/]+)\/(.+\.html?)(.*)$/.exec(url);
    if (ceMatch) {
        return {
            extId: ceMatch[1]!,
            pagePath: ceMatch[2]!,
            hashSearch: ceMatch[3] ?? "",
        };
    }
    return null;
}

/**
 * Tampermonkey's web-install page for a user script, redirected to the
 * installed Tampermonkey's own options page, which installs it. Null when the
 * URL is not one, or no Tampermonkey is enabled.
 */
async function tampermonkeyInstallTarget(
    url: string,
): Promise<ExtensionPageTarget | null> {
    if (!/tampermonkey\.net/i.test(url)) return null;
    try {
        const u = new URL(url);
        // Script URL may appear in hash or query string after "url="
        const combined = u.hash + "&" + u.search;
        const scriptUrlMatch = /[?&#]url=([^&]+)/.exec(combined);
        const scriptUrl = scriptUrlMatch
            ? decodeURIComponent(scriptUrlMatch[1]!)
            : null;
        if (!scriptUrl || !/\.user\.(js|ts)/.test(scriptUrl)) return null;

        // Find the enabled TM extension
        const { extensionsGetAll } = await import("~/api/extensions");
        const tmExt = extensionsGetAll().find(
            ext => ext.enabled && TAMPERMONKEY_IDS.has(ext.id),
        );
        if (!tmExt) return null;
        console.log(
            "[Civil] intercepted TM web-install URL -> local options.html",
            scriptUrl,
        );
        return {
            extId: tmExt.id,
            pagePath: "options.html",
            // TM options.html uses hash router: #nav=install&url=SCRIPT_URL
            hashSearch: `#nav=install&url=${encodeURIComponent(scriptUrl)}`,
        };
    } catch {
        return null;
    }
}

/** Where the service worker serves a built extension page, by its kind. */
function servePrefixFor(pagePath: string): string {
    if (pagePath.startsWith("options")) return "options-tab";
    if (pagePath.startsWith("ask")) return "ask-tab";
    return "action-popup";
}

function openNewTab(url = "browser:newtab") {
    const t = tabManager.createTab(url);
    tabManager.activateTab(t.id);
}

function listen(
    target: EventTarget,
    type: string,
    handler: (e: Event) => void,
): () => void {
    target.addEventListener(type, handler);
    return () => target.removeEventListener(type, handler);
}

const TAB_MIN = 60,
    TAB_MAX = 220,
    NEW_BTN_W = 40,
    // Must track the `gap` on .browserTabstrip.
    TAB_GAP = 6;

function tabWidthFor(n: number, barWidth: number) {
    if (!n) return TAB_MAX;
    // n tabs plus the new-tab button is n+1 items, so n gaps sit between
    // them. The old constant 8px stood in for all of them, which left the
    // row ~50px too wide at eight tabs and pushed the new-tab button off
    // the edge of the window, where it couldn't be clicked at all.
    const available = barWidth - NEW_BTN_W - TAB_GAP * n;
    return Math.min(TAB_MAX, Math.max(TAB_MIN, available / n));
}

interface TabHandlers {
    tabAdded: (tab: Tab) => void;
    tabRemoved: (id: string) => void;
    tabActivated: (id: string) => void;
    tabUpdated: (tab: Tab) => void;
    tabMoved: (id: string, toIndex: number) => void;
}

function subscribeTabs(h: TabHandlers) {
    tabManager.on("tabAdded", h.tabAdded);
    tabManager.on("tabRemoved", h.tabRemoved);
    tabManager.on("tabActivated", h.tabActivated);
    tabManager.on("tabUpdated", h.tabUpdated);
    tabManager.on("tabMoved", h.tabMoved);
    return () => {
        tabManager.off("tabAdded", h.tabAdded);
        tabManager.off("tabRemoved", h.tabRemoved);
        tabManager.off("tabActivated", h.tabActivated);
        tabManager.off("tabUpdated", h.tabUpdated);
        tabManager.off("tabMoved", h.tabMoved);
    };
}

const persist = () => saveSession(tabManager.tabs, tabManager.activeId);

function withUpdate(tabs: Tab[], upd: Tab): Tab[] {
    return tabs.map(t =>
        t.id === upd.id
            ? {
                  ...t,
                  title: upd.title,
                  url: upd.url,
                  isLoading: upd.isLoading,
                  favicon: upd.favicon,
              }
            : t,
    );
}

function moveInto(tabs: Tab[], id: string, toIndex: number): Tab[] | null {
    const arr = [...tabs];
    const from = arr.findIndex(t => t.id === id);
    if (from === -1 || from === toIndex) return null;
    const [tab] = arr.splice(from, 1);
    arr.splice(toIndex, 0, tab);
    return arr;
}

function useTabState(activation: { before: () => void; after: () => void }) {
    const [tabStore, setTabStore] = createStore<{ tabs: Tab[] }>({ tabs: [] });
    const [activeId, setActiveId] = createSignal<string | null>(null);
    const [iframeIds, setIframeIds] = createSignal<string[]>([]);

    const setTabs = (update: (tabs: Tab[]) => Tab[] | null) =>
        setTabStore(store => {
            const next = update(store.tabs);
            if (next) store.tabs = next;
        });

    onCleanup(
        subscribeTabs({
            tabAdded: tab => {
                setTabs(tabs => [...tabs, tab]);
                setIframeIds(ids => [...ids, tab.id]);
                persist();
            },
            tabRemoved: id => {
                setTabs(tabs => tabs.filter(t => t.id !== id));
                setIframeIds(ids => ids.filter(i => i !== id));
                setActiveId(tabManager.activeId);
                persist();
            },
            tabActivated: id => {
                activation.before();
                setActiveId(id);
                activation.after();
                persist();
            },
            tabUpdated: upd => {
                setTabs(tabs => withUpdate(tabs, upd));
                persist();
            },
            tabMoved: (id, toIndex) => {
                setTabs(tabs => moveInto(tabs, id, toIndex));
                persist();
            },
        }),
    );

    /** Takes over the tabs `tabManager` already holds. */
    const adopt = () => {
        setTabs(() => [...tabManager.tabs]);
        setIframeIds(tabManager.tabs.map(t => t.id));
        setActiveId(tabManager.activeId);
    };

    return { tabStore, activeId, iframeIds, adopt };
}

function restoreSession(session: NonNullable<ReturnType<typeof loadSession>>) {
    for (const saved of session.tabs) {
        const t = tabManager.createTab(saved.url);
        tabManager.updateTab(t.id, {
            title: saved.title || t.title,
            favicon: saved.favicon,
            isLoading: false,
        });
    }
    const idx = Math.min(
        Math.max(0, session.activeIndex ?? 0),
        tabManager.tabs.length - 1,
    );
    tabManager.activateTab(tabManager.tabs[idx].id);
}

function openStartupTabs(adopt: () => void) {
    // `tabManager` is a module singleton, so a remount (HMR, or the route
    // re-entering the browser) finds it already holding tabs. Adopt them;
    // restoring the saved session on top doubled the strip every time.
    // The session is still saved when restoring is off, so turning it
    // back on picks up the last tabs.
    const startup = getSetting("startup");
    const session =
        tabManager.tabs.length || startup !== "restore" ? null : loadSession();
    if (tabManager.tabs.length) {
        adopt();
    } else if (session) {
        restoreSession(session);
    } else {
        const page = getSetting("startupUrl").trim();
        openNewTab(startup === "page" && page ? page : "browser:newtab");
    }
    openPendingStartTab();
}

/**
 * A Civil page opened outside the browser (an app picked on a bare /apps)
 * left its address here to open once the tabs exist.
 */
function openPendingStartTab() {
    let pending: string | null = null;
    try {
        pending = sessionStorage.getItem(OPEN_ON_START_KEY);
        sessionStorage.removeItem(OPEN_ON_START_KEY);
    } catch {}
    if (pending) openNewTab(pending);
}

function createExtensionPageOpener() {
    // Dedup guard: prevents infinite-loop if background calls tabs.create
    // repeatedly for the same page before the first one finishes building.
    const _pendingExtPages = new Set<string>();

    return ({ extId, pagePath, hashSearch }: ExtensionPageTarget) => {
        const safeKey = pagePath.replace(/[^a-z0-9]/gi, "-");
        const cacheKey = `${extId}--${safeKey}`;
        const safeHash = hashSearch.replace(/[^a-z0-9]/gi, "-").slice(0, 80);
        const dedupKey = safeHash ? `${cacheKey}--${safeHash}` : cacheKey;

        // Dedup: skip if already building this exact page+hash
        if (_pendingExtPages.has(dedupKey)) return;
        _pendingExtPages.add(dedupKey);

        const servePrefix = servePrefixFor(pagePath);

        // Build the extension page BEFORE creating the tab, then
        // create the tab with the final served URL. This avoids two
        // races that surfaced as a router 404: (1) navigate() no-ops
        // if the iframe hasn't mounted yet, and (2) the served
        // /{servePrefix}/{cacheKey} entry may not be registered when
        // navigation fires. Creating the tab with the internal URL
        // after the build lets registerIframe's restore path load it
        // deterministically (isInternalUrl -> iframe.src = url).
        void (async () => {
            try {
                const [{ extensionsGetById }, { buildExtensionPageSrcDoc }] =
                    await Promise.all([
                        import("~/api/extensions"),
                        import("~/api/extensionRuntime"),
                    ]);
                const ext = extensionsGetById(extId);
                if (!ext) return;
                await buildExtensionPageSrcDoc(
                    ext,
                    pagePath,
                    "popup",
                    cacheKey,
                );
                openNewTab(
                    `${window.location.origin}/${servePrefix}/${cacheKey}${hashSearch}`,
                );
            } catch (err) {
                console.warn("[Civil] buildExtensionPageSrcDoc failed:", err);
            } finally {
                _pendingExtPages.delete(dedupKey);
            }
        })();
    };
}

function newTabHandler(openExtensionPage: (t: ExtensionPageTarget) => void) {
    return async (e: Event) => {
        const { url } = (e as CustomEvent<{ url?: string }>).detail ?? {};
        console.log("[Civil] browser:newtab fired, url=", url);

        if (url) {
            const target =
                extensionPageTarget(url, window.location.origin) ??
                (await tampermonkeyInstallTarget(url));
            console.log("[Civil] browser:newtab pattern match:", {
                extId: target?.extId,
                pagePath: target?.pagePath,
                hashSearch: target?.hashSearch ?? "",
            });
            if (target) {
                openExtensionPage(target);
                return;
            }
        }

        openNewTab(url ?? "browser:newtab");
    };
}

function closeChromeTabs(e: Event) {
    const { chromeTabIds } =
        (e as CustomEvent<{ chromeTabIds?: number[] }>).detail ?? {};
    if (!chromeTabIds?.length) return;
    for (const chromeId of chromeTabIds) {
        const civilId = extensionCivilTabIdFromChromeId(chromeId);
        if (civilId) tabManager.removeTab(civilId);
    }
}

function broadcastUserscriptInstall(e: Event) {
    const { url, source } =
        (e as CustomEvent<{ url?: string; source?: string }>).detail ?? {};
    if (!url || !source) return;
    void import("~/api/extensions").then(({ extensionsGetAll }) => {
        const BroadcastChannel = (window as unknown as Record<string, unknown>)
            .BroadcastChannel as typeof window.BroadcastChannel;
        for (const ext of extensionsGetAll().filter(x => x.enabled)) {
            const bus = new BroadcastChannel(`civil-ext-bus-${ext.id}`);
            const reqId = Math.random().toString(36).slice(2);
            bus.postMessage({
                kind: "sendMessageExternal",
                reqId,
                from: `civil-userscript-${Math.random().toString(36).slice(2)}`,
                contextType: "content",
                message: {
                    action: "userscript",
                    source,
                    url,
                },
                sender: { id: ext.id, url },
            });
            setTimeout(() => bus.close(), 500);
        }
    });
}

function useBrowserEvents(opts: {
    navigateIframe: (tabId: string, url: string) => void;
    toggleSearch: () => void;
}) {
    onSettled(() => {
        const releases = [
            listen(document, "browser:navigate", e => {
                const { tabId, url } = (
                    e as CustomEvent<{ tabId: string; url: string }>
                ).detail;
                opts.navigateIframe(tabId, url);
            }),
            // Debug: log events from extension shims
            listen(window, "__civilDebug", e => {
                console.log("[civil-debug]", (e as CustomEvent).detail);
            }),
            listen(
                document,
                "browser:newtab",
                newTabHandler(createExtensionPageOpener()),
            ),
            listen(document, "browser:closetab", closeChromeTabs),
            listen(
                window,
                "browser:userscript-install",
                broadcastUserscriptInstall,
            ),
            listen(window, "keydown", e => {
                const key = e as KeyboardEvent;
                if ((key.ctrlKey || key.metaKey) && key.key === "k") {
                    key.preventDefault();
                    opts.toggleSearch();
                }
            }),
        ];
        return () => {
            for (const release of releases) release();
        };
    });
}

type TextField = HTMLInputElement | HTMLTextAreaElement;

function focusedField(): TextField | null {
    const el = document.activeElement as TextField | null;
    return el && "setRangeText" in el ? el : null;
}

function replaceSelection(el: TextField, text: string) {
    el.setRangeText(text, el.selectionStart ?? 0, el.selectionEnd ?? 0, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
}

function cutSelection() {
    const active = focusedField();
    if (!active) return;
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    const cut = active.value.slice(start, end);
    if (cut) {
        navigator.clipboard.writeText(cut);
        replaceSelection(active, "");
    }
}

function copySelection() {
    const sel = window.getSelection()?.toString() ?? "";
    if (sel) navigator.clipboard.writeText(sel);
}

function pasteClipboard() {
    navigator.clipboard.readText().then(text => {
        const el = focusedField();
        if (el) replaceSelection(el, text);
    });
}

type MenuItems = Parameters<ReturnType<typeof useContextMenu>["open"]>[1];

const EDIT_ITEMS: MenuItems = [
    { label: "Cut", shortcut: "⌘X", action: cutSelection },
    { label: "Copy", shortcut: "⌘C", action: copySelection },
    { label: "Paste", shortcut: "⌘V", action: pasteClipboard },
    { type: "separator" as const },
];

function isTextTarget(target: HTMLElement) {
    return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
    );
}

function chromeMenu(opts: {
    isInput: boolean;
    open: (url: string) => void;
    inspect: () => void;
    closeActive: () => void;
}): MenuItems {
    return [
        {
            label: "New Tab",
            icon: <IconPlus size={14} />,
            action: () => openNewTab(),
        },
        { type: "separator" },
        {
            label: "Extensions",
            icon: <IconPuzzle size={14} />,
            action: () => opts.open("browser:extensions"),
        },
        { label: "History", action: () => opts.open("browser:history") },
        { label: "Bookmarks", action: () => opts.open("browser:bookmarks") },
        { label: "Apps", action: () => opts.open("browser:apps") },
        {
            label: "Settings",
            icon: <IconSliders size={14} />,
            action: () => opts.open("browser:settings"),
        },
        { type: "separator" },
        ...(opts.isInput ? EDIT_ITEMS : []),
        { label: "Inspect", action: opts.inspect },
        { type: "separator" },
        { label: "Close Tab", danger: true, action: opts.closeActive },
    ];
}

function TabStrip(props: {
    tabs: Tab[];
    activeId: string | null;
    width: number;
    draggingId: string | null;
    setDraggingId: (id: string | null) => void;
    stripRef: (el: HTMLDivElement) => void;
    getStrip: () => HTMLDivElement | undefined;
}) {
    return (
        <div
            class={s.browserTabstrip}
            ref={props.stripRef}
            role="tablist"
            aria-label="Browser tabs"
        >
            <For each={props.tabs} keyed={false}>
                {tab => (
                    <TabPill
                        tab={tab()}
                        active={tab().id === props.activeId}
                        width={props.width}
                        isDragging={tab().id === props.draggingId}
                        onClose={() => tabManager.removeTab(tab().id)}
                        setDraggingId={props.setDraggingId}
                        getTabs={() => props.tabs}
                        getStrip={props.getStrip}
                        onReorder={(tabId, newIndex) =>
                            tabManager.moveTab(tabId, newIndex)
                        }
                    />
                )}
            </For>
            <button
                type="button"
                class={s.tabNew}
                title="New tab"
                onClick={() => openNewTab()}
            >
                <IconPlus size={15} />
            </button>
        </div>
    );
}

function ChromeButtons(props: { open: (url: string) => void }) {
    return (
        <>
            <ExtensionIconBar />
            <button
                type="button"
                class={s.extensionsBtn}
                title="Extensions"
                onClick={() => props.open("browser:extensions")}
            >
                <IconPuzzle size={15} />
            </button>
            <button
                type="button"
                class={s.extensionsBtn}
                title="Settings"
                onClick={() => props.open("browser:settings")}
            >
                <IconSliders size={15} />
            </button>
        </>
    );
}

function EmptyViewport() {
    return (
        <div class={s.browserEmpty}>
            <Specimen icon={IconWorld} size={64} />
            <p>No tabs open</p>
            <button
                type="button"
                class={s.browserEmptyButton}
                onClick={() => openNewTab()}
            >
                Open a tab
            </button>
        </div>
    );
}

function Frames(props: {
    ids: string[];
    activeId: string | null;
    register: (id: string, el: HTMLIFrameElement) => void;
}) {
    return (
        <>
            {/*
             * Keyed by tab id, unlike the lists around it: a frame is a
             * live page that has to stay with its tab. Keyed by index,
             * closing a tab handed its frame to the tab on its right,
             * which then showed the closed page.
             */}
            <For each={props.ids}>
                {id => (
                    <iframe
                        title="Proxied browser-in-browser webpage"
                        class={[
                            s.browserFrame,
                            { [s.browserFrameActive]: id === props.activeId },
                        ]}
                        ref={el => props.register(id, el)}
                    />
                )}
            </For>
        </>
    );
}

function useChii(activeIframe: () => HTMLIFrameElement | undefined) {
    const [chiiOpen, setChiiOpen] = createSignal(false);
    const cleanup = () => {
        const iframe = activeIframe();
        if (iframe) cleanupChiiArtifacts(iframe);
    };
    return { chiiOpen, setChiiOpen, cleanup };
}

function useTabStripWidth(count: () => number) {
    const [tabBarWidth, setTabBarWidth] = createSignal(600);
    const ro = new ResizeObserver(entries => {
        for (const e of entries) setTabBarWidth(e.contentRect.width);
    });
    onCleanup(() => ro.disconnect());
    const tabWidth = createMemo(() => tabWidthFor(count(), tabBarWidth()));
    return { tabWidth, observe: (el: HTMLElement) => ro.observe(el) };
}

function useBrowserState() {
    const bar = searchBar();
    const tabHistory = createTabHistory();
    const frames = createIframeManager(bar, tabHistory.pushHistory);

    const state = useTabState({
        before: () => chii.cleanup(),
        after: () => chii.setChiiOpen(false),
    });
    const { tabStore, activeId } = state;

    const activeTab = createMemo(
        () => tabStore.tabs.find(t => t.id === activeId()) ?? null,
    );
    const activeUrl = createMemo(() => activeTab()?.url ?? "");
    const activeTabIsNewtab = createMemo(() => isNewtabUrl(activeUrl()));
    const activeIframe = createMemo(() => {
        const id = activeId();
        return id ? frames.iframeMap.get(id) : undefined;
    });
    const chii = useChii(activeIframe);

    return {
        bar,
        tabHistory,
        frames,
        state,
        activeTab,
        activeUrl,
        activeTabIsNewtab,
        activeIframe,
        chii,
    };
}

type Browser = ReturnType<typeof useBrowserState>;

function browserActions(b: Browser) {
    const activeId = b.state.activeId;
    return {
        open: (url: string) => {
            const id = activeId();
            if (id) b.frames.navigate(id, url);
        },
        travel: (step: (id: string | null) => string | null | undefined) => {
            const id = activeId();
            const url = step(id);
            if (id && url) b.frames.navigateIframe(id, url);
        },
        refresh: () => {
            const id = activeId();
            if (!id) return;
            const tab = b.state.tabStore.tabs.find(t => t.id === id);
            if (!tab) return;
            const iframe = b.frames.iframeMap.get(id);
            if (!iframe) return;
            tabManager.updateTab(id, { isLoading: true });
            if (isInternalUrl(tab.url)) {
                iframe.src = tab.url;
            } else {
                b.bar.emit("submit", iframe, tab.url);
            }
        },
        inspect: () => {
            const id = activeId();
            if (!id) return;
            const iframe = b.frames.iframeMap.get(id);
            if (!iframe) return;
            if (isInternalUrl(b.activeUrl())) return;
            b.chii.setChiiOpen(true);
        },
        closeActive: () => {
            const id = activeId();
            if (id) tabManager.removeTab(id);
        },
    };
}

type Actions = ReturnType<typeof browserActions>;

function UrlbarRow(props: {
    b: Browser;
    actions: Actions;
    onTabSearch: () => void;
}) {
    const activeId = () => props.b.state.activeId();
    return (
        <div class={s.urlbarRow}>
            <UrlBar
                value={props.b.activeUrl()}
                canBack={props.b.tabHistory.canBack(activeId())}
                canForward={props.b.tabHistory.canForward(activeId())}
                isNewtab={props.b.activeTabIsNewtab()}
                onTabSearch={() => props.onTabSearch()}
                onNavigate={props.actions.open}
                onBack={() => props.actions.travel(props.b.tabHistory.back)}
                onForward={() =>
                    props.actions.travel(props.b.tabHistory.forward)
                }
                onRefresh={props.actions.refresh}
            />
            <ChromeButtons open={props.actions.open} />
        </div>
    );
}

function ChromeBookmarks(props: { b: Browser; open: (url: string) => void }) {
    const bookmarksBar = useSetting("bookmarksBar");
    const showBookmarksBar = () =>
        bookmarksBar() === "always" ||
        (bookmarksBar() === "newtab" && props.b.activeTabIsNewtab());
    return (
        <Show when={showBookmarksBar()}>
            <BookmarksBar
                activeUrl={props.b.activeUrl()}
                activeTitle={props.b.activeTab()?.title ?? ""}
                activeFavicon={props.b.activeTab()?.favicon}
                onNavigate={props.open}
            />
        </Show>
    );
}

function Viewport(props: { b: Browser }) {
    const chii = () => props.b.chii;
    return (
        <div class={s.browserViewport}>
            <Frames
                ids={props.b.state.iframeIds()}
                activeId={props.b.state.activeId()}
                register={props.b.frames.registerIframe}
            />
            <Show when={props.b.state.tabStore.tabs.length === 0}>
                <EmptyViewport />
            </Show>
            <Show when={chii().chiiOpen() && props.b.activeIframe()}>
                <ChiiPanel
                    targetIframe={props.b.activeIframe()!}
                    onClose={() => {
                        chii().cleanup();
                        chii().setChiiOpen(false);
                    }}
                    onDetach={url => {
                        chii().cleanup();
                        window.open(url, "_blank", "width=1000,height=700");
                        chii().setChiiOpen(false);
                    }}
                />
            </Show>
        </div>
    );
}

function ChromeTop(props: {
    b: Browser;
    actions: Actions;
    tabWidth: number;
    draggingId: string | null;
    setDraggingId: (id: string | null) => void;
    stripRef: (el: HTMLDivElement) => void;
    getStrip: () => HTMLDivElement | undefined;
    onTabSearch: () => void;
}) {
    return (
        <div class={s.browserChrome}>
            <TabStrip
                tabs={props.b.state.tabStore.tabs}
                activeId={props.b.state.activeId()}
                width={props.tabWidth}
                draggingId={props.draggingId}
                setDraggingId={props.setDraggingId}
                stripRef={props.stripRef}
                getStrip={props.getStrip}
            />
            <UrlbarRow
                b={props.b}
                actions={props.actions}
                onTabSearch={() => props.onTabSearch()}
            />
            <ChromeBookmarks b={props.b} open={props.actions.open} />
        </div>
    );
}

export default function BrowserChrome() {
    const ctx = useContextMenu();

    const [draggingId, setDraggingId] = createSignal<string | null>(null);
    const [showSearch, setShowSearch] = createSignal(false);

    const b = useBrowserState();
    const { tabStore, activeId } = b.state;
    const strip = useTabStripWidth(() => tabStore.tabs.length);

    let tabStripRef: HTMLDivElement | undefined;
    let browserRootRef: HTMLDivElement | undefined;

    onSettled(() => {
        if (tabStripRef) strip.observe(tabStripRef);
        const releaseTabMonitor = registerTabMonitor({ setDraggingId });
        openStartupTabs(b.state.adopt);
        return releaseTabMonitor;
    });
    useBrowserEvents({
        navigateIframe: b.frames.navigateIframe,
        toggleSearch: () => setShowSearch(v => !v),
    });

    const actions = browserActions(b);
    const openMenu = (e: MouseEvent) =>
        ctx.open(
            e,
            chromeMenu({
                isInput: isTextTarget(e.target as HTMLElement),
                ...actions,
            }),
        );

    return (
        <div class={s.browser} ref={browserRootRef} onContextMenu={openMenu}>
            <ChromeTop
                b={b}
                actions={actions}
                tabWidth={strip.tabWidth()}
                draggingId={draggingId()}
                setDraggingId={setDraggingId}
                stripRef={el => (tabStripRef = el)}
                getStrip={() => tabStripRef}
                onTabSearch={() => setShowSearch(true)}
            />

            <Viewport b={b} />

            <Show when={showSearch()}>
                <TabSearch
                    tabs={tabStore.tabs}
                    activeId={activeId()}
                    onActivate={tabId => tabManager.activateTab(tabId)}
                    onClose={() => setShowSearch(false)}
                />
            </Show>
        </div>
    );
}
