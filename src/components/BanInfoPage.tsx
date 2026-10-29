import { createSignal, For, onSettled, Show } from "solid-js";

import { IconBan, IconLoader } from "~/components/icons";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import StrikeGauge from "~/components/StrikeGauge";
import { createViolationsStatus } from "~/lib/violations";

import * as s from "~/styles/BanInfoPage.css";
import * as schematic from "~/styles/schematic.css";

const PAGE_SIZE = 50;

function StatusSection() {
    const status = createViolationsStatus();

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
                                    Reason: {status()!.banReason}
                                </span>
                            </Show>
                            <Show when={status()!.bannedAt}>
                                <span class={s.bannedDetail}>
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

const BLOCKLIST_BASE =
    "https://raw.githubusercontent.com/Bon-Appetit/porn-domains/refs/heads/main";

async function fetchBlocklist(): Promise<string[]> {
    const metaRes = await fetch(`${BLOCKLIST_BASE}/meta.json`);
    const meta = await metaRes.json();
    const blocklistUrl = `${BLOCKLIST_BASE}/${meta.blocklist.name}`;

    const listRes = await fetch(blocklistUrl);
    const text = await listRes.text();
    return text
        .split("\n")
        .map(d => d.trim())
        .filter(d => d.length > 0);
}

function useBlocklist(onLoaded: () => void) {
    const [domains, setDomains] = createSignal<string[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [loadError, setLoadError] = createSignal<string | null>(null);

    onSettled(() => {
        const load = async () => {
            setDomains(await fetchBlocklist());
            setLoading(false);
            onLoaded();
        };

        // The blocklist is fetched from a third-party host at runtime, so it
        // can fail for reasons that have nothing to do with this app, and the
        // school filter this proxy exists to get around is one of them. Without
        // this the page sat on "loading blocklist" forever, which reads as a
        // hung app rather than an unreachable list.
        void load().catch(() => {
            setLoading(false);
            setLoadError(
                "Couldn't reach the blocklist source. It's fetched from GitHub, which may itself be blocked here.",
            );
        });
    });

    return { domains, loading, loadError };
}

type Blocklist = ReturnType<typeof useBlocklist>;

function useReveal(list: Blocklist) {
    const [maxCount, setMaxCount] = createSignal(500);
    const [visibleCount, setVisibleCount] = createSignal(PAGE_SIZE);
    let sentinelRef: HTMLDivElement | undefined;

    const cappedDomains = () => list.domains().slice(0, maxCount());
    const visibleDomains = () => cappedDomains().slice(0, visibleCount());
    const hasMore = () => visibleCount() < cappedDomains().length;

    const checkForMore = () => {
        if (list.loading() || !hasMore() || !sentinelRef) {
            return;
        }

        const rect = sentinelRef.getBoundingClientRect();
        if (rect.top <= window.innerHeight + 160) {
            setVisibleCount(count =>
                Math.min(count + PAGE_SIZE, cappedDomains().length),
            );
            scheduleCheck();
        }
    };
    const scheduleCheck = () =>
        queueMicrotask(() => requestAnimationFrame(checkForMore));

    const setMax = (value: string) => {
        const val = parseInt(value, 10);
        if (!Number.isNaN(val) && val > 0) {
            setMaxCount(val);
            setVisibleCount(PAGE_SIZE);
            scheduleCheck();
        }
    };

    onSettled(() => {
        window.addEventListener("scroll", checkForMore, { passive: true });
        window.addEventListener("resize", checkForMore);
        return () => {
            window.removeEventListener("scroll", checkForMore);
            window.removeEventListener("resize", checkForMore);
        };
    });

    return {
        maxCount,
        cappedDomains,
        visibleDomains,
        hasMore,
        setMax,
        scheduleCheck,
        setSentinel: (el: HTMLDivElement) => (sentinelRef = el),
    };
}

type Reveal = ReturnType<typeof useReveal>;

function MaxControl(props: { list: Blocklist; reveal: Reveal }) {
    return (
        <div class={s.controls}>
            {/* oxlint-disable-next-line jsx-a11y/label-has-associated-control -- Solid spells the attribute "for", not "htmlFor"; it points at #baninfo-max below */}
            <label class={s.controlLabel} for="baninfo-max">
                Show up to
            </label>
            <input
                class={s.controlInput}
                id="baninfo-max"
                type="number"
                value={props.reveal.maxCount()}
                min={1}
                onInput={e => props.reveal.setMax(e.currentTarget.value)}
            />
            {/* One region, always mounted, so the count is announced as it
                grows rather than appearing in a region the screen reader
                was never watching. */}
            <span class={s.stats} aria-live="polite">
                <Show when={!props.list.loading() && !props.list.loadError()}>
                    {`Showing ${props.reveal.visibleDomains().length.toLocaleString()} of ${props.reveal.cappedDomains().length.toLocaleString()}`}
                </Show>
            </span>
        </div>
    );
}

function DomainRoll(props: { reveal: Reveal }) {
    return (
        <>
            <div class={s.roll}>
                <For each={props.reveal.visibleDomains()} keyed={false}>
                    {domain => <div class={s.domain}>{domain()}</div>}
                </For>
            </div>

            <Show
                when={props.reveal.hasMore()}
                fallback={<span class={s.note.end}>End of list</span>}
            >
                <div ref={props.reveal.setSentinel} class={s.sentinel} />
            </Show>
        </>
    );
}

export default function BanInfoPage() {
    const list = useBlocklist(() => reveal.scheduleCheck());
    const reveal = useReveal(list);

    return (
        <Sheet>
            <TitleBlock
                title="Restricted domains"
                icon={IconBan}
                tint="wine"
                meta={
                    list.loading()
                        ? "Loading…"
                        : `${list.domains().length.toLocaleString()} on file`
                }
            />

            {/* Every vendor whose list this overlaps keeps theirs behind an
                administrator login, so a student who is blocked cannot see what
                they were blocked by. Civil's is on this page, in full, with a
                count. */}
            <p class={schematic.lede}>
                The whole list, in the open. Every filter vendor keeps theirs
                behind an administrator login. This one has a count at the top
                and a last line you can scroll to.
            </p>

            <StatusSection />

            <MaxControl list={list} reveal={reveal} />

            <Rule label="Domains" weight="major" />

            <Show when={list.loadError()}>
                <span class={s.note.error}>{list.loadError()}</span>
            </Show>

            <Show when={list.loading()}>
                <span class={s.note.loading}>
                    <IconLoader size={14} class={s.spin} />
                    Loading the list…
                </span>
            </Show>

            <Show when={!list.loading() && !list.loadError()}>
                <DomainRoll reveal={reveal} />
            </Show>
        </Sheet>
    );
}
