import { createSignal, onCleanup, onSettled } from "solid-js";

import {
    IconArrowUpRight,
    IconClose,
    IconLayoutBottom,
    IconLayoutNavbar,
    IconLayoutSidebar,
    IconLayoutSidebarRight,
} from "~/components/icons";
import { cleanupChiiArtifacts, injectChiiIntoIframe } from "~/lib/chii";

import * as s from "~/styles/ChiiPanel.css";

type ChiiDockSide = "bottom" | "top" | "left" | "right";

interface ChiiPanelProps {
    targetIframe: HTMLIFrameElement;
    onClose: () => void;
    onDetach: (url: string) => void;
    initialSide?: ChiiDockSide;
}

const MIN_PX = 80;

const CHII_HOST = window.location.host;
const CHII_BASE = "/chii/";

interface ChiiTarget {
    id: string;
    rtc?: boolean;
    url?: string;
}

function nanoid(len: number): string {
    const chars =
        "ModuleSymbhasOwnPr-0123456789ABCDEFGHIJKLMNQRTUVWXYZcfgijkpqtvxz";
    let id = "";
    const bytes = crypto.getRandomValues(new Uint8Array(len));
    for (let i = 0; i < len; i++) id += chars[bytes[i] % chars.length];
    return id;
}

function buildDetachUrlForId(targetId: string): string {
    const ws = location.protocol === "https:" ? "wss" : "ws";
    const clientId = nanoid(6);
    const clientPath = encodeURIComponent(
        `${CHII_HOST}${CHII_BASE}client/${clientId}?target=${targetId}`,
    );
    return `${location.origin}${CHII_BASE}front_end/chii_app.html?${ws}=${clientPath}&rtc=false`;
}

async function snapshotTargetIds(): Promise<Set<string>> {
    try {
        const res = await fetch(`${CHII_BASE}targets`, { cache: "no-store" });
        const data = await res.json();
        const targets = (data?.targets ?? []) as ChiiTarget[];
        return new Set(targets.map(t => t.id));
    } catch {
        return new Set();
    }
}

async function waitForNewTarget(
    knownIds: Set<string>,
    expectedUrl: string | null,
    maxWaitMs = 4000,
): Promise<ChiiTarget | null> {
    const interval = 250;
    const attempts = Math.max(1, Math.floor(maxWaitMs / interval));
    for (let i = 0; i < attempts; i++) {
        await new Promise(r => setTimeout(r, interval));
        try {
            const res = await fetch(`${CHII_BASE}targets`, {
                cache: "no-store",
            });
            const data = await res.json();
            const targets = (data?.targets ?? []) as ChiiTarget[];
            const newTargets = targets.filter(t => !knownIds.has(t.id));
            const newTarget =
                (expectedUrl
                    ? newTargets.find(t => t.url === expectedUrl)
                    : null) ?? newTargets[0];
            if (newTarget) return newTarget;
        } catch {}
    }
    return null;
}

function applyTargetSize(
    el: HTMLIFrameElement,
    side: ChiiDockSide,
    panelRatio: number,
): void {
    const free = `${(1 - panelRatio) * 100}%`;
    el.style.position = "absolute";
    el.style.inset = "";
    el.style.top = "";
    el.style.left = "";
    el.style.right = "";
    el.style.bottom = "";
    el.style.width = "";
    el.style.height = "";

    if (side === "bottom") {
        el.style.top = "0";
        el.style.left = "0";
        el.style.width = "100%";
        el.style.height = free;
    } else if (side === "top") {
        el.style.bottom = "0";
        el.style.left = "0";
        el.style.width = "100%";
        el.style.height = free;
    } else if (side === "right") {
        el.style.top = "0";
        el.style.left = "0";
        el.style.width = free;
        el.style.height = "100%";
    } else {
        el.style.top = "0";
        el.style.right = "0";
        el.style.width = free;
        el.style.height = "100%";
    }
}

function resetTargetSize(el: HTMLIFrameElement): void {
    el.style.position = "absolute";
    el.style.inset = "0";
    el.style.top = "";
    el.style.left = "";
    el.style.right = "";
    el.style.bottom = "";
    el.style.width = "";
    el.style.height = "";
}

