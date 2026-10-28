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
import Specimen from "~/components/Specimen";
import type { CivilExtension } from "~/types";

import * as s from "~/styles/ExtensionsPage.css";
import * as schematic from "~/styles/schematic.css";

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

/** The confirm-once uninstall control at the end of a row. */
function UninstallControl(props: {
    name: string;
    armed: boolean;
    onArm: () => void;
    onUninstall: () => void;
}) {
    return (
        <Show
            when={props.armed}
            fallback={
                <button
                    type="button"
                    class={s.removeBtn}
                    aria-label={`Uninstall ${props.name}`}
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
                Confirm uninstall
            </button>
        </Show>
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
                {props.ext.type.toUpperCase()}
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
            <UninstallControl
                name={props.ext.name}
                armed={props.armed}
                onArm={props.onArm}
                onUninstall={props.onUninstall}
            />
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
    // A storage read or write failure surfaces as a DOMException such as
    // NotReadableError, whose message names a browser API rather than anything
    // the reader can act on. Map the known storage errors to a clear message.
    if (
        e instanceof DOMException &&
        (e.name === "NotReadableError" ||
            e.name === "NotFoundError" ||
            e.name === "QuotaExceededError" ||
            e.name === "SecurityError")
    ) {
        return "Couldn't save that extension to browser storage. Reload the page and try again.";
    }
    return e instanceof Error && e.message
        ? e.message
        : "Couldn't install that extension.";
}

async function launchBackground(ext: Omit<CivilExtension, "files">) {
    const { launchExtensionBackground } =
        await import("~/api/extensionRuntime");
    await launchExtensionBackground(ext);
}

/** Installs an uploaded .crx or .xpi; false for any other kind of file. */
async function installFile(file: File): Promise<boolean> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (file.name.endsWith(".crx")) {
        const { extensionsInstallCrx } = await import("~/api/extensions");
        await launchBackground(await extensionsInstallCrx(bytes));
        return true;
    }
    if (file.name.endsWith(".xpi")) {
        const { extensionsInstallXpi } = await import("~/api/extensions");
        await launchBackground(await extensionsInstallXpi(bytes));
        return true;
    }
    return false;
}

/** Installing from a link or an uploaded file, with its progress and error. */
function useInstaller() {
    const [urlInput, setUrlInput] = createSignal("");
    const [installing, setInstalling] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);

    const run = async (install: () => Promise<void>) => {
        setInstalling(true);
        setError(null);
        try {
            await install();
        } catch (e) {
            setError(describeInstallError(e));
        } finally {
            setInstalling(false);
        }
    };

    const handleInstallUrl = async () => {
        const url = urlInput().trim();
        if (!url) return;
        await run(async () => {
            await launchBackground(await extensionsInstallFromUrl(url));
            setUrlInput("");
        });
    };

    const handleFileUpload = async (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        await run(async () => {
            if (!(await installFile(file))) {
                setError("Only .crx and .xpi files are supported");
            }
        });
        input.value = "";
    };

    return {
        urlInput,
        setUrlInput,
        installing,
        error,
        setError,
        handleInstallUrl,
        handleFileUpload,
    };
}

