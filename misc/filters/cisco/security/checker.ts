import {
    err,
    errAsync,
    ok,
    okAsync,
    type Result,
    ResultAsync,
} from "neverthrow";
import xior, { type XiorInstance } from "xior";

import { toCategories } from "../../categories";
import {
    type FilterError,
    type FilterVerdict,
    toFilterError,
} from "../../verdict";

export type CiscoVerdict =
    | "POLICY_ALLOW"
    | "POLICY_BLOCK"
    | "NO_POLICY_BLOCK_OBSERVED"
    | "DNS_ERROR"
    | "UNKNOWN";

export type CiscoPolicyIdentity = {
    organizationId: string;
    deviceId: string;
    accessToken: string;
    dpopToken?: string;
};

export type CiscoPolicyCheckResult = {
    verdict: "POLICY_ALLOW" | "POLICY_BLOCK" | "UNKNOWN";
    category?: string;
    categoryId?: string | number;
    ruleName?: string;
    reason: string;
    raw?: unknown;
};

export type CiscoPolicyChecker = (
    url: string,
    identity: CiscoPolicyIdentity,
) => Promise<CiscoPolicyCheckResult>;

export type CiscoCheckerConfig = {
    dohServer?: string;
    timeoutMs?: number;
    cacheTtlMs?: number;
    blockIpSet?: ReadonlySet<string>;

    /**
     * Optional authenticated Cisco policy identity.
     * DNS-only checks are not authoritative without this.
     */
    policyIdentity?: CiscoPolicyIdentity;

    /**
     * Plug in an official/authorized Cisco policy API lookup here.
     * Do not scrape or replay extension-private credentials.
     */
    policyChecker?: CiscoPolicyChecker;
};

export type CiscoDnsAnswer = {
    name: string;
    type: number;
    TTL: number;
    data: string;
};

export type CiscoDnsResponse = {
    Status: number;
    Answer: CiscoDnsAnswer[];
};

type CiscoCheckResult = {
    url: string;
    normalizedUrl: string;
    hostname: string;

    verdict: CiscoVerdict;
    allowed: boolean;
    blocked: boolean;
    authoritative: boolean;

    reason: string;
    addresses: string[];
    cnames: string[];

    category?: string;
    categoryId?: string | number;
    ruleName?: string;

    raw: {
        dns?: CiscoDnsResponse;
        policy?: unknown;
    };
};

type CiscoCheckerError =
    | { type: "INVALID_URL"; message: string; input: string }
    | { type: "NETWORK_ERROR"; message: string; cause: unknown }
    | { type: "PARSE_ERROR"; message: string; cause: unknown; raw?: unknown }
    | { type: "POLICY_ERROR"; message: string; cause: unknown };

const DEFAULT_DOH_SERVER = "https://doh.sse.cisco.com/dns-query";

const DEFAULT_BLOCK_IPS = new Set([
    "146.112.61.104",
    "146.112.61.105",
    "146.112.255.155",
]);

type CacheEntry<T> = {
    expiresAt: number;
    value: T;
};

function normalizeUrl(input: string): Result<URL, CiscoCheckerError> {
    const trimmed = input.trim();

    if (!trimmed) {
        return err({
            type: "INVALID_URL",
            message: "URL cannot be empty.",
            input,
        });
    }

    try {
        const normalized = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
            ? trimmed
            : `https://${trimmed}`;

        const url = new URL(normalized);

        if (!url.hostname) {
            return err({
                type: "INVALID_URL",
                message: "URL must include a hostname.",
                input,
            });
        }

        return ok(url);
    } catch {
        return err({
            type: "INVALID_URL",
            message: "Invalid URL.",
            input,
        });
    }
}

