/** biome-ignore-all lint/a11y/noStaticElementInteractions: it's just a tab pill lil bro */
import { CgSpinner } from "solid-icons/cg";
import { TbOutlineWorld, TbOutlineX } from "solid-icons/tb";
import { onSettled, Show } from "solid-js";
import type { Tab } from "~/lib/TabManager";
import { tabManager } from "~/lib/TabManager";
import { registerTabDraggable, registerTabDropTarget } from "~/lib/useTabDrag";
import * as s from "~/styles/BrowserChrome.css";

interface TabPillProps {
    tab: Tab;
    active: boolean;
    width: number;
    isDragging: boolean;
    onClose: (e: MouseEvent) => void;
    setDraggingId: (id: string | null) => void;
    getTabs: () => readonly Tab[];
    getStrip: () => HTMLDivElement | undefined;
    onReorder: (tabId: string, newIndex: number) => void;
}

export function TabPill(props: TabPillProps) {
    let el!: HTMLDivElement;

    onSettled(() => {
        registerTabDraggable(el, props.tab.id, props.getStrip, {
            setDraggingId: props.setDraggingId,
        });
        registerTabDropTarget(el, props.tab.id, {
            getTabs: props.getTabs,
            onReorder: props.onReorder,
        });
    });

    return (
        <div
            ref={el}
            tabindex={0}
            class={[
                s.tab,
                {
                    [s.tabActive]: props.active,
                    [s.tabDragging]: props.isDragging,
                },
            ]}
            style={{ width: `${props.width}px` }}
            onClick={() => tabManager.activateTab(props.tab.id)}
            onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    tabManager.activateTab(props.tab.id);
                }
            }}
        >
            <Show when={props.tab.favicon}>
                <img class={s.tabFavicon} src={props.tab.favicon} alt="" />
            </Show>
            <Show when={!props.tab.favicon}>
                <span class={[s.tabIcon, { [s.tabIconActive]: props.active }]}>
                    <Show
                        when={props.tab.isLoading}
                        fallback={<TbOutlineWorld size={13} />}
                    >
                        <CgSpinner size={13} class={s.spin} />
                    </Show>
                </span>
            </Show>
            {/* Below ~110px the title is down to a character or two of noise
                and the close button crowds it. Drop both and let the tab be
                its favicon, the way desktop browsers do at this density; the
                active tab keeps its close button so the current page can
                always be closed without widening the strip first. */}
            <Show when={props.width >= 110}>
                <span
                    class={[s.tabTitle, { [s.tabTitleActive]: props.active }]}
                >
                    {props.tab.title}
                </span>
            </Show>
            <Show when={props.width >= 110 || props.active}>
                <button
                    type="button"
                    class={[s.tabClose, { [s.tabCloseActive]: props.active }]}
                    title="Close tab"
                    onClick={e => {
                        e.stopPropagation();
                        props.onClose(e);
                    }}
                >
                    <TbOutlineX size={12} />
                </button>
            </Show>
        </div>
    );
}
