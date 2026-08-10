import {
    TbOutlineLink,
    TbOutlineLoader,
    TbOutlinePuzzle,
    TbOutlineRefresh,
    TbOutlineUpload,
    TbOutlineX,
} from "solid-icons/tb";
import { createSignal, For, Show } from "solid-js";
import {
    type ExtensionUpdateResult,
    extensionsCheckForUpdates,
    extensionsGetAll,
    extensionsInstallFromUrl,
    extensionsResolveIcon,
    extensionsSetEnabled,
    extensionsUninstall,
} from "~/api/extensions";
import * as s from "~/styles/ExtensionsPage.css";
import * as l from "~/styles/layout.css";
import type { CivilExtension } from "~/types";

type ExtensionListItem = Omit<CivilExtension, "files"> & {
    files?: Map<string, Uint8Array>;
};

function summarizeUpdates(results: ExtensionUpdateResult[]): string {
    if (results.length === 0) return "No extensions to update.";
    const updated = results.filter(r => r.status === "updated");
    const errored = results.filter(r => r.status === "error");
    const parts: string[] = [];
    if (updated.length) {
        parts.push(
            "Updated " +
                updated.map(r => `${r.name} → v${r.toVersion}`).join(", "),
        );
    }
    if (errored.length) {
        parts.push(
            "Failed: " + errored.map(r => `${r.name} (${r.error})`).join(", "),
        );
    }
    if (parts.length === 0) return "All extensions are up to date.";
    return parts.join(" · ");
}

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

// A failed cross-origin download surfaces as a bare TypeError whose message
// is "Failed to fetch" - true, but it names the browser API rather than
// anything the reader can act on. Anything else we raise ourselves is
// already written for a person, so it passes through untouched.
function describeInstallError(e: unknown): string {
    if (e instanceof TypeError) {
        return "Couldn't download that file. Check the link, or download it and use Upload file.";
    }
    return e instanceof Error && e.message
        ? e.message
        : "Couldn't install that extension.";
}

