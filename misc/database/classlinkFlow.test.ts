import { createHash } from "node:crypto";

import { afterEach, expect, it, vi } from "vitest";

import {
    completeFlow,
    config,
    cookies,
    createClassLinkTestAuth,
    mockClassLink,
    startFlow,
} from "./classlink.testHelpers";

const conversion = vi.hoisted(() => vi.fn());
vi.mock("./anonymousConversion", () => ({ convertAnonymousUser: conversion }));

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
});

const invalidTokens = [
    ["issuer", { iss: "https://evil.example" }],
    ["audience", { aud: "another-client" }],
    ["expiry", { exp: 1 }],
    ["nonce", { nonce: "different-nonce" }],
    ["missing email", { email: undefined }],
    ["missing subject", { sub: undefined }],
] as const;

it("completes a verified OIDC code flow with PKCE, state and nonce", async () => {
    const { state, fetch } = mockClassLink();
    const { auth, database } = createClassLinkTestAuth();
    const flow = await startFlow(auth);
    state.nonce = flow.authorization.searchParams.get("nonce")!;
    expect(flow.authorization.searchParams.get("code_challenge_method")).toBe(
        "S256",
    );
    expect(flow.authorization.searchParams.get("code_challenge")).toBeTruthy();
    expect(flow.authorization.searchParams.get("state")).toBeTruthy();
    expect(state.nonce).toBeTruthy();
    expect(flow.authorization.searchParams.get("prompt")).toBe("login");
    expect(flow.authorization.searchParams.get("redirect_uri")).toBe(
        `${config.authOrigin}/api/auth/callback/classlink`,
    );
    const response = await completeFlow(auth, flow);
    expect(response.headers.get("location")).toBe("/settings");
    expect(database.user[0]).toMatchObject({
        email: "student@school.example",
        emailVerified: true,
    });
    expect(database.account[0]).toMatchObject({
        providerId: "classlink",
        accountId: '["https://classlink.example","student-subject"]',
    });
    expect(database.session).toHaveLength(1);
    const exchange = fetch.mock.calls.find(([url]) =>
        String(url).endsWith("/token"),
    )!;
    const body = new URLSearchParams(String(exchange[1]?.body));
    expect(body.get("redirect_uri")).toBe(
        `${config.authOrigin}/api/auth/callback/classlink`,
    );
    expect(
        createHash("sha256")
            .update(body.get("code_verifier")!)
            .digest("base64url"),
    ).toBe(flow.authorization.searchParams.get("code_challenge"));
    expect(
        fetch.mock.calls.some(([url]) => String(url).endsWith("/jwks")),
    ).toBe(true);
    const signout = await auth.handler(
        new Request(`${config.authOrigin}/api/auth/sign-out`, {
            method: "POST",
            headers: { origin: config.authOrigin, cookie: cookies(response) },
        }),
    );
    expect(signout.status).toBe(200);
    expect(signout.headers.get("location")).toBeNull();
});

it("completes a verified ClassLink flow behind Civil's TLS proxy", async () => {
    vi.stubEnv("REVERSE_PROXY", "true");
    const { state } = mockClassLink();
    const { auth, database } = createClassLinkTestAuth();
    const proxiedAuth = {
        ...auth,
        handler(request: Request) {
            const url = new URL(request.url);
            url.protocol = "http:";
            const forwarded = new Request(url, request);
            forwarded.headers.set("x-forwarded-proto", "https");
            return auth.handler(forwarded);
        },
    };
    const flow = await startFlow(proxiedAuth);
    state.nonce = flow.authorization.searchParams.get("nonce")!;
    expect(flow.authorization.searchParams.get("redirect_uri")).toBe(
        `${config.authOrigin}/api/auth/callback/classlink`,
    );
    const response = await completeFlow(proxiedAuth, flow);
    expect(response.headers.get("location")).toBe("/settings");
    expect(database.session).toHaveLength(1);
});

it.each(invalidTokens)(
    "rejects invalid ID token %s before creating an account",
    async (_, claims) => {
        const { state } = mockClassLink();
        const { auth, database } = createClassLinkTestAuth();
        const flow = await startFlow(auth);
        state.nonce = flow.authorization.searchParams.get("nonce")!;
        state.claims = claims;
        const response = await completeFlow(auth, flow);
        expect(response.headers.get("location")).toContain("error=");
        expect(database.user).toHaveLength(0);
        expect(database.account).toHaveLength(0);
        expect(database.session).toHaveLength(0);
    },
);

it.each(["badSignature", "missingToken"] as const)(
    "rejects %s",
    async condition => {
        const { state } = mockClassLink();
        const { auth, database } = createClassLinkTestAuth();
        const flow = await startFlow(auth);
        state.nonce = flow.authorization.searchParams.get("nonce")!;
        state[condition] = true;
        expect(
            (await completeFlow(auth, flow)).headers.get("location"),
        ).toContain("error=");
        expect(database.account).toHaveLength(0);
    },
);

