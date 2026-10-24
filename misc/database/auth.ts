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
