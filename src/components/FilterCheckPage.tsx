import {
    TbFillAlertSquareRounded,
    TbFillFidgetSpinner,
    TbFillSquareRoundedCheck,
    TbOutlineLoader2,
} from "solid-icons/tb";
import {
    type Accessor,
    createMemo,
    createSignal,
    createTrackedEffect,
    For,
    onSettled,
    Show,
} from "solid-js";
import { checkFiltersNow } from "~/lib/swUtils";
import * as s from "~/styles/FilterCheckPage.css";
import GoGuardianManifestToast from "./GoGuardianManifestToast";
import PatreonLoginButton from "./ui/PatreonLoginButton";

type FilterStatus = "allowed" | "blocked" | "warned" | "unknown" | "error";

type FilterResult = {
    filterKey: string;
    filterName: string;
    status: FilterStatus;
    detail: string;
    categories?: string[];
};

type FilterConfig = {
    name: string;
    aliases: string[];
    needsEmail?: boolean;
    endpoint: string;
    buildPayload: (url: string, email: string) => Record<string, unknown>;
    parseResult: (data: unknown) => {
        status: FilterStatus;
        detail: string;
        categories?: string[];
    };
};

const SECURLY_EXTENSION_ID = "ckecmkbnoanpgplccmnoikfmpcdladkc";

const FILTER_CONFIGS: Record<string, FilterConfig> = {
    securly: {
        name: "Securly",
        aliases: ["securly"],
        needsEmail: true,
        endpoint: "/filterCheck/securly",
        buildPayload: (url, email) => {
            let host: string;
            try {
                host = new URL(url).hostname;
            } catch {
                host = url;
            }
            return {
                useremail: email,
                host,
                extensionId: SECURLY_EXTENSION_ID,
            };
        },
        parseResult: (data: any) => {
            const dec = data?.decision;
            const cats: string[] = Array.isArray(data?.categories)
                ? (data.categories as string[])
                : [];
            if (dec?.allowed)
                return {
                    status: "allowed",
                    detail: "Access allowed",
                    categories: cats,
                };
            if (dec?.paused)
                return {
                    status: "warned",
                    detail: "Access paused",
                    categories: cats,
                };
            if (dec?.errored)
                return {
                    status: "error",
                    detail: "Filter error",
                    categories: cats,
                };
            if (!dec?.decisionIsKnown)
                return {
                    status: "unknown",
                    detail: "Decision unknown",
                    categories: cats,
                };
            return {
                status: "blocked",
                detail: "Access blocked",
                categories: cats,
            };
        },
    },
    goguardian: {
        name: "GoGuardian",
        aliases: ["goguardian"],
        endpoint: "/filterCheck/goguardian",
        buildPayload: url => ({ url }),
        parseResult: (data: any) => {
            const keywords: string[] = Array.isArray(data?.matchedKeywords)
                ? (data.matchedKeywords as string[])
                : [];
            if (!data?.statusIsKnown)
                return { status: "unknown", detail: "Status unknown" };
            const blocked = data?.blocked === false;
            return {
                status: blocked ? "blocked" : "allowed",
                detail: blocked
                    ? `Blocked${keywords.length ? ` - ${keywords.join(", ")}` : ""}`
                    : "Allowed",
            };
        },
    },
    blocksi: {
        name: "Blocksi",
        aliases: ["blocksi"],
        endpoint: "/filterCheck/blocksi",
        buildPayload: url => ({ url }),
        parseResult: (data: any) => ({
            status: (data?.blocked
                ? "blocked"
                : data?.warned
                  ? "warned"
                  : "allowed") as FilterStatus,
            detail:
                (data?.reason as string | undefined) ??
                (data?.blocked ? "Blocked" : "Allowed"),
            categories: data?.categoryName
                ? [data.categoryName as string]
                : undefined,
        }),
    },
    fortiguard: {
        name: "FortiGuard",
        aliases: ["fortiguard", "fortinet"],
        endpoint: "/filterCheck/fortiguard",
        buildPayload: url => ({ url }),
        parseResult: (data: any) => ({
            status: (data?.blocked
                ? "blocked"
                : data?.warned
                  ? "warned"
                  : "allowed") as FilterStatus,
            detail: `Verdict: ${(data?.verdict as string | undefined) ?? "unknown"}`,
            categories: data?.categoryName
                ? [data.categoryName as string]
                : undefined,
        }),
    },
    linewize: {
        name: "Linewize",
        aliases: ["linewize"],
        needsEmail: true,
        endpoint: "/filterCheck/linewize",
        buildPayload: (url, email) => ({ url, identity: email }),
        parseResult: (data: any) => {
            const cats: string[] = Array.isArray(data?.categories)
                ? (data.categories as string[])
                : [];
            if (!data?.verdictIsKnown)
                return {
                    status: "unknown",
                    detail: "Verdict unknown",
                    categories: cats,
                };
            return {
                status: data?.blocked ? "blocked" : "allowed",
                detail: data?.blocked ? "Blocked" : "Allowed",
                categories: cats,
            } satisfies {
                status: FilterStatus;
                detail: string;
                categories: string[];
            };
        },
    },
    hapara: {
        name: "Hapara",
        aliases: ["hapara"],
        needsEmail: true,
        endpoint: "/filterCheck/hapara",
        buildPayload: (url, email) => ({ url, email }),
        parseResult: (data: any) => {
            const verdict = data?.verdict as string | undefined;
            const parts: string[] = [];
            if (data?.sessionType) parts.push(`session: ${data.sessionType}`);
            if (data?.teacherName) parts.push(`teacher: ${data.teacherName}`);
            if (data?.matchedDomain)
                parts.push(`matched: ${data.matchedDomain}`);
            const suffix = parts.length ? ` (${parts.join(", ")})` : "";

            switch (verdict) {
                case "BLOCKED":
                    return {
                        status: "blocked" as FilterStatus,
                        detail: `Blocked${suffix}`,
                    };
                case "LOCKED":
                    return {
                        status: "blocked" as FilterStatus,
                        detail: `Locked to teacher-approved tabs${suffix}`,
                    };
                case "PAUSED":
                    return {
                        status: "warned" as FilterStatus,
                        detail: `Screen paused by teacher${suffix}`,
                    };
                case "ALLOWED":
                    return {
                        status: "allowed" as FilterStatus,
                        detail: `Allowed${suffix}`,
                    };
                case "UNMONITORED":
                    return {
                        status: "allowed" as FilterStatus,
                        detail: "Not monitored right now (outside monitoring hours)",
                    };
                default:
                    return {
                        status: "unknown" as FilterStatus,
                        detail: "No active session - status unknown",
                    };
            }
        },
    },
    lightspeed: {
        name: "Lightspeed Filter",
        aliases: ["lightspeedfilter"],
        endpoint: "/filterCheck/lightspeed",
        buildPayload: url => ({ url }),
        parseResult: (data: any) => {
            const cats: string[] = Array.isArray(data?.categories)
                ? (data.categories as string[])
                : [];
            if (!data?.statusIsKnown)
                return {
                    status: "unknown",
                    detail: "Category unknown",
                    categories: cats,
                };
            return {
                status: data?.blocked ? "blocked" : "allowed",
                detail: data?.blocked
                    ? `Blocked${data?.matchedCategory ? ` — ${data.matchedCategory}` : ""}`
                    : "Allowed",
                categories: cats,
            };
        },
    },
};

