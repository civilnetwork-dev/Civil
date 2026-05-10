import { createSignal, For, onSettled, Show } from "solid-js";
import * as s from "~/styles/BanInfoPage.css";

const PAGE_SIZE = 50;

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
                fallback={<p class={s.loadingText}>Loading blocklist…</p>}
            >
                <div class={s.scrollContainer}>
                    <For each={visibleDomains()}>
                        {domain => <div class={s.domainItem}>{domain()}</div>}
                    </For>

                    <Show
                        when={hasMore()}
                        fallback={<p class={s.endText}>— end of list —</p>}
                    >
                        <div ref={sentinelRef} class={s.sentinel} />
                    </Show>
                </div>
            </Show>
        </div>
    );
}
