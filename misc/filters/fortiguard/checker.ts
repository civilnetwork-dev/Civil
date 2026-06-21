import { err, ok, type Result, ResultAsync } from "neverthrow";
import xior, { type XiorInstance } from "xior";
import { z } from "zod";
import { getCachedClientKey } from "./generateClientKey";

export type Verdict = "ALLOW" | "BLOCK" | "WARN" | "UNKNOWN";

export type FortiGuardCheckerConfig = {
    clientKey?: string;
    emsSerialNumber?: string;

    baseUrl?: string;
    protocolVersion?: string;
    clientType?: string;
    categoryVersion?: string;

    timeoutMs?: number;
    discoveryTimeoutMs?: number;
    blockCategories?: readonly number[];
    warnCategories?: readonly number[];
    http?: XiorInstance;
};

export type FortiGuardCheckResult = {
    url: string;
    normalizedUrl: string;
    hostname: string;
    verdict: Verdict;
    allowed: boolean;
    blocked: boolean;
    warned: boolean;
    categoryId: number | null;
    categoryName: string;
    categoryGroup: string;
    source: "fortiguard";
    resolvedConfig: ResolvedFortiGuardConfig;
    raw: unknown;
};

export type ResolvedFortiGuardConfig = {
    clientKey: string;
    emsSerialNumber?: string;
    baseUrl: string;
    protocolVersion: string;
    clientType: string;
    categoryVersion: string;
    timeoutMs: number;
    blockCategories: readonly number[];
    warnCategories: readonly number[];
};

export type FortiGuardCheckerError =
    | { type: "INVALID_CONFIG"; message: string }
    | { type: "INVALID_URL"; message: string; input: string }
    | { type: "DISCOVERY_FAILED"; message: string; cause?: unknown }
    | { type: "NETWORK_ERROR"; message: string; cause: unknown }
    | { type: "PARSE_ERROR"; message: string; raw: unknown }
    | { type: "RATING_UNAVAILABLE"; message: string; raw?: unknown };

const WF_QUERY_PATH = "/service/wfquery";

const DEFAULT_RATING_BASE_URLS = [
    "https://wsfgd1.fortiguard.net:3400",
    "https://wsfgd2.fortiguard.net:3400",
    "https://globalurl.fortinet.net",
] as const;

const DEFAULT_CATEGORY_VERSIONS = ["10", "9", "8"] as const;

const ResponseSchema = z.looseObject({
    status: z.number(),
    data: z.array(z.unknown()).optional(),
});

const FortiGuardRatingSchema = z.union([
    z.number(),
    z.string(),
    z.looseObject({
        category: z.union([z.number(), z.string()]).optional(),
        cate: z.union([z.number(), z.string()]).optional(),
        url: z.string().optional(),
    }),
]);

const FORTIGUARD_CATEGORY_GROUPS: Record<number, string> = {
    0: "Unrated",
    1: "Potentially Liable",
    2: "Adult/Mature Content",
    4: "Bandwidth Consuming",
    5: "Security Risk",
    6: "General Interest - Personal",
    7: "General Interest - Business",
};

