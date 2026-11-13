import { err, errAsync, ok, type Result, ResultAsync } from "neverthrow";
import { getDomain } from "tldts";
import xior, { type XiorError } from "xior";
import { z } from "zod";

import {
    type FilterError,
    type FilterVerdict,
    toFilterError,
} from "../verdict";
import { generateGoGuardianAuthToken } from "./generateAuthToken";

type GoGuardianError =
    | { type: "INVALID_URL"; message: string; input: string }
    | { type: "NETWORK"; message: string; status?: number; body?: unknown }
    | { type: "PARSE"; message: string; body?: unknown };

export type GoGuardianAuthCheckerOptions =
    | { authToken: string; extensionVersion: string; timeoutMs?: number }
    | { orgRands: string[]; extensionVersion: string; timeoutMs?: number };

export interface GoGuardianCheckInput {
    url: string;
    title?: string;
    text?: string;
}

interface GoGuardianCheckResult {
    inputUrl: string;
    normalizedUrl: string;
    hostname: string;
    domain: string | null;
    matchedProxyKeywords: string[];
    matchedThreatKeywords: string[];
    proxyModelVersion?: string;
    threatsModelVersion?: string;
    rawModels?: {
        proxy?: unknown;
        threats?: unknown;
    };
}

const VersionSchema = z.object({
    version: z.union([z.string(), z.number()]).transform(String),
});

const ProxyModelSchema = z.looseObject({
    proxy_keywords: z.array(z.string()).optional(),
});

const ThreatLevelSchema = z.looseObject({
    keywords: z.array(z.string()).optional(),
});

const ThreatsModelSchema = z.looseObject({
    keywords: z.array(z.string()).optional(),
    threat_keywords: z.array(z.string()).optional(),
    medium: ThreatLevelSchema.optional(),
    high: ThreatLevelSchema.optional(),
    veryHigh: ThreatLevelSchema.optional(),
});

function normalizeUrl(input: string): URL | null {
    try {
        return new URL(input.includes("://") ? input : `https://${input}`);
    } catch {
        return null;
    }
}

function toNetworkError(error: unknown): GoGuardianError {
    const e = error as XiorError<unknown>;

    return {
        type: "NETWORK",
        message: e.message,
        status: e.response?.status,
        body: e.response?.data,
    };
}

function includesKeyword(haystack: string, keyword: string): boolean {
    const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (!escaped) return false;

    return new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i").test(haystack);
}

function matchKeywords(content: string, keywords: string[]): string[] {
    return keywords.filter(keyword => includesKeyword(content, keyword));
}

function resolveAuthToken(
    options: GoGuardianAuthCheckerOptions,
): ResultAsync<string, GoGuardianError> {
    if ("authToken" in options) {
        return ResultAsync.fromSafePromise(Promise.resolve(options.authToken));
    }

    return generateGoGuardianAuthToken({
        orgRands: options.orgRands,
        extensionVersion: options.extensionVersion,
        timeoutMs: options.timeoutMs,
    });
}

type XiorClient = ReturnType<typeof xior.create>;

const MODELS_URL =
    "https://snat.goguardian.com/api/v1/ext/smart-filtering/models";

function createModelClient(
    authToken: string,
    options: GoGuardianAuthCheckerOptions,
): XiorClient {
    return xior.create({
        timeout: options.timeoutMs ?? 10_000,
        headers: {
            Authorization: authToken,
            "Comprand-Authorization": authToken,
            extensionversion: options.extensionVersion,
            accept: "application/json",
        },
    });
}

/** The current version of one of GoGuardian's smart-filtering models. */
function fetchModelVersion(
    client: XiorClient,
    model: "proxies" | "threats",
    label: string,
): ResultAsync<string, GoGuardianError> {
    return ResultAsync.fromPromise(
        client.get(`${MODELS_URL}/${model}/version/current`),
        toNetworkError,
    ).andThen(res => {
        const parsed = VersionSchema.safeParse(res.data);

        return parsed.success
            ? ok(parsed.data.version)
            : err({
                  type: "PARSE" as const,
                  message: `Invalid ${label} model version response.`,
                  body: res.data,
              });
    });
}

type ModelVersions = { proxyVersion: string; threatsVersion: string };

function searchableTextFor(input: GoGuardianCheckInput, normalized: URL) {
    return [
        normalized.href,
        normalized.hostname,
        getDomain(normalized.hostname) ?? "",
        input.title ?? "",
        input.text ?? "",
    ]
        .join(" ")
        .toLowerCase();
}

