import {
    detectIbossGateway,
    raceIbossGateways,
} from "$config/service/ibossGatewayDetect";
import {
    createMemo,
    createSignal,
    createTrackedEffect,
    For,
    onSettled,
    Show,
} from "solid-js";

import { IconLoaderDots, IconSearch } from "~/components/icons";
import Anno from "~/components/schematic/Anno";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import {
    type FilterConfig,
    type FilterResult,
    type FilterStatus,
    findFilterConfig,
    formatRetryAfter,
    parseVerdict,
    prettifyFilterName,
} from "~/lib/filterCheckVendors";
import { checkFiltersNow } from "~/lib/swUtils";

import FilterCheckForm from "./FilterCheckForm";
import FilterCheckResults from "./FilterCheckResults";
import GoGuardianManifestToast from "./GoGuardianManifestToast";
import IbossGatewayToast from "./IbossGatewayToast";
import PatreonLoginButton from "./ui/PatreonLoginButton";

import * as s from "~/styles/FilterCheckPage.css";
import * as schematic from "~/styles/schematic.css";

/**
 * The middleware sends both `Retry-After` and a JSON `retryAfterSeconds`. Read
 * the header first: a proxy that rewrites the body still has to keep the header
 * honest, and the body may not be JSON at all if something upstream answered.
 */
async function readRetryAfter(res: Response): Promise<number> {
    const header = Number(res.headers.get("Retry-After"));
    if (Number.isFinite(header) && header > 0) return header;
    try {
        const body = (await res.json()) as { retryAfterSeconds?: unknown };
        const seconds = Number(body?.retryAfterSeconds);
        return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    } catch {
        return 0;
    }
}

async function checkFilter(
    key: string,
    config: FilterConfig,
    url: string,
    email: string,
    payloadOverride?: Record<string, unknown>,
): Promise<FilterResult> {
    try {
        const payload = payloadOverride ?? config.buildPayload(url, email);
        const res = await fetch(config.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        // 429 is the shared filter-check rate limiter, not a vendor verdict.
        // It used to fall through the generic branch below and print the raw
        // JSON body into the ledger: the single most common failure this page
        // produces (79 `filter_rate_limited` events), shown as gibberish.
        if (res.status === 429) {
            const retryAfterSeconds = await readRetryAfter(res);
            return {
                filterKey: key,
                filterName: config.name,
                status: "error",
                detail: `Daily check limit reached. You can check again ${formatRetryAfter(retryAfterSeconds)}.`,
                retryAfterSeconds,
            };
        }
        if (!res.ok) {
            const text = await res.text();
            return {
                filterKey: key,
                filterName: config.name,
                status: "error",
                detail: text.slice(0, 140) || `HTTP ${res.status}`,
            };
        }
        const data: unknown = await res.json();
        return {
            filterKey: key,
            filterName: config.name,
            ...parseVerdict(data),
        };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Network error";
        return {
            filterKey: key,
            filterName: config.name,
            status: "error",
            detail: msg,
        };
    }
}

function readDetectedFilters(): string[] {
    try {
        const raw = localStorage.getItem("detectedFilters");
        return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
        return [];
    }
}

interface District {
    leaId: string;
    name: string;
}

async function fetchDistrict(): Promise<District | null> {
    const locRes = await fetch("/api/ipLocation");
    if (!locRes.ok) return null;
    const { lat, lon } = (await locRes.json()) as {
        lat: number;
        lon: number;
    };

    const distRes = await fetch(
        `/api/schoolDistricts/nearest?lat=${lat}&lon=${lon}`,
    );
    if (!distRes.ok) return null;
    return (await distRes.json()) as District;
}

async function submitAutoGateway(
    gateway: { host: string; port: number },
    leaId: string,
    districtName: string | null,
) {
    await fetch("/api/iboss/submitGateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            gatewayHost: gateway.host,
            port: gateway.port,
            leaId,
            districtName: districtName ?? undefined,
            source: "auto",
        }),
    });
}

async function lookupIbossGateway(
    leaId: string,
    districtName: () => string | null,
    onMissing: () => void,
) {
    const gwRes = await fetch(
        `/api/iboss/gateway?leaId=${encodeURIComponent(leaId)}`,
    );
    if (gwRes.ok) return;
    if (gwRes.status !== 404) return;

    const detected = await detectIbossGateway();
    if (detected) {
        await submitAutoGateway(detected, leaId, districtName());
    } else {
        onMissing();
    }
}

async function lookupManifestKey(
    leaId: string,
    onFound: (extensionId: string) => void,
    onMissing: () => void,
) {
    const keyRes = await fetch(
        `/api/goguardian/manifestKey?leaId=${encodeURIComponent(leaId)}`,
    );
    if (keyRes.ok) {
        const { extensionId } = (await keyRes.json()) as {
            extensionId: string;
        };
        onFound(extensionId);
    } else if (keyRes.status === 404) {
        onMissing();
    }
}