function createMemoryCache<T>() {
    const entries = new Map<string, CacheEntry<T>>();

    return {
        get(key: string): T | undefined {
            const entry = entries.get(key);
            if (!entry) return undefined;

            if (Date.now() >= entry.expiresAt) {
                entries.delete(key);
                return undefined;
            }

            return entry.value;
        },

        set(key: string, value: T, ttlMs: number): void {
            entries.set(key, {
                value,
                expiresAt: Date.now() + ttlMs,
            });
        },

        clear(): void {
            entries.clear();
        },
    };
}

function buildDnsQuery(hostname: string): Uint8Array {
    const labels = hostname.replace(/\.$/, "").toLowerCase().split(".");

    const bytes: number[] = [
        0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ];

    for (const label of labels) {
        if (!label || label.length > 63) {
            throw new Error(`Invalid DNS label: ${label}`);
        }

        bytes.push(label.length, ...Buffer.from(label, "ascii"));
    }

    bytes.push(0x00, 0x00, 0x01, 0x00, 0x01);

    return new Uint8Array(bytes);
}

function ensureAvailable(
    bytes: Uint8Array,
    offset: number,
    length: number,
): void {
    if (offset + length > bytes.length) {
        throw new Error("DNS response ended unexpectedly.");
    }
}

/**
 * Reads a possibly compressed name at `startOffset`. `nextOffset` is where
 * the record continues: just past the first compression pointer, or past the
 * terminating zero when the name was not compressed.
 */
function readDnsName(
    bytes: Uint8Array,
    startOffset: number,
): { name: string; nextOffset: number } {
    const labels: string[] = [];
    let currentOffset = startOffset;
    let nextOffset: number | undefined;
    let jumps = 0;

    while (true) {
        if (currentOffset >= bytes.length) {
            throw new Error("DNS name pointer is out of bounds.");
        }

        const length = bytes[currentOffset];

        if ((length & 0xc0) === 0xc0) {
            if (currentOffset + 1 >= bytes.length) {
                throw new Error("Incomplete DNS compression pointer.");
            }

            nextOffset ??= currentOffset + 2;
            currentOffset = ((length & 0x3f) << 8) | bytes[currentOffset + 1];

            if (++jumps > 20) {
                throw new Error("Too many DNS compression jumps.");
            }

            continue;
        }

        if (length === 0) {
            return {
                name: labels.join("."),
                nextOffset: nextOffset ?? currentOffset + 1,
            };
        }

        const start = currentOffset + 1;
        const end = start + length;

        if (end > bytes.length) {
            throw new Error("DNS label exceeds response length.");
        }

        labels.push(Buffer.from(bytes.slice(start, end)).toString("ascii"));
        currentOffset = end;
    }
}

function readRecordData(
    bytes: Uint8Array,
    offset: number,
    type: number,
    rdLength: number,
): string {
    if (type === 1 && rdLength === 4) {
        return Array.from(bytes.slice(offset, offset + 4)).join(".");
    }
    if (type === 5) {
        return readDnsName(bytes, offset).name;
    }
    return Buffer.from(bytes.slice(offset, offset + rdLength)).toString("hex");
}

function readDnsAnswer(
    bytes: Uint8Array,
    view: DataView,
    startOffset: number,
): { answer: CiscoDnsAnswer; nextOffset: number } {
    const answerName = readDnsName(bytes, startOffset);
    let offset = answerName.nextOffset;

    ensureAvailable(bytes, offset, 10);

    const type = view.getUint16(offset);
    // Type, then class, which is always IN here.
    offset += 4;

    const TTL = view.getUint32(offset);
    offset += 4;

    const rdLength = view.getUint16(offset);
    offset += 2;

    ensureAvailable(bytes, offset, rdLength);

    return {
        answer: {
            name: answerName.name,
            type,
            TTL,
            data: readRecordData(bytes, offset, type, rdLength),
        },
        nextOffset: offset + rdLength,
    };
}