/** Checking every extension for updates, and relaunching what updated. */
function useUpdateCheck(setError: (error: string | null) => void) {
    const [checking, setChecking] = createSignal(false);
    const [updateStatus, setUpdateStatus] = createSignal<string | null>(null);

    const handleCheckUpdates = async () => {
        setChecking(true);
        setError(null);
        setUpdateStatus(null);
        try {
            const results = await extensionsCheckForUpdates();
            for (const r of results.filter(res => res.status === "updated")) {
                const ext = extensionsGetAll().find(e => e.id === r.id);
                if (ext) await launchBackground(ext);
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

    return { checking, updateStatus, handleCheckUpdates };
}

/**
 * Uninstalling deletes the extension's stored files, so the control asks
 * once. Keyed by id rather than a boolean because arming one row must disarm
 * any other — two live "confirm" buttons is how the wrong one gets clicked.
 */
function useArmedUninstall() {
    const [armedId, setArmedId] = createSignal<string | null>(null);
    let armTimer: ReturnType<typeof setTimeout> | undefined;

    const arm = (id: string) => {
        clearTimeout(armTimer);
        setArmedId(id);
        armTimer = setTimeout(() => setArmedId(null), 4000);
    };

    const uninstall = async (id: string) => {
        clearTimeout(armTimer);
        setArmedId(null);
        await extensionsUninstall(id);
    };

    return { armedId, arm, uninstall };
}

function ExtensionsTitle(props: {
    extensions: ExtensionListItem[];
    checking: boolean;
    onCheck: () => void;
}) {
    const enabledCount = () => props.extensions.filter(e => e.enabled).length;
    return (
        <TitleBlock
            title="Extensions"
            icon={IconPuzzle}
            tint="sandstone"
            meta={
                props.extensions.length > 0
                    ? `${enabledCount()} of ${props.extensions.length} enabled`
                    : undefined
            }
            actions={
                <div class={s.titleActions}>
                    <button
                        type="button"
                        class={s.textBtn}
                        onClick={props.onCheck}
                        disabled={
                            props.checking || props.extensions.length === 0
                        }
                    >
                        <Show
                            when={props.checking}
                            fallback={
                                <>
                                    <IconRefresh size={13} /> Check for updates
                                </>
                            }
                        >
                            <IconLoader size={13} /> Checking…
                        </Show>
                    </button>
                </div>
            }
        />
    );
}

function InstallIntake(props: { installer: ReturnType<typeof useInstaller> }) {
    const installer = () => props.installer;
    return (
        <div class={s.intake}>
            <span class={s.intakeLabel} id="ext-intake-label">
                Source
            </span>
            <input
                class={s.intakeInput}
                type="text"
                placeholder="https://… (.crx or .xpi)"
                value={installer().urlInput()}
                aria-labelledby="ext-intake-label"
                onInput={e => installer().setUrlInput(e.currentTarget.value)}
                onKeyDown={e => {
                    if (e.key === "Enter") installer().handleInstallUrl();
                }}
            />
            <button
                type="button"
                class={s.textBtn}
                onClick={installer().handleInstallUrl}
                disabled={
                    installer().installing() || !installer().urlInput().trim()
                }
            >
                <Show
                    when={installer().installing()}
                    fallback={
                        <>
                            <IconLink size={13} /> Install
                        </>
                    }
                >
                    <IconLoader size={13} /> Installing…
                </Show>
            </button>
            <label class={s.uploadLabel}>
                <IconUpload size={13} /> Upload file
                <input
                    type="file"
                    accept=".crx,.xpi"
                    class={s.uploadInput}
                    onChange={installer().handleFileUpload}
                />
            </label>
        </div>
    );
}

/**
 * One region for both outcomes, always present in the DOM. A live region
 * that is added at the same moment its text arrives is frequently missed
 * entirely — the announcement has to land in a region the screen reader was
 * already watching.
 */
function StatusLine(props: { error: string | null; status: string | null }) {
    return (
        <p
            class={`${s.status} ${props.error ? s.statusTone.error : s.statusTone.info}`}
            role="status"
            aria-live="polite"
        >
            <Show when={props.error ?? props.status}>
                <span class={s.statusMark} aria-hidden="true" />
                {props.error ?? props.status}
            </Show>
        </p>
    );
}

/** One kind of extension under its own rule, shown when any are installed. */
function ExtensionSection(props: {
    label: string;
    list: ExtensionListItem[];
    uninstaller: ReturnType<typeof useArmedUninstall>;
}) {
    return (
        <Show when={props.list.length > 0}>
            <div class={s.section}>
                <Rule label={props.label} weight="major" />
                <ul class={s.list}>
                    <For each={props.list} keyed={false}>
                        {ext => (
                            <ExtensionRow
                                ext={ext()}
                                armed={props.uninstaller.armedId() === ext().id}
                                onToggle={v =>
                                    extensionsSetEnabled(ext().id, v)
                                }
                                onArm={() => props.uninstaller.arm(ext().id)}
                                onUninstall={() =>
                                    props.uninstaller.uninstall(ext().id)
                                }
                            />
                        )}
                    </For>
                </ul>
            </div>
        </Show>
    );
}

export default function ExtensionsPage() {
    // Reactive extension index: reading extensions() inside JSX or a memo
    // re-runs on any install / uninstall / enable-toggle / update, since each
    // routes through saveIndex, which notifies the reactive store.
    const extensions = (): ExtensionListItem[] => extensionsGetAll();
    const installer = useInstaller();
    const updates = useUpdateCheck(installer.setError);
    const uninstaller = useArmedUninstall();

    return (
        <Sheet>
            <ExtensionsTitle
                extensions={extensions()}
                checking={updates.checking()}
                onCheck={updates.handleCheckUpdates}
            />

            <p class={schematic.lede}>
                Add tools to your browser. Turn them on or off whenever you
                like.
            </p>

            <InstallIntake installer={installer} />
            <StatusLine
                error={installer.error()}
                status={updates.updateStatus()}
            />

            {/* One statement, not three. The title block's meta, this rule's
                label and the body line all said "none installed" within 150px
                of each other; the rule label and the meta are gone. */}
            <Show when={extensions().length === 0}>
                <Rule weight="major" />
                <div class={s.empty}>
                    <Specimen icon={IconPuzzle} tint="stone" size={64} />
                    <Anno muted>
                        No extensions yet. Install one from a link or upload a
                        file.
                    </Anno>
                </div>
            </Show>

            <ExtensionSection
                label="Chrome extensions"
                list={extensions().filter(e => e.type === "crx")}
                uninstaller={uninstaller}
            />
            <ExtensionSection
                label="Firefox extensions"
                list={extensions().filter(e => e.type === "xpi")}
                uninstaller={uninstaller}
            />
        </Sheet>
    );
}
