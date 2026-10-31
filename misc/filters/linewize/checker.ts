import { randomUUID } from "node:crypto";

import { err, errAsync, ok, type Result, ResultAsync } from "neverthrow";
import xior, { type XiorError, type XiorInstance } from "xior";
import { z } from "zod";

import { toCategories } from "../categories";
import {
    type FilterError,
    type FilterStatus,
    type FilterVerdict,
    toFilterError,
} from "../verdict";
import { getLatestLinewizeConnectVersion } from "./getLatestVersion";

const LINEWIZE_CONNECT_CHROME_ID = "ddfbkhpmcdbciejenfcolaaiebnjcbfc";

const LINEWIZE_REGIONS = [
    "beta-1",
    "sit",
    "syd-1",
    "syd-2",
    "uk-1",
    "us-1",
] as const;

export type LinewizeRegion = (typeof LINEWIZE_REGIONS)[number];

type Verdict = "ALLOW" | "BLOCK" | "WARN" | "BYPASS" | "UNKNOWN";

export type CheckerError =
    | { type: "INVALID_URL"; message: string }
    | { type: "CONFIG_ERROR"; message: string; details?: unknown }
    | { type: "HTTP_ERROR"; status?: number; message: string; data?: unknown }
    | { type: "TIMEOUT"; message: string }
    | { type: "PARSE_ERROR"; message: string; raw: unknown };

export type LinewizeCheckerConfig = {
    verdictServerUrl: string;
    identity: string;
    deviceId: string;
    chromeId?: string;
    extensionVersion?: string;
    authToken?: string;
    isDelegationActive?: boolean;
    isOnNetwork?: boolean;
    timeoutMs?: number;
};

export type AutoLinewizeCheckerConfig = {
    identity: string;
    regions?: readonly LinewizeRegion[];
    extensionVersion?: string;
    chromeId?: string;
    timeoutMs?: number;
    isDelegationActive?: boolean;
    isOnNetwork?: boolean;
    authToken?: string;
};

type CheckInput = {
    url: string | URL;
    searchQuery?: string;
    signatureIds?: string[];
    youtubeData?: {
        channelId: string;
        category: string;
    };
};

/** A bypass code lets the page through, so it reads as allowed. */
const STATUSES: Record<Verdict, FilterStatus> = {
    ALLOW: "allowed",
    BLOCK: "blocked",
    WARN: "warned",
    BYPASS: "allowed",
    UNKNOWN: "unknown",
};

type NetworkStatus = {
    onNetwork: boolean;
    authenticated: boolean;
    user?: string;
    deviceId?: string;
    region?: string;
    raw?: unknown;
};

type LinewizeDiscoveredConfig = {
    region: LinewizeRegion;
    gatewayUrl: string;
    verdictServerUrl: string;
    identity: string;
    userId: string;
    deviceId: string;
    extensionVersion: string;
    rawUserLookup: unknown;
    rawConfig: unknown;
};

type RegionAttempt = {
    region: LinewizeRegion;
    gatewayUrl: string;
    ok: boolean;
    status?: number;
    message?: string;
    data?: unknown;
};

const VerdictResponseSchema = z
    .object({
        verdict: z.union([z.string(), z.number()]).optional(),
        deviceid: z.string().optional(),
        method: z.string().optional(),
        ttl: z.number().optional(),
        categories: z.array(z.string()).optional(),
        category: z.union([z.string(), z.array(z.string())]).optional(),
        signatures: z
            .object({
                signature: z.string().optional(),
                category: z.string().optional(),
                subCategory: z.string().optional(),
                noise: z.boolean().optional(),
                effective_domain: z.string().optional(),
            })
            .catchall(z.unknown())
            .optional(),
        reason: z.string().optional(),
    })
    .catchall(z.unknown());

const NetworkStatusSchema = z
    .object({
        data: z
            .object({
                loggedin: z.boolean().optional(),
                user: z.string().optional(),
                device_id: z.string().optional(),
                region: z.string().optional(),
            })
            .catchall(z.unknown())
            .optional(),
    })
    .catchall(z.unknown());