function parseDnsResponse(data: ArrayBuffer): CiscoDnsResponse {
    const bytes = new Uint8Array(data);
    const view = new DataView(data);

    if (bytes.length < 12) {
        throw new Error("DNS response is too short.");
    }

    const status = bytes[3] & 0x0f;
    const qdCount = view.getUint16(4);
    const anCount = view.getUint16(6);

    let offset = 12;

    for (let i = 0; i < qdCount; i++) {
        offset = readDnsName(bytes, offset).nextOffset;
        ensureAvailable(bytes, offset, 4);
        offset += 4;
    }

    const Answer: CiscoDnsAnswer[] = [];

    for (let i = 0; i < anCount; i++) {
        const { answer, nextOffset } = readDnsAnswer(bytes, view, offset);
        Answer.push(answer);
        offset = nextOffset;
    }

    return {
        Status: status,
        Answer,
    };
}

function dnsToCheckResult(
    inputUrl: string,
    normalizedUrl: URL,
    raw: CiscoDnsResponse,
    blockIpSet: ReadonlySet<string>,
): CiscoCheckResult {
    const addresses = raw.Answer.filter(answer => answer.type === 1).map(
        answer => answer.data,
    );

    const cnames = raw.Answer.filter(answer => answer.type === 5).map(
        answer => answer.data,
    );

    const policyBlockObserved =
        addresses.some(ip => blockIpSet.has(ip)) ||
        cnames.some(name =>
            /block|blocked|proxy|policy|opendns|umbrella|hit-nxdomain/i.test(
                name,
            ),
        );

    const verdict: CiscoVerdict =
        raw.Status !== 0
            ? "DNS_ERROR"
            : policyBlockObserved
              ? "POLICY_BLOCK"
              : "NO_POLICY_BLOCK_OBSERVED";

    return {
        url: inputUrl,
        normalizedUrl: normalizedUrl.toString(),
        hostname: normalizedUrl.hostname,

        verdict,
        allowed: false,
        blocked: verdict === "POLICY_BLOCK",
        authoritative: verdict === "POLICY_BLOCK",

        reason:
            verdict === "POLICY_BLOCK"
                ? "Cisco returned a known Umbrella/OpenDNS block response."
                : verdict === "NO_POLICY_BLOCK_OBSERVED"
                  ? "Cisco DoH resolved the domain normally, but no authenticated Cisco policy verdict was available."
                  : `Cisco DoH returned DNS status ${raw.Status}.`,

        addresses,
        cnames,

        raw: {
            dns: raw,
        },
    };
}

function policyToCheckResult(
    inputUrl: string,
    normalizedUrl: URL,
    policy: CiscoPolicyCheckResult,
    dns?: CiscoDnsResponse,
): CiscoCheckResult {
    return {
        url: inputUrl,
        normalizedUrl: normalizedUrl.toString(),
        hostname: normalizedUrl.hostname,

        verdict: policy.verdict,
        allowed: policy.verdict === "POLICY_ALLOW",
        blocked: policy.verdict === "POLICY_BLOCK",
        authoritative: true,

        reason: policy.reason,

        addresses:
            dns?.Answer.filter(answer => answer.type === 1).map(
                answer => answer.data,
            ) ?? [],

        cnames:
            dns?.Answer.filter(answer => answer.type === 5).map(
                answer => answer.data,
            ) ?? [],

        category: policy.category,
        categoryId: policy.categoryId,
        ruleName: policy.ruleName,

        raw: {
            dns,
            policy: policy.raw ?? policy,
        },
    };
}

function queryDns(
    client: XiorInstance,
    dohServer: string,
    hostname: string,
): ResultAsync<CiscoDnsResponse, CiscoCheckerError> {
    let dnsQuery: Uint8Array;

    try {
        dnsQuery = buildDnsQuery(hostname);
    } catch (cause) {
        return ResultAsync.fromSafePromise(
            Promise.resolve(
                err({
                    type: "PARSE_ERROR" as const,
                    message: "Failed to build DNS query.",
                    cause,
                }),
            ),
        ).andThen(result => result);
    }

    return ResultAsync.fromPromise(
        client.post<ArrayBuffer>(dohServer, dnsQuery, {
            responseType: "arraybuffer",
            headers: {
                Accept: "application/dns-message",
                "Content-Type": "application/dns-message",
            },
        }),
        (cause): CiscoCheckerError => ({
            type: "NETWORK_ERROR",
            message: "Cisco DoH request failed.",
            cause,
        }),
    ).andThen(response => {
        try {
            return ok(parseDnsResponse(response.data));
        } catch (cause) {
            return err({
                type: "PARSE_ERROR" as const,
                message: "Failed to parse Cisco DNS response.",
                cause,
                raw: response.data,
            });
        }
    });
}