const FORTIGUARD_CATEGORIES: Record<number, { name: string; group: string }> = {
    0: {
        name: "Not Rated",
        group: FORTIGUARD_CATEGORY_GROUPS[0],
    },
    1: {
        name: "Drug Abuse",
        group: FORTIGUARD_CATEGORY_GROUPS[1],
    },
    2: {
        name: "Alternative Beliefs",
        group: FORTIGUARD_CATEGORY_GROUPS[2],
    },
    3: {
        name: "Hacking",
        group: FORTIGUARD_CATEGORY_GROUPS[1],
    },
    4: {
        name: "Illegal or Unethical",
        group: FORTIGUARD_CATEGORY_GROUPS[1],
    },
    5: {
        name: "Discrimination",
        group: FORTIGUARD_CATEGORY_GROUPS[1],
    },
    6: {
        name: "Explicit Violence",
        group: FORTIGUARD_CATEGORY_GROUPS[1],
    },
    7: {
        name: "Abortion",
        group: FORTIGUARD_CATEGORY_GROUPS[2],
    },
    8: {
        name: "Other Adult Materials",
        group: FORTIGUARD_CATEGORY_GROUPS[2],
    },
    9: {
        name: "Advocacy Organizations",
        group: FORTIGUARD_CATEGORY_GROUPS[2],
    },
    10: {
        name: "Alcohol and Tobacco",
        group: FORTIGUARD_CATEGORY_GROUPS[2],
    },
    11: {
        name: "Gambling",
        group: FORTIGUARD_CATEGORY_GROUPS[2],
    },
    12: {
        name: "Extremist Groups",
        group: FORTIGUARD_CATEGORY_GROUPS[1],
    },
    13: {
        name: "Nudity and Risque",
        group: FORTIGUARD_CATEGORY_GROUPS[2],
    },
    14: {
        name: "Pornography",
        group: FORTIGUARD_CATEGORY_GROUPS[2],
    },
    15: {
        name: "Dating",
        group: FORTIGUARD_CATEGORY_GROUPS[2],
    },
    16: {
        name: "Weapons (Sales)",
        group: FORTIGUARD_CATEGORY_GROUPS[2],
    },
    17: {
        name: "Advertising",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    18: {
        name: "Brokerage and Trading",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    19: {
        name: "Freeware and Software Downloads",
        group: FORTIGUARD_CATEGORY_GROUPS[4],
    },
    20: {
        name: "Games",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    23: {
        name: "Web-based Email",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    24: {
        name: "File Sharing and Storage",
        group: FORTIGUARD_CATEGORY_GROUPS[4],
    },
    25: {
        name: "Streaming Media and Download",
        group: FORTIGUARD_CATEGORY_GROUPS[4],
    },
    26: {
        name: "Malicious Websites",
        group: FORTIGUARD_CATEGORY_GROUPS[5],
    },
    28: {
        name: "Entertainment",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    29: {
        name: "Arts and Culture",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    30: {
        name: "Education",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    31: {
        name: "Finance and Banking",
        group: FORTIGUARD_CATEGORY_GROUPS[7],
    },
    33: {
        name: "Health and Wellness",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    34: {
        name: "Job Search",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    35: {
        name: "Medicine",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    36: {
        name: "News and Media",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    37: {
        name: "Social Networking",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    38: {
        name: "Political Organizations",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    39: {
        name: "Reference",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    40: {
        name: "Global Religion",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    41: {
        name: "Search Engines and Portals",
        group: FORTIGUARD_CATEGORY_GROUPS[7],
    },
    42: {
        name: "Shopping",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    43: {
        name: "General Organizations",
        group: FORTIGUARD_CATEGORY_GROUPS[7],
    },
    44: {
        name: "Society and Lifestyles",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    46: {
        name: "Sports",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    47: {
        name: "Travel",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    48: {
        name: "Personal Vehicles",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    49: {
        name: "Business",
        group: FORTIGUARD_CATEGORY_GROUPS[7],
    },
    50: {
        name: "Information and Computer Security",
        group: FORTIGUARD_CATEGORY_GROUPS[7],
    },
    51: {
        name: "Government and Legal Organizations",
        group: FORTIGUARD_CATEGORY_GROUPS[7],
    },
    52: {
        name: "Information Technology",
        group: FORTIGUARD_CATEGORY_GROUPS[7],
    },
    53: {
        name: "Armed Forces",
        group: FORTIGUARD_CATEGORY_GROUPS[7],
    },
    54: {
        name: "Dynamic Content",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    55: {
        name: "Meaningless Content",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    56: {
        name: "Web Hosting",
        group: FORTIGUARD_CATEGORY_GROUPS[7],
    },
    57: {
        name: "Marijuana",
        group: FORTIGUARD_CATEGORY_GROUPS[2],
    },
    58: {
        name: "Folklore",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    59: {
        name: "Proxy Avoidance",
        group: FORTIGUARD_CATEGORY_GROUPS[1],
    },
    61: {
        name: "Phishing",
        group: FORTIGUARD_CATEGORY_GROUPS[5],
    },
    62: {
        name: "Plagiarism",
        group: FORTIGUARD_CATEGORY_GROUPS[1],
    },
    63: {
        name: "Sex Education",
        group: FORTIGUARD_CATEGORY_GROUPS[2],
    },
    64: {
        name: "Alcohol",
        group: FORTIGUARD_CATEGORY_GROUPS[2],
    },
    65: {
        name: "Tobacco",
        group: FORTIGUARD_CATEGORY_GROUPS[2],
    },
    66: {
        name: "Lingerie and Swimsuit",
        group: FORTIGUARD_CATEGORY_GROUPS[2],
    },
    67: {
        name: "Sports Hunting and War Games",
        group: FORTIGUARD_CATEGORY_GROUPS[2],
    },
    68: {
        name: "Web Chat",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    69: {
        name: "Instant Messaging",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    70: {
        name: "Newsgroups and Message Boards",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    71: {
        name: "Digital Postcards",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    72: {
        name: "Peer-to-peer File Sharing",
        group: FORTIGUARD_CATEGORY_GROUPS[4],
    },
    75: {
        name: "Internet Radio and TV",
        group: FORTIGUARD_CATEGORY_GROUPS[4],
    },
    76: {
        name: "Internet Telephony",
        group: FORTIGUARD_CATEGORY_GROUPS[4],
    },
    77: {
        name: "Child Education",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    78: {
        name: "Real Estate",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    79: {
        name: "Restaurant and Dining",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    80: {
        name: "Personal Websites and Blogs",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    81: {
        name: "Secure Websites",
        group: FORTIGUARD_CATEGORY_GROUPS[7],
    },
    82: {
        name: "Content Servers",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    83: {
        name: "Child Abuse",
        group: FORTIGUARD_CATEGORY_GROUPS[1],
    },
    84: {
        name: "Web-based Applications",
        group: FORTIGUARD_CATEGORY_GROUPS[7],
    },
    85: {
        name: "Domain Parking",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    86: {
        name: "Spam URLs",
        group: FORTIGUARD_CATEGORY_GROUPS[5],
    },
    87: {
        name: "Personal Privacy",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    88: {
        name: "Dynamic DNS",
        group: FORTIGUARD_CATEGORY_GROUPS[5],
    },
    89: {
        name: "Auction",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    90: {
        name: "Newly Observed Domain",
        group: FORTIGUARD_CATEGORY_GROUPS[5],
    },
    91: {
        name: "Newly Registered Domain",
        group: FORTIGUARD_CATEGORY_GROUPS[5],
    },
    92: {
        name: "Charitable Organizations",
        group: FORTIGUARD_CATEGORY_GROUPS[7],
    },
    93: {
        name: "Remote Access",
        group: FORTIGUARD_CATEGORY_GROUPS[7],
    },
    94: {
        name: "Web Analytics",
        group: FORTIGUARD_CATEGORY_GROUPS[7],
    },
    95: {
        name: "Online Meeting",
        group: FORTIGUARD_CATEGORY_GROUPS[7],
    },
    96: {
        name: "Terrorism",
        group: FORTIGUARD_CATEGORY_GROUPS[1],
    },
    97: {
        name: "URL Shortening",
        group: FORTIGUARD_CATEGORY_GROUPS[7],
    },
    98: {
        name: "Crypto Mining",
        group: FORTIGUARD_CATEGORY_GROUPS[1],
    },
    99: {
        name: "Potentially Unwanted Program",
        group: FORTIGUARD_CATEGORY_GROUPS[1],
    },
    100: {
        name: "Artificial Intelligence Technology",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
    101: {
        name: "Cryptocurrency",
        group: FORTIGUARD_CATEGORY_GROUPS[6],
    },
};

export function createFortiGuardChecker(
    config: FortiGuardCheckerConfig = {
        clientKey: getCachedClientKey(),
        blockCategories: [12, 13, 14, 19, 67, 83, 96, 98, 99],
    },
) {
    const http = config.http ?? xior.create();
    let resolvedConfigPromise: Promise<
        Result<ResolvedFortiGuardConfig, FortiGuardCheckerError>
    > | null = null;

    const resolveConfig = (): ResultAsync<
        ResolvedFortiGuardConfig,
        FortiGuardCheckerError
    > => {
        resolvedConfigPromise ??= resolveFortiGuardConfig(config, http);
        return ResultAsync.fromSafePromise(resolvedConfigPromise).andThen(
            result => result,
        );
    };

    const checkUrl = (
        input: string | URL,
    ): ResultAsync<FortiGuardCheckResult, FortiGuardCheckerError> => {
        return resolveConfig().andThen(resolvedConfig =>
            ResultAsync.fromPromise(
                requestRating(input, resolvedConfig, http),
                (cause): FortiGuardCheckerError => ({
                    type: "NETWORK_ERROR",
                    message:
                        cause instanceof Error
                            ? cause.message
                            : "FortiGuard request failed",
                    cause,
                }),
            ).andThen(raw => parseRating(input, raw, resolvedConfig)),
        );
    };

    return { checkUrl, resolveConfig };
}

async function resolveFortiGuardConfig(
    config: FortiGuardCheckerConfig,
    http: XiorInstance,
): Promise<Result<ResolvedFortiGuardConfig, FortiGuardCheckerError>> {
    if (!config.clientKey?.trim()) {
        return err({
            type: "INVALID_CONFIG",
            message: "clientKey is required",
        });
    }

    const partial = {
        clientKey: config.clientKey.trim(),
        emsSerialNumber: config.emsSerialNumber?.trim(),
        protocolVersion: config.protocolVersion ?? "1.0",
        clientType: config.clientType ?? "ie",
        timeoutMs: config.timeoutMs ?? 8_000,
        blockCategories: config.blockCategories ?? [],
        warnCategories: config.warnCategories ?? [],
    };

    const baseUrlResult = config.baseUrl
        ? ok(config.baseUrl)
        : await discoverBaseUrl(
              partial,
              http,
              config.discoveryTimeoutMs ?? 2_500,
          );

    if (baseUrlResult.isErr()) return err(baseUrlResult.error);

    const categoryVersionResult = config.categoryVersion
        ? ok(config.categoryVersion)
        : await discoverCategoryVersion(
              { ...partial, baseUrl: baseUrlResult.value },
              http,
              config.discoveryTimeoutMs ?? 2_500,
          );

    if (categoryVersionResult.isErr()) return err(categoryVersionResult.error);

    return ok({
        ...partial,
        baseUrl: baseUrlResult.value,
        categoryVersion: categoryVersionResult.value,
    });
}

async function discoverBaseUrl(
    config: Omit<ResolvedFortiGuardConfig, "baseUrl" | "categoryVersion">,
    http: XiorInstance,
    timeoutMs: number,
): Promise<Result<string, FortiGuardCheckerError>> {
    const attempts = DEFAULT_RATING_BASE_URLS.map(async baseUrl => {
        const raw = await requestRating(
            "https://example.com",
            {
                ...config,
                baseUrl,
                categoryVersion: "10",
            },
            http,
            timeoutMs,
        );

        ResponseSchema.parse(raw);
        return baseUrl;
    });

    try {
        return ok(await Promise.any(attempts));
    } catch (cause) {
        return err({
            type: "DISCOVERY_FAILED",
            message: "Could not discover a working FortiGuard rating base URL",
            cause,
        });
    }
}

async function discoverCategoryVersion(
    config: Omit<ResolvedFortiGuardConfig, "categoryVersion">,
    http: XiorInstance,
    timeoutMs: number,
): Promise<Result<string, FortiGuardCheckerError>> {
    for (const categoryVersion of DEFAULT_CATEGORY_VERSIONS) {
        try {
            const raw = await requestRating(
                "https://example.com",
                {
                    ...config,
                    categoryVersion,
                },
                http,
                timeoutMs,
            );

            const parsed = ResponseSchema.safeParse(raw);
            if (parsed.success && parsed.data.status === 0)
                return ok(categoryVersion);
        } catch {
            // Try the next version.
        }
    }

    return err({
        type: "DISCOVERY_FAILED",
        message: "Could not discover an accepted FortiGuard category version",
    });
}

async function requestRating(
    input: string | URL,
    config: ResolvedFortiGuardConfig,
    http: XiorInstance,
    timeoutOverrideMs?: number,
): Promise<unknown> {
    const normalized = normalizeUrl(input);
    if (normalized.isErr()) throw normalized.error;

    const ratingUrl = new URL(
        WF_QUERY_PATH,
        ensureTrailingSlash(config.baseUrl),
    );
    ratingUrl.searchParams.set("protver", config.protocolVersion);
    ratingUrl.searchParams.set("cltkey", config.clientKey);
    if (config.emsSerialNumber)
        ratingUrl.searchParams.set("emssn", config.emsSerialNumber);
    ratingUrl.searchParams.set("clttype", config.clientType);
    ratingUrl.searchParams.set("type", "cate");
    ratingUrl.searchParams.set("catver", config.categoryVersion);
    ratingUrl.searchParams.set("qurl", normalized.value.href);

    const response = await http.get(ratingUrl.href, {
        timeout: timeoutOverrideMs ?? config.timeoutMs,
        responseType: "json",
        validateStatus: () => true,
    });

    return response.data;
}

function parseRating(
    originalInput: string | URL,
    raw: unknown,
    config: ResolvedFortiGuardConfig,
): Result<FortiGuardCheckResult, FortiGuardCheckerError> {
    const parsedResponse = ResponseSchema.safeParse(raw);

    if (!parsedResponse.success) {
        return err({
            type: "PARSE_ERROR",
            message: "Unexpected FortiGuard response",
            raw,
        });
    }

    if (parsedResponse.data.status !== 0) {
        return err({
            type: "RATING_UNAVAILABLE",
            message: `FortiGuard returned status ${parsedResponse.data.status}`,
            raw,
        });
    }

    const first = parsedResponse.data.data?.[0];
    const parsedRating = FortiGuardRatingSchema.safeParse(first);

    if (!parsedRating.success) {
        return err({
            type: "PARSE_ERROR",
            message: "Unexpected FortiGuard rating object",
            raw,
        });
    }

    const categoryId =
        typeof parsedRating.data === "object"
            ? parseCategoryId(
                  parsedRating.data.category ?? parsedRating.data.cate,
              )
            : parseCategoryId(parsedRating.data);

    const fallbackUrl = normalizeUrl(originalInput);
    if (fallbackUrl.isErr()) return err(fallbackUrl.error);

    const ratedUrl =
        typeof parsedRating.data === "object" && parsedRating.data.url
            ? normalizeUrl(parsedRating.data.url).unwrapOr(fallbackUrl.value)
            : fallbackUrl.value;

    const category =
        categoryId == null ? undefined : FORTIGUARD_CATEGORIES[categoryId];
    const verdict = decideVerdict(categoryId, config);

    return ok({
        url: ratedUrl.href,
        normalizedUrl: ratedUrl.href,
        hostname: ratedUrl.hostname,
        verdict,
        allowed: verdict === "ALLOW",
        blocked: verdict === "BLOCK",
        warned: verdict === "WARN",
        categoryId,
        categoryName: category?.name ?? "Unknown",
        categoryGroup: category?.group ?? "Unknown",
        source: "fortiguard",
        resolvedConfig: config,
        raw,
    });
}

function normalizeUrl(
    input: string | URL,
): Result<URL, FortiGuardCheckerError> {
    const raw = String(input).trim();

    try {
        const url =
            input instanceof URL
                ? input
                : new URL(raw.includes("://") ? raw : `https://${raw}`);

        if (!["http:", "https:"].includes(url.protocol)) {
            return err({
                type: "INVALID_URL",
                message: "Only http(s) URLs are supported",
                input: raw,
            });
        }

        return ok(url);
    } catch {
        return err({ type: "INVALID_URL", message: "Invalid URL", input: raw });
    }
}

function parseCategoryId(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
    return null;
}

function decideVerdict(
    categoryId: number | null,
    config: Pick<
        ResolvedFortiGuardConfig,
        "blockCategories" | "warnCategories"
    >,
): Verdict {
    if (categoryId == null) return "UNKNOWN";
    if (config.blockCategories.includes(categoryId)) return "BLOCK";
    if (config.warnCategories.includes(categoryId)) return "WARN";
    return "ALLOW";
}

function ensureTrailingSlash(value: string): string {
    return value.endsWith("/") ? value : `${value}/`;
}
