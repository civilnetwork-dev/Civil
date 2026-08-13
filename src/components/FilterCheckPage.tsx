import {
    type Accessor,
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
import {
    IconAlert,
    IconCheck,
    IconLoaderDots,
    IconSpinnerFilled,
} from "~/components/icons";
import {
    type FilterConfig,
    type FilterResult,
    type FilterStatus,
    findFilterConfig,
    prettifyFilterName,
} from "~/lib/filterCheckVendors";
import { checkFiltersNow } from "~/lib/swUtils";
import * as s from "~/styles/FilterCheckPage.css";
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

function StatusIcon(props: { status: FilterStatus }) {
    return (
        <span class={s.resultIconColor[props.status]}>
            <Show
                when={props.status === "allowed"}
                fallback={
                    <Show
                        when={
                            props.status === "error" ||
                            props.status === "unknown"
                        }
                        fallback={<IconAlert size={22} />}
                    >
                        <IconSpinnerFilled size={22} />
                    </Show>
                }
            >
                <IconCheck size={22} />
            </Show>
        </span>
    );
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
            <div class={s.page}>
                <header class={s.header}>
                    <div class={s.headerTitle}>
                        <span class={s.eyebrow}>
                            <span class={s.eyebrowMark} />
                            Diagnostic
                        </span>
                        <h1 class={s.title}>Filter Check</h1>
                        <p class={s.subtitle}>
                            Test whether a URL is blocked by your school's web
                            filter
                        </p>
                    </div>
                    <PatreonLoginButton />
                </header>

                <Show
                    when={detectedFilters().length > 0}
                    fallback={
                        <div class={s.detectedBadges}>
                            <p class={s.noFiltersText}>
                                You don't have any filters installed.
                            </p>
                            <button
                                type="button"
                                class={s.rescanBtn}
                                onClick={handleRescan}
                                disabled={rescanning()}
                            >
                                <Show
                                    when={rescanning()}
                                    fallback="Re-scan filters"
                                >
                                    <IconLoaderDots class={s.spinner} />{" "}
                                    Scanning…
                                </Show>
                            </button>
                        </div>
                    }
                >
                    <div class={s.detectedBadges}>
                        <span class={s.detectedLabel}>Detected filters:</span>
                        <For each={detectedFilters()} keyed={false}>
                            {(f: Accessor<string>) => (
                                <span class={s.badge}>{f()}</span>
                            )}
                        </For>
                        <button
                            type="button"
                            class={s.rescanBtn}
                            onClick={handleRescan}
                            disabled={rescanning()}
                        >
                            <Show
                                when={rescanning()}
                                fallback="Re-scan filters"
                            >
                                <IconLoaderDots class={s.spinner} /> Scanning…
                            </Show>
                        </button>
                    </div>

                    <Show when={unsupportedFilters().length > 0}>
                        <div class={s.unsupportedNotice}>
                            <For each={unsupportedFilters()} keyed={false}>
                                {(f: Accessor<string>) => (
                                    <p>
                                        We don't support the ID of the extension
                                        "{prettifyFilterName(f())}" you have
                                        yet.
                                    </p>
                                )}
                            </For>
                        </div>
                    </Show>

                    <form
                        class={s.form}
                        onSubmit={e => {
                            e.preventDefault();
                            void handleCheck();
                        }}
                    >
                        <Show when={needsEmail()}>
                            <label class={s.label}>
                                School email
                                <input
                                    class={s.input}
                                    type="email"
                                    placeholder="student@school.edu"
                                    value={email()}
                                    onInput={e =>
                                        setEmail(e.currentTarget.value)
                                    }
                                    required
                                />
                            </label>
                        </Show>

                        <label class={s.label}>
                            URL to check
                            <input
                                class={s.input}
                                type="url"
                                placeholder="https://example.com"
                                value={url()}
                                onInput={e => setUrl(e.currentTarget.value)}
                                required
                            />
                        </label>

                        <button
                            class={s.checkBtn}
                            type="submit"
                            disabled={loading()}
                        >
                            <Show when={loading()} fallback="Check URL">
                                <span class={s.spinner}>
                                    <IconLoaderDots size={15} />
                                </span>
                                Checking…
                            </Show>
                        </button>
                    </form>

                    <Show when={checked()}>
                        <div class={s.results}>
                            <For each={results()} keyed={false}>
                                {(result: Accessor<FilterResult>, i) => (
                                    <div
                                        class={s.resultCard[result().status]}
                                        style={{
                                            "animation-delay": `${i * 0.06}s`,
                                        }}
                                    >
                                        <div class={s.resultIcon}>
                                            <StatusIcon
                                                status={result().status}
                                            />
                                        </div>
                                        <div class={s.resultBody}>
                                            <span class={s.resultName}>
                                                {result().filterName}
                                            </span>
                                            <span class={s.resultDetail}>
                                                {result().detail}
                                            </span>
                                            <Show
                                                when={
                                                    result().categories &&
                                                    result().categories!
                                                        .length > 0
                                                }
                                            >
                                                <div class={s.categories}>
                                                    <For
                                                        each={
                                                            result().categories
                                                        }
                                                        keyed={false}
                                                    >
                                                        {(
                                                            cat: Accessor<string>,
                                                        ) => (
                                                            <span
                                                                class={
                                                                    s.catChip
                                                                }
                                                            >
                                                                {cat()}
                                                            </span>
                                                        )}
                                                    </For>
                                                </div>
                                            </Show>
                                        </div>
                                        <span
                                            class={
                                                s.resultStatus[result().status]
                                            }
                                        >
                                            {result().status}
                                        </span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </Show>
                </Show>
            </div>
        </>
    );
}
