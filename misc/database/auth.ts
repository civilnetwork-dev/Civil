import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { deleteSessionCookie, setSessionCookie } from "better-auth/cookies";
import { anonymous, genericOAuth, patreon } from "better-auth/plugins";

import { getClassLinkConfig, optionalEnv, requireEnv } from "../env";
import { convertAnonymousUser } from "./anonymousConversion";
import {
    classLinkAccountLinking,
    classLinkGuard,
    classLinkProvider,
} from "./classlink";
import { db } from "./db";
import { accounts, sessions, users, verifications } from "./schema";

export const classLinkConfig = getClassLinkConfig();

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
    account: { accountLinking: classLinkAccountLinking },
    hooks: { before: classLinkGuard(classLinkConfig) },
    plugins: [
        anonymous({
            onLinkAccount: async ({ anonymousUser, newUser, ctx }) => {
                try {
                    const ban = await convertAnonymousUser(
                        anonymousUser.user.id,
                        newUser.user.id,
                    );
                    if (ban) {
                        Object.assign(newUser.user, ban);
                        await setSessionCookie(ctx, newUser);
                    }
                } catch (error) {
                    // A failed transfer must not leave a usable, unbanned session.
                    deleteSessionCookie(ctx);
                    await ctx.context.internalAdapter.deleteSession(
                        newUser.session.token,
                    );
                    throw error;
                }
            },
        }),
        genericOAuth({
            config: [
                ...(classLinkConfig
                    ? [classLinkProvider(classLinkConfig)]
                    : []),
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
                input: false,
            },
            isAdmin: {
                type: "boolean",
                defaultValue: false,
                returned: true,
                input: false,
            },
            isBanned: {
                type: "boolean",
                defaultValue: false,
                returned: true,
                input: false,
            },
            banReason: {
                type: "string",
                required: false,
                returned: true,
                input: false,
            },
            bannedAt: {
                type: "date",
                required: false,
                returned: true,
                input: false,
            },
        },
    },
    telemetry: {
        enabled: false,
    },
});

export type Auth = typeof auth;
