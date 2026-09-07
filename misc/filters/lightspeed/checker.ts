import { err, ok, ResultAsync } from "neverthrow";
import { WebSocket } from "ws";
import xior, { type XiorError } from "xior";
import { z } from "zod";

import { matchBannedDomain } from "../../database/bannedDomains";

export type LightspeedVerdict = "BLOCKED" | "ALLOWED" | "UNKNOWN";

export type LightspeedError =
    | { type: "INVALID_URL"; message: string; input: string }
    | { type: "NETWORK"; message: string; status?: number; body?: unknown }
    | { type: "PARSE"; message: string; body?: unknown };

export interface LightspeedCheckInput {
    url: string;
    blockedCategories?: string[];
}

export interface LightspeedCheckResult {
    inputUrl: string;
    normalizedUrl: string;
    hostname: string;
    verdict: LightspeedVerdict;
    blocked: boolean;
    categories: string[];
    categoryId: number | null;
    matchedCategory: string | null;
    reason: string;
}

export interface LightspeedRelayConfig {
    uri?: string;
    auth?: string;
    customerId?: string;
    agentType?: string;
    agentVersion?: string;
}

export interface LightspeedCheckerOptions {
    timeoutMs?: number;
    taxonomyBaseUrl?: string;
    relay?: LightspeedRelayConfig;
    categorize?: (
        normalizedUrl: string,
    ) => ResultAsync<
        { categories: string[]; categoryId: number | null },
        LightspeedError
    >;
}

const RELAY_URI =
    process.env.LIGHTSPEED_RELAY_URI ?? "wss://production-gc.lsfilter.com";
const RELAY_AUTH =
    process.env.LIGHTSPEED_RELAY_AUTH ?? "0ef9b862-b74f-4e8d-8aad-be549c5f452a";
const RELAY_CUSTOMER_ID = process.env.LIGHTSPEED_CUSTOMER_ID ?? "62-2124-A000";
const AGENT_TYPE = "chrome";
const AGENT_VERSION = "4.4.1";

const LIGHTSPEED_TAXONOMY_URL =
    "https://lsrelay-config-production.s3.amazonaws.com/84e747afc7d98b7854c513fbceec22dc1535b9f4b0112cbb9e3bf6d8a2b18185/categories.json";

const DEFAULT_BLOCKED_CATEGORIES = [
    "mature",
    "adult",
    "porn",
    "nudity",
    "sex",
    "drugs",
    "alcohol",
    "tobacco",
    "gambling",
    "weapons",
    "violence",
    "hate",
    "malware",
    "phishing",
    "spyware",
    "botnet",
    "proxy",
    "anonymizer",
    "dating",
    "personals",
    "terror",
    "warez",
    "hacking",
];

const TaxonomySchema = z.record(z.string(), z.string());
let _taxonomyCache: { at: number; map: Record<string, string> } | null = null;

function normalizeLightspeedUrl(input: string): string {
    if (
        !input.startsWith("http") &&
        !input.startsWith("file:") &&
        !input.startsWith("chrome-extension:")
    ) {
        return `https://${input}`;
    }
    return input;
}

function toNetworkError(error: unknown): LightspeedError {
    const e = error as XiorError<unknown>;
    return {
        type: "NETWORK",
        message: e?.message ?? String(error),
        status: e?.response?.status,
        body: e?.response?.data,
    };
}

function fetchLightspeedTaxonomy(
    options: LightspeedCheckerOptions = {},
): ResultAsync<Record<string, string>, LightspeedError> {
    const now = Date.now();
    if (_taxonomyCache && now - _taxonomyCache.at < 6 * 60 * 60 * 1000) {
        return ResultAsync.fromSafePromise(Promise.resolve(_taxonomyCache.map));
    }
    const url = options.taxonomyBaseUrl ?? LIGHTSPEED_TAXONOMY_URL;
    const client = xior.create({ timeout: options.timeoutMs ?? 10_000 });
    return ResultAsync.fromPromise(
        client.get<unknown>(url),
        toNetworkError,
    ).andThen(res => {
        const parsed = TaxonomySchema.safeParse(res.data);
        if (!parsed.success) {
            return err<Record<string, string>, LightspeedError>({
                type: "PARSE",
                message: "Invalid categories.json taxonomy.",
                body: res.data,
            });
        }
        _taxonomyCache = { at: now, map: parsed.data };
        return ok<Record<string, string>, LightspeedError>(parsed.data);
    });
}