const ConfigResponseSchema = z
    .object({
        verdict_server_url: z.string().optional(),
        device_id: z.string().optional(),
        deviceid: z.string().optional(),
    })
    .catchall(z.unknown());

const UserLookupResponseSchema = z
    .object({
        userid: z.string().optional(),
        user_id: z.string().optional(),
        user: z.string().optional(),
        deviceid: z.string().optional(),
        device_id: z.string().optional(),
    })
    .catchall(z.unknown());

let cachedGeneratedDeviceId: string | null = null;

export function generateDeviceId(): string {
    cachedGeneratedDeviceId ??= randomUUID();
    return cachedGeneratedDeviceId;
}

function getConfigurationGatewayUrl(region: LinewizeRegion): string {
    return `https://configuration-gw.${region}.linewize.net`;
}

function normalizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, "");
}

function normalizeVerdict(value: unknown): Verdict {
    if (typeof value === "number") {
        switch (value) {
            case 0:
                return "BLOCK";
            case 1:
                return "ALLOW";
            case 2:
                return "WARN";
            case 3:
                return "BYPASS";
            default:
                return "UNKNOWN";
        }
    }

    const normalized = String(value ?? "UNKNOWN").toUpperCase();

    return ["ALLOW", "BLOCK", "WARN", "BYPASS"].includes(normalized)
        ? (normalized as Verdict)
        : "UNKNOWN";
}

function normalizeCategories(
    parsed: z.infer<typeof VerdictResponseSchema>,
): string[] {
    if (Array.isArray(parsed.categories)) return parsed.categories;
    if (Array.isArray(parsed.category)) return parsed.category;
    if (typeof parsed.category === "string" && parsed.category.length > 0) {
        return [parsed.category];
    }

    if (typeof parsed.signatures?.category === "string") {
        return [parsed.signatures.category];
    }

    return [];
}

function toUrl(input: string | URL): Result<URL, CheckerError> {
    try {
        return ok(input instanceof URL ? input : new URL(input));
    } catch {
        return err({
            type: "INVALID_URL",
            message: `Invalid URL: ${String(input)}`,
        });
    }
}

function mapXiorError(error: unknown): CheckerError {
    const maybe = error as Partial<XiorError> & {
        code?: string;
        message?: string;
        response?: {
            status?: number;
            data?: unknown;
        };
    };

    if (
        maybe.code === "ECONNABORTED" ||
        /timeout/i.test(String(maybe.message ?? ""))
    ) {
        return { type: "TIMEOUT", message: "Linewize request timed out" };
    }

    return {
        type: "HTTP_ERROR",
        status: maybe.response?.status,
        message: maybe.message ?? "Linewize request failed",
        data: maybe.response?.data,
    };
}

function extractUserId(raw: unknown): Result<string, CheckerError> {
    const parsed = UserLookupResponseSchema.safeParse(raw);

    if (!parsed.success) {
        return err({
            type: "PARSE_ERROR",
            message: "Unexpected Linewize userid response",
            raw,
        });
    }

    const userId =
        parsed.data.userid ?? parsed.data.user_id ?? parsed.data.user;

    if (!userId) {
        return err({
            type: "CONFIG_ERROR",
            message: "Linewize userid response did not include a user id",
            details: raw,
        });
    }

    return ok(userId);
}

function extractDeviceId(raw: unknown): Result<string, CheckerError> {
    const parsed = UserLookupResponseSchema.safeParse(raw);

    if (!parsed.success) {
        return err({
            type: "PARSE_ERROR",
            message: "Unexpected Linewize deviceid response",
            raw,
        });
    }

    const deviceId = parsed.data.deviceid ?? parsed.data.device_id;

    if (!deviceId) {
        return err({
            type: "CONFIG_ERROR",
            message: "Linewize userid response did not include a device id",
            details: raw,
        });
    }

    return ok(deviceId);
}

