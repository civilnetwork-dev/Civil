import { createSignal, For, onSettled, Show } from "solid-js";

import { IconBan, IconLoader } from "~/components/icons";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import StrikeGauge from "~/components/StrikeGauge";

import * as s from "~/styles/BanInfoPage.css";
import * as schematic from "~/styles/schematic.css";

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
            <div class={s.statusBlock}>
                <Show
                    when={status()!.banned}
                    fallback={
                        <StrikeGauge
                            violations={status()!.violations}
                            maxViolations={status()!.maxViolations}
                        />
                    }
                >
                    <div class={s.banned}>
                        <IconBan size={20} class={s.bannedIcon} />
                        <div class={s.bannedInfo}>
                            <span class={s.bannedTitle}>
                                Your account has been banned
                            </span>
                            <Show when={status()!.banReason}>
                                <span class={s.bannedDetail}>
                                    reason: {status()!.banReason}
                                </span>
                            </Show>
                            <Show when={status()!.bannedAt}>
                                <span class={s.bannedDetail}>
                                    banned on:{" "}
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
    const [loadError, setLoadError] = createSignal<string | null>(null);
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

        // The blocklist is fetched from a third-party host at runtime, so it
        // can fail for reasons that have nothing to do with this app — and the
        // school filter this proxy exists to get around is one of them. Without
        // this the page sat on "loading blocklist" forever, which reads as a
        // hung app rather than an unreachable list.
        void load().catch(() => {
            setLoading(false);
            setLoadError(
                "Couldn't reach the blocklist source. It's fetched from GitHub, which may itself be blocked here.",
            );
        });

        return () => {
            window.removeEventListener("scroll", checkForMore);
            window.removeEventListener("resize", checkForMore);
        };
    });

    return (
        <Sheet density="fine">
            <TitleBlock
                title="Restricted domains"
                meta={
                    loading()
                        ? "loading"
                        : `${domains().length.toLocaleString()} on file`
                }
            />

            {/* Every vendor whose list this overlaps keeps theirs behind an
                administrator login, so a student who is blocked cannot see what
                they were blocked by. Civil's is on this page, in full, with a
                count. */}
            <p class={schematic.lede}>
                The whole list, in the open. Every filter vendor keeps theirs
                behind an administrator login — this one has a count at the top
                and a last line you can scroll to.
            </p>

            <StatusSection />

            <div class={s.controls}>
                {/* oxlint-disable-next-line jsx-a11y/label-has-associated-control -- Solid spells the attribute "for", not "htmlFor"; it points at #baninfo-max below */}
                <label class={s.controlLabel} for="baninfo-max">
                    max entries shown
                </label>
                <input
                    class={s.controlInput}
                    id="baninfo-max"
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
                {/* One region, always mounted, so the count is announced as it
                    grows rather than appearing in a region the screen reader
                    was never watching. */}
                <span class={s.stats} aria-live="polite">
                    <Show when={!loading() && !loadError()}>
                        {`showing ${visibleDomains().length.toLocaleString()} of ${cappedDomains().length.toLocaleString()}`}
                    </Show>
                </span>
            </div>

            <Rule label="roll" weight="major" />

            <Show when={loadError()}>
                <span class={s.note.error}>{loadError()}</span>
            </Show>

            <Show when={loading()}>
                <span class={s.note.loading}>
                    <IconLoader size={14} class={s.spin} />
                    loading blocklist
                </span>
            </Show>

            <Show when={!loading() && !loadError()}>
                <div class={s.roll}>
                    <For each={visibleDomains()} keyed={false}>
                        {domain => <div class={s.domain}>{domain()}</div>}
                    </For>
                </div>

                <Show
                    when={hasMore()}
                    fallback={<span class={s.note.end}>end of list</span>}
                >
                    <div ref={sentinelRef} class={s.sentinel} />
                </Show>
            </Show>
        </Sheet>
    );
}
