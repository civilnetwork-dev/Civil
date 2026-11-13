import {
    APIError,
    createAuthMiddleware,
    getAuthoritativeSessionFromCtx,
} from "better-auth/api";
import type { GenericOAuthConfig } from "better-auth/plugins/generic-oauth";
import { z } from "zod";

import type { ClassLinkConfig } from "../env";
import { classLinkUserInfo } from "./classlinkUserInfo";

export function classLinkAvailable(
    config: ClassLinkConfig | null,
    request: Request,
): boolean {
    if (!config) return false;

    const url = new URL(request.url);
    if (process.env.REVERSE_PROXY) {
        // The trusted proxy terminates TLS before Hono builds the request URL.
        const scheme = request.headers
            .get("x-forwarded-proto")
            ?.split(",")
            .at(-1)
            ?.trim()
            .toLowerCase();
        if (scheme !== undefined) {
            if (scheme !== "http" && scheme !== "https") return false;
            url.protocol = `${scheme}:`;
        }
    }

    const origin = request.headers.get("origin");
    return (
        url.origin === config.authOrigin &&
        (origin === null || origin === config.authOrigin)
    );
}

function canonicalCallback(value: unknown, origin: string): boolean {
    if (typeof value !== "string") return false;
    try {
        return new URL(value, origin).origin === origin;
    } catch {
        return false;
    }
}

async function classLinkProfile(
    tokens: { idToken?: string; accessToken?: string },
    issuer: string,
) {
    if (!tokens.idToken) return null;
    try {
        // Generic OAuth verifies the signature, audience and nonce before this callback.
        const claims = JSON.parse(
            Buffer.from(tokens.idToken.split(".")[1], "base64url").toString(),
        ) as Record<string, unknown>;
        if (
            claims.iss !== issuer ||
            typeof claims.sub !== "string" ||
            !claims.sub.trim()
        ) {
            return null;
        }
        const profile = z.email().safeParse(claims.email).success
            ? claims
            : await classLinkUserInfo(issuer, claims.sub, tokens.accessToken);
        if (!profile) return null;
        return {
            sub: claims.sub,
            email: profile.email as string,
            emailVerified: profile.email_verified === true,
            name:
                typeof profile.name === "string"
                    ? profile.name
                    : "ClassLink user",
            image:
                typeof profile.picture === "string"
                    ? profile.picture
                    : undefined,
        };
    } catch {
        return null;
    }
}

export function classLinkProvider(config: ClassLinkConfig): GenericOAuthConfig {
    return {
        providerId: "classlink",
        discoveryUrl: `${config.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
        requireIdTokenVerification: true,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        scopes: ["openid", "profile", "email"],
        redirectURI: `${config.authOrigin}/api/auth/callback/classlink`,
        pkce: true,
        prompt: "login",
        disableProviderLogout: true,
        accountSubject: ({ profile }) =>
            JSON.stringify([config.issuer, profile.sub]),
        getUserInfo: async tokens => classLinkProfile(tokens, config.issuer),
    };
}

export const classLinkAccountLinking = {
    enabled: true,
    disableImplicitLinking: true,
    allowDifferentEmails: true,
    updateUserInfoOnLink: false,
    // A completed code flow proves ownership even if the IdP omits email verification.
    trustedProviders: ["classlink"],
};

export function classLinkGuard(config: ClassLinkConfig | null) {
    return createAuthMiddleware(async ctx => {
        const callback =
            ctx.path === "/callback/classlink" ||
            (ctx.path === "/callback/:id" && ctx.params?.id === "classlink");
        if (!callback && ctx.body?.provider !== "classlink") return;
        if (
            !config ||
            !ctx.request ||
            !classLinkAvailable(config, ctx.request)
        ) {
            throw new APIError("FORBIDDEN", {
                message: "ClassLink requires the canonical auth origin",
            });
        }
        if (callback) return;
        if (ctx.path === "/link-social") {
            const session = await getAuthoritativeSessionFromCtx(ctx);
            if (session?.user.isAnonymous) {
                throw new APIError("BAD_REQUEST", {
                    message:
                        "Sign in with ClassLink to convert an anonymous session",
                });
            }
        }
        if (ctx.body?.idToken || ctx.body?.additionalParams) {
            throw new APIError("BAD_REQUEST", {
                message: "ClassLink requires a fresh authorization code flow",
            });
        }
        for (const key of [
            "callbackURL",
            "errorCallbackURL",
            "newUserCallbackURL",
        ]) {
            const value = ctx.body?.[key];
            if (
                value !== undefined &&
                !canonicalCallback(value, config.authOrigin)
            ) {
                throw new APIError("FORBIDDEN", {
                    message:
                        "ClassLink callbacks must stay on the canonical auth origin",
                });
            }
        }
    });
}
