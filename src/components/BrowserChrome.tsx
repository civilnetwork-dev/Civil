import { TbOutlinePlus, TbOutlinePuzzle, TbOutlineWorld } from "solid-icons/tb";
import {
    createMemo,
    createSignal,
    createStore,
    For,
    onCleanup,
    onSettled,
    Show,
} from "solid-js";
import BookmarksBar from "~/components/BookmarksBar";
import { ChiiPanel } from "~/components/ChiiPanel";
import { useContextMenu } from "~/components/ContextMenu";
import ExtensionIconBar from "~/components/ExtensionIconBar";
import TabSearch from "~/components/TabSearch";
import { TabPill } from "~/components/ui/TabPill";
import { UrlBar } from "~/components/ui/UrlBar";
import {
    createTabHistory,
    loadSession,
    saveSession,
} from "~/lib/browserHelpers";
import searchBar from "~/lib/SearchBar";
import {
    isInternalUrl,
    isNewtabUrl,
    type Tab,
    tabManager,
} from "~/lib/TabManager";
import {
    cleanupChiiArtifacts,
    createIframeManager,
} from "~/lib/useIframeManager";
import { registerTabMonitor } from "~/lib/useTabDrag";

import * as s from "~/styles/BrowserChrome.css";

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

    const { getHistory, pushHistory, canBack, canForward } = createTabHistory();
    const { iframeMap, navigateIframe, navigate, registerIframe } =
        createIframeManager(bar, pushHistory);

    let tabStripRef: HTMLDivElement | undefined;
    let browserRootRef: HTMLDivElement | undefined;

    const TAB_MIN = 60,
        TAB_MAX = 220,
        NEW_BTN_W = 40;
    const tabWidth = createMemo(() => {
        const n = tabStore.tabs.length;
        if (!n) return TAB_MAX;
        return Math.min(
            TAB_MAX,
            Math.max(TAB_MIN, (tabBarWidth() - NEW_BTN_W - 8) / n),
        );
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

    const persist = () => saveSession(tabStore.tabs, activeId());

    const onTabAdded = (tab: Tab) => {
        setTabStore(s => {
            s.tabs = [...s.tabs, tab];
        });
        setIframeIds(ids => [...ids, tab.id]);
        persist();
    };
    const onTabRemoved = (id: string) => {
        setTabStore(s => {
            s.tabs = s.tabs.filter(t => t.id !== id);
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
        setTabStore(s => {
            s.tabs = s.tabs.map(t =>
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
        setTabStore(s => {
            const arr = [...s.tabs];
            const from = arr.findIndex(t => t.id === id);
            if (from === -1 || from === toIndex) return;
            const [tab] = arr.splice(from, 1);
            arr.splice(toIndex, 0, tab);
            s.tabs = arr;
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

        registerTabMonitor({ setDraggingId });

        const session = loadSession();
        if (session) {
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
            const t = tabManager.createTab("browser:newtab");
            tabManager.activateTab(t.id);
        }

        const onBrowserNavigate = (e: Event) => {
            const { tabId, url } = (
                e as CustomEvent<{ tabId: string; url: string }>
            ).detail;
            navigateIframe(tabId, url);
        };
        document.addEventListener("browser:navigate", onBrowserNavigate);

        const onGlobalKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setShowSearch(v => !v);
            }
        };
        window.addEventListener("keydown", onGlobalKey);

        return () => {
            document.removeEventListener("browser:navigate", onBrowserNavigate);
            window.removeEventListener("keydown", onGlobalKey);
        };
    });

    const openExtensions = () => {
        const id = activeId();
        if (id) navigate(id, "browser:extensions");
    };

    const handleReorder = (tabId: string, newIndex: number) => {
        tabManager.moveTab(tabId, newIndex);
    };

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: biome breaking my project lmao
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
                        icon: <TbOutlinePlus size={14} />,
                        action: () => {
                            const t = tabManager.createTab("browser:newtab");
                            tabManager.activateTab(t.id);
                        },
                    },
                    { type: "separator" },
                    {
                        label: "Extensions",
                        icon: <TbOutlinePuzzle size={14} />,
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
                <div class={s.browserTabstrip} ref={tabStripRef}>
                    <For each={tabStore.tabs}>
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
                        <TbOutlinePlus size={15} />
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
                            if (!id) return;
                            const h = getHistory(id);
                            if (h.cursor > 0) {
                                h.cursor--;
                                navigateIframe(id, h.stack[h.cursor]);
                            }
                        }}
                        onForward={() => {
                            const id = activeId();
                            if (!id) return;
                            const h = getHistory(id);
                            if (h.cursor < h.stack.length - 1) {
                                h.cursor++;
                                navigateIframe(id, h.stack[h.cursor]);
                            }
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
                        <TbOutlinePuzzle size={15} />
                    </button>
                </div>

                <BookmarksBar
                    activeUrl={activeUrl()}
                    activeTitle={activeTab()?.title ?? ""}
                    activeFavicon={activeTab()?.favicon}
                    onNavigate={url => {
                        const id = activeId();
                        if (id) navigate(id, url);
                    }}
                />
            </div>

            <div class={s.browserViewport}>
                <For each={iframeIds()}>
                    {id => (
                        <iframe
                            title="Proxied browser-in-browser webpage"
                            class={[
                                s.browserFrame,
                                { [s.browserFrameActive]: id() === activeId() },
                            ]}
                            ref={el => registerIframe(id(), el)}
                        />
                    )}
                </For>
                <Show when={tabStore.tabs.length === 0}>
                    <div class={s.browserEmpty}>
                        <TbOutlineWorld size={40} class={s.browserEmptyIcon} />
                        <p>No tabs open</p>
                        <button
                            type="button"
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
