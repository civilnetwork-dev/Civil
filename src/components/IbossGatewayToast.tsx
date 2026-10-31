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
    onSubmit: (gatewayHost: string) => void;
}

async function submitGateway(
    contribution: ReturnType<typeof useContributionSubmit>,
    props: Props,
    gatewayHost: string,
    securityKey: string,
) {
    const host = gatewayHost.trim();
    if (!host) return;
    await contribution.submit<{ gatewayHost: string }>(
        "/api/iboss/submitGateway",
        {
            gatewayHost: host,
            securityKey: securityKey.trim() || undefined,
            leaId: props.leaId,
            districtName: props.districtName,
            source: "manual",
        },
        data => props.onSubmit(data.gatewayHost),
    );
}

export default function IbossGatewayToast(props: Props) {
    const [gatewayHost, setGatewayHost] = createSignal("");
    const [securityKey, setSecurityKey] = createSignal("");
    const contribution = useContributionSubmit();

    const handleSubmit = () =>
        submitGateway(contribution, props, gatewayHost(), securityKey());

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

            <ContributionField
                placeholder="cn…-vnsg….ibosscloud.com"
                value={gatewayHost()}
                onInput={setGatewayHost}
            />

            <span class={s.orDivider}>security key (optional)</span>

            <ContributionField
                placeholder="Account web security key - enables live categorization"
                value={securityKey()}
                onInput={setSecurityKey}
            />

            <ContributionActions
                error={contribution.error()}
                canSubmit={!!gatewayHost().trim()}
                submitting={contribution.submitting()}
                onSkip={props.onDismiss}
                onSubmit={() => void handleSubmit()}
            />
        </div>
    );
}
