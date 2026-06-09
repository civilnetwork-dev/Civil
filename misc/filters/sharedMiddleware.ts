import { and, eq } from "drizzle-orm";
import type { Express, Request, RequestHandler } from "express";
import {
    type Oauth2StoredToken,
    PatreonUserClient,
    QueryBuilder,
} from "patreon-api.ts";
import { RateLimiterMemory, type RateLimiterRes } from "rate-limiter-flexible";
import "dotenv/config";
import { auth } from "../database/auth";
import { cached, sessionKey } from "../database/cache";
import { db } from "../database/db";
import { accounts } from "../database/schema";

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

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required env var: ${name}`);
    return value;
}

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

/** Extract BetterAuth session token from Authorization header or cookie. */
function extractToken(req: Request): string | undefined {
    const bearer = req.headers.authorization?.replace("Bearer ", "");
    if (bearer) return bearer;
    return req.headers.cookie
        ?.split(";")
        .find(c => c.trim().startsWith("better-auth.session_token="))
        ?.split("=")[1]
        ?.trim();
}

/** Resolve BetterAuth session; redis-cached for 60s. */
async function resolveSession(token: string | undefined) {
    if (!token) return null;
    return cached(
        sessionKey(token),
        () =>
            auth.api.getSession({
                headers: new Headers({
                    cookie: `better-auth.session_token=${token}`,
                    authorization: `Bearer ${token}`,
                }),
            }),
        60,
    ).catch(() => null);
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

function createSharedFilterMiddleware(route: `/${string}`): RequestHandler {
    return async (req: Request, res, next) => {
        if (req.method !== "POST" || !routeMatches(req.path, route)) {
            return next();
        }

        try {
            const token = extractToken(req);
            const session = await resolveSession(token);
            const userId = session?.user
                ? (session.user as { id: string }).id
                : null;

            const dollarsPaid = userId ? await getPatreonDollars(userId) : 0;
            const points = calculateLimit(dollarsPaid);
            const limiter = getLimiter(points);
            const key = userId ? `user:${userId}` : `ip:${req.ip ?? "unknown"}`;

            const result = await limiter.consume(key, 1);

            res.setHeader("RateLimit-Limit", String(points));
            res.setHeader(
                "RateLimit-Remaining",
                String(result.remainingPoints),
            );
            res.setHeader(
                "RateLimit-Reset",
                String(Math.ceil((Date.now() + result.msBeforeNext) / 1000)),
            );

            return next();
        } catch (error) {
            const rateLimitError = error as RateLimiterRes;

            if (typeof rateLimitError.msBeforeNext === "number") {
                const retryAfterSeconds = Math.ceil(
                    rateLimitError.msBeforeNext / 1000,
                );
                res.setHeader("Retry-After", String(retryAfterSeconds));
                res.setHeader("RateLimit-Remaining", "0");
                return res
                    .status(429)
                    .json({ error: "Too many requests", retryAfterSeconds });
            }

            return next(error);
        }
    };
}

export function useSharedFilterMiddleware(app: Express, route: `/${string}`) {
    app.use(createSharedFilterMiddleware(route));
}
