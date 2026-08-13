import {
    createMemo,
    createSignal,
    createTrackedEffect,
    For,
    onSettled,
    Show,
} from "solid-js";
import {
    detectIbossGateway,
    raceIbossGateways,
} from "$config/service/ibossGatewayDetect";
import { IconLoaderDots } from "~/components/icons";
import Anno from "~/components/schematic/Anno";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import {
    type FilterConfig,
    type FilterResult,
    type FilterStatus,
    findFilterConfig,
    prettifyFilterName,
} from "~/lib/filterCheckVendors";
import { checkFiltersNow } from "~/lib/swUtils";
import * as s from "~/styles/FilterCheckPage.css";
import * as schematic from "~/styles/schematic.css";
import FilterCheckForm from "./FilterCheckForm";
import FilterCheckResults from "./FilterCheckResults";
import GoGuardianManifestToast from "./GoGuardianManifestToast";
import IbossGatewayToast from "./IbossGatewayToast";
import PatreonLoginButton from "./ui/PatreonLoginButton";

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
            ...config.parseResult(data),
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

export default function FilterCheckPage() {
    const [email, setEmail] = createSignal("");
    const [url, setUrl] = createSignal("");
    const [results, setResults] = createSignal<FilterResult[]>([]);
    const [loading, setLoading] = createSignal(false);
    const [checked, setChecked] = createSignal(false);

    const [detectedLeaId, setDetectedLeaId] = createSignal<string | null>(null);
    const [detectedDistrictName, setDetectedDistrictName] = createSignal<
        string | null
    >(null);
    const [showManifestToast, setShowManifestToast] = createSignal(false);
    const [goguardianExtensionId, setGoguardianExtensionId] = createSignal<
        string | null
    >(null);
    const [manifestKeyFetched, setManifestKeyFetched] = createSignal(false);

    const [showIbossToast, setShowIbossToast] = createSignal(false);
    const [ibossGatewayFetched, setIbossGatewayFetched] = createSignal(false);

    const readDetectedFilters = (): string[] => {
        try {
            const raw = localStorage.getItem("detectedFilters");
            return raw ? (JSON.parse(raw) as string[]) : [];
        } catch {
            return [];
        }
    };

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

    createTrackedEffect(() => {
        const leaId = detectedLeaId();
        const hasGG = detectedFilters().includes("goguardian");
        if (!leaId || !hasGG || manifestKeyFetched()) return;
        setManifestKeyFetched(true);
        void (async () => {
            try {
                const keyRes = await fetch(
                    `/api/goguardian/manifest-key?leaId=${encodeURIComponent(leaId)}`,
                );
                if (keyRes.ok) {
                    const { extensionId } = (await keyRes.json()) as {
                        extensionId: string;
                    };
                    setGoguardianExtensionId(extensionId);
                } else if (keyRes.status === 404) {
                    setShowManifestToast(true);
                }
            } catch {}
        })();
    });

    createTrackedEffect(() => {
        const leaId = detectedLeaId();
        const hasIboss = detectedFilters().includes("iboss");
        if (!leaId || !hasIboss || ibossGatewayFetched()) return;
        setIbossGatewayFetched(true);
        void (async () => {
            try {
                const gwRes = await fetch(
                    `/api/iboss/gateway?leaId=${encodeURIComponent(leaId)}`,
                );
                if (gwRes.ok) return;
                if (gwRes.status !== 404) return;

                const detected = await detectIbossGateway();
                if (detected) {
                    await fetch("/api/iboss/submit-gateway", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            gatewayHost: detected.host,
                            port: detected.port,
                            leaId,
                            districtName: detectedDistrictName() ?? undefined,
                            source: "auto",
                        }),
                    });
                } else {
                    setShowIbossToast(true);
                }
            } catch {}
        })();
    });

    onSettled(() => {
        const handler = (e: Event) => {
            setDetectedFilters(
                (e as CustomEvent<string[]>).detail ?? readDetectedFilters(),
            );
        };
        window.addEventListener("detectedFiltersUpdated", handler);

        void checkFiltersNow();

        void (async () => {
            try {
                const locRes = await fetch("/api/ip-location");
                if (!locRes.ok) return;
                const { lat, lon } = (await locRes.json()) as {
                    lat: number;
                    lon: number;
                };

                const distRes = await fetch(
                    `/api/school-districts/nearest?lat=${lat}&lon=${lon}`,
                );
                if (!distRes.ok) return;
                const { leaId, name } = (await distRes.json()) as {
                    leaId: string;
                    name: string;
                };
                setDetectedLeaId(leaId);
                setDetectedDistrictName(name);
            } catch {}
        })();

        return () =>
            window.removeEventListener("detectedFiltersUpdated", handler);
    });

    const activeConfigs = createMemo<[string, FilterConfig][]>(() => {
        const found: [string, FilterConfig][] = [];
        for (const f of detectedFilters()) {
            const match = findFilterConfig(f);
            if (match && !found.some(([k]) => k === match[0])) {
                found.push(match);
            }
        }
        return found;
    });

    const unsupportedFilters = createMemo(() =>
        detectedFilters().filter(f => !findFilterConfig(f)),
    );

    const needsEmail = createMemo(() =>
        activeConfigs().some(([, c]) => c.needsEmail),
    );

    const handleCheck = async () => {
        const rawUrl = url().trim();
        if (!rawUrl) return;
        setLoading(true);
        setChecked(false);
        setResults([]);

        const configs = activeConfigs();
        const emailVal = email().trim();

        let urlHostname = rawUrl;
        try {
            urlHostname = new URL(rawUrl).hostname;
        } catch {
            /* keep raw */
        }
        const emailDomain = emailVal.includes("@")
            ? emailVal.split("@")[1]
            : undefined;

        const isProd = window.location.host === "civil.quartinal.me";

        isProd &&
            window.posthog?.capture("filter_check_submitted", {
                url_hostname: urlHostname,
                email_domain: emailDomain,
                active_filters: configs.map(([k]) => k),
                detected_filters: detectedFilters(),
            });

        const startMs = Date.now();
        const ggExtId = goguardianExtensionId();
        const settled = await Promise.allSettled(
            configs.map(([key, config]) => {
                const payloadOverride =
                    key === "goguardian" && ggExtId
                        ? {
                              ...config.buildPayload(rawUrl, emailVal),
                              orgRands: [ggExtId],
                          }
                        : key === "iboss"
                          ? {
                                ...config.buildPayload(rawUrl, emailVal),
                                leaId: detectedLeaId(),
                            }
                          : undefined;
                return checkFilter(
                    key,
                    config,
                    rawUrl,
                    emailVal,
                    payloadOverride,
                );
            }),
        );
        const durationMs = Date.now() - startMs;

        const mapped = settled.map((r, i) => {
            if (r.status === "fulfilled") return r.value;
            const [key, config] = configs[i]!;
            if (isProd) {
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

        if (isProd) {
            for (const result of mapped) {
                if (result.status === "error") {
                    window.posthog?.captureException(
                        new Error(`filter_check_error: ${result.filterKey}`),
                        { extra: { detail: result.detail } },
                    );
                }
            }

            window.posthog?.capture("filter_check_completed", {
                url_hostname: urlHostname,
                duration_ms: durationMs,
                results: mapped.map(r => ({
                    filter: r.filterKey,
                    status: r.status,
                })),
            });
        }

        setResults(mapped);
        setLoading(false);
        setChecked(true);
    };

    return (
        <>
            <Show when={showManifestToast() && detectedDistrictName()}>
                <GoGuardianManifestToast
                    districtName={detectedDistrictName()!}
                    leaId={detectedLeaId()!}
                    onDismiss={() => setShowManifestToast(false)}
                    onSubmit={extId => {
                        setGoguardianExtensionId(extId);
                        setShowManifestToast(false);
                    }}
                />
            </Show>
            <Show when={showIbossToast() && detectedDistrictName()}>
                <IbossGatewayToast
                    districtName={detectedDistrictName()!}
                    leaId={detectedLeaId()!}
                    onDismiss={() => {
                        setShowIbossToast(false);
                        // Last resort: no host from scanning or the user, so race
                        // the known-good gateways and contribute the fastest.
                        void (async () => {
                            const leaId = detectedLeaId();
                            if (!leaId) return;
                            const best = await raceIbossGateways();
                            if (!best) return;
                            try {
                                await fetch("/api/iboss/submit-gateway", {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                        gatewayHost: best.host,
                                        port: best.port,
                                        leaId,
                                        districtName:
                                            detectedDistrictName() ?? undefined,
                                        source: "auto",
                                    }),
                                });
                            } catch {}
                        })();
                    }}
                    onSubmit={() => setShowIbossToast(false)}
                />
            </Show>

            <Sheet marks={["tl", "tr", "br"]}>
                <TitleBlock
                    eyebrow="diagnostic"
                    title="Filter report"
                    meta={`${detectedFilters().length} detected`}
                    actions={
                        // PatreonLoginButton lives here because this page is
                        // its only host in the app. Patreon entitlement is what
                        // raises the filter-check rate limit (see
                        // misc/filters/sharedMiddleware.ts), so dropping it
                        // leaves supporters silently capped at the free tier
                        // with nowhere to sign in.
                        <div class={s.titleActions}>
                            <PatreonLoginButton />
                            <button
                                type="button"
                                class={s.rescan}
                                onClick={handleRescan}
                                disabled={rescanning()}
                            >
                                <Show when={rescanning()} fallback="re-scan">
                                    <IconLoaderDots
                                        size={13}
                                        class={s.spinner}
                                    />{" "}
                                    scanning…
                                </Show>
                            </button>
                        </div>
                    }
                />

                {/* The one page where Civil's voice has a direct target. The
                    vendors this page queries describe themselves in soft nouns
                    — visibility, insights, oversight, "observed" — for systems
                    that record screens minute by minute. This page asks their
                    own classifiers the same question from the other side, and
                    prints whatever comes back. */}
                <p class={schematic.lede}>
                    Every vendor below calls this visibility. Here is the same
                    question, asked from your side of the glass — and their own
                    answer, unedited.
                </p>

                <Rule label="specimen" />
                <div class={s.specimenRow}>
                    <Show
                        when={detectedFilters().length > 0}
                        fallback={
                            <Anno muted>
                                no filters detected on this network
                            </Anno>
                        }
                    >
                        <For each={detectedFilters()} keyed={false}>
                            {f => <span class={s.specimenChip}>{f()}</span>}
                        </For>
                    </Show>
                </div>

                <Show when={unsupportedFilters().length > 0}>
                    <div class={s.unsupported}>
                        <For each={unsupportedFilters()} keyed={false}>
                            {f => (
                                <Anno muted>
                                    unsupported extension id —{" "}
                                    {prettifyFilterName(f())}
                                </Anno>
                            )}
                        </For>
                    </div>
                </Show>

                <FilterCheckForm
                    needsEmail={needsEmail()}
                    email={email()}
                    url={url()}
                    loading={loading()}
                    onEmail={setEmail}
                    onUrl={setUrl}
                    onSubmit={() => void handleCheck()}
                />

                <Show when={checked()}>
                    <Rule
                        label="results"
                        weight="major"
                        class={s.resultsRule}
                    />
                    <FilterCheckResults results={results()} />
                </Show>
            </Sheet>
        </>
    );
}