function queryPolicy(
    config: CiscoCheckerConfig,
    normalizedUrl: URL,
): ResultAsync<CiscoPolicyCheckResult | undefined, CiscoCheckerError> {
    if (!config.policyIdentity || !config.policyChecker) {
        return ResultAsync.fromSafePromise(Promise.resolve(undefined));
    }

    return ResultAsync.fromPromise(
        config.policyChecker(normalizedUrl.toString(), config.policyIdentity),
        (cause): CiscoCheckerError => ({
            type: "POLICY_ERROR",
            message: "Authenticated Cisco policy check failed.",
            cause,
        }),
    );
}

function cacheKeyFor(hostname: string, config: CiscoCheckerConfig): string {
    return [
        hostname,
        config.policyIdentity?.organizationId ?? "no-org",
        config.policyIdentity?.deviceId ?? "no-device",
        config.policyChecker ? "policy" : "dns",
    ].join(":");
}

/**
 * Only an authenticated policy lookup, or DNS landing on Umbrella's block
 * page, is an answer. Without one, DoH resolving the name normally says
 * nothing about policy, so it reads as unknown, never allowed: that read as
 * allowed for pornhub.com once.
 */
function toVerdict(result: CiscoCheckResult): FilterVerdict {
    return {
        status: result.blocked
            ? "blocked"
            : result.authoritative && result.allowed
              ? "allowed"
              : "unknown",
        categories: toCategories([result.category]),
        detail: result.reason,
        matched: result.ruleName ? [result.ruleName] : [],
    };
}

export function createCiscoSecurityChecker(config: CiscoCheckerConfig = {}) {
    const dohServer = config.dohServer ?? DEFAULT_DOH_SERVER;
    const timeoutMs = config.timeoutMs ?? 10_000;
    const cacheTtlMs = config.cacheTtlMs ?? 60_000;
    const blockIpSet = config.blockIpSet ?? DEFAULT_BLOCK_IPS;

    const client: XiorInstance = xior.create({ timeout: timeoutMs });
    const cache = createMemoryCache<FilterVerdict>();

    function checkUrl(url: string): ResultAsync<FilterVerdict, FilterError> {
        const normalized = normalizeUrl(url);
        if (normalized.isErr())
            return errAsync(toFilterError(normalized.error));

        const normalizedUrl = normalized.value;
        const hostname = normalizedUrl.hostname.toLowerCase();
        const cacheKey = cacheKeyFor(hostname, config);
        const cached = cache.get(cacheKey);
        if (cached) return okAsync(cached);

        const answer = (dns: CiscoDnsResponse) =>
            queryPolicy(config, normalizedUrl).map(policy =>
                policy
                    ? policyToCheckResult(url, normalizedUrl, policy, dns)
                    : dnsToCheckResult(url, normalizedUrl, dns, blockIpSet),
            );
        return queryDns(client, dohServer, hostname)
            .andThen(answer)
            .map(result => {
                const verdict = toVerdict(result);
                cache.set(cacheKey, verdict, cacheTtlMs);
                return verdict;
            })
            .mapErr(toFilterError);
    }

    async function checkMany(urls: readonly string[]) {
        return Promise.all(urls.map(url => checkUrl(url)));
    }

    function clearCache(): void {
        cache.clear();
    }

    return { checkUrl, checkMany, clearCache };
}
