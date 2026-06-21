import { createSignal, onSettled, Show } from "solid-js";
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

    return (
        <div class={s.banRoot}>
            <div class={s.banText}>
                <Show
                    when={isPermanentlyBanned()}
                    fallback={
                        <>
                            <h1>Site Restricted</h1>
                            <p>
                                {banReason ||
                                    "This site is restricted by the proxy."}
                            </p>
                            <Show when={status()}>
                                <p
                                    style={{
                                        "font-size": "14px",
                                        opacity: "0.6",
                                    }}
                                >
                                    Strike {status()!.violations} of{" "}
                                    {status()!.maxViolations}
                                </p>
                            </Show>
                            <a href="/baninfo">View your proxy status</a>
                        </>
                    }
                >
                    <h1>Banned</h1>
                    <p>
                        {status()?.banReason ??
                            "You have been permanently banned from this proxy."}
                    </p>
                    <a href="/baninfo">View ban details</a>
                </Show>
            </div>
        </div>
    );
}
