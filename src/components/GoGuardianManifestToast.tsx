import { TbOutlineX } from "solid-icons/tb";
import { createSignal, Show } from "solid-js";
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

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        setDropActive(false);
        const file = e.dataTransfer?.files[0];
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
        reader.readAsText(file);
    };

    const handleFileInput = (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
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
        reader.readAsText(file);
    };

    const handleSubmit = async () => {
        const key = manifestKey().trim();
        if (!key) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/goguardian/submit-manifest-key", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    manifestKey: key,
                    leaId: props.leaId,
                    districtName: props.districtName,
                }),
            });
            if (!res.ok) {
                const text = await res.text();
                setError(text.slice(0, 120) || `HTTP ${res.status}`);
                return;
            }
            const data = (await res.json()) as { extensionId: string };
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
            <div class={s.header}>
                <div class={s.titleGroup}>
                    <h3 class={s.title}>Improve GoGuardian filter checking</h3>
                    <span class={s.districtName} title={props.districtName}>
                        {props.districtName}
                    </span>
                </div>
                <button
                    class={s.dismissBtn}
                    onClick={props.onDismiss}
                    aria-label="Dismiss"
                    type="button"
                >
                    <TbOutlineX />
                </button>
            </div>

            <p class={s.description}>
                No GoGuardian manifest key on file for your school district.
                Share your <code>manifest.json</code> key to help improve filter
                checking for other students in your district.
            </p>

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
                spellcheck={false}
            />

            <Show when={error()}>
                <p class={s.errorText}>{error()}</p>
            </Show>

            <div class={s.actions}>
                <button
                    class={s.cancelBtn}
                    type="button"
                    onClick={props.onDismiss}
                >
                    Skip
                </button>
                <button
                    class={s.submitBtn}
                    type="button"
                    disabled={!manifestKey().trim() || submitting()}
                    onClick={() => void handleSubmit()}
                >
                    {submitting() ? "Submitting…" : "Submit"}
                </button>
            </div>
        </div>
    );
}