interface CheckRequest {
    configs: [string, FilterConfig][];
    rawUrl: string;
    email: string;
    ggExtId: string | null;
    leaId: string | null;
}

function payloadFor(key: string, config: FilterConfig, req: CheckRequest) {
    if (key === "goguardian" && req.ggExtId)
        return {
            ...config.buildPayload(req.rawUrl, req.email),
            orgRands: [req.ggExtId],
        };
    if (key === "iboss")
        return {
            ...config.buildPayload(req.rawUrl, req.email),
            leaId: req.leaId,
        };
    return undefined;
}

function hostnameOf(rawUrl: string) {
    try {
        return new URL(rawUrl).hostname;
    } catch {
        /* keep raw */
        return rawUrl;
    }
}

const isProd = () => window.location.host === "civil.quartinal.me";

function settledResults(
    settled: PromiseSettledResult<FilterResult>[],
    configs: [string, FilterConfig][],
): FilterResult[] {
    return settled.map((r, i) => {
        if (r.status === "fulfilled") return r.value;
        const [key, config] = configs[i]!;
        if (isProd()) {
            window.posthog?.captureException(
                new Error(`filter_check_rejected: ${key}`),
                { extra: { filter: key, reason: r.reason } },
            );
        }
        return {
            filterKey: key,
            filterName: config.name,
            status: "error" as FilterStatus,
            detail: "Request failed",
        };
    });
}

function reportCompleted(
    mapped: FilterResult[],
    urlHostname: string,
    durationMs: number,
) {
    window.posthog?.capture("filter_check_completed", {
        url_hostname: urlHostname,
        duration_ms: durationMs,
        results: mapped.map(r => ({
            filter: r.filterKey,
            status: r.status,
        })),
    });
}

async function runFilterCheck(
    req: CheckRequest,
    detectedFilters: string[],
): Promise<FilterResult[]> {
    const urlHostname = hostnameOf(req.rawUrl);
    const emailDomain = req.email.includes("@")
        ? req.email.split("@")[1]
        : undefined;

    if (isProd())
        window.posthog?.capture("filter_check_submitted", {
            url_hostname: urlHostname,
            email_domain: emailDomain,
            active_filters: req.configs.map(([k]) => k),
            detected_filters: detectedFilters,
        });

    const startMs = Date.now();
    const settled = await Promise.allSettled(
        req.configs.map(([key, config]) =>
            checkFilter(
                key,
                config,
                req.rawUrl,
                req.email,
                payloadFor(key, config, req),
            ),
        ),
    );
    const durationMs = Date.now() - startMs;

    const mapped = settledResults(settled, req.configs);
    if (isProd()) reportCompleted(mapped, urlHostname, durationMs);
    return mapped;
}

function useDetectedFilters() {
    const [detectedFilters, setDetectedFilters] = createSignal<string[]>(
        readDetectedFilters(),
    );
    const [rescanning, setRescanning] = createSignal(false);

    const handleRescan = async () => {
        if (rescanning()) return;
        setRescanning(true);
        try {
            await checkFiltersNow();
        } finally {
            setRescanning(false);
        }
    };

    onSettled(() => {
        const handler = (e: Event) => {
            setDetectedFilters(
                (e as CustomEvent<string[]>).detail ?? readDetectedFilters(),
            );
        };
        window.addEventListener("detectedFiltersUpdated", handler);

        void checkFiltersNow();

        return () =>
            window.removeEventListener("detectedFiltersUpdated", handler);
    });

    return { detectedFilters, rescanning, handleRescan };
}

function useDistrict() {
    const [detectedLeaId, setDetectedLeaId] = createSignal<string | null>(null);
    const [detectedDistrictName, setDetectedDistrictName] = createSignal<
        string | null
    >(null);

    onSettled(() => {
        void (async () => {
            try {
                const district = await fetchDistrict();
                if (!district) return;
                setDetectedLeaId(district.leaId);
                setDetectedDistrictName(district.name);
            } catch {}
        })();
    });

    return { detectedLeaId, detectedDistrictName };
}

type DistrictState = ReturnType<typeof useDistrict>;

