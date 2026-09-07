/**
 * Per-vendor filter-check configuration.
 *
 * Extracted from FilterCheckPage.tsx, which had grown to 865 lines with 240 of
 * them being this table. It lives in lib/ rather than beside the component
 * because it is data and request-shaping, not rendering — and because vendor
 * APIs drift, so this is the file that changes when a checker breaks.
 */

export type FilterStatus =
    | "allowed"
    | "blocked"
    | "warned"
    | "unknown"
    | "error";

export type FilterResult = {
    filterKey: string;
    filterName: string;
    status: FilterStatus;
    detail: string;
    categories?: string[];
    /**
     * Seconds until the shared rate limiter (misc/filters/sharedMiddleware.ts)
     * will accept another check. Set only on HTTP 429.
     */
    retryAfterSeconds?: number;
};

/**
 * "in about 23 hours" rather than `{"error":"Too many requests",
 * "retryAfterSeconds":86372}`, which is what the ledger used to print verbatim.
 *
 * The window is a whole day at the free tier, so minutes are noise above an
 * hour and seconds are noise above a minute; each unit is dropped once the one
 * above it can answer the only question being asked — when can I try again.
 */
export function formatRetryAfter(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return "in a moment";
    if (seconds < 60) return `in ${Math.ceil(seconds)}s`;
    if (seconds < 3600) return `in about ${Math.round(seconds / 60)} min`;
    const hours = Math.round(seconds / 3600);
    return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
}

export type FilterConfig = {
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

export const FILTER_CONFIGS: Record<string, FilterConfig> = {
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
    iboss: {
        name: "iboss",
        aliases: ["iboss"],
        needsEmail: true,
        endpoint: "/filterCheck/iboss",
        buildPayload: (url, email) => ({ url, userEmail: email }),
        parseResult: (data: any) => {
            if (!data?.statusIsKnown) {
                return {
                    status: "unknown" as FilterStatus,
                    detail: data?.needsSecurityKey
                        ? "Gateway known, but a security key is needed for a live check"
                        : data?.error
                          ? `Filter error: ${String(data.error).slice(0, 80)}`
                          : "Status unknown",
                };
            }
            return {
                status: (data?.blocked ? "blocked" : "allowed") as FilterStatus,
                detail:
                    (data?.reason as string | undefined) ??
                    (data?.blocked ? "Blocked" : "Allowed"),
                categories: data?.categoryName
                    ? [data.categoryName as string]
                    : undefined,
            };
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
                    ? `Blocked${data?.matchedCategory ? ` - ${data.matchedCategory}` : ""}`
                    : "Allowed",
                categories: cats,
            };
        },
    },
};

export function findFilterConfig(name: string): [string, FilterConfig] | null {
    const lower = name.toLowerCase();
    for (const [key, config] of Object.entries(FILTER_CONFIGS)) {
        if (config.aliases.some(alias => lower.includes(alias))) {
            return [key, config];
        }
    }
    return null;
}

export function prettifyFilterName(key: string): string {
    const spaced = key
        .replace(/([a-z\d])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