export default function ExtensionsPage() {
    // Reactive extension index: reading extensions() inside JSX or a memo
    // re-runs on any install / uninstall / enable-toggle / update, since each
    // routes through saveIndex, which notifies the reactive store.
    const extensions = (): ExtensionListItem[] => extensionsGetAll();
    const [urlInput, setUrlInput] = createSignal("");
    const [installing, setInstalling] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const [checking, setChecking] = createSignal(false);
    const [updateStatus, setUpdateStatus] = createSignal<string | null>(null);

    const handleInstallUrl = async () => {
        const url = urlInput().trim();
        if (!url) return;
        setInstalling(true);
        setError(null);
        try {
            const ext = await extensionsInstallFromUrl(url);
            const { launchExtensionBackground } = await import(
                "~/api/extensionRuntime"
            );
            await launchExtensionBackground(ext);
            setUrlInput("");
        } catch (e) {
            setError(describeInstallError(e));
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
                const ext = await extensionsInstallCrx(bytes);
                const { launchExtensionBackground } = await import(
                    "~/api/extensionRuntime"
                );
                await launchExtensionBackground(ext);
            } else if (file.name.endsWith(".xpi")) {
                const { extensionsInstallXpi } = await import(
                    "~/api/extensions"
                );
                const ext = await extensionsInstallXpi(bytes);
                const { launchExtensionBackground } = await import(
                    "~/api/extensionRuntime"
                );
                await launchExtensionBackground(ext);
            } else {
                setError("Only .crx and .xpi files are supported");
                return;
            }
        } catch (err) {
            setError(describeInstallError(err));
        } finally {
            setInstalling(false);
            input.value = "";
        }
    };

    const handleCheckUpdates = async () => {
        setChecking(true);
        setError(null);
        setUpdateStatus(null);
        try {
            const results = await extensionsCheckForUpdates();

            const updated = results.filter(r => r.status === "updated");
            if (updated.length) {
                const { launchExtensionBackground } = await import(
                    "~/api/extensionRuntime"
                );
                for (const r of updated) {
                    const ext = extensionsGetAll().find(e => e.id === r.id);
                    if (ext) await launchExtensionBackground(ext);
                }
            }
            setUpdateStatus(summarizeUpdates(results));
        } catch (e) {
            setError(
                e instanceof Error ? e.message : "Failed to check for updates",
            );
        } finally {
            setChecking(false);
        }
    };

    const handleToggle = (id: string, enabled: boolean) => {
        extensionsSetEnabled(id, enabled);
    };

    const handleUninstall = async (id: string) => {
        await extensionsUninstall(id);
    };

    const crxExts = () => extensions().filter(e => e.type === "crx");
    const xpiExts = () => extensions().filter(e => e.type === "xpi");

    return (
        <div class={s.root}>
            <header class={l.masthead}>
                <div class={l.mastheadTop}>
                    <div class={l.mastheadTitleGroup}>
                        <span class={l.eyebrow}>
                            <span class={l.eyebrowMark} />
                            Preferences
                        </span>
                        <h1 class={l.pageTitle}>Extensions</h1>
                    </div>
                    <Show when={extensions().length > 0}>
                        <span class={l.pageMeta}>
                            {extensions().filter(e => e.enabled).length} of{" "}
                            {extensions().length} enabled
                        </span>
                    </Show>
                </div>
                <div class={l.mastheadRule} />
            </header>

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
                        <TbOutlineLoader size={14} /> Installing
                    </Show>
                </button>
                <label class={s.uploadBtnLabel}>
                    <TbOutlineUpload size={14} /> Upload file
                    <input
                        type="file"
                        accept=".crx,.xpi"
                        style={{ display: "none" }}
                        onChange={handleFileUpload}
                    />
                </label>
                <button
                    type="button"
                    class={s.installBtn}
                    onClick={handleCheckUpdates}
                    disabled={checking() || extensions().length === 0}
                >
                    <Show
                        when={checking()}
                        fallback={
                            <>
                                <TbOutlineRefresh size={14} /> Check for updates
                            </>
                        }
                    >
                        <TbOutlineLoader size={14} /> Checking
                    </Show>
                </button>
            </div>

            <Show when={updateStatus()}>
                <p
                    style={{
                        color: "var(--civil-color-text-muted, #888)",
                        "font-size": "13px",
                        "margin-bottom": "16px",
                    }}
                >
                    {updateStatus()}
                </p>
            </Show>

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
                <div class={s.empty}>
                    <TbOutlinePuzzle size={40} class={s.emptyIcon} />
                    <p class={s.emptyText}>
                        No extensions installed. Install a .crx or .xpi above.
                    </p>
                </div>
            </Show>

            <Show when={crxExts().length > 0}>
                <p class={s.sectionTitle}>Chrome Extensions</p>
                <div class={s.list}>
                    <For each={crxExts()} keyed={false}>
                        {ext => (
                            <div class={s.card}>
                                <ExtensionIcon ext={ext()} />
                                <div class={s.cardInfo}>
                                    <div class={s.cardName}>
                                        <span
                                            class={[
                                                s.statusDot,
                                                {
                                                    [s.statusDotOn]:
                                                        ext().enabled,
                                                },
                                            ]}
                                        />{" "}
                                        {ext().name}
                                    </div>
                                    <div class={s.cardMeta}>
                                        v{ext().version} ·{" "}
                                        {ext().manifest.description ?? ""}
                                    </div>
                                </div>
                                <span
                                    class={`${s.cardBadge} ${s.cardBadgeCrx}`}
                                >
                                    CRX
                                </span>
                                <ToggleSwitch
                                    checked={ext().enabled}
                                    onChange={v => handleToggle(ext().id, v)}
                                />
                                <button
                                    type="button"
                                    class={s.removeBtn}
                                    title="Uninstall"
                                    onClick={() => handleUninstall(ext().id)}
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
                    <For each={xpiExts()} keyed={false}>
                        {ext => (
                            <div class={s.card}>
                                <ExtensionIcon ext={ext()} />
                                <div class={s.cardInfo}>
                                    <div class={s.cardName}>
                                        <span
                                            class={[
                                                s.statusDot,
                                                {
                                                    [s.statusDotOn]:
                                                        ext().enabled,
                                                },
                                            ]}
                                        />{" "}
                                        {ext().name}
                                    </div>
                                    <div class={s.cardMeta}>
                                        v{ext().version} ·{" "}
                                        {ext().manifest.description ?? ""}
                                    </div>
                                </div>
                                <span
                                    class={`${s.cardBadge} ${s.cardBadgeXpi}`}
                                >
                                    XPI
                                </span>
                                <ToggleSwitch
                                    checked={ext().enabled}
                                    onChange={v => handleToggle(ext().id, v)}
                                />
                                <button
                                    type="button"
                                    class={s.removeBtn}
                                    title="Uninstall"
                                    onClick={() => handleUninstall(ext().id)}
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
