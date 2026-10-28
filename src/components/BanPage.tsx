import { Show } from "solid-js";

import { IconBan } from "~/components/icons";
import Specimen from "~/components/Specimen";
import StrikeGauge from "~/components/StrikeGauge";
import { createViolationsStatus } from "~/lib/violations";

import * as s from "~/styles/BanPage.css";

/** The specimen wears the severity band's tone. */
const SPECIMEN_TINT = { banned: "wine", restricted: "sandstone" } as const;

type ViolationsStatus = ReturnType<ReturnType<typeof createViolationsStatus>>;

function RestrictedNotice(props: {
    banReason: string;
    status: ViolationsStatus;
}) {
    return (
        <>
            <span class={s.eyebrow}>
                <span class={s.eyebrowMark.restricted} aria-hidden="true" />
                Blocked by Civil
            </span>
            <h1 class={s.title}>Site restricted</h1>
            <p class={s.reason}>
                {props.banReason || "This site is restricted by the proxy."}
            </p>
            {/* The strike count is the actionable part of this page — it is
                the difference between "try something else" and "one more and
                you are locked out" — so it gets the gauge rather than the
                14px, 60%-opacity line of text it was. */}
            <Show when={props.status}>
                {status => (
                    <div class={s.gaugeSlot}>
                        <StrikeGauge
                            violations={status().violations}
                            maxViolations={status().maxViolations}
                        />
                    </div>
                )}
            </Show>
            <div class={s.actions}>
                <a class={s.link} href="/baninfo">
                    View your proxy status
                </a>
                {/* A filter's block page tells you to contact an
                    administrator. Civil's says which list this came from and
                    lets you read it. */}
                <span class={s.note}>Civil publishes its whole list</span>
            </div>
        </>
    );
}

function BannedNotice(props: { status: ViolationsStatus }) {
    return (
        <>
            <span class={s.eyebrow}>
                <span class={s.eyebrowMark.banned} aria-hidden="true" />
                Account suspended
            </span>
            <h1 class={s.title}>Banned</h1>
            <p class={s.reason}>
                {props.status?.banReason ??
                    "You have been permanently banned from this proxy."}
            </p>
            <div class={s.actions}>
                <a class={s.link} href="/baninfo">
                    View ban details
                </a>
            </div>
        </>
    );
}

export default function BanPage({ banReason }: { banReason: string }) {
    const status = createViolationsStatus();

    const isPermanentlyBanned = () => status()?.banned === true;
    const tone = () => (isPermanentlyBanned() ? "banned" : "restricted");

    return (
        <div class={s.root}>
            <div class={s.plate}>
                <div class={s.band[tone()]} aria-hidden="true" />
                <Specimen
                    icon={IconBan}
                    tint={SPECIMEN_TINT[tone()]}
                    size={56}
                    class={s.mark}
                />

                <Show
                    when={isPermanentlyBanned()}
                    fallback={
                        <RestrictedNotice
                            banReason={banReason}
                            status={status()}
                        />
                    }
                >
                    <BannedNotice status={status()} />
                </Show>
            </div>
        </div>
    );
}
