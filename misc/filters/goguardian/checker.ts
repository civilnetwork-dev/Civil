import { err, ok, ResultAsync } from "neverthrow";
import { getDomain } from "tldts";
import xior, { type XiorError } from "xior";
import { z } from "zod";

export type GoGuardianVerdict = "ALLOW" | "BLOCK" | "UNKNOWN";

export type GoGuardianError =
    | { type: "INVALID_URL"; message: string; input: string }
    | { type: "NETWORK"; message: string; status?: number; body?: unknown }
    | { type: "PARSE"; message: string; body?: unknown };

export interface GoGuardianAuthCheckerOptions {
    authToken: string;
    extensionVersion: string;
    timeoutMs?: number;
}

export interface GoGuardianCheckInput {
    url: string;
    title?: string;
    text?: string;
}

export interface GoGuardianCheckResult {
    inputUrl: string;
    normalizedUrl: string;
    hostname: string;
    domain: string | null;
    verdict: GoGuardianVerdict;
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

const ThreatsModelSchema = z.looseObject({
    keywords: z.array(z.string()).optional(),
    threat_keywords: z.array(z.string()).optional(),
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

export function checkGoGuardianFilterAuthenticated(
    input: GoGuardianCheckInput,
    options: GoGuardianAuthCheckerOptions,
): ResultAsync<GoGuardianCheckResult, GoGuardianError> {
    const normalized = normalizeUrl(input.url);

    if (!normalized) {
        return ResultAsync.fromSafePromise(
            Promise.resolve(
                err({
                    type: "INVALID_URL" as const,
                    message: "Invalid URL.",
                    input: input.url,
                }),
            ),
        ).andThen(x => x);
    }

    const client = xior.create({
        timeout: options.timeoutMs ?? 10_000,
        headers: {
            Authorization: options.authToken,
            "Comprand-Authorization": options.authToken,
            extensionversion: options.extensionVersion,
            accept: "application/json",
        },
    });

    const fetchProxyVersion = ResultAsync.fromPromise(
        client.get(
            "https://snat.goguardian.com/api/v1/ext/smart-filtering/models/proxies/version/current",
        ),
        toNetworkError,
    ).andThen(res => {
        const parsed = VersionSchema.safeParse(res.data);

        return parsed.success
            ? ok(parsed.data.version)
            : err({
                  type: "PARSE" as const,
                  message: "Invalid proxy model version response.",
                  body: res.data,
              });
    });

    const fetchThreatsVersion = ResultAsync.fromPromise(
        client.get(
            "https://snat.goguardian.com/api/v1/ext/smart-filtering/models/threats/version/current",
        ),
        toNetworkError,
    ).andThen(res => {
        const parsed = VersionSchema.safeParse(res.data);

        return parsed.success
            ? ok(parsed.data.version)
            : err({
                  type: "PARSE" as const,
                  message: "Invalid threats model version response.",
                  body: res.data,
              });
    });

    return fetchProxyVersion.andThen(proxyVersion =>
        fetchThreatsVersion.andThen(threatsVersion =>
            ResultAsync.fromPromise(
                Promise.all([
                    client.get(
                        `https://snat.goguardian.com/api/v1/ext/smart-filtering/models/proxies/${proxyVersion}/model.json`,
                    ),
                    client.get(
                        `https://snat.goguardian.com/api/v1/ext/smart-filtering/models/threats/${threatsVersion}/model.json`,
                    ),
                ]),
                toNetworkError,
            ).andThen(([proxyRes, threatsRes]) => {
                const proxyParsed = ProxyModelSchema.safeParse(proxyRes.data);
                const threatsParsed = ThreatsModelSchema.safeParse(
                    threatsRes.data,
                );

                if (!proxyParsed.success) {
                    return err({
                        type: "PARSE" as const,
                        message: "Invalid proxy model response.",
                        body: proxyRes.data,
                    });
                }

                if (!threatsParsed.success) {
                    return err({
                        type: "PARSE" as const,
                        message: "Invalid threats model response.",
                        body: threatsRes.data,
                    });
                }

                const searchableText = [
                    normalized.href,
                    normalized.hostname,
                    getDomain(normalized.hostname) ?? "",
                    input.title ?? "",
                    input.text ?? "",
                ]
                    .join(" ")
                    .toLowerCase();

                const proxyKeywords = proxyParsed.data.proxy_keywords ?? [];

                const threatKeywords = [
                    ...(threatsParsed.data.keywords ?? []),
                    ...(threatsParsed.data.threat_keywords ?? []),
                ];

                const matchedProxyKeywords = matchKeywords(
                    searchableText,
                    proxyKeywords,
                );

                const matchedThreatKeywords = matchKeywords(
                    searchableText,
                    threatKeywords,
                );

                const verdict: GoGuardianVerdict =
                    matchedProxyKeywords.length > 0 ||
                    matchedThreatKeywords.length > 0
                        ? "BLOCK"
                        : "UNKNOWN";

                return ok({
                    inputUrl: input.url,
                    normalizedUrl: normalized.href,
                    hostname: normalized.hostname,
                    domain: getDomain(normalized.hostname),
                    verdict,
                    matchedProxyKeywords,
                    matchedThreatKeywords,
                    proxyModelVersion: proxyVersion,
                    threatsModelVersion: threatsVersion,
                    rawModels: {
                        proxy: proxyRes.data,
                        threats: threatsRes.data,
                    },
                });
            }),
        ),
    );
}
