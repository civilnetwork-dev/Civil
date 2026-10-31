import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, genericOAuth, patreon } from "better-auth/plugins";

import { optionalEnv, requireEnv } from "../env";
import { db } from "./db";
import { accounts, sessions, users, verifications } from "./schema";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: users,
            session: sessions,
            account: accounts,
            verification: verifications,
        },
    }),
    secret: requireEnv("BETTER_AUTH_SECRET"),
    baseURL: optionalEnv("BETTER_AUTH_URL", "http://localhost:9876"),
    basePath: "/api/auth",
    // A POST that carries any cookie gets better-auth's Origin check, and
    // PostHog and the ad scripts set cookies before the anonymous sign-in in
    // __root.tsx runs. With only BETTER_AUTH_URL trusted, production answered
    // that sign-in 403 INVALID_ORIGIN, so students went without a session and
    // every trackVisit after it failed. Civil answers on whatever
    // host it was reached by, so trust the request's own host. A cross-site
    // Origin still fails.
    trustedOrigins: request => {
        if (!request) return [];
        const { host } = new URL(request.url);
        return [`https://${host}`, `http://${host}`];
    },
    advanced: {
        database: {
            generateId: "uuid",
            // better-auth 1.7 checks the Drizzle schema against its own on
            // every auth request and fails the request on a mismatch. Its
            // account model always has a `password` column, which Civil
            // dropped (migration 20260610194037_strange_supernaut: there is
            // no email/password sign-in), so the check could never pass.
            validateSchema: false,
        },
        ipAddress: {
            ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
        },
    },
    plugins: [
        anonymous(),
        genericOAuth({
            config: [
                patreon({
                    clientId: requireEnv("PATREON_CLIENT_ID"),
                    clientSecret: requireEnv("PATREON_CLIENT_SECRET"),
                }),
            ],
        }),
    ],
    session: {
        expiresIn: 60 * 60 * 24 * 30,
        updateAge: 60 * 60 * 24,
        cookieCache: {
            enabled: true,
            maxAge: 60 * 5,
        },
    },
    user: {
        additionalFields: {
            isAnonymous: {
                type: "boolean",
                defaultValue: false,
                returned: true,
            },
            isAdmin: { type: "boolean", defaultValue: false, returned: true },
            isBanned: { type: "boolean", defaultValue: false, returned: true },
            banReason: { type: "string", required: false, returned: true },
            bannedAt: { type: "date", required: false, returned: true },
        },
    },
    telemetry: {
        enabled: false,
    },
});

export type Auth = typeof auth;
