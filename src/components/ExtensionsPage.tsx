import {
    TbOutlineLink,
    TbOutlinePuzzle,
    TbOutlineUpload,
    TbOutlineX,
} from "solid-icons/tb";
import { createSignal, For, onMount, Show } from "solid-js";
import {
    extensionsGetAll,
    extensionsInstallFromUrl,
    extensionsResolveIcon,
    extensionsSetEnabled,
    extensionsUninstall,
} from "~/api/extensions";
import * as s from "~/styles/ExtensionsPage.css";
import type { CivilExtension } from "~/types";

type ExtensionListItem = Omit<CivilExtension, "files"> & {
    files?: Map<string, Uint8Array>;
};

function ExtensionIcon(props: { ext: ExtensionListItem }) {
    const iconUrl = () =>
        extensionsResolveIcon(props.ext.id, props.ext.manifest as any, 48);

    return (
        <div class={s.cardIcon}>
            <Show when={iconUrl()} fallback={<TbOutlinePuzzle size={20} />}>
                {url => <img src={url()} class={s.cardIconImg} alt="" />}
            </Show>
        </div>
    );
}

function ToggleSwitch(props: {
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <label class={s.toggle}>
            <input
                type="checkbox"
                class={s.toggleInput}
                checked={props.checked}
                onChange={e => props.onChange(e.currentTarget.checked)}
            />
            <span class={s.toggleTrack} />
            <span class={s.toggleThumb} />
        </label>
    );
}

export default function ExtensionsPage() {
    const [extensions, setExtensions] = createSignal<ExtensionListItem[]>([]);
    const [urlInput, setUrlInput] = createSignal("");
    const [installing, setInstalling] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);

    onMount(() => {
        setExtensions(extensionsGetAll());
    });

    const handleInstallUrl = async () => {
        const url = urlInput().trim();
        if (!url) return;
        setInstalling(true);
        setError(null);
        try {
            await extensionsInstallFromUrl(url);
            setExtensions(extensionsGetAll());
            setUrlInput("");
        } catch (e) {
            setError(
                e instanceof Error ? e.message : "Failed to install extension",
            );
        } finally {
            setInstalling(false);
        }
    };

    const handleFileUpload = async (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        setInstalling(true);
        setError(null);
        try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            if (file.name.endsWith(".crx")) {
                const { extensionsInstallCrx } = await import(
                    "~/api/extensions"
                );
                await extensionsInstallCrx(bytes);
            } else if (file.name.endsWith(".xpi")) {
                const { extensionsInstallXpi } = await import(
                    "~/api/extensions"
                );
                await extensionsInstallXpi(bytes);
            } else {
                setError("Only .crx and .xpi files are supported");
                return;
            }
            setExtensions(extensionsGetAll());
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to install extension",
            );
        } finally {
            setInstalling(false);
            input.value = "";
        }
    };

    const handleToggle = (id: string, enabled: boolean) => {
        extensionsSetEnabled(id, enabled);
        setExtensions(extensionsGetAll());
    };

    const handleUninstall = async (id: string) => {
        await extensionsUninstall(id);
        setExtensions(extensionsGetAll());
    };

    const crxExts = () => extensions().filter(e => e.type === "crx");
    const xpiExts = () => extensions().filter(e => e.type === "xpi");

    return (
        <div class={s.root}>
            <div class={s.header}>
                <TbOutlinePuzzle size={28} class={s.headerIcon} />
                <span class={s.title}>Extensions</span>
            </div>

            <div class={s.installBar}>
                <input
                    class={s.installInput}
                    type="text"
                    placeholder="Install from URL (.crx or .xpi)"
                    value={urlInput()}
                    onInput={e => setUrlInput(e.currentTarget.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter") handleInstallUrl();
                    }}
                />
                <button
                    type="button"
                    class={s.installBtn}
                    onClick={handleInstallUrl}
                    disabled={installing() || !urlInput().trim()}
                >
                    <Show
                        when={installing()}
                        fallback={
                            <>
                                <TbOutlineLink size={14} /> Install
                            </>
                        }
                    >
                        Installing…
                    </Show>
                </button>
                <label class={s.uploadBtnLabel}>
                    <TbOutlineUpload size={14} />
                    Upload file
                    <input
                        type="file"
                        accept=".crx,.xpi"
                        style={{ display: "none" }}
                        onChange={handleFileUpload}
                    />
                </label>
            </div>

            <Show when={error()}>
                <p
                    style={{
                        color: "var(--civil-color-red)",
                        "font-size": "13px",
                        "margin-bottom": "16px",
                    }}
                >
                    {error()}
                </p>
            </Show>

            <Show when={extensions().length === 0}>
                <p class={s.empty}>
                    No extensions installed. Install a .crx or .xpi above.
                </p>
            </Show>

            <Show when={crxExts().length > 0}>
                <p class={s.sectionTitle}>Chrome Extensions</p>
                <div class={s.list}>
                    <For each={crxExts()}>
                        {ext => (
                            <div class={s.card}>
                                <ExtensionIcon ext={ext} />
                                <div class={s.cardInfo}>
                                    <div class={s.cardName}>{ext.name}</div>
                                    <div class={s.cardMeta}>
                                        v{ext.version} ·{" "}
                                        {ext.manifest.description ?? ""}
                                    </div>
                                </div>
                                <span
                                    class={`${s.cardBadge} ${s.cardBadgeCrx}`}
                                >
                                    CRX
                                </span>
                                <ToggleSwitch
                                    checked={ext.enabled}
                                    onChange={v => handleToggle(ext.id, v)}
                                />
                                <button
                                    type="button"
                                    class={s.removeBtn}
                                    title="Uninstall"
                                    onClick={() => handleUninstall(ext.id)}
                                >
                                    <TbOutlineX size={15} />
                                </button>
                            </div>
                        )}
                    </For>
                </div>
            </Show>

            <Show when={xpiExts().length > 0}>
                <p class={s.sectionTitle}>Firefox Extensions</p>
                <div class={s.list}>
                    <For each={xpiExts()}>
                        {ext => (
                            <div class={s.card}>
                                <ExtensionIcon ext={ext} />
                                <div class={s.cardInfo}>
                                    <div class={s.cardName}>{ext.name}</div>
                                    <div class={s.cardMeta}>
                                        v{ext.version} ·{" "}
                                        {ext.manifest.description ?? ""}
                                    </div>
                                </div>
                                <span
                                    class={`${s.cardBadge} ${s.cardBadgeXpi}`}
                                >
                                    XPI
                                </span>
                                <ToggleSwitch
                                    checked={ext.enabled}
                                    onChange={v => handleToggle(ext.id, v)}
                                />
                                <button
                                    type="button"
                                    class={s.removeBtn}
                                    title="Uninstall"
                                    onClick={() => handleUninstall(ext.id)}
                                >
                                    <TbOutlineX size={15} />
                                </button>
                            </div>
                        )}
                    </For>
                </div>
            </Show>
        </div>
    );
}
