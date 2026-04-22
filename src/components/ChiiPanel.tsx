import {
    TbOutlineArrowUpRight,
    TbOutlineLayoutBottombar,
    TbOutlineLayoutNavbar,
    TbOutlineLayoutSidebar,
    TbOutlineLayoutSidebarRight,
    TbOutlineX,
} from "solid-icons/tb";
import { createSignal, onMount, Show } from "solid-js";
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

function nanoid(len: number): string {
    const chars =
        "ModuleSymbhasOwnPr-0123456789ABCDEFGHIJKLMNQRTUVWXYZcfgijkpqtvxz";
    let id = "";
    const bytes = crypto.getRandomValues(new Uint8Array(len));
    for (let i = 0; i < len; i++) id += chars[bytes[i] % chars.length];
    return id;
}

async function waitForTarget(
    maxWaitMs = 5000,
): Promise<{ id: string; rtc: boolean } | null> {
    const interval = 200;
    const attempts = maxWaitMs / interval;
    for (let i = 0; i < attempts; i++) {
        try {
            const res = await fetch(`${CHII_BASE}targets`);
            const { targets } = await res.json();
            if (targets?.length) return targets[0];
        } catch {}
        await new Promise(r => setTimeout(r, interval));
    }
    return null;
}

async function buildDetachUrl(): Promise<string> {
    const target = await waitForTarget();
    if (target) {
        const ws = location.protocol === "https:" ? "wss" : "ws";
        const clientId = nanoid(6);
        const clientPath = encodeURIComponent(
            `${CHII_HOST}${CHII_BASE}client/${clientId}?target=${target.id}`,
        );
        return `${location.origin}${CHII_BASE}front_end/chii_app.html?${ws}=${clientPath}&rtc=${target.rtc ?? false}`;
    }
    return `${location.origin}${CHII_BASE}`;
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

export function ChiiPanel(props: ChiiPanelProps) {
    const [side, setSide] = createSignal<ChiiDockSide>(
        props.initialSide ?? "bottom",
    );
    const [size, setSize] = createSignal(0.4);
    const [dragging, setDragging] = createSignal(false);
    const [devtoolsSrc, setDevtoolsSrc] = createSignal("");

    let devtoolsRef!: HTMLIFrameElement;

    const isHoriz = () => side() === "left" || side() === "right";

    onMount(async () => {
        applyTargetSize(props.targetIframe, side(), size());
        try {
            (props.targetIframe.contentWindow as any).ChiiDevtoolsIframe =
                devtoolsRef;
        } catch {}
        setDevtoolsSrc(await buildDetachUrl());
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
        const s = side();
        let ratio: number;
        if (s === "bottom") ratio = 1 - (e.clientY - rect.top) / rect.height;
        else if (s === "top") ratio = (e.clientY - rect.top) / rect.height;
        else if (s === "right")
            ratio = 1 - (e.clientX - rect.left) / rect.width;
        else ratio = (e.clientX - rect.left) / rect.width;
        const minRatio = MIN_PX / (isHoriz() ? rect.width : rect.height);
        const clamped = Math.max(minRatio, Math.min(1 - minRatio, ratio));
        setSize(clamped);
        applyTargetSize(props.targetIframe, s, clamped);
    };

    const onPointerup = () => setDragging(false);

    const changeSide = (next: ChiiDockSide) => {
        setSide(next);
        applyTargetSize(props.targetIframe, next, size());
    };

    const handleClose = () => {
        resetTargetSize(props.targetIframe);
        props.onClose();
    };

    const handleDetach = async () => {
        resetTargetSize(props.targetIframe);
        const url = await buildDetachUrl();
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
            <Show when={side() === "bottom" || side() === "right"}>
                <div
                    class={dividerClass()}
                    onPointerDown={onPointerdown}
                    onPointerUp={onPointerup}
                />
            </Show>

            <div class={s.toolbar}>
                {sides.map(({ s: ds, icon }) => (
                    <button
                        type="button"
                        title={`Dock ${ds}`}
                        class={`${s.dockBtn}${side() === ds ? ` ${s.dockBtnActive}` : ""}`}
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
                src={devtoolsSrc()}
                class={s.devtoolsFrame}
                title="Chii DevTools"
            />

            <Show when={side() === "top" || side() === "left"}>
                <div
                    class={dividerClass()}
                    onPointerDown={onPointerdown}
                    onPointerUp={onPointerup}
                />
            </Show>
        </div>
    );
}
