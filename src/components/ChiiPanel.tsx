import {
    TbOutlineArrowUpRight,
    TbOutlineLayoutBottombar,
    TbOutlineLayoutNavbar,
    TbOutlineLayoutSidebar,
    TbOutlineLayoutSidebarRight,
    TbOutlineX,
} from "solid-icons/tb";
import { createSignal, onCleanup, onSettled } from "solid-js";
import {
    cleanupChiiArtifacts,
    injectChiiIntoIframe,
} from "~/lib/useIframeManager";
import * as s from "~/styles/ChiiPanel.css";

export type ChiiDockSide = "bottom" | "top" | "left" | "right";

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

function contentInsetStyle(side: ChiiDockSide): Record<string, string> {
    if (side === "bottom")
        return { top: "4px", left: "0", right: "0", bottom: "0" };
    if (side === "top")
        return { top: "0", left: "0", right: "0", bottom: "4px" };
    if (side === "right")
        return { left: "4px", top: "0", right: "0", bottom: "0" };
    return { right: "4px", top: "0", left: "0", bottom: "0" };
}

export function ChiiPanel(props: ChiiPanelProps) {
    const [side, setSide] = createSignal<ChiiDockSide>(
        props.initialSide ?? "bottom",
    );
    const [size, setSize] = createSignal(0.4);
    const [dragging, setDragging] = createSignal(false);

    let devtoolsRef!: HTMLIFrameElement;
    let disposed = false;
    let initialized = false;
    let activeTargetId: string | null = null;

    const isHoriz = () => side() === "left" || side() === "right";
    const cleanupTargetArtifacts = () => {
        cleanupChiiArtifacts(props.targetIframe);
    };

    const resolveDevtoolsSrc = async () => {
        const knownIds = await snapshotTargetIds();
        const expectedUrl = (() => {
            try {
                return props.targetIframe.contentWindow?.location.href ?? null;
            } catch {
                return null;
            }
        })();
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
        cleanupTargetArtifacts();
        if (initialized) return;
        initialized = true;
        void resolveDevtoolsSrc();
    });

    onCleanup(() => {
        disposed = true;
    });

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
        let ratio: number;
        if (cur === "bottom") ratio = 1 - (e.clientY - rect.top) / rect.height;
        else if (cur === "top") ratio = (e.clientY - rect.top) / rect.height;
        else if (cur === "right")
            ratio = 1 - (e.clientX - rect.left) / rect.width;
        else ratio = (e.clientX - rect.left) / rect.width;
        const minRatio = MIN_PX / (isHoriz() ? rect.width : rect.height);
        const clamped = Math.max(minRatio, Math.min(1 - minRatio, ratio));
        setSize(clamped);
        applyTargetSize(props.targetIframe, cur, clamped);
    };

    const onPointerup = () => setDragging(false);

    const changeSide = (next: ChiiDockSide) => {
        setSide(next);
        applyTargetSize(props.targetIframe, next, size());
        cleanupTargetArtifacts();
    };

    const handleClose = () => {
        cleanupTargetArtifacts();
        resetTargetSize(props.targetIframe);
        props.onClose();
    };

    const handleDetach = async () => {
        cleanupTargetArtifacts();
        resetTargetSize(props.targetIframe);
        const url = activeTargetId
            ? buildDetachUrlForId(activeTargetId)
            : `${location.origin}${CHII_BASE}`;
        props.onDetach(url);
    };

    const sides: { s: ChiiDockSide; icon: () => any }[] = [
        { s: "bottom", icon: () => <TbOutlineLayoutBottombar size={14} /> },
        { s: "top", icon: () => <TbOutlineLayoutNavbar size={14} /> },
        { s: "left", icon: () => <TbOutlineLayoutSidebar size={14} /> },
        { s: "right", icon: () => <TbOutlineLayoutSidebarRight size={14} /> },
    ];

    const dividerClass = () =>
        [
            isHoriz() ? s.dividerVert : s.dividerHoriz,
            dragging() ? s.dividerDragging : "",
        ]
            .filter(Boolean)
            .join(" ");

    return (
        <div
            class={s.panel}
            style={panelPositionStyle(side(), size())}
            onPointerMove={onPointermove}
            onPointerUp={onPointerup}
        >
            <div
                class={dividerClass()}
                style={{
                    position: "absolute",
                    "z-index": "2",
                    ...dividerPositionStyle(side()),
                }}
                onPointerDown={onPointerdown}
                onPointerUp={onPointerup}
            />

            <div
                style={{
                    position: "absolute",
                    display: "flex",
                    "flex-direction": "column",
                    ...contentInsetStyle(side()),
                }}
            >
                <div class={s.toolbar}>
                    {sides.map(({ s: ds, icon }) => (
                        <button
                            type="button"
                            title={`Dock ${ds}`}
                            class={[
                                s.dockBtn,
                                { [s.dockBtnActive]: side() === ds },
                            ]}
                            onClick={() => changeSide(ds)}
                        >
                            {icon()}
                        </button>
                    ))}
                    <div class={s.toolbarSpacer} />
                    <button
                        type="button"
                        title="Open in new window"
                        class={s.detachBtn}
                        onClick={() => {
                            void handleDetach();
                        }}
                    >
                        <TbOutlineArrowUpRight size={14} />
                    </button>
                    <button
                        type="button"
                        title="Close devtools"
                        class={s.closeBtn}
                        onClick={handleClose}
                    >
                        <TbOutlineX size={14} />
                    </button>
                </div>

                <iframe
                    ref={devtoolsRef}
                    src=""
                    class={s.devtoolsFrame}
                    title="Chii DevTools"
                />
            </div>
        </div>
    );
}
