import { and, eq } from "drizzle-orm";
import type { Context, Hono, MiddlewareHandler } from "hono";
import {
    type Oauth2StoredToken,
    PatreonUserClient,
    QueryBuilder,
} from "patreon-api.ts";
import { RateLimiterMemory, type RateLimiterRes } from "rate-limiter-flexible";

import { cached } from "../database/cache";
import { db } from "../database/db";
import { accounts } from "../database/schema";
import { resolveSessionFromHeaders } from "../database/session";
import { requireEnv } from "../env";
import { type AppEnv, clientIp } from "../http";
import { posthog } from "./posthog";

const BASE_RATE_LIMIT = 5;
const BOOST_PER_DOLLAR = 0.05;
const WINDOW_SECONDS = 86_400;
const MAX_LIMIT = 500;
/** Redis TTL for cached Patreon entitlement (seconds) */
const ENTITLEMENT_TTL = 300;
/** Redis TTL for cached Patreon OAuth token lookup (seconds) */
const PATREON_TOKEN_TTL = 600;

const limiters = new Map<number, RateLimiterMemory>();

const PATREON_CLIENT_ID = requireEnv("PATREON_CLIENT_ID");
const PATREON_CLIENT_SECRET = requireEnv("PATREON_CLIENT_SECRET");

function getLimiter(points: number): RateLimiterMemory {
    const existing = limiters.get(points);
    if (existing) return existing;
    const limiter = new RateLimiterMemory({
        keyPrefix: `patreon:${points}:${WINDOW_SECONDS}`,
        points,
        duration: WINDOW_SECONDS,
    });
    limiters.set(points, limiter);
    return limiter;
}

function calculateLimit(dollarsPaid: number): number {
    return Math.min(
        MAX_LIMIT,
        Math.floor(
            BASE_RATE_LIMIT * (1 + Math.max(0, dollarsPaid) * BOOST_PER_DOLLAR),
        ),
    );
}

function routeMatches(path: string, route: `/${string}`): boolean {
    return path === route || path.startsWith(`${route}/`);
}

/** Fetch Patreon OAuth token stored by BetterAuth in accounts table; redis-cached for 10 min. */
async function getPatreonToken(
    userId: string,
): Promise<Oauth2StoredToken | null> {
    return cached(
        `patreon-token:${userId}`,
        async () => {
            const rows = await db
                .select({
                    accessToken: accounts.accessToken,
                    refreshToken: accounts.refreshToken,
                    accessTokenExpiresAt: accounts.accessTokenExpiresAt,
                    scope: accounts.scope,
                })
                .from(accounts)
                .where(
                    and(
                        eq(accounts.userId, userId),
                        eq(accounts.providerId, "patreon"),
                    ),
                )
                .limit(1);

            const row = rows[0];
            if (!row?.accessToken) return null;

            const expiresEpoch = row.accessTokenExpiresAt
                ? String(Math.floor(row.accessTokenExpiresAt.getTime() / 1000))
                : "0";
            return {
                access_token: row.accessToken,
                refresh_token: row.refreshToken ?? "",
                token_type: "Bearer",
                expires_in: String(
                    row.accessTokenExpiresAt
                        ? Math.floor(
                              (row.accessTokenExpiresAt.getTime() -
                                  Date.now()) /
                                  1000,
                          )
                        : 0,
                ),
                expires_in_epoch: expiresEpoch,
            } as Oauth2StoredToken;
        },
        PATREON_TOKEN_TTL,
    ).catch(() => null);
}