function panelPositionStyle(
    side: ChiiDockSide,
    ratio: number,
): Record<string, string> {
    const pct = `${ratio * 100}%`;
    if (side === "bottom")
        return { bottom: "0", left: "0", right: "0", height: pct };
    if (side === "top") return { top: "0", left: "0", right: "0", height: pct };
    if (side === "right")
        return { top: "0", right: "0", bottom: "0", width: pct };
    return { top: "0", left: "0", bottom: "0", width: pct };
}

function dividerPositionStyle(side: ChiiDockSide): Record<string, string> {
    if (side === "bottom")
        return { top: "0", left: "0", right: "0", height: "4px" };
    if (side === "top")
        return { bottom: "0", left: "0", right: "0", height: "4px" };
    if (side === "right")
        return { left: "0", top: "0", bottom: "0", width: "4px" };
    return { right: "0", top: "0", bottom: "0", width: "4px" };
}

const CONTENT_BASE = {
    position: "absolute",
    display: "flex",
    "flex-direction": "column",
} as const;

function contentInsetStyle(side: ChiiDockSide): Record<string, string> {
    if (side === "bottom")
        return { top: "4px", left: "0", right: "0", bottom: "0" };
    if (side === "top")
        return { top: "0", left: "0", right: "0", bottom: "4px" };
    if (side === "right")
        return { left: "4px", top: "0", right: "0", bottom: "0" };
    return { right: "4px", top: "0", left: "0", bottom: "0" };
}

function dragRatio(cur: ChiiDockSide, e: PointerEvent, rect: DOMRect): number {
    if (cur === "bottom") return 1 - (e.clientY - rect.top) / rect.height;
    if (cur === "top") return (e.clientY - rect.top) / rect.height;
    if (cur === "right") return 1 - (e.clientX - rect.left) / rect.width;
    return (e.clientX - rect.left) / rect.width;
}

function sweepArtifacts(iframe: HTMLIFrameElement) {
    const sweep = () => cleanupChiiArtifacts(iframe);
    sweep();
    // Chii redraws its inspect/ghost overlay AFTER the relayout, so a single
    // synchronous sweep misses the re-created node (seen on top/left docks).
    // Sweep again on the next frames + a short tail.
    requestAnimationFrame(() => {
        sweep();
        requestAnimationFrame(sweep);
    });
    for (const delay of [120, 400]) setTimeout(sweep, delay);
}

function currentUrl(iframe: HTMLIFrameElement): string | null {
    try {
        return iframe.contentWindow?.location.href ?? null;
    } catch {
        return null;
    }
}

function useDevtoolsTarget(
    props: ChiiPanelProps,
    side: () => ChiiDockSide,
    size: () => number,
) {
    let devtoolsRef!: HTMLIFrameElement;
    let initialized = false;
    let disposed = false;
    let activeTargetId: string | null = null;

    const resolveDevtoolsSrc = async () => {
        const knownIds = await snapshotTargetIds();
        const expectedUrl = currentUrl(props.targetIframe);
        injectChiiIntoIframe(props.targetIframe, devtoolsRef);
        const target = await waitForNewTarget(knownIds, expectedUrl, 4000);
        if (disposed) return;
        if (target) {
            activeTargetId = target.id;
            devtoolsRef.src = buildDetachUrlForId(target.id);
        } else {
            devtoolsRef.src = "about:blank";
        }
    };

    onSettled(() => {
        applyTargetSize(props.targetIframe, side(), size());
        cleanupChiiArtifacts(props.targetIframe);
        if (initialized) return;
        initialized = true;
        void resolveDevtoolsSrc();
    });

    onCleanup(() => {
        disposed = true;
    });

    return {
        setFrame: (el: HTMLIFrameElement) => (devtoolsRef = el),
        detachUrl: () =>
            activeTargetId
                ? buildDetachUrlForId(activeTargetId)
                : `${location.origin}${CHII_BASE}`,
    };
}