function threatKeywordsOf(model: z.infer<typeof ThreatsModelSchema>) {
    return [
        ...(model.keywords ?? []),
        ...(model.threat_keywords ?? []),
        ...(model.medium?.keywords ?? []),
        ...(model.high?.keywords ?? []),
        ...(model.veryHigh?.keywords ?? []),
    ];
}

/** Matches the page against both downloaded models. */
function scoreAgainstModels(
    input: GoGuardianCheckInput,
    normalized: URL,
    { proxyVersion, threatsVersion }: ModelVersions,
    proxyData: unknown,
    threatsData: unknown,
): Result<GoGuardianCheckResult, GoGuardianError> {
    const proxyParsed = ProxyModelSchema.safeParse(proxyData);
    const threatsParsed = ThreatsModelSchema.safeParse(threatsData);

    if (!proxyParsed.success) {
        return err({
            type: "PARSE" as const,
            message: "Invalid proxy model response.",
            body: proxyData,
        });
    }

    if (!threatsParsed.success) {
        return err({
            type: "PARSE" as const,
            message: "Invalid threats model response.",
            body: threatsData,
        });
    }

    const searchableText = searchableTextFor(input, normalized);
    const matchedProxyKeywords = matchKeywords(
        searchableText,
        proxyParsed.data.proxy_keywords ?? [],
    );
    const matchedThreatKeywords = matchKeywords(
        searchableText,
        threatKeywordsOf(threatsParsed.data),
    );

    return ok({
        inputUrl: input.url,
        normalizedUrl: normalized.href,
        hostname: normalized.hostname,
        domain: getDomain(normalized.hostname),
        matchedProxyKeywords,
        matchedThreatKeywords,
        proxyModelVersion: proxyVersion,
        threatsModelVersion: threatsVersion,
        rawModels: {
            proxy: proxyData,
            threats: threatsData,
        },
    });
}

function fetchAndScore(
    client: XiorClient,
    input: GoGuardianCheckInput,
    normalized: URL,
): ResultAsync<GoGuardianCheckResult, GoGuardianError> {
    // Both version lookups start at once; the chain only orders the results.
    const fetchProxyVersion = fetchModelVersion(client, "proxies", "proxy");
    const fetchThreatsVersion = fetchModelVersion(client, "threats", "threats");

    return fetchProxyVersion.andThen(proxyVersion =>
        fetchThreatsVersion.andThen(threatsVersion =>
            ResultAsync.fromPromise(
                Promise.all([
                    client.get(
                        `${MODELS_URL}/proxies/${proxyVersion}/model.json`,
                    ),
                    client.get(
                        `${MODELS_URL}/threats/${threatsVersion}/model.json`,
                    ),
                ]),
                toNetworkError,
            ).andThen(([proxyRes, threatsRes]) =>
                scoreAgainstModels(
                    input,
                    normalized,
                    { proxyVersion, threatsVersion },
                    proxyRes.data,
                    threatsRes.data,
                ),
            ),
        ),
    );
}

/**
 * The legacy models supply keyword evidence. Enforcement also depends on the
 * school's policy and enabled triggers, which this checker does not have.
 */
function toVerdict(result: GoGuardianCheckResult): FilterVerdict {
    const matched = [
        ...result.matchedProxyKeywords,
        ...result.matchedThreatKeywords,
    ];
    return {
        status: "unknown",
        categories:
            result.matchedProxyKeywords.length > 0 ? ["Proxy & VPN"] : [],
        detail: matched.length
            ? `Matched GoGuardian's legacy keyword models: ${matched.join(", ")}. The school's policy determines enforcement.`
            : "No keyword in GoGuardian's legacy models matched. The school's policy determines enforcement.",
        matched,
    };
}

export function checkGoGuardianFilterAuthenticated(
    input: GoGuardianCheckInput,
    options: GoGuardianAuthCheckerOptions,
): ResultAsync<FilterVerdict, FilterError> {
    const normalized = normalizeUrl(input.url);

    if (!normalized) {
        return errAsync({
            type: "INVALID_URL" as const,
            message: "Invalid URL.",
        });
    }

    return resolveAuthToken(options)
        .andThen(authToken =>
            fetchAndScore(
                createModelClient(authToken, options),
                input,
                normalized,
            ),
        )
        .map(toVerdict)
        .mapErr(toFilterError);
}