/** Query Patreon API for active patron pledge amount; redis-cached for 5 min. */
async function getPatreonDollars(userId: string): Promise<number> {
    const token = await getPatreonToken(userId);
    if (!token) return 0;

    return cached(
        `patreon-entitlement:${userId}`,
        async () => {
            const client = new PatreonUserClient({
                oauth: {
                    clientId: PATREON_CLIENT_ID,
                    clientSecret: PATREON_CLIENT_SECRET,
                    token,
                },
            });

            const query = QueryBuilder.identity
                .addRelationships(["memberships"])
                .setRelationshipAttributes("memberships", [
                    "currently_entitled_amount_cents",
                    "patron_status",
                ]);

            const identity = await client.fetchIdentity(query);

            const activeMembership = identity.included?.find(
                (item: any) =>
                    item.type === "member" &&
                    item.attributes?.patron_status === "active_patron" &&
                    typeof item.attributes?.currently_entitled_amount_cents ===
                        "number",
            );

            const cents =
                activeMembership?.attributes?.currently_entitled_amount_cents ??
                0;
            return cents / 100;
        },
        ENTITLEMENT_TTL,
    ).catch(() => 0);
}

type QuotaCaller = { ip: string | undefined; userId: string | null };

/**
 * Spends one of the caller's daily checks and returns the headers that report
 * what is left. Fills in `caller.userId` as soon as the session resolves, so a
 * failure later on is still attributed to the account.
 */
async function consumeQuota(
    c: Context<AppEnv>,
    caller: QuotaCaller,
): Promise<Record<string, string>> {
    const session = await resolveSessionFromHeaders(c.req.raw.headers);
    caller.userId = session?.user ? (session.user as { id: string }).id : null;

    const dollarsPaid = caller.userId
        ? await getPatreonDollars(caller.userId)
        : 0;
    const points = calculateLimit(dollarsPaid);
    const limiter = getLimiter(points);
    const key = caller.userId
        ? `user:${caller.userId}`
        : `ip:${caller.ip ?? "unknown"}`;

    const result = await limiter.consume(key, 1);

    return {
        "RateLimit-Limit": String(points),
        "RateLimit-Remaining": String(result.remainingPoints),
        "RateLimit-Reset": String(
            Math.ceil((Date.now() + result.msBeforeNext) / 1000),
        ),
    };
}

/** Answers 429 when the quota ran out; rethrows anything else. */
function rejectQuotaFailure(
    c: Context<AppEnv>,
    { ip, userId }: QuotaCaller,
    route: `/${string}`,
    error: unknown,
): Response {
    const rateLimitError = error as RateLimiterRes;

    if (typeof rateLimitError.msBeforeNext === "number") {
        const retryAfterSeconds = Math.ceil(rateLimitError.msBeforeNext / 1000);
        posthog.capture({
            distinctId: userId ?? ip ?? "unknown",
            event: "filter_rate_limited",
            properties: {
                userId,
                ip,
                route,
                retryAfterSeconds,
            },
        });
        c.header("Retry-After", String(retryAfterSeconds));
        c.header("RateLimit-Remaining", "0");
        return c.json({ error: "Too many requests", retryAfterSeconds }, 429);
    }

    posthog.capture({
        distinctId: userId ?? ip ?? "unknown",
        event: "filter_middleware_error",
        properties: {
            userId,
            ip,
            route,
            error: String(error),
        },
    });
    throw error;
}

function createSharedFilterMiddleware(
    route: `/${string}`,
): MiddlewareHandler<AppEnv> {
    return async (c, next) => {
        if (c.req.method !== "POST" || !routeMatches(c.req.path, route)) {
            return next();
        }

        const caller: QuotaCaller = { ip: clientIp(c), userId: null };
        let rateLimitHeaders: Record<string, string>;
        try {
            rateLimitHeaders = await consumeQuota(c, caller);
        } catch (error) {
            return rejectQuotaFailure(c, caller, route, error);
        }

        // Outside the try: a failure in the filter check itself is that
        // route's error, not this middleware's. The headers go on afterwards
        // because a handler may return its own Response, which would not carry
        // headers set on the context before it ran.
        await next();
        for (const [name, value] of Object.entries(rateLimitHeaders)) {
            c.header(name, value);
        }
    };
}

export function useSharedFilterMiddleware(
    app: Hono<AppEnv>,
    route: `/${string}`,
) {
    app.use(createSharedFilterMiddleware(route));
}
