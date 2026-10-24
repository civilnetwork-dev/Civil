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
import searchBar from "~/lib/SearchBar";
import { getSetting, useSetting } from "~/lib/settings";
import { type Tab, tabManager } from "~/lib/TabManager";
import {
    cleanupChiiArtifacts,
    createIframeManager,
} from "~/lib/useIframeManager";
import { registerTabMonitor } from "~/lib/useTabDrag";

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

export default function BrowserChrome() {
    const bar = searchBar();
    const ctx = useContextMenu();

    const [tabStore, setTabStore] = createStore<{ tabs: Tab[] }>({ tabs: [] });
    const [activeId, setActiveId] = createSignal<string | null>(null);
    const [tabBarWidth, setTabBarWidth] = createSignal(600);
    const [draggingId, setDraggingId] = createSignal<string | null>(null);
    const [iframeIds, setIframeIds] = createSignal<string[]>([]);
    const [showSearch, setShowSearch] = createSignal(false);
    const [chiiOpen, setChiiOpen] = createSignal(false);

    const { pushHistory, back, forward, canBack, canForward } =
        createTabHistory();
    const { iframeMap, navigateIframe, navigate, registerIframe } =
        createIframeManager(bar, pushHistory);

    let tabStripRef: HTMLDivElement | undefined;
    let browserRootRef: HTMLDivElement | undefined;

    const TAB_MIN = 60,
        TAB_MAX = 220,
        NEW_BTN_W = 40,
        // Must track the `gap` on .browserTabstrip.
        TAB_GAP = 6;
    const tabWidth = createMemo(() => {
        const n = tabStore.tabs.length;
        if (!n) return TAB_MAX;
        // n tabs plus the new-tab button is n+1 items, so n gaps sit between
        // them. The old constant 8px stood in for all of them, which left the
        // row ~50px too wide at eight tabs and pushed the new-tab button off
        // the edge of the window, where it couldn't be clicked at all.
        const available = tabBarWidth() - NEW_BTN_W - TAB_GAP * n;
        return Math.min(TAB_MAX, Math.max(TAB_MIN, available / n));
    });
    const activeTab = createMemo(
        () => tabStore.tabs.find(t => t.id === activeId()) ?? null,
    );
    const activeUrl = createMemo(() => activeTab()?.url ?? "");
    const activeTabIsNewtab = createMemo(() => isNewtabUrl(activeUrl()));
    const activeIframe = createMemo(() => {
        const id = activeId();
        return id ? iframeMap.get(id) : undefined;
    });
    const cleanupActiveChii = () => {
        const iframe = activeIframe();
        if (iframe) cleanupChiiArtifacts(iframe);
    };

    const persist = () => saveSession(tabManager.tabs, tabManager.activeId);

    const onTabAdded = (tab: Tab) => {
        setTabStore(store => {
            store.tabs = [...store.tabs, tab];
        });
        setIframeIds(ids => [...ids, tab.id]);
        persist();
    };
    const onTabRemoved = (id: string) => {
        setTabStore(store => {
            store.tabs = store.tabs.filter(t => t.id !== id);
        });
        setIframeIds(ids => ids.filter(i => i !== id));
        setActiveId(tabManager.activeId);
        persist();
    };
    const onTabActivated = (id: string) => {
        cleanupActiveChii();
        setActiveId(id);
        setChiiOpen(false);
        persist();
    };
    const onTabUpdated = (upd: Tab) => {
        setTabStore(store => {
            store.tabs = store.tabs.map(t =>
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
        });
        persist();
    };
    const onTabMoved = (id: string, toIndex: number) => {
        setTabStore(store => {
            const arr = [...store.tabs];
            const from = arr.findIndex(t => t.id === id);
            if (from === -1 || from === toIndex) return;
            const [tab] = arr.splice(from, 1);
            arr.splice(toIndex, 0, tab);
            store.tabs = arr;
        });
        persist();
    };

    tabManager.on("tabAdded", onTabAdded);
    tabManager.on("tabRemoved", onTabRemoved);
    tabManager.on("tabActivated", onTabActivated);
    tabManager.on("tabUpdated", onTabUpdated);
    tabManager.on("tabMoved", onTabMoved);
    onCleanup(() => {
        tabManager.off("tabAdded", onTabAdded);
        tabManager.off("tabRemoved", onTabRemoved);
        tabManager.off("tabActivated", onTabActivated);
        tabManager.off("tabUpdated", onTabUpdated);
        tabManager.off("tabMoved", onTabMoved);
    });

    const ro = new ResizeObserver(entries => {
        for (const e of entries) setTabBarWidth(e.contentRect.width);
    });
    onCleanup(() => ro.disconnect());

    onSettled(() => {
        if (tabStripRef) ro.observe(tabStripRef);

        const releaseTabMonitor = registerTabMonitor({ setDraggingId });

        // `tabManager` is a module singleton, so a remount (HMR, or the route
        // re-entering the browser) finds it already holding tabs. Adopt them;
        // restoring the saved session on top doubled the strip every time.
        // The session is still saved when restoring is off, so turning it
        // back on picks up the last tabs.
        const startup = getSetting("startup");
        const session =
            tabManager.tabs.length || startup !== "restore"
                ? null
                : loadSession();
        if (tabManager.tabs.length) {
            setTabStore(store => {
                store.tabs = [...tabManager.tabs];
            });
            setIframeIds(tabManager.tabs.map(t => t.id));
            setActiveId(tabManager.activeId);
        } else if (session) {
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
        } else {
            const page = getSetting("startupUrl").trim();
            const t = tabManager.createTab(
                startup === "page" && page ? page : "browser:newtab",
            );
            tabManager.activateTab(t.id);
        }

        const onBrowserNavigate = (e: Event) => {
            const { tabId, url } = (
                e as CustomEvent<{ tabId: string; url: string }>
            ).detail;
            navigateIframe(tabId, url);
        };
        document.addEventListener("browser:navigate", onBrowserNavigate);

        // Debug: log events from extension shims
        const onCivilDebug = (e: Event) => {
            console.log("[civil-debug]", (e as CustomEvent).detail);
        };
        window.addEventListener("__civilDebug", onCivilDebug);

        // Dedup guard: prevents infinite-loop if background calls tabs.create
        // repeatedly for the same page before the first one finishes building.
        const _pendingExtPages = new Set<string>();

        const openExtensionPage = ({
            extId,
            pagePath,
            hashSearch,
        }: ExtensionPageTarget) => {
            const safeKey = pagePath.replace(/[^a-z0-9]/gi, "-");
            const cacheKey = `${extId}--${safeKey}`;
            const safeHash = hashSearch
                .replace(/[^a-z0-9]/gi, "-")
                .slice(0, 80);
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
                    const [
                        { extensionsGetById },
                        { buildExtensionPageSrcDoc },
                    ] = await Promise.all([
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
                    const t = tabManager.createTab(
                        `${window.location.origin}/${servePrefix}/${cacheKey}${hashSearch}`,
                    );
                    tabManager.activateTab(t.id);
                } catch (err) {
                    console.warn(
                        "[Civil] buildExtensionPageSrcDoc failed:",
                        err,
                    );
                } finally {
                    _pendingExtPages.delete(dedupKey);
                }
            })();
        };

        const onBrowserNewTab = async (e: Event) => {
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

            const t = tabManager.createTab(url ?? "browser:newtab");
            tabManager.activateTab(t.id);
        };
        document.addEventListener("browser:newtab", onBrowserNewTab);

        const onBrowserCloseTab = (e: Event) => {
            const { chromeTabIds } =
                (e as CustomEvent<{ chromeTabIds?: number[] }>).detail ?? {};
            if (!chromeTabIds?.length) return;
            for (const chromeId of chromeTabIds) {
                const civilId = extensionCivilTabIdFromChromeId(chromeId);
                if (civilId) tabManager.removeTab(civilId);
            }
        };
        document.addEventListener("browser:closetab", onBrowserCloseTab);

        const onUserscriptInstall = (e: Event) => {
            const { url, source } =
                (e as CustomEvent<{ url?: string; source?: string }>).detail ??
                {};
            if (!url || !source) return;
            void import("~/api/extensions").then(({ extensionsGetAll }) => {
                const BroadcastChannel = (
                    window as unknown as Record<string, unknown>
                ).BroadcastChannel as typeof window.BroadcastChannel;
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
        };
        window.addEventListener(
            "browser:userscript-install",
            onUserscriptInstall,
        );

        const onGlobalKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setShowSearch(v => !v);
            }
        };
        window.addEventListener("keydown", onGlobalKey);

        return () => {
            releaseTabMonitor();
            document.removeEventListener("browser:navigate", onBrowserNavigate);
            document.removeEventListener("browser:newtab", onBrowserNewTab);
            document.removeEventListener("browser:closetab", onBrowserCloseTab);
            window.removeEventListener("__civilDebug", onCivilDebug);
            window.removeEventListener(
                "browser:userscript-install",
                onUserscriptInstall,
            );
            window.removeEventListener("keydown", onGlobalKey);
        };
    });

    const openExtensions = () => {
        const id = activeId();
        if (id) navigate(id, "browser:extensions");
    };

    const openSettings = () => {
        const id = activeId();
        if (id) navigate(id, "browser:settings");
    };

    const bookmarksBar = useSetting("bookmarksBar");
    const showBookmarksBar = () =>
        bookmarksBar() === "always" ||
        (bookmarksBar() === "newtab" && activeTabIsNewtab());

    const handleReorder = (tabId: string, newIndex: number) => {
        tabManager.moveTab(tabId, newIndex);
    };

    return (
        <div
            class={s.browser}
            ref={browserRootRef}
            onContextMenu={e => {
                const target = e.target as HTMLElement;
                const isInput =
                    target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.isContentEditable;
                ctx.open(e, [
                    {
                        label: "New Tab",
                        icon: <IconPlus size={14} />,
                        action: () => {
                            const t = tabManager.createTab("browser:newtab");
                            tabManager.activateTab(t.id);
                        },
                    },
                    { type: "separator" },
                    {
                        label: "Extensions",
                        icon: <IconPuzzle size={14} />,
                        action: openExtensions,
                    },
                    {
                        label: "History",
                        action: () => {
                            const id = activeId();
                            if (id) navigate(id, "browser:history");
                        },
                    },
                    {
                        label: "Bookmarks",
                        action: () => {
                            const id = activeId();
                            if (id) navigate(id, "browser:bookmarks");
                        },
                    },
                    {
                        label: "Apps",
                        action: () => {
                            const id = activeId();
                            if (id) navigate(id, "browser:apps");
                        },
                    },
                    {
                        label: "Settings",
                        icon: <IconSliders size={14} />,
                        action: openSettings,
                    },
                    { type: "separator" },
                    ...(isInput
                        ? [
                              {
                                  label: "Cut",
                                  shortcut: "⌘X",
                                  action: () => {
                                      const active = document.activeElement as
                                          | HTMLInputElement
                                          | HTMLTextAreaElement
                                          | null;
                                      if (active && "setRangeText" in active) {
                                          const start =
                                              active.selectionStart ?? 0;
                                          const end = active.selectionEnd ?? 0;
                                          const cut = active.value.slice(
                                              start,
                                              end,
                                          );
                                          if (cut) {
                                              navigator.clipboard.writeText(
                                                  cut,
                                              );
                                              active.setRangeText(
                                                  "",
                                                  start,
                                                  end,
                                                  "end",
                                              );
                                              active.dispatchEvent(
                                                  new Event("input", {
                                                      bubbles: true,
                                                  }),
                                              );
                                          }
                                      }
                                  },
                              },
                              {
                                  label: "Copy",
                                  shortcut: "⌘C",
                                  action: () => {
                                      const sel =
                                          window.getSelection()?.toString() ??
                                          "";
                                      if (sel)
                                          navigator.clipboard.writeText(sel);
                                  },
                              },
                              {
                                  label: "Paste",
                                  shortcut: "⌘V",
                                  action: () => {
                                      navigator.clipboard
                                          .readText()
                                          .then(text => {
                                              const el =
                                                  document.activeElement as
                                                      | HTMLInputElement
                                                      | HTMLTextAreaElement
                                                      | null;
                                              if (el && "setRangeText" in el) {
                                                  el.setRangeText(
                                                      text,
                                                      el.selectionStart ?? 0,
                                                      el.selectionEnd ?? 0,
                                                      "end",
                                                  );
                                                  el.dispatchEvent(
                                                      new Event("input", {
                                                          bubbles: true,
                                                      }),
                                                  );
                                              }
                                          });
                                  },
                              },
                              { type: "separator" as const },
                          ]
                        : []),
                    {
                        label: "Inspect",
                        action: () => {
                            const id = activeId();
                            if (!id) return;
                            const iframe = iframeMap.get(id);
                            if (!iframe) return;
                            if (isInternalUrl(activeUrl())) return;
                            setChiiOpen(true);
                        },
                    },
                    { type: "separator" },
                    {
                        label: "Close Tab",
                        danger: true,
                        action: () => {
                            const id = activeId();
                            if (id) tabManager.removeTab(id);
                        },
                    },
                ]);
            }}
        >
            <div class={s.browserChrome}>
                <div
                    class={s.browserTabstrip}
                    ref={tabStripRef}
                    role="tablist"
                    aria-label="Browser tabs"
                >
                    <For each={tabStore.tabs} keyed={false}>
                        {tab => (
                            <TabPill
                                tab={tab()}
                                active={tab().id === activeId()}
                                width={tabWidth()}
                                isDragging={tab().id === draggingId()}
                                onClose={() => tabManager.removeTab(tab().id)}
                                setDraggingId={setDraggingId}
                                getTabs={() => tabStore.tabs}
                                getStrip={() => tabStripRef}
                                onReorder={handleReorder}
                            />
                        )}
                    </For>
                    <button
                        type="button"
                        class={s.tabNew}
                        title="New tab"
                        onClick={() => {
                            const t = tabManager.createTab("browser:newtab");
                            tabManager.activateTab(t.id);
                        }}
                    >
                        <IconPlus size={15} />
                    </button>
                </div>

                <div class={s.urlbarRow}>
                    <UrlBar
                        value={activeUrl()}
                        canBack={canBack(activeId())}
                        canForward={canForward(activeId())}
                        isNewtab={activeTabIsNewtab()}
                        onTabSearch={() => setShowSearch(true)}
                        onNavigate={url => {
                            const id = activeId();
                            if (id) navigate(id, url);
                        }}
                        onBack={() => {
                            const id = activeId();
                            const url = back(id);
                            if (id && url) navigateIframe(id, url);
                        }}
                        onForward={() => {
                            const id = activeId();
                            const url = forward(id);
                            if (id && url) navigateIframe(id, url);
                        }}
                        onRefresh={() => {
                            const id = activeId();
                            if (!id) return;
                            const tab = tabStore.tabs.find(t => t.id === id);
                            if (!tab) return;
                            const iframe = iframeMap.get(id);
                            if (!iframe) return;
                            tabManager.updateTab(id, { isLoading: true });
                            if (isInternalUrl(tab.url)) {
                                iframe.src = tab.url;
                            } else {
                                bar.emit("submit", iframe, tab.url);
                            }
                        }}
                    />
                    <ExtensionIconBar />
                    <button
                        type="button"
                        class={s.extensionsBtn}
                        title="Extensions"
                        onClick={openExtensions}
                    >
                        <IconPuzzle size={15} />
                    </button>
                    <button
                        type="button"
                        class={s.extensionsBtn}
                        title="Settings"
                        onClick={openSettings}
                    >
                        <IconSliders size={15} />
                    </button>
                </div>

                <Show when={showBookmarksBar()}>
                    <BookmarksBar
                        activeUrl={activeUrl()}
                        activeTitle={activeTab()?.title ?? ""}
                        activeFavicon={activeTab()?.favicon}
                        onNavigate={url => {
                            const id = activeId();
                            if (id) navigate(id, url);
                        }}
                    />
                </Show>
            </div>

            <div class={s.browserViewport}>
                {/*
                 * Keyed by tab id, unlike the lists around it: a frame is a
                 * live page that has to stay with its tab. Keyed by index,
                 * closing a tab handed its frame to the tab on its right,
                 * which then showed the closed page.
                 */}
                <For each={iframeIds()}>
                    {id => (
                        <iframe
                            title="Proxied browser-in-browser webpage"
                            class={[
                                s.browserFrame,
                                { [s.browserFrameActive]: id === activeId() },
                            ]}
                            ref={el => registerIframe(id, el)}
                        />
                    )}
                </For>
                <Show when={tabStore.tabs.length === 0}>
                    <div class={s.browserEmpty}>
                        <Specimen icon={IconWorld} size={64} />
                        <p>No tabs open</p>
                        <button
                            type="button"
                            class={s.browserEmptyButton}

                            onClick={() => {
                                const t =
                                    tabManager.createTab("browser:newtab");
                                tabManager.activateTab(t.id);
                            }}
                        >
                            Open a tab
                        </button>
                    </div>
                </Show>
                <Show when={chiiOpen() && activeIframe()}>
                    <ChiiPanel
                        targetIframe={activeIframe()!}
                        onClose={() => {
                            cleanupActiveChii();
                            setChiiOpen(false);
                        }}
                        onDetach={url => {
                            cleanupActiveChii();
                            window.open(url, "_blank", "width=1000,height=700");
                            setChiiOpen(false);
                        }}
                    />
                </Show>
            </div>

            <Show when={showSearch()}>
                <TabSearch
                    tabs={tabStore.tabs}
                    activeId={activeId()}
                    onActivate={tabId => {
                        tabManager.activateTab(tabId);
                    }}
                    onClose={() => setShowSearch(false)}
                />
            </Show>
        </div>
    );
}