function extractVerdictServerUrl(raw: unknown): Result<string, CheckerError> {
    const parsed = ConfigResponseSchema.safeParse(raw);

    if (!parsed.success) {
        return err({
            type: "PARSE_ERROR",
            message: "Unexpected Linewize configuration response",
            raw,
        });
    }

    const verdictServerUrl = parsed.data.verdict_server_url;

    if (!verdictServerUrl) {
        return err({
            type: "CONFIG_ERROR",
            message:
                "Linewize configuration did not include verdict_server_url",
            details: raw,
        });
    }

    return ok(normalizeBaseUrl(verdictServerUrl));
}

async function resolveExtensionVersion(
    extensionVersion?: string,
): Promise<string> {
    return extensionVersion ?? getLatestLinewizeConnectVersion();
}

type RegionLookup = {
    identity: string;
    region: LinewizeRegion;
    extensionVersion: string;
    timeoutMs: number;
    client: XiorInstance;
};

/** Step one: the identity's user and device ids in this region. */
async function lookupRegionUser(
    options: RegionLookup,
    gatewayUrl: string,
): Promise<
    Result<{ userId: string; deviceId: string; raw: unknown }, CheckerError>
> {
    const response = await options.client.get(
        `${gatewayUrl}/get/configuration/userid`,
        {
            params: {
                identity: options.identity,
            },
            timeout: options.timeoutMs,
            validateStatus: () => true,
        },
    );

    if (response.status !== 200) {
        return err({
            type: "HTTP_ERROR",
            status: response.status,
            message: `userid lookup failed for region ${options.region}`,
            data: response.data,
        });
    }

    const userIdResult = extractUserId(response.data);
    if (userIdResult.isErr()) return err(userIdResult.error);

    const deviceIdResult = extractDeviceId(response.data);
    if (deviceIdResult.isErr()) return err(deviceIdResult.error);

    return ok({
        userId: userIdResult.value,
        deviceId: deviceIdResult.value,
        raw: response.data,
    });
}

async function fetchLinewizeConfigForRegion(
    options: RegionLookup,
): Promise<Result<LinewizeDiscoveredConfig, CheckerError>> {
    const gatewayUrl = getConfigurationGatewayUrl(options.region);

    const user = await lookupRegionUser(options, gatewayUrl);
    if (user.isErr()) return err(user.error);
    const { userId, deviceId } = user.value;

    const configResponse = await options.client.get(
        `${gatewayUrl}/get/configuration/chrome-extension`,
        {
            params: {
                user: userId,
                deviceid: deviceId,
                agt: "chrome",
                ver: options.extensionVersion,
            },
            headers: {
                "X-Actor-Id": userId,
            },
            timeout: options.timeoutMs,
            validateStatus: () => true,
        },
    );

    if (configResponse.status !== 200) {
        return err({
            type: "HTTP_ERROR",
            status: configResponse.status,
            message: `configuration lookup failed for region ${options.region}`,
            data: configResponse.data,
        });
    }

    const verdictServerUrlResult = extractVerdictServerUrl(configResponse.data);
    if (verdictServerUrlResult.isErr())
        return err(verdictServerUrlResult.error);

    return ok({
        region: options.region,
        gatewayUrl,
        verdictServerUrl: verdictServerUrlResult.value,
        identity: options.identity,
        userId,
        deviceId,
        extensionVersion: options.extensionVersion,
        rawUserLookup: user.value.raw,
        rawConfig: configResponse.data,
    });
}

/** Tries one region, returning the config or a record of why it failed. */
async function attemptRegion(
    options: RegionLookup,
): Promise<LinewizeDiscoveredConfig | RegionAttempt> {
    const failure = (error: CheckerError, data: unknown): RegionAttempt => ({
        region: options.region,
        gatewayUrl: getConfigurationGatewayUrl(options.region),
        ok: false,
        status: error.type === "HTTP_ERROR" ? error.status : undefined,
        message: error.message,
        data,
    });

    try {
        const result = await fetchLinewizeConfigForRegion(options);
        if (result.isOk()) return result.value;
        const { error } = result;
        return failure(
            error,
            error.type === "HTTP_ERROR" ? error.data : (error as any).details,
        );
    } catch (error) {
        const mapped = mapXiorError(error);
        return failure(
            mapped,
            mapped.type === "HTTP_ERROR" ? mapped.data : undefined,
        );
    }
}

