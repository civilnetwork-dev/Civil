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
import {
    IconClose,
    IconLink,
    IconLoader,
    IconPuzzle,
    IconRefresh,
    IconUpload,
} from "~/components/icons";
import Anno from "~/components/schematic/Anno";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import * as s from "~/styles/ExtensionsPage.css";
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
        <span class={s.iconPlate}>
            <Show when={iconUrl()} fallback={<IconPuzzle size={15} />}>
                {url => <img src={url()} class={s.iconImg} alt="" />}
            </Show>
        </span>
    );
}

/**
 * One extension. This was previously written out twice — once under "Chrome
 * Extensions" and once under "Firefox Extensions" — with the two copies
 * differing only in the badge. Forty-odd lines of markup kept in sync by hand
 * is a defect waiting to happen, and the second copy had already drifted
 * nowhere useful.
 */
function ExtensionRow(props: {
    ext: ExtensionListItem;
    armed: boolean;
    onToggle: (enabled: boolean) => void;
    onArm: () => void;
    onUninstall: () => void;
}) {
    const description = () => props.ext.manifest.description ?? "";
    return (
        <li class={s.row}>
            <span
                class={props.ext.enabled ? s.node.on : s.node.off}
                aria-hidden="true"
            />
            <ExtensionIcon ext={props.ext} />
            <span class={s.info}>
                <span class={s.name}>{props.ext.name}</span>
                <span class={s.meta}>
                    v{props.ext.version}
                    {description() ? ` · ${description()}` : ""}
                </span>
            </span>
            <span class={s.stamp[props.ext.type === "crx" ? "crx" : "xpi"]}>
                {props.ext.type}
            </span>
            {/* The switch is the only thing stating enabled/disabled to a
                screen reader — the spine node beside it is decorative — so it
                carries the extension's name in its own label rather than
                relying on the row for context. */}
            <label class={s.toggle}>
                <input
                    type="checkbox"
                    class={s.toggleInput}
                    checked={props.ext.enabled}
                    aria-label={`Enable ${props.ext.name}`}
                    onChange={e => props.onToggle(e.currentTarget.checked)}
                />
                <span class={s.toggleTrack} />
                <span class={s.toggleThumb} />
            </label>
            <Show
                when={props.armed}
                fallback={
                    <button
                        type="button"
                        class={s.removeBtn}
                        aria-label={`Uninstall ${props.ext.name}`}
                        onClick={props.onArm}
                    >
                        <IconClose size={14} />
                    </button>
                }
            >
                <button
                    type="button"
                    class={s.removeArmed}
                    onClick={props.onUninstall}
                >
                    confirm uninstall
                </button>
            </Show>
        </li>
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

    // Uninstalling deletes the extension's stored files, so the control asks
    // once. Keyed by id rather than a boolean because arming one row must
    // disarm any other — two live "confirm" buttons is how the wrong one gets
    // clicked.
    const [armedId, setArmedId] = createSignal<string | null>(null);
    let armTimer: ReturnType<typeof setTimeout> | undefined;

    const arm = (id: string) => {
        clearTimeout(armTimer);
        setArmedId(id);
        armTimer = setTimeout(() => setArmedId(null), 4000);
    };

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

    const handleUninstall = async (id: string) => {
        clearTimeout(armTimer);
        setArmedId(null);
        await extensionsUninstall(id);
    };

    const crxExts = () => extensions().filter(e => e.type === "crx");
    const xpiExts = () => extensions().filter(e => e.type === "xpi");

    const enabledCount = () => extensions().filter(e => e.enabled).length;

    return (
        <Sheet>
            <TitleBlock
                eyebrow="preferences"
                title="Extensions"
                meta={
                    extensions().length > 0
                        ? `${enabledCount()} of ${extensions().length} enabled`
                        : "none installed"
                }
                actions={
                    <div class={s.titleActions}>
                        <button
                            type="button"
                            class={s.textBtn}
                            onClick={handleCheckUpdates}
                            disabled={checking() || extensions().length === 0}
                        >
                            <Show
                                when={checking()}
                                fallback={
                                    <>
                                        <IconRefresh size={13} /> check for
                                        updates
                                    </>
                                }
                            >
                                <IconLoader size={13} /> checking
                            </Show>
                        </button>
                    </div>
                }
            />

            <div class={s.intake}>
                <span class={s.intakeLabel} id="ext-intake-label">
                    source
                </span>
                <input
                    class={s.intakeInput}
                    type="text"
                    placeholder="https://… .crx or .xpi"
                    value={urlInput()}
                    aria-labelledby="ext-intake-label"
                    onInput={e => setUrlInput(e.currentTarget.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter") handleInstallUrl();
                    }}
                />
                <button
                    type="button"
                    class={s.textBtn}
                    onClick={handleInstallUrl}
                    disabled={installing() || !urlInput().trim()}
                >
                    <Show
                        when={installing()}
                        fallback={
                            <>
                                <IconLink size={13} /> install
                            </>
                        }
                    >
                        <IconLoader size={13} /> installing
                    </Show>
                </button>
                <label class={s.uploadLabel}>
                    <IconUpload size={13} /> upload file
                    <input
                        type="file"
                        accept=".crx,.xpi"
                        class={s.uploadInput}
                        onChange={handleFileUpload}
                    />
                </label>
            </div>

            {/* One region for both outcomes, always present in the DOM. A live
                region that is added at the same moment its text arrives is
                frequently missed entirely — the announcement has to land in a
                region the screen reader was already watching. */}
            <p
                class={`${s.status} ${error() ? s.statusTone.error : s.statusTone.info}`}
                role="status"
                aria-live="polite"
            >
                <Show when={error() ?? updateStatus()}>
                    <span class={s.statusMark} aria-hidden="true" />
                    {error() ?? updateStatus()}
                </Show>
            </p>

            <Show when={extensions().length === 0}>
                <Rule label="none installed" weight="major" />
                <div class={s.empty}>
                    <Anno muted>
                        no extensions yet — install a .crx or .xpi above
                    </Anno>
                </div>
            </Show>

            <Show when={crxExts().length > 0}>
                <div class={s.section}>
                    <Rule label="chrome · crx" weight="major" />
                    <ul class={s.list}>
                        <For each={crxExts()} keyed={false}>
                            {ext => (
                                <ExtensionRow
                                    ext={ext()}
                                    armed={armedId() === ext().id}
                                    onToggle={v =>
                                        extensionsSetEnabled(ext().id, v)
                                    }
                                    onArm={() => arm(ext().id)}
                                    onUninstall={() =>
                                        handleUninstall(ext().id)
                                    }
                                />
                            )}
                        </For>
                    </ul>
                </div>
            </Show>

            <Show when={xpiExts().length > 0}>
                <div class={s.section}>
                    <Rule label="firefox · xpi" weight="major" />
                    <ul class={s.list}>
                        <For each={xpiExts()} keyed={false}>
                            {ext => (
                                <ExtensionRow
                                    ext={ext()}
                                    armed={armedId() === ext().id}
                                    onToggle={v =>
                                        extensionsSetEnabled(ext().id, v)
                                    }
                                    onArm={() => arm(ext().id)}
                                    onUninstall={() =>
                                        handleUninstall(ext().id)
                                    }
                                />
                            )}
                        </For>
                    </ul>
                </div>
            </Show>
        </Sheet>
    );
}