it("rejects state tampering and replay", async () => {
    const { state } = mockClassLink();
    const { auth, database } = createClassLinkTestAuth();
    const flow = await startFlow(auth);
    state.nonce = flow.authorization.searchParams.get("nonce")!;
    expect(
        (await completeFlow(auth, flow, "forged-state")).headers.get(
            "location",
        ),
    ).toContain("error=");
    expect(database.account).toHaveLength(0);
    await completeFlow(auth, flow);
    expect((await completeFlow(auth, flow)).headers.get("location")).toContain(
        "error=",
    );
    expect(database.account).toHaveLength(1);
});

it("rejects a valid callback arriving on a mirror", async () => {
    const { state } = mockClassLink();
    const { auth, database } = createClassLinkTestAuth();
    const flow = await startFlow(auth);
    state.nonce = flow.authorization.searchParams.get("nonce")!;
    const query = new URLSearchParams({
        code: "code",
        state: flow.authorization.searchParams.get("state")!,
    });
    const response = await auth.handler(
        new Request(
            `https://mirror.example/api/auth/callback/classlink?${query}`,
            {
                headers: { cookie: flow.cookie },
            },
        ),
    );
    expect(response.status).toBe(403);
    expect(database.account).toHaveLength(0);
});

it("never implicitly links an email match", async () => {
    const { state } = mockClassLink();
    const { auth, database } = createClassLinkTestAuth();
    const ctx = await auth.$context;
    await ctx.internalAdapter.createUser(
        {
            email: "student@school.example",
            name: "Existing",
            emailVerified: true,
        },
        { method: "custom" },
    );
    const flow = await startFlow(auth);
    state.nonce = flow.authorization.searchParams.get("nonce")!;
    expect((await completeFlow(auth, flow)).headers.get("location")).toContain(
        "error=account_not_linked",
    );
    expect(database.account).toHaveLength(0);
    expect(database.user).toHaveLength(1);
});

it("rejects discovery without JWKS rather than decoding an unverified identity", async () => {
    const { state } = mockClassLink();
    state.discovery = { jwks_uri: undefined };
    const { auth, database } = createClassLinkTestAuth();
    const response = await auth.handler(
        new Request(`${config.authOrigin}/api/auth/sign-in/social`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                origin: config.authOrigin,
            },
            body: JSON.stringify({ provider: "classlink" }),
        }),
    );
    expect(response.status).toBe(404);
    expect(database.account).toHaveLength(0);
});

it("requires discovery issuer to agree with the configured identity issuer", async () => {
    const { state } = mockClassLink();
    state.discovery.issuer = "https://different.example";
    state.claims.iss = "https://different.example";
    const { auth, database } = createClassLinkTestAuth();
    const flow = await startFlow(auth);
    state.nonce = flow.authorization.searchParams.get("nonce")!;
    expect((await completeFlow(auth, flow)).headers.get("location")).toContain(
        "error=",
    );
    expect(database.account).toHaveLength(0);
});

it("links a freshly authenticated different email and preserves primary email", async () => {
    const { state } = mockClassLink();
    const { auth, database } = createClassLinkTestAuth();
    const ctx = await auth.$context;
    const user = await ctx.internalAdapter.createUser(
        {
            email: "primary@example.com",
            name: "Existing",
            emailVerified: true,
        },
        { method: "custom" },
    );
    const session = await ctx.internalAdapter.createSession(user.id);
    const { makeSignature } = await import("better-auth/crypto");
    const signature = await makeSignature(session.token, ctx.secret);
    const cookie = `${ctx.authCookies.sessionToken.name}=${encodeURIComponent(`${session.token}.${signature}`)}`;
    const flow = await startFlow(auth, cookie, "/link-social");
    state.nonce = flow.authorization.searchParams.get("nonce")!;
    state.claims.email_verified = false;
    expect((await completeFlow(auth, flow)).headers.get("location")).toBe(
        "/settings",
    );
    expect(database.account[0]).toMatchObject({
        userId: user.id,
        providerId: "classlink",
    });
    expect(database.user[0].email).toBe("primary@example.com");
    expect(database.user[0].emailVerified).toBe(true);
});

it("requires an authenticated session for explicit linking", async () => {
    mockClassLink();
    const { auth } = createClassLinkTestAuth();
    const response = await auth.handler(
        new Request(`${config.authOrigin}/api/auth/link-social`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                origin: config.authOrigin,
            },
            body: JSON.stringify({
                provider: "classlink",
                callbackURL: "/settings",
            }),
        }),
    );
    expect(response.status).toBe(401);
});

