import { Show } from "solid-js";

import { IconClose } from "~/components/icons";

import * as s from "~/styles/GoGuardianManifestToast.css";

/**
 * POSTs a district contribution and returns the server's JSON reply. Rejects
 * with the server's own message, or the HTTP status when it sent none, and
 * with the network error when the request never completes.
 */
export async function submitContribution<T>(
    url: string,
    body: object,
): Promise<T> {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text.slice(0, 120) || `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
}

/** A contribution toast's title row: what it asks for, for which district. */
export function ContributionHeader(props: {
    title: string;
    districtName: string;
    onDismiss: () => void;
}) {
    return (
        <div class={s.header}>
            <div class={s.titleGroup}>
                <h3 class={s.title}>{props.title}</h3>
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
    );
}

/** The error line and the Skip and Submit buttons that end every
 *  contribution toast. */
export function ContributionActions(props: {
    error: string | null;
    canSubmit: boolean;
    submitting: boolean;
    onSkip: () => void;
    onSubmit: () => void;
}) {
    return (
        <>
            <Show when={props.error}>
                <p class={s.errorText}>{props.error}</p>
            </Show>

            <div class={s.actions}>
                <button
                    class={s.cancelBtn}
                    type="button"
                    onClick={props.onSkip}
                >
                    Skip
                </button>
                <button
                    class={s.submitBtn}
                    type="button"
                    disabled={!props.canSubmit || props.submitting}
                    onClick={props.onSubmit}
                >
                    {props.submitting ? "Submitting…" : "Submit"}
                </button>
            </div>
        </>
    );
}