function useGoGuardianKey(
    district: DistrictState,
    detectedFilters: () => string[],
) {
    const [showManifestToast, setShowManifestToast] = createSignal(false);
    const [goguardianExtensionId, setGoguardianExtensionId] = createSignal<
        string | null
    >(null);
    const [manifestKeyFetched, setManifestKeyFetched] = createSignal(false);

    createTrackedEffect(() => {
        const leaId = district.detectedLeaId();
        const hasGG = detectedFilters().includes("goguardian");
        if (!leaId || !hasGG || manifestKeyFetched()) return;
        setManifestKeyFetched(true);
        void lookupManifestKey(leaId, setGoguardianExtensionId, () =>
            setShowManifestToast(true),
        ).catch(() => {});
    });

    return {
        showManifestToast,
        setShowManifestToast,
        goguardianExtensionId,
        setGoguardianExtensionId,
    };
}

function useIbossGateway(
    district: DistrictState,
    detectedFilters: () => string[],
) {
    const [showIbossToast, setShowIbossToast] = createSignal(false);
    const [ibossGatewayFetched, setIbossGatewayFetched] = createSignal(false);

    createTrackedEffect(() => {
        const leaId = district.detectedLeaId();
        const hasIboss = detectedFilters().includes("iboss");
        if (!leaId || !hasIboss || ibossGatewayFetched()) return;
        setIbossGatewayFetched(true);
        void lookupIbossGateway(leaId, district.detectedDistrictName, () =>
            setShowIbossToast(true),
        ).catch(() => {});
    });

    return { showIbossToast, setShowIbossToast };
}

function activeConfigsOf(detectedFilters: string[]) {
    const found: [string, FilterConfig][] = [];
    for (const f of detectedFilters) {
        const match = findFilterConfig(f);
        if (match && !found.some(([k]) => k === match[0])) {
            found.push(match);
        }
    }
    return found;
}

function useFilterCheck(
    activeConfigs: () => [string, FilterConfig][],
    detectedFilters: () => string[],
    context: () => { ggExtId: string | null; leaId: string | null },
) {
    const [email, setEmail] = createSignal("");
    const [url, setUrl] = createSignal("");
    const [results, setResults] = createSignal<FilterResult[]>([]);
    const [loading, setLoading] = createSignal(false);
    const [checked, setChecked] = createSignal(false);
    /**
     * The rate limit is per person, not per vendor, so it belongs above the
     * ledger rather than repeated down every row.
     */
    const [retryAfter, setRetryAfter] = createSignal<number | null>(null);

    const handleCheck = async () => {
        const rawUrl = url().trim();
        if (!rawUrl) return;
        setLoading(true);
        setChecked(false);
        setResults([]);

        const mapped = await runFilterCheck(
            {
                configs: activeConfigs(),
                rawUrl,
                email: email().trim(),
                ...context(),
            },
            detectedFilters(),
        );

        setRetryAfter(
            mapped.find(r => r.retryAfterSeconds)?.retryAfterSeconds ?? null,
        );
        setResults(mapped);
        setLoading(false);
        setChecked(true);
    };

    return {
        email,
        setEmail,
        url,
        setUrl,
        results,
        loading,
        checked,
        retryAfter,
        handleCheck,
    };
}

function ContributionToasts(props: {
    district: DistrictState;
    gg: ReturnType<typeof useGoGuardianKey>;
    iboss: ReturnType<typeof useIbossGateway>;
}) {
    const district = () => props.district;
    return (
        <>
            <Show
                when={
                    props.gg.showManifestToast() &&
                    district().detectedDistrictName()
                }
            >
                <GoGuardianManifestToast
                    districtName={district().detectedDistrictName()!}
                    leaId={district().detectedLeaId()!}
                    onDismiss={() => props.gg.setShowManifestToast(false)}
                    onSubmit={extId => {
                        props.gg.setGoguardianExtensionId(extId);
                        props.gg.setShowManifestToast(false);
                    }}
                />
            </Show>
            <Show
                when={
                    props.iboss.showIbossToast() &&
                    district().detectedDistrictName()
                }
            >
                <IbossGatewayToast
                    districtName={district().detectedDistrictName()!}
                    leaId={district().detectedLeaId()!}
                    onDismiss={() => {
                        props.iboss.setShowIbossToast(false);
                        // Last resort: no host from scanning or the user, so race
                        // the known-good gateways and contribute the fastest.
                        void (async () => {
                            const leaId = district().detectedLeaId();
                            if (!leaId) return;
                            const best = await raceIbossGateways();
                            if (!best) return;
                            try {
                                await submitAutoGateway(
                                    best,
                                    leaId,
                                    district().detectedDistrictName(),
                                );
                            } catch {}
                        })();
                    }}
                    onSubmit={() => props.iboss.setShowIbossToast(false)}
                />
            </Show>
        </>
    );
}

