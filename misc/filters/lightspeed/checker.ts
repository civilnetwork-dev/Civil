import { err, errAsync, ok, ResultAsync } from "neverthrow";
import { WebSocket } from "ws";
import xior, { type XiorError } from "xior";
import { z } from "zod";

import { matchBannedDomain } from "../../database/bannedDomains";
import { toCategories } from "../categories";
import {
    type FilterError,
    type FilterVerdict,
    toFilterError,
} from "../verdict";

export type LightspeedError =
    | { type: "INVALID_URL"; message: string; input: string }
    | { type: "NETWORK"; message: string; status?: number; body?: unknown }
    | { type: "PARSE"; message: string; body?: unknown };

export interface LightspeedCheckInput {
    url: string;
    blockedCategories?: string[];
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

type HostLookupReply = {
    action?: string;
    request?: { host?: string };
    cat?: number;
    cats?: number[];
};

/** The category ids in a reply to our lookup of `host`, or null for any other message. */
function categoryIdsFor(raw: WebSocket.RawData, host: string): number[] | null {
    const msg = JSON.parse(raw.toString()) as HostLookupReply;
    if (msg.action !== "host_lookup" || msg.request?.host !== host) return null;

    const ids = new Set<number>();
    if (typeof msg.cat === "number") ids.add(msg.cat);
    if (Array.isArray(msg.cats)) {
        for (const c of msg.cats) {
            if (typeof c === "number") ids.add(c);
        }
    }
    return [...ids];
}

function relayLookupHost(
    host: string,
    relay: LightspeedRelayConfig,
    timeoutMs: number,
): Promise<number[]> {
    return new Promise<number[]>(resolve => {
        const customerId = relay.customerId ?? RELAY_CUSTOMER_ID;
        const agentVersion = relay.agentVersion ?? AGENT_VERSION;

        const qs = new URLSearchParams({
            a: relay.auth ?? RELAY_AUTH,
            customer_id: customerId,
            agentType: relay.agentType ?? AGENT_TYPE,
            agentVersion,
        });

        let ws: WebSocket;
        try {
            ws = new WebSocket(`${relay.uri ?? RELAY_URI}/?${qs.toString()}`);
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

        const lookup = JSON.stringify({
            action: "dy_lookup",
            host,
            customerId,
            agentVersion,
            os: "cros",
            noCache: false,
        });
        ws.on("open", () => {
            try {
                ws.send(lookup);
            } catch {
                finish([]);
            }
        });
        ws.on("message", data => {
            try {
                const ids = categoryIdsFor(data, host);
                if (ids) finish(ids);
            } catch {}
        });
        ws.on("error", () => finish([]));
        ws.on("close", () => finish([]));
    });
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
                    names.add(taxonomy[String(id)] ?? `category ${id}`);
                }
                if (
                    matchBannedDomain(normalizedUrl) &&
                    ![...names].some(c => /mature|adult|porn/i.test(c))
                ) {
                    names.add("mature");
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
): ResultAsync<FilterVerdict, FilterError> {
    const normalizedUrl = normalizeLightspeedUrl(input.url);
    if (!URL.canParse(normalizedUrl))
        return errAsync({
            type: "INVALID_URL" as const,
            message: "Could not parse the provided URL.",
        });

    const blockList = (
        input.blockedCategories ?? DEFAULT_BLOCKED_CATEGORIES
    ).map(c => c.toLowerCase());

    const categorize =
        options.categorize ?? ((u: string) => relayCategorize(u, options));

    return categorize(normalizedUrl)
        .map(({ categories }) => judgeCategories(blockList, categories))
        .mapErr(toFilterError);
}

/** Lightspeed's names nest ("security.proxy"), so a substring of the block
 *  list catches a whole branch. */
function judgeCategories(blockList: string[], names: string[]): FilterVerdict {
    const unique = [...new Set(names)];
    if (unique.length === 0)
        return {
            status: "unknown",
            categories: [],
            detail: "Lightspeed's relay returned no category: the site is unrated, or the relay was unreachable.",
            matched: [],
        };

    const matched = unique.find(name =>
        blockList.some(blocked => name.toLowerCase().includes(blocked)),
    );
    return {
        status: matched ? "blocked" : "allowed",
        categories: toCategories(unique),
        detail: matched
            ? `Blocked category: ${matched}.`
            : `Allowed categories: ${unique.join(", ")}.`,
        matched: matched ? [matched] : [],
    };
}