function useDockDrag(
    props: ChiiPanelProps,
    side: () => ChiiDockSide,
    setSize: (ratio: number) => void,
) {
    const [dragging, setDragging] = createSignal(false);

    const onPointerdown = (e: PointerEvent) => {
        e.preventDefault();
        setDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const onPointermove = (e: PointerEvent) => {
        if (!dragging()) return;
        const parent = (e.currentTarget as HTMLElement).parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        const cur = side();
        const ratio = dragRatio(cur, e, rect);
        const horiz = cur === "left" || cur === "right";
        const minRatio = MIN_PX / (horiz ? rect.width : rect.height);
        const clamped = Math.max(minRatio, Math.min(1 - minRatio, ratio));
        setSize(clamped);
        applyTargetSize(props.targetIframe, cur, clamped);
    };

    const onPointerup = () => setDragging(false);

    return { dragging, onPointerdown, onPointermove, onPointerup };
}

const SIDES: { s: ChiiDockSide; icon: () => any }[] = [
    { s: "bottom", icon: () => <IconLayoutBottom size={14} /> },
    { s: "top", icon: () => <IconLayoutNavbar size={14} /> },
    { s: "left", icon: () => <IconLayoutSidebar size={14} /> },
    { s: "right", icon: () => <IconLayoutSidebarRight size={14} /> },
];

function ChiiToolbar(props: {
    side: ChiiDockSide;
    onSide: (side: ChiiDockSide) => void;
    onDetach: () => void;
    onClose: () => void;
}) {
    return (
        <div class={s.toolbar}>
            {SIDES.map(({ s: ds, icon }) => (
                <button
                    type="button"
                    title={`Dock ${ds}`}
                    class={[
                        s.dockBtn,
                        { [s.dockBtnActive]: props.side === ds },
                    ]}
                    onClick={() => props.onSide(ds)}
                >
                    {icon()}
                </button>
            ))}
            <div class={s.toolbarSpacer} />
            <button
                type="button"
                title="Open in new window"
                class={s.detachBtn}
                onClick={() => props.onDetach()}
            >
                <IconArrowUpRight size={14} />
            </button>
            <button
                type="button"
                title="Close devtools"
                class={s.closeBtn}
                onClick={() => props.onClose()}
            >
                <IconClose size={14} />
            </button>
        </div>
    );
}

function DockDivider(props: {
    side: ChiiDockSide;
    dragging: boolean;
    onPointerDown: (e: PointerEvent) => void;
    onPointerUp: () => void;
}) {
    const isHoriz = () => props.side === "left" || props.side === "right";
    const dividerClass = () =>
        [
            isHoriz() ? s.dividerVert : s.dividerHoriz,
            props.dragging ? s.dividerDragging : "",
        ]
            .filter(Boolean)
            .join(" ");

    return (
        <div
            class={dividerClass()}
            style={{
                position: "absolute",
                "z-index": "2",
                ...dividerPositionStyle(props.side),
            }}
            onPointerDown={e => props.onPointerDown(e)}
            onPointerUp={() => props.onPointerUp()}
        />
    );
}

export function ChiiPanel(props: ChiiPanelProps) {
    const [side, setSide] = createSignal<ChiiDockSide>(
        props.initialSide ?? "bottom",
    );
    const [size, setSize] = createSignal(0.4);
    const target = useDevtoolsTarget(props, side, size);
    const drag = useDockDrag(props, side, setSize);

    const changeSide = (next: ChiiDockSide) => {
        setSide(next);
        applyTargetSize(props.targetIframe, next, size());
        sweepArtifacts(props.targetIframe);
    };

    const release = () => {
        cleanupChiiArtifacts(props.targetIframe);
        resetTargetSize(props.targetIframe);
    };

    return (
        <div
            class={s.panel}
            style={panelPositionStyle(side(), size())}
            onPointerMove={drag.onPointermove}
            onPointerUp={drag.onPointerup}
        >
            <DockDivider
                side={side()}
                dragging={drag.dragging()}
                onPointerDown={drag.onPointerdown}
                onPointerUp={drag.onPointerup}
            />

            <div style={{ ...CONTENT_BASE, ...contentInsetStyle(side()) }}>
                <ChiiToolbar
                    side={side()}
                    onSide={changeSide}
                    onDetach={() => {
                        release();
                        props.onDetach(target.detachUrl());
                    }}
                    onClose={() => {
                        release();
                        props.onClose();
                    }}
                />

                <iframe
                    ref={target.setFrame}
                    src=""
                    class={s.devtoolsFrame}
                    title="Chii DevTools"
                />
            </div>
        </div>
    );
}