function TitleActions(props: { rescanning: boolean; onRescan: () => void }) {
    return (
        <div class={schematic.titleBlockActions}>
            <PatreonLoginButton />
            <button
                type="button"
                class={s.rescan}
                onClick={() => props.onRescan()}
                disabled={props.rescanning}
            >
                <Show when={props.rescanning} fallback="Scan again">
                    <IconLoaderDots size={13} class={s.spinner} /> Scanning…
                </Show>
            </button>
        </div>
    );
}

function DetectedFilters(props: { detected: string[] }) {
    const unsupported = createMemo(() =>
        props.detected.filter(f => !findFilterConfig(f)),
    );
    return (
        <>
            <Rule label="Filters on this network" />
            <div class={s.specimenRow}>
                <Show
                    when={props.detected.length > 0}
                    fallback={<Anno muted>None detected</Anno>}
                >
                    <For each={props.detected} keyed={false}>
                        {f => (
                            <span class={s.specimenChip}>
                                {prettifyFilterName(f())}
                            </span>
                        )}
                    </For>
                </Show>
            </div>

            <Show when={unsupported().length > 0}>
                <div class={s.unsupported}>
                    <For each={unsupported()} keyed={false}>
                        {f => (
                            <Anno muted>
                                Can't check {prettifyFilterName(f())} yet
                            </Anno>
                        )}
                    </For>
                </div>
            </Show>
        </>
    );
}

function RateLimitNotice(props: { retryAfter: number }) {
    return (
        <div class={s.rateLimit}>
            <Anno>
                Daily check limit reached. You can check again{" "}
                {formatRetryAfter(props.retryAfter)}. Signing in with Patreon
                raises the limit.
            </Anno>
        </div>
    );
}

function CheckOutcome(props: { check: ReturnType<typeof useFilterCheck> }) {
    return (
        <>
            <Show when={props.check.retryAfter() !== null}>
                <RateLimitNotice retryAfter={props.check.retryAfter()!} />
            </Show>

            <Show when={props.check.checked()}>
                <Rule label="Results" weight="major" class={s.resultsRule} />
                <FilterCheckResults results={props.check.results()} />
            </Show>
        </>
    );
}

function usePageCheck(
    filters: ReturnType<typeof useDetectedFilters>,
    district: DistrictState,
    gg: ReturnType<typeof useGoGuardianKey>,
) {
    const activeConfigs = createMemo<[string, FilterConfig][]>(() =>
        activeConfigsOf(filters.detectedFilters()),
    );

    const needsEmail = createMemo(() =>
        activeConfigs().some(([, c]) => c.needsEmail),
    );

    const check = useFilterCheck(
        activeConfigs,
        filters.detectedFilters,
        () => ({
            ggExtId: gg.goguardianExtensionId(),
            leaId: district.detectedLeaId(),
        }),
    );

    return { needsEmail, check };
}

function FilterCheckTitle(props: {
    rescanning: boolean;
    onRescan: () => void;
}) {
    return (
        <TitleBlock
            title="Filter check"
            icon={IconSearch}
            tint="stone"
            actions={
                // PatreonLoginButton lives here because this page is
                // its only host in the app. Patreon entitlement is what
                // raises the filter-check rate limit (see
                // misc/filters/sharedMiddleware.ts), so dropping it
                // leaves supporters silently capped at the free tier
                // with nowhere to sign in.
                <TitleActions
                    rescanning={props.rescanning}
                    onRescan={() => props.onRescan()}
                />
            }
        />
    );
}

export default function FilterCheckPage() {
    const filters = useDetectedFilters();
    const district = useDistrict();
    const gg = useGoGuardianKey(district, filters.detectedFilters);
    const iboss = useIbossGateway(district, filters.detectedFilters);

    const { needsEmail, check } = usePageCheck(filters, district, gg);

    return (
        <>
            <ContributionToasts district={district} gg={gg} iboss={iboss} />

            <Sheet>
                <FilterCheckTitle
                    rescanning={filters.rescanning()}
                    onRescan={() => void filters.handleRescan()}
                />

                {/* The one page where Civil's voice has a direct target. The
                    vendors this page queries describe themselves in soft nouns
                    (visibility, insights, oversight, "observed") for systems
                    that record screens minute by minute. This page asks their
                    own classifiers the same question from the other side, and
                    prints whatever comes back. */}
                <p class={schematic.lede}>
                    See how content filters categorize a website. Enter its
                    address to check.
                </p>

                <DetectedFilters detected={filters.detectedFilters()} />

                <FilterCheckForm
                    needsEmail={needsEmail()}
                    email={check.email()}
                    url={check.url()}
                    loading={check.loading()}
                    onEmail={check.setEmail}
                    onUrl={check.setUrl}
                    onSubmit={() => void check.handleCheck()}
                />

                <CheckOutcome check={check} />
            </Sheet>
        </>
    );
}
