import { TbOutlineBan, TbOutlineLoader } from "solid-icons/tb";
import { createSignal, For, onSettled, Show } from "solid-js";
import * as s from "~/styles/BanInfoPage.css";

const PAGE_SIZE = 50;

type ViolationsData = {
    authenticated: boolean;
    banned: boolean;
    banReason: string | null;
    bannedAt: string | null;
    violations: number;
    maxViolations: number;
};

function StatusSection() {
    const [status, setStatus] = createSignal<ViolationsData | null>(null);

    onSettled(() => {
        void fetch("/api/violations")
            .then(r => r.json())
            .then((data: ViolationsData) => setStatus(data))
            .catch(() => {});
    });

    return (
        <Show when={status()}>
            <div class={s.statusSection}>
                <Show
                    when={status()!.banned}
                    fallback={
                        <div class={s.strikeCard}>
                            <div class={s.strikeHeader}>
                                <span class={s.strikeLabel}>
                                    Your proxy strikes
                                </span>
                                <span class={s.strikeCount}>
                                    {status()!.violations} /{" "}
                                    {status()!.maxViolations}
                                </span>
                            </div>
                            <div class={s.strikeTrack}>
                                <div
                                    class={s.strikeFill}
                                    style={{
                                        width: `${Math.min((status()!.violations / status()!.maxViolations) * 100, 100)}%`,
                                        "--fill-color":
                                            status()!.violations === 0
                                                ? "var(--color-green)"
                                                : status()!.violations < 3
                                                  ? "var(--color-yellow)"
                                                  : "var(--color-red)",
                                    }}
                                />
                            </div>
                            <p class={s.policyText}>
                                Accessing restricted domains through the proxy
                                counts as a strike. At {status()!.maxViolations}{" "}
                                strikes your account is permanently banned.
                                Strikes reset after 24 hours of inactivity.
                            </p>
                        </div>
                    }
                >
                    <div class={s.bannedBanner}>
                        <TbOutlineBan class={s.bannedIcon} />
                        <div class={s.bannedInfo}>
                            <span class={s.bannedTitle}>
                                Your account has been banned
                            </span>
                            <Show when={status()!.banReason}>
                                <span class={s.bannedReason}>
                                    Reason: {status()!.banReason}
                                </span>
                            </Show>
                            <Show when={status()!.bannedAt}>
                                <span class={s.bannedDate}>
                                    Banned on:{" "}
                                    {new Date(
                                        status()!.bannedAt!,
                                    ).toLocaleString()}
                                </span>
                            </Show>
                        </div>
                    </div>
                </Show>
            </div>
        </Show>
    );
}

export default function BanInfoPage() {
    const [domains, setDomains] = createSignal<string[]>([]);
    const [maxCount, setMaxCount] = createSignal(500);
    const [visibleCount, setVisibleCount] = createSignal(PAGE_SIZE);
    const [loading, setLoading] = createSignal(true);
    let sentinelRef!: HTMLDivElement;

    const cappedDomains = () => domains().slice(0, maxCount());
    const visibleDomains = () => cappedDomains().slice(0, visibleCount());
    const hasMore = () => visibleCount() < cappedDomains().length;

    const checkForMore = () => {
        if (loading() || !hasMore() || !sentinelRef) {
            return;
        }

        const rect = sentinelRef.getBoundingClientRect();
        if (rect.top <= window.innerHeight + 160) {
            setVisibleCount(count =>
                Math.min(count + PAGE_SIZE, cappedDomains().length),
            );
            queueMicrotask(() => requestAnimationFrame(checkForMore));
        }
    };

    onSettled(() => {
        const load = async () => {
            const metaRes = await fetch(
                "https://raw.githubusercontent.com/Bon-Appetit/porn-domains/refs/heads/main/meta.json",
            );
            const meta = await metaRes.json();
            const blocklistUrl = `https://raw.githubusercontent.com/Bon-Appetit/porn-domains/refs/heads/main/${meta.blocklist.name}`;

            const listRes = await fetch(blocklistUrl);
            const text = await listRes.text();
            const list = text
                .split("\n")
                .map(d => d.trim())
                .filter(d => d.length > 0);

            setDomains(list);
            setLoading(false);
            queueMicrotask(() => requestAnimationFrame(checkForMore));
        };

        window.addEventListener("scroll", checkForMore, { passive: true });
        window.addEventListener("resize", checkForMore);

        void load();

        return () => {
            window.removeEventListener("scroll", checkForMore);
            window.removeEventListener("resize", checkForMore);
        };
    });

    return (
        <div class={s.banInfoRoot}>
            <div class={s.header}>
                <h1 class={s.title}>Restricted Domains</h1>
                <StatusSection />
                <div class={s.inputRow}>
                    <label class={s.label} for={s.input}>
                        Max entries shown:
                    </label>
                    <input
                        class={s.input}
                        id={s.input}
                        type="number"
                        value={maxCount()}
                        min={1}
                        onInput={e => {
                            const val = parseInt(e.currentTarget.value, 10);
                            if (!Number.isNaN(val) && val > 0) {
                                setMaxCount(val);
                                setVisibleCount(PAGE_SIZE);
                                queueMicrotask(() =>
                                    requestAnimationFrame(checkForMore),
                                );
                            }
                        }}
                    />
                </div>
                <Show when={!loading()}>
                    <span class={s.statsText}>
                        {`Showing ${visibleDomains().length.toLocaleString()} of ${cappedDomains().length.toLocaleString()} entries (${domains().length.toLocaleString()} total)`}
                    </span>
                </Show>
            </div>

            <Show
                when={!loading()}
                fallback={
                    <p class={s.loadingText}>
                        <TbOutlineLoader class={s.loadingIcon} /> Loading
                        blocklist
                    </p>
                }
            >
                <div class={s.scrollContainer}>
                    <For each={visibleDomains()}>
                        {domain => <div class={s.domainItem}>{domain()}</div>}
                    </For>

                    <Show
                        when={hasMore()}
                        fallback={<p class={s.endText}>end of list</p>}
                    >
                        <div ref={sentinelRef} class={s.sentinel} />
                    </Show>
                </div>
            </Show>
        </div>
    );
}
