import { createSignal, Show } from "solid-js";

import { IconClose } from "~/components/icons";

import * as s from "~/styles/GoGuardianManifestToast.css";

interface Props {
    districtName: string;
    leaId: string;
    onDismiss: () => void;
    onSubmit: (gatewayHost: string) => void;
}

export default function IbossGatewayToast(props: Props) {
    const [gatewayHost, setGatewayHost] = createSignal("");
    const [securityKey, setSecurityKey] = createSignal("");
    const [submitting, setSubmitting] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);

    const handleSubmit = async () => {
        const host = gatewayHost().trim();
        if (!host) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/iboss/submit-gateway", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gatewayHost: host,
                    securityKey: securityKey().trim() || undefined,
                    leaId: props.leaId,
                    districtName: props.districtName,
                    source: "manual",
                }),
            });
            if (!res.ok) {
                const text = await res.text();
                setError(text.slice(0, 120) || `HTTP ${res.status}`);
                return;
            }
            const data = (await res.json()) as { gatewayHost: string };
            props.onSubmit(data.gatewayHost);
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
            aria-label="Share iboss gateway host"
        >
            <div class={s.header}>
                <div class={s.titleGroup}>
                    <h3 class={s.title}>Improve iboss filter checking</h3>
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
                    <IconClose />
                </button>
            </div>

            <p class={s.description}>
                No iboss cloud gateway on file for your school district. If you
                know your district's gateway host (e.g.{" "}
                <code>cn1759617341-vnsg10840.ibosscloud.com</code>), share it to
                help other students in your district check filters.
            </p>

            <span class={s.orDivider}>gateway host</span>

            <textarea
                class={s.textarea}
                placeholder="cn…-vnsg….ibosscloud.com"
                value={gatewayHost()}
                onInput={e => setGatewayHost(e.currentTarget.value)}
                spellcheck="false"
            />

            <span class={s.orDivider}>security key (optional)</span>

            <textarea
                class={s.textarea}
                placeholder="Account web security key - enables live categorization"
                value={securityKey()}
                onInput={e => setSecurityKey(e.currentTarget.value)}
                spellcheck="false"
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
                    disabled={!gatewayHost().trim() || submitting()}
                    onClick={() => void handleSubmit()}
                >
                    {submitting() ? "Submitting…" : "Submit"}
                </button>
            </div>
        </div>
    );
}
