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
            const data = await submitContribution<{ gatewayHost: string }>(
                "/api/iboss/submit-gateway",
                {
                    gatewayHost: host,
                    securityKey: securityKey().trim() || undefined,
                    leaId: props.leaId,
                    districtName: props.districtName,
                    source: "manual",
                },
            );
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
            <ContributionHeader
                title="Improve iboss filter checking"
                districtName={props.districtName}
                onDismiss={props.onDismiss}
            />

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

            <ContributionActions
                error={error()}
                canSubmit={!!gatewayHost().trim()}
                submitting={submitting()}
                onSkip={props.onDismiss}
                onSubmit={() => void handleSubmit()}
            />
        </div>
    );
}
