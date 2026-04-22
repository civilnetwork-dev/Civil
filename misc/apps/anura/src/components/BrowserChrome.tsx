import { BiRegularLeftArrowAlt, BiRegularRightArrowAlt } from "solid-icons/bi";
import { CgSpinner } from "solid-icons/cg";
import {
    TbOutlineArrowRight,
    TbOutlineLock,
    TbOutlinePlus,
    TbOutlineRefresh,
    TbOutlineWorld,
    TbOutlineX,
} from "solid-icons/tb";
import {
    batch,
    createMemo,
    createSignal,
    For,
    onCleanup,
    onMount,
    Show,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import searchBar from "#lib/SearchBar";
import {
    BROWSER_URLS,
    isInternalUrl,
    isNewtabUrl,
    resolveUrl,
    type Tab,
    tabManager,
} from "#lib/TabManager";

import "@catppuccin/palette/css/catppuccin.css";
import "#styles/BrowserChrome.css";

const topWin = top as any;
const anura: Anura | undefined = topWin?.anura;

function displayUrl(raw: string): string {
    try {
        const u = new URL(raw);
        return u.hostname + u.pathname + u.search;
    } catch {
        return raw;
    }
}

function TabPill(props: {
    tab: Tab;
    active: boolean;
    width: number;
    isDragging: boolean;
    onClose: (e: MouseEvent) => void;
    onPointerDown: (e: PointerEvent) => void;
}) {
    return (
        <div
            class="tab"
            classList={{
                "tab--active": props.active,
                "tab--dragging": props.isDragging,
            }}
            style={{ width: `${props.width}px` }}
            onPointerDown={props.onPointerDown}
        >
            <Show when={props.tab.favicon}>
                <img class="tab--favicon" src={props.tab.favicon} alt="" />
            </Show>
            <Show when={!props.tab.favicon}>
                <span class="tab--icon">
                    <Show
                        when={props.tab.isLoading}
                        fallback={<TbOutlineWorld size={13} />}
                    >
                        <CgSpinner size={13} class="spin" />
                    </Show>
                </span>
            </Show>
            <span class="tab--title">{props.tab.title}</span>
            <button
                class="tab--close"
                title="Close tab"
                onClick={e => {
                    e.stopPropagation();
                    props.onClose(e);
                }}
            >
                <TbOutlineX size={12} />
            </button>
        </div>
    );
}

const isProbablyUrl = (v: string): boolean => {
    try {
        new URL(v);
        return true;
    } catch {}
    return /^[\w-]+\.[a-z]{2,}/i.test(v);
};

function UrlBar(props: {
    value: string;
    canBack: boolean;
    canForward: boolean;
    isNewtab: boolean;
    onNavigate: (url: string) => void;
    onBack: () => void;
    onForward: () => void;
    onRefresh: () => void;
}) {
    const [editing, setEditing] = createSignal(false);
    const [draft, setDraft] = createSignal("");
    let inputRef: HTMLInputElement | undefined;

    const display = () =>
        editing() ? draft() : props.isNewtab ? "" : displayUrl(props.value);

    const commit = (value = draft()) => {
        const v = value.trim();
        if (!v) {
            setEditing(false);
            return;
        }
        setEditing(false);
        const resolved = resolveUrl(v);
        props.onNavigate(resolved !== v ? resolved : v);
    };

    return (
        <div class="urlbar">
            <button
                class="urlbar--nav-btn"
                classList={{ "urlbar--nav-btn--dim": !props.canBack }}
                title="Back"
                disabled={!props.canBack}
                onClick={props.onBack}
            >
                <BiRegularLeftArrowAlt size={17} />
            </button>
            <button
                class="urlbar--nav-btn"
                classList={{ "urlbar--nav-btn--dim": !props.canForward }}
                title="Forward"
                disabled={!props.canForward}
                onClick={props.onForward}
            >
                <BiRegularRightArrowAlt size={17} />
            </button>
            <button
                class="urlbar--nav-btn"
                title="Reload"
                onClick={props.onRefresh}
            >
                <TbOutlineRefresh size={17} />
            </button>

            <div class="urlbar--omnibox-wrap">
                <div
                    class="urlbar--omnibox"
                    classList={{
                        "urlbar--omnibox--focus": editing(),
                    }}
                >
                    <Show when={!props.isNewtab && !editing()}>
                        <span class="urlbar--lock">
                            <TbOutlineLock size={12} />
                        </span>
                    </Show>
                    <input
                        ref={inputRef}
                        class="urlbar--input"
                        type="text"
                        value={display()}
                        placeholder={
                            props.isNewtab || editing()
                                ? "Search or enter address"
                                : ""
                        }
                        onFocus={e => {
                            setEditing(true);
                            setDraft(props.isNewtab ? "" : props.value);
                            e.target.select();
                        }}
                        onInput={e => setDraft(e.target.value)}
                        onBlur={() => setEditing(false)}
                        onKeyDown={e => {
                            if (e.key === "Enter") commit();
                            if (e.key === "Escape") {
                                setEditing(false);
                                inputRef?.blur();
                            }
                        }}
                        spellcheck={false}
                        autocomplete="off"
                    />
                    <button
                        class="urlbar--go-btn"
                        title="Go"
                        onClick={() => commit()}
                        onMouseDown={e => e.preventDefault()}
                    >
                        <TbOutlineArrowRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function BrowserChrome() {
    const bar = searchBar();

    const [tabStore, setTabStore] = createStore<{ tabs: Tab[] }>({ tabs: [] });
    const [activeId, setActiveId] = createSignal<string | null>(null);
    const [tabBarWidth, setTabBarWidth] = createSignal(600);
    const [draggingId, setDraggingId] = createSignal<string | null>(null);
    const [iframeIds, setIframeIds] = createSignal<string[]>([]);

    const STORAGE_KEY = "anura-browser-session";
    const saveSession = () => {
        try {
            const tabs = tabStore.tabs.map(t => {
                const browserKey = Object.entries(BROWSER_URLS).find(
                    ([, v]) => v === t.url,
                )?.[0];
                return {
                    url: browserKey ?? t.url,
                    title: t.title,
                    favicon: t.favicon,
                };
            });
            const active = activeId();
            const activeIndex = active
                ? tabStore.tabs.findIndex(t => t.id === active)
                : 0;
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ tabs, activeIndex }),
            );
        } catch {}
    };

    const iframeMap = new Map<string, HTMLIFrameElement>();
    const historyMap = new Map<string, { stack: string[]; cursor: number }>();

    const getHistory = (id: string) => {
        if (!historyMap.has(id)) historyMap.set(id, { stack: [], cursor: -1 });
        return historyMap.get(id)!;
    };
    const pushHistory = (id: string, url: string) => {
        const h = getHistory(id);
        h.stack = h.stack.slice(0, h.cursor + 1);
        h.stack.push(url);
        h.cursor = h.stack.length - 1;
    };

    const canBack = () => {
        const id = activeId();
        return id ? getHistory(id).cursor > 0 : false;
    };
    const canForward = () => {
        const id = activeId();
        if (!id) return false;
        const h = getHistory(id);
        return h.cursor < h.stack.length - 1;
    };

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

    let tabStripRef: HTMLDivElement | undefined;
    let browserRootRef: HTMLDivElement | undefined;
    const ro = new ResizeObserver(entries => {
        for (const e of entries) setTabBarWidth(e.contentRect.width);
    });

    tabManager.on("tabAdded", tab => {
        setTabStore("tabs", t => [...t, tab]);
        setIframeIds(ids => [...ids, tab.id]);
        saveSession();
    });
    tabManager.on("tabRemoved", id =>
        batch(() => {
            setTabStore("tabs", t => t.filter(tab => tab.id !== id));
            setIframeIds(ids => ids.filter(i => i !== id));
            setActiveId(tabManager.activeId);
            iframeMap.delete(id);
            historyMap.delete(id);
            saveSession();
        }),
    );
    tabManager.on("tabActivated", id => {
        setActiveId(id);
        saveSession();
    });
    tabManager.on("tabUpdated", upd => {
        setTabStore(
            "tabs",
            t => t.id === upd.id,
            produce(t => {
                t.title = upd.title;
                t.url = upd.url;
                t.isLoading = upd.isLoading;
                t.favicon = upd.favicon;
            }),
        );
        saveSession();
    });
    tabManager.on("tabMoved", (id, toIndex) => {
        setTabStore(
            "tabs",
            produce(tabs => {
                const from = tabs.findIndex(t => t.id === id);
                if (from === -1 || from === toIndex) return;
                const [tab] = tabs.splice(from, 1);
                tabs.splice(toIndex, 0, tab);
            }),
        );
        saveSession();
    });

    const normalizeNav = (term: string): string => {
        try {
            new URL(term);
            return term;
        } catch {}
        if (/^[\w-]+\.[a-z]{2,}/i.test(term)) return `https://${term}`;
        return term;
    };

    const handleNonHttpUrl = (url: string) => {
        if (!anura) return;
        if (url.startsWith("http://") || url.startsWith("https://")) return;
        if (url.startsWith("about:") || url.startsWith("browser:")) return;
        if (url.endsWith(".html")) return;

        anura.dialog
            .confirm(`This website wants to open ${url}`)
            .then((confirmed: boolean) => {
                if (confirmed) anura.uri.handle(url);
            });
    };

    const navigateIframe = (id: string, url: string) => {
        const iframe = iframeMap.get(id);
        if (!iframe) return;

        handleNonHttpUrl(url);

        pushHistory(id, url);
        tabManager.updateTab(id, {
            url,
            isLoading: true,
            title: "Loading\u2026",
        });

        if (isInternalUrl(url)) {
            iframe.src = url;
        } else {
            bar.emit("submit", iframe, normalizeNav(url));
        }
    };
    const navigate = (id: string, url: string) =>
        navigateIframe(id, resolveUrl(url));
    const activeUrl = () =>
        tabStore.tabs.find(t => t.id === activeId())?.url ?? "";
    const activeTabIsNewtab = createMemo(() => isNewtabUrl(activeUrl()));

    const registerIframe = (id: string, el: HTMLIFrameElement) => {
        iframeMap.set(id, el);
        el.addEventListener("load", () => {
            let href: string | undefined;
            try {
                href = el.contentWindow?.location.href;
            } catch {}
            if (!href || href === "about:blank") return;
            try {
                const docTitle = el.contentDocument?.title;
                const favicon =
                    el.contentDocument?.querySelector<HTMLLinkElement>(
                        'link[rel*="icon"]',
                    )?.href;
                tabManager.updateTab(id, {
                    isLoading: false,
                    title:
                        docTitle ||
                        displayUrl(
                            tabManager.tabs.find(t => t.id === id)?.url ?? "",
                        ) ||
                        "Untitled",
                    favicon,
                });
            } catch {
                tabManager.updateTab(id, { isLoading: false });
            }
        });
        const tab = tabManager.tabs.find(t => t.id === id);
        if (tab?.url) {
            pushHistory(id, tab.url);
            if (isInternalUrl(tab.url)) {
                el.src = tab.url;
            } else {
                bar.ready.then(() =>
                    bar.emit("submit", el, normalizeNav(tab.url)),
                );
            }
        }
    };

    const startDrag = (tabId: string, e: PointerEvent) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest(".tab--close")) return;

        const strip = tabStripRef;
        const root = browserRootRef;
        if (!strip || !root) return;

        const tabEl = e.currentTarget as HTMLElement;
        const tabRect = tabEl.getBoundingClientRect();
        const stripRect = strip.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const offsetX = e.clientX - tabRect.left;

        const tabEls = Array.from(strip.querySelectorAll<HTMLElement>(".tab"));
        const initialRects = tabEls.map(el => el.getBoundingClientRect());
        const dragIdx = tabStore.tabs.findIndex(t => t.id === tabId);

        const nonDragCenters: number[] = [];
        for (let i = 0; i < initialRects.length; i++) {
            if (i === dragIdx) continue;
            nonDragCenters.push(
                initialRects[i].left + initialRects[i].width / 2,
            );
        }

        let clone: HTMLDivElement | null = null;
        let dragging = false;
        let currentTargetIdx = dragIdx;
        const THRESHOLD = 3;

        const applyShifts = (targetIdx: number) => {
            const w = tabRect.width;
            tabEls.forEach((el, i) => {
                if (i === dragIdx) return;
                let shift = 0;
                if (targetIdx > dragIdx && i > dragIdx && i <= targetIdx) {
                    shift = -w;
                } else if (
                    targetIdx < dragIdx &&
                    i >= targetIdx &&
                    i < dragIdx
                ) {
                    shift = w;
                }
                el.style.transition = "transform 0.15s ease";
                el.style.transform = shift ? `translateX(${shift}px)` : "";
            });
        };

        const onMove = (me: PointerEvent) => {
            const dx = me.clientX - startX;
            const dy = me.clientY - startY;
            if (!dragging && Math.sqrt(dx * dx + dy * dy) < THRESHOLD) return;

            if (!dragging) {
                dragging = true;
                setDraggingId(tabId);
                tabManager.activateTab(tabId);
                clone = tabEl.cloneNode(true) as HTMLDivElement;
                clone.style.cssText = `position:fixed;top:${tabRect.top}px;left:${tabRect.left}px;width:${tabRect.width}px;height:${tabRect.height}px;margin:0;z-index:9999;pointer-events:none;transform-origin:center;`;
                clone.classList.remove("tab--active", "tab--dragging");
                clone.classList.add("tab--drag-clone");
                root.appendChild(clone);
            }

            if (!clone) return;
            const rawLeft = me.clientX - offsetX;
            const clampedLeft = Math.max(
                stripRect.left,
                Math.min(stripRect.right - tabRect.width, rawLeft),
            );
            clone.style.transform = `translateX(${clampedLeft - tabRect.left}px) scale(1.02)`;

            const centerX = clampedLeft + tabRect.width / 2;
            let targetIdx = 0;
            for (const mid of nonDragCenters) {
                if (centerX > mid) targetIdx++;
            }
            if (targetIdx >= dragIdx) targetIdx++;

            if (targetIdx !== currentTargetIdx) {
                currentTargetIdx = targetIdx;
                applyShifts(targetIdx);
            }
        };

        const onUp = () => {
            document.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerup", onUp);
            document.removeEventListener("pointercancel", onUp);

            tabEls.forEach(el => {
                el.style.transform = "";
                el.style.transition = "";
            });

            if (clone) {
                clone.remove();
                clone = null;
            }
            if (dragging && currentTargetIdx !== dragIdx) {
                tabManager.moveTab(tabId, currentTargetIdx);
            }
            if (!dragging) {
                tabManager.activateTab(tabId);
            }
            setDraggingId(null);
            dragging = false;
        };

        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
        document.addEventListener("pointercancel", onUp);
    };

    onMount(() => {
        if (tabStripRef) ro.observe(tabStripRef);

        let restored = false;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const session = JSON.parse(raw);
                if (Array.isArray(session.tabs) && session.tabs.length > 0) {
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
                    restored = true;
                }
            }
        } catch {}

        if (!restored) {
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
        onCleanup(() =>
            document.removeEventListener("browser:navigate", onBrowserNavigate),
        );
    });
    onCleanup(() => ro.disconnect());

    return (
        <div class="browser" ref={browserRootRef}>
            <div class="browser--chrome">
                <div class="browser--tabstrip" ref={tabStripRef}>
                    <For each={tabStore.tabs}>
                        {tab => (
                            <TabPill
                                tab={tab}
                                active={tab.id === activeId()}
                                width={tabWidth()}
                                isDragging={tab.id === draggingId()}
                                onClose={() => tabManager.removeTab(tab.id)}
                                onPointerDown={e => startDrag(tab.id, e)}
                            />
                        )}
                    </For>
                    <button
                        class="tab-new"
                        title="New tab"
                        onClick={() => {
                            const t = tabManager.createTab("browser:newtab");
                            tabManager.activateTab(t.id);
                        }}
                    >
                        <TbOutlinePlus size={15} />
                    </button>
                </div>

                <UrlBar
                    value={activeUrl()}
                    canBack={canBack()}
                    canForward={canForward()}
                    isNewtab={activeTabIsNewtab()}
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
            </div>

            <div class="browser--viewport">
                <For each={iframeIds()}>
                    {id => (
                        <iframe
                            title="Proxied browser-in-browser webpage"
                            class="browser--frame"
                            classList={{
                                "browser--frame--active": id === activeId(),
                            }}
                            ref={el => registerIframe(id, el)}
                        />
                    )}
                </For>
                <Show when={tabStore.tabs.length === 0}>
                    <div class="browser--empty">
                        <TbOutlineWorld size={40} class="browser--empty-icon" />
                        <p>No tabs open</p>
                        <button
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
            </div>
        </div>
    );
}
