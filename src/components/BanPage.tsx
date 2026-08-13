import { createSignal, onSettled, Show } from "solid-js";
import StrikeGauge from "~/components/StrikeGauge";
import * as s from "~/styles/BanPage.css";

type ViolationsData = {
    authenticated: boolean;
    banned: boolean;
    banReason: string | null;
    violations: number;
    maxViolations: number;
};

export default function BanPage({ banReason }: { banReason: string }) {
    const [status, setStatus] = createSignal<ViolationsData | null>(null);

    onSettled(() => {
        void fetch("/api/violations")
            .then(r => r.json())
            .then((data: ViolationsData) => setStatus(data))
            .catch(() => {});
    });

    const isPermanentlyBanned = () => status()?.banned === true;
    const tone = () => (isPermanentlyBanned() ? "banned" : "restricted");

    return (
        <div class={s.root}>
            <div class={s.plate}>
                <div class={s.band[tone()]} aria-hidden="true" />
                <Show
                    when={isPermanentlyBanned()}
                    fallback={
                        <>
                            <span class={s.eyebrow}>
                                <span
                                    class={s.eyebrowMark.restricted}
                                    aria-hidden="true"
                                />
                                blocked by civil
                            </span>
                            <h1 class={s.title}>Site restricted</h1>
                            <p class={s.reason}>
                                {banReason ||
                                    "This site is restricted by the proxy."}
                            </p>
                            {/* The strike count is the actionable part of this
                                page — it is the difference between "try
                                something else" and "one more and you are
                                locked out" — so it gets the gauge rather than
                                the 14px, 60%-opacity line of text it was. */}
                            <Show when={status()}>
                                <div class={s.gaugeSlot}>
                                    <StrikeGauge
                                        violations={status()!.violations}
                                        maxViolations={status()!.maxViolations}
                                    />
                                </div>
                            </Show>
                            <div class={s.actions}>
                                <a class={s.link} href="/baninfo">
                                    view your proxy status
                                </a>
                                {/* A filter's block page tells you to contact
                                    an administrator. Civil's says which list
                                    this came from and lets you read it. */}
                                <span class={s.note}>
                                    civil publishes its whole list
                                </span>
                            </div>
                        </>
                    }
                >
                    <span class={s.eyebrow}>
                        <span class={s.eyebrowMark.banned} aria-hidden="true" />
                        account suspended
                    </span>
                    <h1 class={s.title}>Banned</h1>
                    <p class={s.reason}>
                        {status()?.banReason ??
                            "You have been permanently banned from this proxy."}
                    </p>
                    <div class={s.actions}>
                        <a class={s.link} href="/baninfo">
                            view ban details
                        </a>
                    </div>
                </Show>
            </div>
        </div>
    );
}