async function discoverAcrossRegions(
    config: AutoLinewizeCheckerConfig,
    client: XiorInstance,
): Promise<LinewizeDiscoveredConfig> {
    const timeoutMs = config.timeoutMs ?? 5_000;
    const extensionVersion = await resolveExtensionVersion(
        config.extensionVersion,
    );

    const attempts: RegionAttempt[] = [];

    for (const region of config.regions ?? LINEWIZE_REGIONS) {
        const outcome = await attemptRegion({
            identity: config.identity,
            region,
            extensionVersion,
            timeoutMs,
            client,
        });
        if (!("ok" in outcome)) return outcome;
        attempts.push(outcome);
    }

    throw {
        type: "CONFIG_ERROR",
        message: "No Linewize region returned a usable configuration",
        details: attempts,
    } satisfies CheckerError;
}

function discoverLinewizeConfig(
    config: AutoLinewizeCheckerConfig,
    client: XiorInstance = xior.create(),
): ResultAsync<LinewizeDiscoveredConfig, CheckerError> {
    return ResultAsync.fromPromise(
        discoverAcrossRegions(config, client),
        error => {
            if (
                typeof error === "object" &&
                error !== null &&
                "type" in error &&
                "message" in error
            ) {
                return error as CheckerError;
            }

            return mapXiorError(error);
        },
    );
}

export function createAutoLinewizeFilterChecker(
    config: AutoLinewizeCheckerConfig,
    client: XiorInstance = xior.create(),
): ResultAsync<LinewizeFilterChecker, FilterError> {
    return discoverLinewizeConfig(config, client)
        .map(discovered => {
            return new LinewizeFilterChecker(
                {
                    verdictServerUrl: discovered.verdictServerUrl,
                    identity: config.identity,
                    deviceId: discovered.deviceId,
                    chromeId: config.chromeId ?? LINEWIZE_CONNECT_CHROME_ID,
                    extensionVersion: discovered.extensionVersion,
                    timeoutMs: config.timeoutMs,
                    isDelegationActive: config.isDelegationActive,
                    isOnNetwork: config.isOnNetwork,
                    authToken: config.authToken,
                },
                client,
            );
        })
        .mapErr(toFilterError);
}

class LinewizeFilterChecker {
    private readonly client: XiorInstance;
    private readonly config: Required<
        Omit<LinewizeCheckerConfig, "authToken">
    > &
        Pick<LinewizeCheckerConfig, "authToken">;

    constructor(
        config: LinewizeCheckerConfig,
        client: XiorInstance = xior.create(),
    ) {
        if (!config.verdictServerUrl || !config.identity || !config.deviceId) {
            throw new Error("Missing required Linewize checker config");
        }

        this.config = {
            chromeId: LINEWIZE_CONNECT_CHROME_ID,
            extensionVersion: "4.0.1",
            isDelegationActive: false,
            isOnNetwork: false,
            timeoutMs: 5_000,
            ...config,
            verdictServerUrl: normalizeBaseUrl(config.verdictServerUrl),
        };

        this.client = client;
    }

    checkUrl(input: CheckInput): ResultAsync<FilterVerdict, FilterError> {
        return this.requestVerdict("/get/verdict", input);
    }

    checkClassroomPolicy(
        input: CheckInput,
    ): ResultAsync<FilterVerdict, FilterError> {
        return this.requestVerdict("/check/classroom/verdict", input);
    }

    checkMany(inputs: CheckInput[]): ResultAsync<FilterVerdict[], FilterError> {
        return ResultAsync.combine(inputs.map(input => this.checkUrl(input)));
    }

