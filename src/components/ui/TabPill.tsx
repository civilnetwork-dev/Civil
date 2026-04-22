/** biome-ignore-all lint/a11y/noStaticElementInteractions: it's just a tab pill lil bro */
import { CgSpinner } from "solid-icons/cg";
import { TbOutlineWorld, TbOutlineX } from "solid-icons/tb";
import { onMount, Show } from "solid-js";
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

    onMount(() => {
        registerTabDraggable(el, props.tab.id, props.getStrip, {
            setDraggingId: props.setDraggingId,
        });
        registerTabDropTarget(el, props.tab.id, {
            getTabs: props.getTabs,
            onReorder: props.onReorder,
        });
    });

    return (
        // biome-ignore lint/a11y/useKeyWithClickEvents: it's just a tab pill lil bro
        <div
            ref={el}
            class={s.tab}
            classList={{
                [s.tabActive]: props.active,
                [s.tabDragging]: props.isDragging,
            }}
            style={{ width: `${props.width}px` }}
            onClick={() => tabManager.activateTab(props.tab.id)}
        >
            <Show when={props.tab.favicon}>
                <img class={s.tabFavicon} src={props.tab.favicon} alt="" />
            </Show>
            <Show when={!props.tab.favicon}>
                <span class={s.tabIcon}>
                    <Show
                        when={props.tab.isLoading}
                        fallback={<TbOutlineWorld size={13} />}
                    >
                        <CgSpinner size={13} class={s.spin} />
                    </Show>
                </span>
            </Show>
            <span class={s.tabTitle}>{props.tab.title}</span>
            <button
                type="button"
                class={s.tabClose}
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