function relayLookupHost(
    host: string,
    relay: LightspeedRelayConfig,
    timeoutMs: number,
): Promise<number[]> {
    return new Promise<number[]>(resolve => {
        const uri = relay.uri ?? RELAY_URI;
        const auth = relay.auth ?? RELAY_AUTH;
        const customerId = relay.customerId ?? RELAY_CUSTOMER_ID;
        const agentVersion = relay.agentVersion ?? AGENT_VERSION;
        const agentType = relay.agentType ?? AGENT_TYPE;

        const qs = new URLSearchParams({
            a: auth,
            customer_id: customerId,
            agentType,
            agentVersion,
        });

        let ws: WebSocket;
        try {
            ws = new WebSocket(`${uri}/?${qs.toString()}`);
        } catch {
            return resolve([]);
        }

        let done = false;
        const finish = (v: number[]) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            try {
                ws.close();
            } catch {}
            resolve(v);
        };
        const timer = setTimeout(() => finish([]), timeoutMs);

        ws.on("open", () => {
            try {
                ws.send(
                    JSON.stringify({
                        action: "dy_lookup",
                        host,
                        customerId,
                        agentVersion,
                        os: "cros",
                        noCache: false,
                    }),
                );
            } catch {
                finish([]);
            }
        });
        ws.on("message", data => {
            try {
                const msg = JSON.parse(data.toString()) as {
                    action?: string;
                    request?: { host?: string };
                    cat?: number;
                    cats?: number[];
                };
                if (
                    msg.action === "host_lookup" &&
                    msg.request?.host === host
                ) {
                    const ids = new Set<number>();
                    if (typeof msg.cat === "number") ids.add(msg.cat);
                    if (Array.isArray(msg.cats)) {
                        for (const c of msg.cats) {
                            if (typeof c === "number") ids.add(c);
                        }
                    }
                    finish([...ids]);
                }
            } catch {}
        });
        ws.on("error", () => finish([]));
        ws.on("close", () => finish([]));
    });
}

function expandCategoryName(name: string): string[] {
    const parts = name.split(".");
    const out: string[] = [];
    for (let i = parts.length; i >= 1; i--) {
        out.push(parts.slice(0, i).join(".").toUpperCase());
    }
    return out;
}

function relayCategorize(
    normalizedUrl: string,
    options: LightspeedCheckerOptions,
): ResultAsync<
    { categories: string[]; categoryId: number | null },
    LightspeedError
> {
    let host: string;
    try {
        host = new URL(normalizedUrl).hostname
            .toLowerCase()
            .replace(/^www\./, "");
    } catch {
        return ResultAsync.fromSafePromise(
            Promise.resolve({ categories: [], categoryId: null }),
        );
    }

    const timeout = options.timeoutMs ?? 8000;
    return ResultAsync.fromSafePromise(
        relayLookupHost(host, options.relay ?? {}, timeout),
    ).andThen(catIds =>
        fetchLightspeedTaxonomy(options)
            .orElse(() =>
                ResultAsync.fromSafePromise(
                    Promise.resolve<Record<string, string>>({}),
                ),
            )
            .map(taxonomy => {
                const names = new Set<string>();
                for (const id of catIds) {
                    if (id === 0) continue;
                    const name = taxonomy[String(id)];
                    if (name) {
                        for (const n of expandCategoryName(name)) names.add(n);
                    } else {
                        names.add(`CAT:${id}`);
                    }
                }
                if (
                    matchBannedDomain(normalizedUrl) &&
                    ![...names].some(c => /MATURE|ADULT|PORN/.test(c))
                ) {
                    names.add("MATURE");
                }
                return {
                    categories: [...names],
                    categoryId: catIds[0] ?? null,
                };
            }),
    );
}

export function checkLightspeedFilter(
    input: LightspeedCheckInput,
    options: LightspeedCheckerOptions = {},
): ResultAsync<LightspeedCheckResult, LightspeedError> {
    const normalizedUrl = normalizeLightspeedUrl(input.url);
    let hostname: string;
    try {
        hostname = new URL(normalizedUrl).hostname;
    } catch {
        return ResultAsync.fromSafePromise(
            Promise.resolve(
                err<LightspeedCheckResult, LightspeedError>({
                    type: "INVALID_URL",
                    message: "Could not parse the provided URL.",
                    input: input.url,
                }),
            ),
        ).andThen(x => x);
    }

    const blockList = (
        input.blockedCategories ?? DEFAULT_BLOCKED_CATEGORIES
    ).map(c => c.toLowerCase());

    const categorize = options.categorize
        ? (u: string) =>
              options.categorize!(u).map(cats => ({
                  categories: cats.categories,
                  categoryId: cats.categoryId,
              }))
        : (u: string) => relayCategorize(u, options);

    return categorize(normalizedUrl).map(
        ({ categories: rawCats, categoryId }) => {
            const categories = [...new Set(rawCats.map(c => c.toUpperCase()))];

            let matchedCategory: string | null = null;
            for (const cat of categories) {
                const lower = cat.toLowerCase();
                if (blockList.some(b => lower.includes(b))) {
                    matchedCategory = cat;
                    break;
                }
            }

            const verdict: LightspeedVerdict = matchedCategory
                ? "BLOCKED"
                : categories.length > 0
                  ? "ALLOWED"
                  : "UNKNOWN";

            return {
                inputUrl: input.url,
                normalizedUrl,
                hostname,
                verdict,
                blocked: verdict === "BLOCKED",
                categories,
                categoryId,
                matchedCategory,
                reason: matchedCategory
                    ? `Blocked category: ${matchedCategory}`
                    : categories.length > 0
                      ? `Allowed (categories: ${categories.join(", ")})`
                      : "Relay returned no category (uncategorized or unreachable)",
            } satisfies LightspeedCheckResult;
        },
    );
}
