// biome-ignore-all lint/a11y/noStaticElementInteractions: biome breaking my project lmao
// biome-ignore-all lint/a11y/useKeyWithClickEvents: biome breaking my project lmao
import {
    createContext,
    createSignal,
    For,
    type JSX,
    onCleanup,
    onMount,
    type ParentComponent,
    Show,
    useContext,
} from "solid-js";
import { Portal } from "solid-js/web";
import * as s from "~/styles/ContextMenu.css";

export interface ContextMenuItem {
    type?: "item" | "separator" | "submenu";
    label?: string;
    icon?: JSX.Element;
    shortcut?: string;
    danger?: boolean;
    disabled?: boolean;
    action?: () => void;
    children?: ContextMenuItem[];
}

interface MenuState {
    x: number;
    y: number;
    items: ContextMenuItem[];
}

interface ContextMenuContextValue {
    open: (e: MouseEvent, items: ContextMenuItem[]) => void;
    close: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextValue>({
    open: () => {},
    close: () => {},
});

export function useContextMenu() {
    return useContext(ContextMenuContext);
}

function clampPos(x: number, y: number, w: number, h: number) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
        x: x + w > vw ? Math.max(0, vw - w - 6) : x,
        y: y + h > vh ? Math.max(0, vh - h - 6) : y,
    };
}

function blockIframes(): () => void {
    const iframes = Array.from(
        document.querySelectorAll<HTMLIFrameElement>("iframe"),
    );
    const prev = iframes.map(f => f.style.pointerEvents);
    iframes.forEach(f => {
        f.style.pointerEvents = "none";
    });
    return () => {
        iframes.forEach((f, i) => {
            f.style.pointerEvents = prev[i];
        });
    };
}

function RenderItem(props: { item: ContextMenuItem }) {
    const ctx = useContextMenu();

    if (props.item.type === "separator") {
        return <div class={s.separator} />;
    }

    if (props.item.type === "submenu" && props.item.children) {
        return (
            <div class={s.subMenuWrap}>
                <div
                    class={`${s.menuItem}${props.item.danger ? ` ${s.menuItemDanger}` : ""}`}
                    style={
                        props.item.disabled
                            ? { opacity: "0.4", "pointer-events": "none" }
                            : {}
                    }
                >
                    <Show when={props.item.icon}>
                        <span class={s.menuItemIcon}>{props.item.icon}</span>
                    </Show>
                    <span class={s.menuItemLabel}>{props.item.label}</span>
                    <span class={s.subMenuArrow}>›</span>
                </div>
                <div class={s.subMenu}>
                    <For each={props.item.children}>
                        {child => <RenderItem item={child} />}
                    </For>
                </div>
            </div>
        );
    }

    return (
        <div
            class={`${s.menuItem}${props.item.danger ? ` ${s.menuItemDanger}` : ""}`}
            style={
                props.item.disabled
                    ? { opacity: "0.4", "pointer-events": "none" }
                    : {}
            }
            onMouseDown={e => e.stopPropagation()}
            onClick={() => {
                if (props.item.disabled) return;
                props.item.action?.();
                ctx.close();
            }}
        >
            <Show when={props.item.icon}>
                <span class={s.menuItemIcon}>{props.item.icon}</span>
            </Show>
            <span class={s.menuItemLabel}>{props.item.label}</span>
            <Show when={props.item.shortcut}>
                <span class={s.menuItemShortcut}>{props.item.shortcut}</span>
            </Show>
        </div>
    );
}

function ContextMenuPopup(props: { state: MenuState; onClose: () => void }) {
    let menuRef: HTMLDivElement | undefined;
    const [pos, setPos] = createSignal({ x: props.state.x, y: props.state.y });

    onMount(() => {
        if (menuRef) {
            const rect = menuRef.getBoundingClientRect();
            setPos(
                clampPos(props.state.x, props.state.y, rect.width, rect.height),
            );
        }

        const restoreIframes = blockIframes();

        const onPointerDown = (e: PointerEvent) => {
            if (menuRef && !menuRef.contains(e.target as Node)) {
                props.onClose();
            }
        };

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") props.onClose();
        };

        const onScroll = () => props.onClose();

        document.addEventListener("pointerdown", onPointerDown, {
            capture: true,
        });
        document.addEventListener("keydown", onKey);
        window.addEventListener("scroll", onScroll, {
            capture: true,
            passive: true,
        });

        onCleanup(() => {
            restoreIframes();
            document.removeEventListener("pointerdown", onPointerDown, {
                capture: true,
            });
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("scroll", onScroll, { capture: true });
        });
    });

    return (
        <Portal>
            <div
                class={s.iframeCover}
                onMouseDown={() => props.onClose()}
                onContextMenu={e => {
                    e.preventDefault();
                    props.onClose();
                }}
            />
            <div
                ref={menuRef}
                class={s.menu}
                style={{ left: `${pos().x}px`, top: `${pos().y}px` }}
                onContextMenu={e => e.preventDefault()}
            >
                <For each={props.state.items}>
                    {item => <RenderItem item={item} />}
                </For>
            </div>
        </Portal>
    );
}

export const ContextMenuProvider: ParentComponent = props => {
    const [state, setState] = createSignal<MenuState | null>(null);

    const open = (e: MouseEvent, items: ContextMenuItem[]) => {
        e.preventDefault();
        setState({ x: e.clientX, y: e.clientY, items });
    };

    const close = () => setState(null);

    return (
        <ContextMenuContext.Provider value={{ open, close }}>
            {props.children}
            <Show when={state()}>
                {st => <ContextMenuPopup state={st()} onClose={close} />}
            </Show>
        </ContextMenuContext.Provider>
    );
};
