import { createSignal } from "solid-js";

import {
    ContributionActions,
    ContributionField,
    ContributionHeader,
    useContributionSubmit,
} from "~/components/ContributionToast";

import * as s from "~/styles/GoGuardianManifestToast.css";

interface Props {
    districtName: string;
    leaId: string;
    onDismiss: () => void;
    onSubmit: (extensionId: string) => void;
}

function extractKeyFromManifest(text: string): string | null {
    try {
        const json = JSON.parse(text) as Record<string, unknown>;
        const key = json["key"];
        return typeof key === "string" ? key : null;
    } catch {
        return null;
    }
}

/** A manifest.json dropped on the zone or picked with the file browser. */
function ManifestDropZone(props: {
    onKey: (key: string) => void;
    onError: (error: string) => void;
}) {
    const [dropActive, setDropActive] = createSignal(false);

    /** Both intake paths, a drop and the file picker, end here. */
    const readManifestFile = (file: File | undefined) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const key = extractKeyFromManifest(reader.result as string);
            if (key) props.onKey(key);
            else props.onError('No "key" field found in manifest.json');
        };
        reader.onerror = () => {
            props.onError("Couldn't read that file. Try again.");
        };
        reader.readAsText(file);
    };

    return (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the label wraps the file input, so clicking or dropping on it activates a real control
        <label
            class={s.dropZone}
            data-active={dropActive() ? "true" : "false"}
            onDragOver={e => {
                e.preventDefault();
                setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e: DragEvent) => {
                e.preventDefault();
                setDropActive(false);
                readManifestFile(e.dataTransfer?.files[0]);
            }}
        >
            <input
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={e => readManifestFile(e.currentTarget.files?.[0])}
            />
            {dropActive()
                ? "Drop manifest.json here"
                : "Drop manifest.json or click to browse"}
        </label>
    );
}

async function submitManifestKey(
    contribution: ReturnType<typeof useContributionSubmit>,
    props: Props,
    manifestKey: string,
) {
    const key = manifestKey.trim();
    if (!key) return;
    await contribution.submit<{ extensionId: string }>(
        "/api/goguardian/submit-manifest-key",
        {
            manifestKey: key,
            leaId: props.leaId,
            districtName: props.districtName,
        },
        data => props.onSubmit(data.extensionId),
    );
}

export default function GoGuardianManifestToast(props: Props) {
    const [manifestKey, setManifestKey] = createSignal("");
    const contribution = useContributionSubmit();

    const handleSubmit = () =>
        submitManifestKey(contribution, props, manifestKey());

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

            <ManifestDropZone
                onKey={key => {
                    setManifestKey(key);
                    contribution.setError(null);
                }}
                onError={contribution.setError}
            />

            <span class={s.orDivider}>or paste key</span>

            <ContributionField
                placeholder="Paste the base64 public key from manifest.json here…"
                value={manifestKey()}
                onInput={setManifestKey}
            />

            <ContributionActions
                error={contribution.error()}
                canSubmit={!!manifestKey().trim()}
                submitting={contribution.submitting()}
                onSkip={props.onDismiss}
                onSubmit={() => void handleSubmit()}
            />
        </div>
    );
}