it("refuses to link an identity already owned by another account", async () => {
    const { state } = mockClassLink();
    const { auth, database } = createClassLinkTestAuth();
    const initial = await startFlow(auth);
    state.nonce = initial.authorization.searchParams.get("nonce")!;
    await completeFlow(auth, initial);
    const owner = database.account[0].userId;
    const ctx = await auth.$context;
    const user = await ctx.internalAdapter.createUser(
        { email: "other@example.com", name: "Other", emailVerified: true },
        { method: "custom" },
    );
    const session = await ctx.internalAdapter.createSession(user.id);
    const { makeSignature } = await import("better-auth/crypto");
    const signature = await makeSignature(session.token, ctx.secret);
    const cookie = `${ctx.authCookies.sessionToken.name}=${encodeURIComponent(`${session.token}.${signature}`)}`;
    const flow = await startFlow(auth, cookie, "/link-social");
    state.nonce = flow.authorization.searchParams.get("nonce")!;
    expect((await completeFlow(auth, flow)).headers.get("location")).toContain(
        "error=",
    );
    expect(database.account).toHaveLength(1);
    expect(database.account[0].userId).toBe(owner);
});

async function anonymousFlow() {
    const { auth: productionAuth } = await import("./auth");
    const anonymousPlugin = productionAuth.options.plugins!.find(
        plugin => plugin.id === "anonymous",
    )!;
    const harness = createClassLinkTestAuth({
        plugins: [anonymousPlugin],
        user: productionAuth.options.user,
        session: productionAuth.options.session,
    });
    const response = await harness.auth.handler(
        new Request(`${config.authOrigin}/api/auth/sign-in/anonymous`, {
            method: "POST",
            headers: {
                origin: config.authOrigin,
                "content-type": "application/json",
            },
            body: "{}",
        }),
    );
    expect(response.status).toBe(200);
    return {
        ...harness,
        anonymousId: harness.database.user[0].id as string,
        flow: await startFlow(harness.auth, cookies(response)),
    };
}

it("runs production anonymous conversion before cleanup and refreshes transferred ban cookies", async () => {
    const { state } = mockClassLink();
    const { auth, database, flow, anonymousId } = await anonymousFlow();
    state.nonce = flow.authorization.searchParams.get("nonce")!;
    conversion.mockResolvedValueOnce({
        isBanned: true,
        banReason: "admin ban",
        bannedAt: new Date(123),
    });
    const response = await completeFlow(auth, flow);
    expect(conversion).toHaveBeenCalledWith(
        anonymousId,
        database.account[0].userId,
    );
    expect(database.user).toHaveLength(1);
    expect(database.user[0]).toMatchObject({
        isAnonymous: false,
        isAdmin: false,
    });
    const session = await auth.handler(
        new Request(`${config.authOrigin}/api/auth/get-session`, {
            headers: { cookie: cookies(response) },
        }),
    );
    expect((await session.json()).user).toMatchObject({
        isBanned: true,
        banReason: "admin ban",
    });
});

it("revokes the newly issued session and preserves the anonymous user when conversion fails", async () => {
    const { state } = mockClassLink();
    const { auth, database, flow, anonymousId } = await anonymousFlow();
    state.nonce = flow.authorization.searchParams.get("nonce")!;
    conversion.mockRejectedValueOnce(new Error("transfer failed"));
    const response = await completeFlow(auth, flow);
    expect(response.status).toBe(500);
    expect(database.user.some(user => user.id === anonymousId)).toBe(true);
    expect(
        database.session.every(session => session.userId === anonymousId),
    ).toBe(true);
    expect(response.headers.get("set-cookie")).toBeNull();
});

it("requires anonymous users to convert through sign-in instead of linking a temporary identity", async () => {
    mockClassLink();
    const { auth, database, flow } = await anonymousFlow();
    const response = await auth.handler(
        new Request(`${config.authOrigin}/api/auth/link-social`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                origin: config.authOrigin,
                cookie: flow.cookie,
            },
            body: JSON.stringify({
                provider: "classlink",
                callbackURL: "/settings",
            }),
        }),
    );
    expect(response.status).toBe(400);
    expect(database.account).toHaveLength(0);
    expect(conversion).not.toHaveBeenCalled();
});

it.each([
    ["https://mirror.example", {}],
    [config.authOrigin, { idToken: { token: "replayed-token" } }],
    [config.authOrigin, { additionalParams: { prompt: "none" } }],
    [config.authOrigin, { callbackURL: "https://mirror.example/settings" }],
    [config.authOrigin, { callbackURL: "https://[" }],
] as const)(
    "refuses ClassLink shortcuts or mirror handoff %s %j",
    async (origin, extra) => {
        mockClassLink();
        const { auth, database } = createClassLinkTestAuth();
        const response = await auth.handler(
            new Request(`${origin}/api/auth/sign-in/social`, {
                method: "POST",
                headers: { "content-type": "application/json", origin },
                body: JSON.stringify({ provider: "classlink", ...extra }),
            }),
        );
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(database.account).toHaveLength(0);
    },
);
