import { createSignal } from "solid-js";

import {
    ContributionActions,
    ContributionHeader,
    submitContribution,
} from "~/components/ContributionToast";

import * as s from "~/styles/GoGuardianManifestToast.css";

interface Props {
    districtName: string;
    leaId: string;
    onDismiss: () => void;
    onSubmit: (extensionId: string) => void;
}

export default function GoGuardianManifestToast(props: Props) {
    const [manifestKey, setManifestKey] = createSignal("");
    const [submitting, setSubmitting] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const [dropActive, setDropActive] = createSignal(false);

    const extractKeyFromManifest = (text: string): string | null => {
        try {
            const json = JSON.parse(text) as Record<string, unknown>;
            const key = json["key"];
            return typeof key === "string" ? key : null;
        } catch {
            return null;
        }
    };

    /** Both intake paths — a drop and the file picker — end here. */
    const readManifestFile = (file: File | undefined) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const key = extractKeyFromManifest(reader.result as string);
            if (key) {
                setManifestKey(key);
                setError(null);
            } else {
                setError('No "key" field found in manifest.json');
            }
        };
        reader.onerror = () => {
            setError("Couldn't read that file. Try again.");
        };
        reader.readAsText(file);
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        setDropActive(false);
        readManifestFile(e.dataTransfer?.files[0]);
    };

    const handleFileInput = (e: Event) => {
        readManifestFile((e.currentTarget as HTMLInputElement).files?.[0]);
    };

    const handleSubmit = async () => {
        const key = manifestKey().trim();
        if (!key) return;
        setSubmitting(true);
        setError(null);
        try {
            const data = await submitContribution<{ extensionId: string }>(
                "/api/goguardian/submit-manifest-key",
                {
                    manifestKey: key,
                    leaId: props.leaId,
                    districtName: props.districtName,
                },
            );
            props.onSubmit(data.extensionId);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Network error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            class={s.toast}
            role="dialog"
            aria-label="Share GoGuardian manifest key"
        >
            <ContributionHeader
                title="Improve GoGuardian filter checking"
                districtName={props.districtName}
                onDismiss={props.onDismiss}
            />

            <p class={s.description}>
                No GoGuardian manifest key on file for your school district.
                Share your <code>manifest.json</code> key to help improve filter
                checking for other students in your district.
            </p>

            {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the label wraps the file input, so clicking or dropping on it activates a real control */}
            <label
                class={s.dropZone}
                data-active={dropActive() ? "true" : "false"}
                onDragOver={e => {
                    e.preventDefault();
                    setDropActive(true);
                }}
                onDragLeave={() => setDropActive(false)}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    accept=".json,application/json"
                    style={{ display: "none" }}
                    onChange={handleFileInput}
                />
                {dropActive()
                    ? "Drop manifest.json here"
                    : "Drop manifest.json or click to browse"}
            </label>

            <span class={s.orDivider}>or paste key</span>

            <textarea
                class={s.textarea}
                placeholder="Paste the base64 public key from manifest.json here…"
                value={manifestKey()}
                onInput={e => setManifestKey(e.currentTarget.value)}
                spellcheck="false"
            />

            <ContributionActions
                error={error()}
                canSubmit={!!manifestKey().trim()}
                submitting={submitting()}
                onSkip={props.onDismiss}
                onSubmit={() => void handleSubmit()}
            />
        </div>
    );
}
