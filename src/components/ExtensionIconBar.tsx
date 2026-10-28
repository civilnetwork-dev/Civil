import { Portal } from "@solidjs/web";
import { createSignal, For, onSettled, Show } from "solid-js";

import { buildExtensionPageSrcDoc } from "~/api/extensionRuntime";
import {
    extensionsGetAll,
    extensionsResolveIcon,
    extensionsResolvePopup,
} from "~/api/extensions";
import type { ChromeManifest, CivilExtension } from "~/types";

import * as s from "~/styles/ExtensionIconBar.css";

interface ExtIconState {
    ext: Omit<CivilExtension, "files">;
    iconUrl: string | null;
    popupUrl: string | null;
}

interface PopupState {
    extId: string;
    popupUrl: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

const POPUP_W = 380;
const POPUP_H = 600;

function clampPopup(x: number, y: number): { x: number; y: number } {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
        x: Math.min(x, vw - POPUP_W - 8),
        y: Math.min(y, vh - POPUP_H - 8),
    };
}

function getPopupPath(manifest: ChromeManifest): string | null {
    return (
        manifest.action?.default_popup ??
        manifest.browser_action?.default_popup ??
        null
    );
}

function enabledExtensionIcons(): ExtIconState[] {
    return extensionsGetAll()
        .filter(e => e.enabled)
        .map(ext => {
            const manifest = ext.manifest as ChromeManifest;
            const iconUrl = extensionsResolveIcon(ext.id, manifest, 48);
            const popupUrl = extensionsResolvePopup(ext.id, manifest);
            return { ext, iconUrl, popupUrl };
        });
}

function ExtensionButton(props: {
    item: ExtIconState;
    onClick: (e: MouseEvent) => void;
}) {
    return (
        <button
            type="button"
            class={s.extBtn}
            title={props.item.ext.name}
            onClick={props.onClick}
        >
            <Show
                when={props.item.iconUrl}
                fallback={
                    <span class={s.extIconFallback}>
                        {props.item.ext.name.slice(0, 2).toUpperCase()}
                    </span>
                }
            >
                {url => (
                    <img
                        src={url()}
                        class={s.extIcon}
                        alt={props.item.ext.name}
                    />
                )}
            </Show>
        </button>
    );
}

function ExtensionPopup(props: { popup: PopupState; onClose: () => void }) {
    return (
        <Portal>
            {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions */}
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    "z-index": "99998",
                    background: "transparent",
                }}
                onMouseDown={props.onClose}
            />
            <div
                class={s.popup}
                style={{
                    left: `${props.popup.x}px`,
                    top: `${props.popup.y}px`,
                    width: `${props.popup.width}px`,
                    height: `${props.popup.height}px`,
                }}
            >
                <iframe
                    class={s.popupFrame}
                    src={props.popup.popupUrl}
                    title="Extension popup"
                />
            </div>
        </Portal>
    );
}

/** The popup for `item`, opened below the button that was clicked. */
async function openPopupFor(
    e: MouseEvent,
    item: ExtIconState,
): Promise<PopupState | null> {
    const btn = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { x, y } = clampPopup(btn.left, btn.bottom + 6);

    const popupPath = getPopupPath(item.ext.manifest as ChromeManifest);
    if (!popupPath) return null;

    try {
        await buildExtensionPageSrcDoc(item.ext, popupPath, "popup");
    } catch (err) {
        console.warn("[civil/extensions] popup load failed:", err);
        return null;
    }

    return {
        extId: item.ext.id,
        popupUrl: `/action-popup/${item.ext.id}`,
        x,
        y,
        width: POPUP_W,
        height: POPUP_H,
    };
}

export default function ExtensionIconBar() {
    const [icons, setIcons] = createSignal<ExtIconState[]>([]);
    const [popup, setPopup] = createSignal<PopupState | null>(null);

    onSettled(() => {
        setIcons(enabledExtensionIcons());
    });

    const handleClick = async (e: MouseEvent, item: ExtIconState) => {
        if (!item.popupUrl) return;
        if (popup()?.extId === item.ext.id) {
            setPopup(null);
            return;
        }
        const opened = await openPopupFor(e, item);
        if (opened) setPopup(opened);
    };

    return (
        <>
            <div class={s.bar}>
                <For each={icons()} keyed={false}>
                    {item => (
                        <ExtensionButton
                            item={item()}
                            onClick={e => handleClick(e, item())}
                        />
                    )}
                </For>
            </div>

            <Show when={popup()}>
                {p => (
                    <ExtensionPopup
                        popup={p()}
                        onClose={() => setPopup(null)}
                    />
                )}
            </Show>
        </>
    );
}
