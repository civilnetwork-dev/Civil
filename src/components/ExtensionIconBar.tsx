import { Portal } from "@solidjs/web";
import { createSignal, For, onSettled, Show } from "solid-js";
import { buildExtensionPageSrcDoc } from "~/api/extensionRuntime";
import {
    extensionsGetAll,
    extensionsResolveIcon,
    extensionsResolvePopup,
} from "~/api/extensions";
import * as s from "~/styles/ExtensionIconBar.css";
import type { ChromeManifest, CivilExtension } from "~/types";

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

export default function ExtensionIconBar() {
    const [icons, setIcons] = createSignal<ExtIconState[]>([]);
    const [popup, setPopup] = createSignal<PopupState | null>(null);

    onSettled(() => {
        const all = extensionsGetAll().filter(e => e.enabled);
        const resolved = all.map(ext => {
            const manifest = ext.manifest as ChromeManifest;
            const iconUrl = extensionsResolveIcon(ext.id, manifest, 48);
            const popupUrl = extensionsResolvePopup(ext.id, manifest);
            return { ext, iconUrl, popupUrl };
        });
        setIcons(resolved);
    });

    const handleClick = async (e: MouseEvent, item: ExtIconState) => {
        if (!item.popupUrl) return;

        const btn = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const rawX = btn.left;
        const rawY = btn.bottom + 6;
        const { x, y } = clampPopup(rawX, rawY);

        const current = popup();
        if (current?.extId === item.ext.id) {
            setPopup(null);
            return;
        }

        const popupPath = getPopupPath(item.ext.manifest as ChromeManifest);
        if (!popupPath) return;

        try {
            await buildExtensionPageSrcDoc(item.ext, popupPath, "popup");
        } catch (err) {
            console.warn("[civil/extensions] popup load failed:", err);
            return;
        }

        setPopup({
            extId: item.ext.id,
            popupUrl: `/action-popup/${item.ext.id}`,
            x,
            y,
            width: POPUP_W,
            height: POPUP_H,
        });
    };

    const closePopup = () => setPopup(null);

    return (
        <>
            <div class={s.bar}>
                <For each={icons()} keyed={false}>
                    {item => (
                        <button
                            type="button"
                            class={s.extBtn}
                            title={item().ext.name}
                            onClick={e => handleClick(e, item())}
                        >
                            <Show
                                when={item().iconUrl}
                                fallback={
                                    <span class={s.extIconFallback}>
                                        {item()
                                            .ext.name.slice(0, 2)
                                            .toUpperCase()}
                                    </span>
                                }
                            >
                                {url => (
                                    <img
                                        src={url()}
                                        class={s.extIcon}
                                        alt={item().ext.name}
                                    />
                                )}
                            </Show>
                        </button>
                    )}
                </For>
            </div>

            <Show when={popup()}>
                {p => (
                    <Portal>
                        {/** biome-ignore lint/a11y/noStaticElementInteractions: biome being dumb au */}
                        <div
                            style={{
                                position: "fixed",
                                inset: 0,
                                "z-index": "99998",
                                background: "transparent",
                            }}
                            onMouseDown={closePopup}
                        />
                        <div
                            class={s.popup}
                            style={{
                                left: `${p().x}px`,
                                top: `${p().y}px`,
                                width: `${p().width}px`,
                                height: `${p().height}px`,
                            }}
                        >
                            <iframe
                                class={s.popupFrame}
                                src={p().popupUrl}
                                title="Extension popup"
                            />
                        </div>
                    </Portal>
                )}
            </Show>
        </>
    );
}
