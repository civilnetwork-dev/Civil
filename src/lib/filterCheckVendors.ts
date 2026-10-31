/**
 * Per-vendor filter-check configuration.
 *
 * Extracted from FilterCheckPage.tsx, which had grown to 865 lines with 240 of
 * them being this table. It lives in lib/ rather than beside the component
 * because it is data and request-shaping, not rendering, and because vendor
 * APIs drift, so this is the file that changes when a checker breaks.
 *
 * What comes back needs no table: every `/filterCheck/*` route answers with
 * the same verdict (misc/filters/verdict.ts), categories already in Civil's
 * one vocabulary (misc/filters/categories.ts), so `parseVerdict` reads them
 * all.
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
 * above it can answer the only question being asked, when can I try again.
 */
export function formatRetryAfter(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return "in a moment";
    if (seconds < 60) return `in ${Math.ceil(seconds)}s`;
    if (seconds < 3600) return `in about ${Math.round(seconds / 60)} min`;
    const hours = Math.round(seconds / 3600);
    return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
}

const VERDICT_STATUSES: ReadonlySet<unknown> = new Set<FilterStatus>([
    "allowed",
    "blocked",
    "warned",
    "unknown",
]);

/** A `/filterCheck/*` verdict, checked on the way in: anything else is an
 *  error row, not a guess at what the vendor meant. */
export function parseVerdict(
    data: unknown,
): Pick<FilterResult, "status" | "detail" | "categories"> {
    const verdict = (data ?? {}) as {
        status?: unknown;
        detail?: unknown;
        categories?: unknown;
    };
    if (
        !VERDICT_STATUSES.has(verdict.status) ||
        typeof verdict.detail !== "string"
    )
        return {
            status: "error",
            detail: "The check answered in a shape Civil doesn't know.",
        };
    return {
        status: verdict.status as FilterStatus,
        detail: verdict.detail,
        categories: Array.isArray(verdict.categories)
            ? verdict.categories.filter(
                  (category): category is string =>
                      typeof category === "string",
              )
            : [],
    };
}

export type FilterConfig = {
    name: string;
    aliases: string[];
    needsEmail?: boolean;
    endpoint: string;
    buildPayload: (url: string, email: string) => Record<string, unknown>;
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
    },
    goguardian: {
        name: "GoGuardian",
        aliases: ["goguardian"],
        endpoint: "/filterCheck/goguardian",
        buildPayload: url => ({ url }),
    },
    blocksi: {
        name: "Blocksi",
        aliases: ["blocksi"],
        endpoint: "/filterCheck/blocksi",
        buildPayload: url => ({ url }),
    },
    fortiguard: {
        name: "FortiGuard",
        aliases: ["fortiguard", "fortinet"],
        endpoint: "/filterCheck/fortiguard",
        buildPayload: url => ({ url }),
    },
    linewize: {
        name: "Linewize",
        aliases: ["linewize"],
        needsEmail: true,
        endpoint: "/filterCheck/linewize",
        buildPayload: (url, email) => ({ url, identity: email }),
    },
    hapara: {
        name: "Hapara",
        aliases: ["hapara"],
        needsEmail: true,
        endpoint: "/filterCheck/hapara",
        buildPayload: (url, email) => ({ url, email }),
    },
    iboss: {
        name: "iboss",
        aliases: ["iboss"],
        needsEmail: true,
        endpoint: "/filterCheck/iboss",
        buildPayload: (url, email) => ({ url, userEmail: email }),
    },
    lightspeed: {
        name: "Lightspeed Filter",
        aliases: ["lightspeedfilter"],
        endpoint: "/filterCheck/lightspeed",
        buildPayload: url => ({ url }),
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

/** Detected filter IDs (misc/config/service/filterDetect.ts) whose vendor
 *  spells its name in a way splitting the camelCase can't recover. */
const FILTER_NAMES: Record<string, string> = {
    goguardian: "GoGuardian",
    fortiguard: "FortiGuard",
    contentkeeper: "ContentKeeper",
    ckAuthenticatorG3: "ContentKeeper Authenticator G3",
    iboss: "iboss",
    lanschool: "LanSchool",
    lanschoolWebHelper: "LanSchool Web Helper",
    interclassFilteringService: "InterCLASS Filtering Service",
    intersafeGatewayConnectionAgent: "InterSafe Gateway Connection Agent",
    imtLazarus: "IMT Lazarus",
    loiLoWebFilters: "LoiLo Web Filters",
    netsupportSchoolStudent: "NetSupport School Student",
    classroomdotcloudStudent: "classroom.cloud Student",
    lockdownBrowser: "LockDown Browser",
    lockdownBrowserAPClassroomEdition: "LockDown Browser AP Classroom Edition",
};

export function prettifyFilterName(key: string): string {
    if (FILTER_NAMES[key]) return FILTER_NAMES[key];
    const spaced = key
        .replace(/([a-z\d])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
