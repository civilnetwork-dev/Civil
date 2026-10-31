import { Show } from "solid-js";

import { IconBan } from "~/components/icons";
import Specimen from "~/components/Specimen";
import { createBanStatus } from "~/lib/banStatus";

import * as s from "~/styles/BanPage.css";

/** The specimen wears the severity band's tone. */
const SPECIMEN_TINT = { banned: "wine", restricted: "sandstone" } as const;

type BanStatus = ReturnType<ReturnType<typeof createBanStatus>>;

function RestrictedNotice(props: { banReason: string }) {
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
            <div class={s.actions}>
                <a class={s.link} href="/banInfo">
                    See the restricted list
                </a>
                {/* A filter's block page tells you to contact an
                    administrator. Civil's says which list this came from and
                    lets you read it. */}
                <span class={s.note}>Civil publishes its whole list</span>
            </div>
        </>
    );
}

function BannedNotice(props: { status: BanStatus }) {
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
                <a class={s.link} href="/banInfo">
                    View ban details
                </a>
            </div>
        </>
    );
}

export default function BanPage({ banReason }: { banReason: string }) {
    const status = createBanStatus();

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
                    fallback={<RestrictedNotice banReason={banReason} />}
                >
                    <BannedNotice status={status()} />
                </Show>
            </div>
        </div>
    );
}