function findFilterConfig(name: string): [string, FilterConfig] | null {
    const lower = name.toLowerCase();
    for (const [key, config] of Object.entries(FILTER_CONFIGS)) {
        if (config.aliases.some(alias => lower.includes(alias))) {
            return [key, config];
        }
    }
    return null;
}

function prettifyFilterName(key: string): string {
    const spaced = key
        .replace(/([a-z\d])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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
                        fallback={<TbFillAlertSquareRounded size={22} />}
                    >
                        <TbFillFidgetSpinner size={22} />
                    </Show>
                }
            >
                <TbFillSquareRoundedCheck size={22} />
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
            // Result flows back via the detectedFiltersUpdated listener.
            await checkFiltersNow();
        } finally {
            setRescanning(false);
        }
    };

    // Only fetch manifest key (and show toast) when GoGuardian is actually detected
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

    onSettled(() => {
        const handler = (e: Event) => {
            setDetectedFilters(
                (e as CustomEvent<string[]>).detail ?? readDetectedFilters(),
            );
        };
        window.addEventListener("detectedFiltersUpdated", handler);

        // Re-detect installed filters on every visit (getFilters() in the SW
        // probes live), so filters installed after boot show up without a
        // manual localStorage.removeItem + reload. Result flows back through the
        // detectedFiltersUpdated handler above.
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

    // Detected filters with no FilterCheck API support yet.
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
            <div class={s.page}>
                <header class={s.header}>
                    <div class={s.headerTitle}>
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
                                    <TbOutlineLoader2 class={s.spinner} />{" "}
                                    Scanning…
                                </Show>
                            </button>
                        </div>
                    }
                >
                    <div class={s.detectedBadges}>
                        <span class={s.detectedLabel}>Detected filters:</span>
                        <For each={detectedFilters()}>
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
                                <TbOutlineLoader2 class={s.spinner} /> Scanning…
                            </Show>
                        </button>
                    </div>

                    <Show when={unsupportedFilters().length > 0}>
                        <div class={s.unsupportedNotice}>
                            <For each={unsupportedFilters()}>
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
                                    <TbOutlineLoader2 size={15} />
                                </span>
                                Checking…
                            </Show>
                        </button>
                    </form>

                    <Show when={checked()}>
                        <div class={s.results}>
                            <For each={results()}>
                                {(result: Accessor<FilterResult>, i) => (
                                    <div
                                        class={s.resultCard[result().status]}
                                        style={{
                                            "animation-delay": `${i() * 0.06}s`,
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
