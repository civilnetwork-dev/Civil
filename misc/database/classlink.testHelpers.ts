import { generateKeyPairSync, sign } from "node:crypto";

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { memoryAdapter, type MemoryDB } from "better-auth/adapters/memory";
import { genericOAuth } from "better-auth/plugins";
import { vi } from "vitest";

import {
    classLinkAccountLinking,
    classLinkGuard,
    classLinkProvider,
} from "./classlink";

export const config = {
    issuer: "https://classlink.example",
    clientId: "civil-test-client",
    clientSecret: "civil-test-secret",
    authOrigin: "https://civil.example",
};
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
});
const jwk = {
    ...publicKey.export({ format: "jwk" }),
    kid: "test-key",
    alg: "RS256",
    use: "sig",
};

function idToken(claims: Record<string, unknown>) {
    const header = Buffer.from(
        JSON.stringify({ alg: "RS256", kid: "test-key" }),
    ).toString("base64url");
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const data = `${header}.${payload}`;
    return `${data}.${sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url")}`;
}

export const userInfoEndpoint = "https://profile.classlink.example/userinfo";

interface ClassLinkMockState {
    nonce: string;
    claims: Record<string, unknown>;
    badSignature: boolean;
    missingToken: boolean;
    missingAccessToken: boolean;
    discovery: Record<string, unknown>;
    userInfo: unknown;
    userInfoMode: "json" | "non-json" | "error" | "network-error" | "timeout";
}

function tokenResponse(state: ClassLinkMockState) {
    let signed = idToken({
        iss: config.issuer,
        aud: config.clientId,
        sub: "student-subject",
        email: "student@school.example",
        email_verified: true,
        name: "Student",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
        nonce: state.nonce,
        ...state.claims,
    });
    if (state.badSignature) signed = `${signed.slice(0, -10)}corruption`;
    return Response.json({
        ...(state.missingAccessToken ? {} : { access_token: "access" }),
        token_type: "Bearer",
        expires_in: 300,
        ...(state.missingToken ? {} : { id_token: signed }),
    });
}

function userInfoResponse(
    state: ClassLinkMockState,
    signal?: AbortSignal | null,
) {
    if (state.userInfoMode === "non-json")
        return new Response("<html>error</html>");
    if (state.userInfoMode === "error")
        return new Response("denied", { status: 403 });
    if (state.userInfoMode === "network-error")
        throw new TypeError("connection failed");
    if (state.userInfoMode === "timeout") {
        return new Promise<Response>((_, reject) => {
            if (signal?.aborted) reject(signal.reason);
            else
                signal?.addEventListener("abort", () => reject(signal.reason), {
                    once: true,
                });
        });
    }
    return Response.json(state.userInfo);
}

export function mockClassLink() {
    const state: ClassLinkMockState = {
        nonce: "",
        claims: {},
        badSignature: false,
        missingToken: false,
        missingAccessToken: false,
        discovery: {},
        userInfo: { sub: "student-subject" },
        userInfoMode: "json",
    };
    const fetch = vi.fn(
        async (input: string | URL | Request, init?: RequestInit) => {
            const url = new URL(input instanceof Request ? input.url : input);
            if (url.pathname === "/.well-known/openid-configuration")
                return Response.json({
                    issuer: config.issuer,
                    authorization_endpoint: `${config.issuer}/authorize`,
                    token_endpoint: `${config.issuer}/token`,
                    jwks_uri: `${config.issuer}/jwks`,
                    userinfo_endpoint: userInfoEndpoint,
                    id_token_signing_alg_values_supported: ["RS256"],
                    ...state.discovery,
                });
            if (url.pathname === "/jwks") return Response.json({ keys: [jwk] });
            if (url.pathname === "/token") return tokenResponse(state);
            if (url.pathname === "/userinfo")
                return userInfoResponse(state, init?.signal);
            throw new Error(`Unexpected test fetch: ${url}`);
        },
    );
    vi.stubGlobal("fetch", fetch);
    return { state, fetch };
}

export function createClassLinkTestAuth(options: BetterAuthOptions = {}) {
    const database: MemoryDB = {
        user: [],
        session: [],
        account: [],
        verification: [],
    };
    const auth = betterAuth({
        baseURL: config.authOrigin,
        secret: "classlink-test-secret-at-least-32-characters",
        database: memoryAdapter(database),
        telemetry: { enabled: false },
        logger: { disabled: true },
        trustedOrigins: request =>
            request ? [new URL(request.url).origin] : [],
        account: { accountLinking: classLinkAccountLinking },
        hooks: { before: classLinkGuard(config) },
        ...options,
        plugins: [
            ...(options.plugins ?? []),
            genericOAuth({ config: [classLinkProvider(config)] }),
        ],
    });
    return { auth, database };
}

export function cookies(response: Response) {
    const jar = new Map<string, string>();
    for (const value of response.headers.getSetCookie()) {
        const cookie = value.split(";")[0];
        jar.set(cookie.slice(0, cookie.indexOf("=")), cookie);
    }
    return [...jar.values()].join("; ");
}

export async function startFlow(
    auth: ReturnType<typeof createClassLinkTestAuth>["auth"],
    cookie = "",
    path = "/sign-in/social",
) {
    const response = await auth.handler(
        new Request(`${config.authOrigin}/api/auth${path}`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                origin: config.authOrigin,
                cookie,
            },
            body: JSON.stringify({
                provider: "classlink",
                callbackURL: "/settings",
                disableRedirect: true,
            }),
        }),
    );
    const data = await response.json();
    if (response.status !== 200) throw new Error(JSON.stringify(data));
    return {
        authorization: new URL(data.url),
        cookie: [cookie, cookies(response)].filter(Boolean).join("; "),
    };
}

export function completeFlow(
    auth: ReturnType<typeof createClassLinkTestAuth>["auth"],
    flow: Awaited<ReturnType<typeof startFlow>>,
    state = flow.authorization.searchParams.get("state")!,
) {
    const query = new URLSearchParams({ code: "test-code", state });
    return auth.handler(
        new Request(
            `${config.authOrigin}/api/auth/callback/classlink?${query}`,
            {
                headers: { cookie: flow.cookie },
            },
        ),
    );
}
