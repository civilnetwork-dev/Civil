import {
    draggable,
    dropTargetForElements,
    monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { disableNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview";
import { preventUnhandled } from "@atlaskit/pragmatic-drag-and-drop/prevent-unhandled";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";
import { onCleanup } from "solid-js";
import type { Tab } from "~/lib/TabManager";

export { reorder };

const TAB_DATA_KEY = "civil-tab-id";

function getTabData(tabId: string): Record<string, unknown> {
    return { [TAB_DATA_KEY]: tabId };
}

function extractTabId(data: Record<string, unknown>): string | null {
    const id = data[TAB_DATA_KEY];
    return typeof id === "string" ? id : null;
}

const DROP_OVER_ATTR = "data-tab-drop-over";

function setDropOver(el: HTMLElement | null, on: boolean) {
    if (!on) {
        el?.removeAttribute(DROP_OVER_ATTR);
    } else {
        el?.setAttribute(DROP_OVER_ATTR, "true");
    }
}

let floatingClone: HTMLDivElement | null = null;
let stripRef: HTMLDivElement | null = null;
let cloneOffsetX = 0;
// biome-ignore lint/correctness/noUnusedVariables: it's used in a place biome can't see
// biome-ignore lint/style/useConst: it is assigned it's just biome can't see it lol
let cloneOffsetY = 0;

function createFloatingClone(
    sourceEl: HTMLElement,
    strip: HTMLDivElement,
    pointerX: number,
    _pointerY: number,
) {
    destroyFloatingClone();

    stripRef = strip;
    const rect = sourceEl.getBoundingClientRect();
    cloneOffsetX = pointerX - rect.left;

    const clone = sourceEl.cloneNode(true) as HTMLDivElement;
    const stripRect = strip.getBoundingClientRect();

    const cloneTop = stripRect.bottom - rect.height;

    const clampedLeft = clampX(pointerX - cloneOffsetX, rect.width, stripRect);

    Object.assign(clone.style, {
        position: "fixed",
        top: `${cloneTop}px`,
        left: `${clampedLeft}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: "0",
        zIndex: "99999",
        pointerEvents: "none",
        willChange: "left",
        opacity: "0.96",
        boxShadow:
            "0 -2px 12px rgba(0,0,0,0.35), 0 8px 28px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
        borderRadius: "10px 10px 0 0",
        transform: "scale(1.04)",
        transformOrigin: "bottom center",
        transition: "transform 0.08s ease, box-shadow 0.08s ease",
    });

    document.body.appendChild(clone);
    floatingClone = clone;
}

function clampX(rawLeft: number, tabWidth: number, stripRect: DOMRect): number {
    const min = stripRect.left;
    const max = stripRect.right - tabWidth;
    return Math.max(min, Math.min(max, rawLeft));
}

function moveFloatingClone(pointerX: number) {
    if (!floatingClone || !stripRef) return;
    const stripRect = stripRef.getBoundingClientRect();
    const tabWidth = floatingClone.getBoundingClientRect().width;
    const rawLeft = pointerX - cloneOffsetX;
    const clampedLeft = clampX(rawLeft, tabWidth, stripRect);
    floatingClone.style.left = `${clampedLeft}px`;
}

function destroyFloatingClone() {
    floatingClone?.remove();
    floatingClone = null;
    stripRef = null;
}

export interface TabDragOptions {
    getTabs: () => readonly Tab[];
    setDraggingId: (id: string | null) => void;
    onReorder: (tabId: string, newIndex: number) => void;
}

/**
 * Register draggable behaviour on a single tab element.
 *
 * - Native ghost is suppressed; a custom fixed-position clone tracks the pointer
 *   and is clamped to the tab strip bounds.
 * - `onDragStart` fires after ghost capture, so dimming here doesn't affect the
 *   (now-hidden) native ghost.
 */
export function registerTabDraggable(
    el: HTMLElement,
    tabId: string,
    getStrip: () => HTMLDivElement | undefined,
    opts: Pick<TabDragOptions, "setDraggingId">,
) {
    const cleanup = draggable({
        element: el,
        getInitialData: () => getTabData(tabId),

        onGenerateDragPreview: ({ nativeSetDragImage }) => {
            disableNativeDragPreview({ nativeSetDragImage });
            preventUnhandled.start();
        },

        onDragStart: ({ location }) => {
            const strip = getStrip();
            if (strip) {
                createFloatingClone(
                    el,
                    strip,
                    location.current.input.clientX,
                    location.current.input.clientY,
                );
            }
            opts.setDraggingId(tabId);
        },

        onDrop: () => {
            preventUnhandled.stop();
            destroyFloatingClone();
            opts.setDraggingId(null);
        },
    });
    onCleanup(cleanup);
}

/**
 * Register a drop target on a tab element.
 * Shows a drop-over highlight while dragging over.
 */
export function registerTabDropTarget(
    el: HTMLElement,
    tabId: string,
    opts: Pick<TabDragOptions, "getTabs" | "onReorder">,
) {
    const cleanup = dropTargetForElements({
        element: el,
        canDrop: ({ source }) => {
            const srcId = extractTabId(source.data);
            return srcId !== null && srcId !== tabId;
        },
        onDragEnter: () => setDropOver(el, true),
        onDragLeave: () => setDropOver(el, false),
        onDrop: ({ source }) => {
            setDropOver(el, false);
            const srcId = extractTabId(source.data);
            if (!srcId) return;
            const tabs = opts.getTabs();
            const fromIdx = tabs.findIndex(t => t.id === srcId);
            const toIdx = tabs.findIndex(t => t.id === tabId);
            if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
            opts.onReorder(srcId, toIdx);
        },
        getData: () => getTabData(tabId),
    });
    onCleanup(cleanup);
}

/**
 * Register a global monitor.
 * - Moves the floating clone on every drag event
 * - Cleans up on cancel / escape (onDrop fires for all endings in pragmatic-dnd)
 */
export function registerTabMonitor(
    opts: Pick<TabDragOptions, "setDraggingId">,
) {
    const cleanup = monitorForElements({
        canMonitor: ({ source }) => extractTabId(source.data) !== null,
        onDrag: ({ location }) => {
            moveFloatingClone(location.current.input.clientX);
        },
        onDrop: () => {
            preventUnhandled.stop();
            destroyFloatingClone();
            opts.setDraggingId(null);
        },
    });
    onCleanup(cleanup);
}