    probeNetworkStatus(): ResultAsync<NetworkStatus, CheckerError> {
        return ResultAsync.fromPromise(
            this.client.get("http://chromelogin.linewize.net/status", {
                timeout: this.config.timeoutMs,
                headers: {
                    "Cache-Control": "no-store",
                },
            }),
            mapXiorError,
        ).andThen(response => {
            const parsed = NetworkStatusSchema.safeParse(response.data);

            if (!parsed.success) {
                return err({
                    type: "PARSE_ERROR" as const,
                    message: "Unexpected Linewize network status response",
                    raw: response.data,
                });
            }

            const data = parsed.data.data;

            return ok({
                onNetwork: true,
                authenticated: Boolean(data?.loggedin && data?.user),
                user: data?.user,
                deviceId: data?.device_id,
                region: data?.region,
                raw: response.data,
            });
        });
    }

    private requestVerdict(
        path: string,
        input: CheckInput,
    ): ResultAsync<FilterVerdict, FilterError> {
        const parsedUrl = toUrl(input.url);

        if (parsedUrl.isErr()) {
            return errAsync(toFilterError(parsedUrl.error));
        }

        const requestUrl = new URL(`${this.config.verdictServerUrl}${path}`);
        this.setVerdictParams(requestUrl.searchParams, parsedUrl.value, input);

        return ResultAsync.fromPromise(
            this.client.get(requestUrl.toString(), {
                timeout: this.config.timeoutMs,
                headers: this.config.authToken
                    ? {
                          Authorization: `Bearer ${this.config.authToken}`,
                      }
                    : undefined,
            }),
            mapXiorError,
        )
            .andThen(response => this.parseVerdictResponse(response.data))
            .mapErr(toFilterError);
    }

    private setVerdictParams(
        params: URLSearchParams,
        url: URL,
        input: CheckInput,
    ): void {
        params.set("deviceid", this.config.deviceId);
        params.set("cev", this.config.extensionVersion);
        params.set("identity", this.config.identity);
        params.set("chrome_id", this.config.chromeId);
        params.set("requested_website", url.hostname);
        params.set(
            "requested_path",
            encodeURIComponent(`${url.pathname}${url.search}`),
        );
        params.set(
            "is_delegation_active",
            String(this.config.isDelegationActive),
        );
        params.set("is_on_network", String(this.config.isOnNetwork));

        if (input.searchQuery) {
            params.set("search_query", encodeURIComponent(input.searchQuery));
        }

        if (input.youtubeData) {
            params.set("youtube_channel", input.youtubeData.channelId);
            params.set("youtube_category", input.youtubeData.category);
        }

        for (const signatureId of input.signatureIds ?? []) {
            params.append("signature_id", encodeURIComponent(signatureId));
        }
    }

    private parseVerdictResponse(
        raw: unknown,
    ): Result<FilterVerdict, CheckerError> {
        const parsed = VerdictResponseSchema.safeParse(raw);

        if (!parsed.success) {
            return err({
                type: "PARSE_ERROR",
                message: "Unexpected Linewize verdict response",
                raw,
            });
        }

        const verdict = normalizeVerdict(parsed.data.verdict);
        const categories = toCategories(normalizeCategories(parsed.data));

        // `method: "fallback"` is the verdict server declining to classify
        // (no signature, allow by default), not an allow it stands behind.
        if (parsed.data.method === "fallback")
            return ok({
                status: "unknown",
                categories,
                detail: "Linewize's verdict server declined to classify it and allows it by default.",
                matched: [],
            });

        return ok({
            status: STATUSES[verdict],
            categories,
            detail: `Linewize answered ${verdict}${parsed.data.reason ? `: ${parsed.data.reason}` : ""}.`,
            matched: [],
        });
    }
}

export function createLinewizeFilterChecker(
    config: LinewizeCheckerConfig,
    client?: XiorInstance,
): LinewizeFilterChecker {
    return new LinewizeFilterChecker(config, client);
}
