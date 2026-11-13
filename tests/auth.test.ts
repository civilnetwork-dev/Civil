import { expect, it, vi } from "vitest";

/**
 * better-auth skips its Origin check when NODE_ENV is "test" or TEST is set,
 * as vitest does, and reads NODE_ENV once, when it loads. Load it the way
 * production does so the check below runs. Top-level, not in a hook: under a
 * full parallel run the import outlasts a hook's ten-second timeout.
 */
vi.stubEnv("NODE_ENV", "production");
vi.stubEnv("TEST", "");
vi.stubEnv("CLASSLINK_ISSUER", "");
vi.stubEnv("CLASSLINK_CLIENT_ID", "");
vi.stubEnv("CLASSLINK_CLIENT_SECRET", "");
const { auth } = await import("../misc/database/auth");

/**
 * better-auth gates every request on a check of the Drizzle schema against
 * its own. A mismatch there fails all of auth - sessions and Patreon sign-in
 * alike - which no other test would notice. A cookieless session probe never
 * reaches the database, so it passes exactly when the gate lets requests
 * through.
 */
it("serves a session probe through the configured auth handler", async () => {
    const res = await auth.handler(
        new Request("http://localhost:9876/api/auth/get-session"),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
});

/**
 * A cookie turns on better-auth's Origin check. Production refused the
 * anonymous sign-in from its own page because only BETTER_AUTH_URL was
 * trusted. Sign-out without a session never reaches the database, so it shows
 * the check alone.
 */
function signOutFrom(origin: string) {
    return auth.handler(
        new Request("https://civil.example/api/auth/sign-out", {
            method: "POST",
            headers: {
                origin,
                cookie: "ph_session=1",
                "content-type": "application/json",
            },
            body: "{}",
        }),
    );
}

it("trusts a POST from the host Civil was reached by", async () => {
    expect((await signOutFrom("https://civil.example")).status).toBe(200);
});

it("refuses a POST from another site", async () => {
    expect((await signOutFrom("https://evil.example")).status).toBe(403);
});

it("keeps ClassLink disabled while retaining Patreon and anonymous login", async () => {
    const ctx = await auth.$context;
    expect(ctx.socialProviders.map(provider => provider.id)).toContain(
        "patreon",
    );
    expect(ctx.socialProviders.map(provider => provider.id)).not.toContain(
        "classlink",
    );
    const response = await auth.handler(
        new Request("http://localhost:9876/api/auth/sign-in/social", {
            method: "POST",
            headers: {
                origin: "http://localhost:9876",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                provider: "classlink",
                callbackURL: "/settings",
            }),
        }),
    );
    expect(response.status).toBe(403);
});

it("never accepts administration or ban fields from a user request", async () => {
    const { betterAuth } = await import("better-auth");
    const { memoryAdapter } = await import("better-auth/adapters/memory");
    const database: import("better-auth/adapters/memory").MemoryDB = {
        user: [],
        session: [],
        account: [],
        verification: [],
    };
    const memoryAuth = betterAuth({
        ...auth.options,
        database: memoryAdapter(database),
    });
    const anonymous = await memoryAuth.handler(
        new Request("http://localhost:9876/api/auth/sign-in/anonymous", {
            method: "POST",
            headers: {
                origin: "http://localhost:9876",
                "content-type": "application/json",
            },
            body: "{}",
        }),
    );
    expect(anonymous.status).toBe(200);
    const cookie = anonymous.headers
        .getSetCookie()
        .map(value => value.split(";")[0])
        .join("; ");
    const ctx = await memoryAuth.$context;
    await ctx.internalAdapter.updateUser(database.user[0].id, {
        isBanned: true,
        banReason: "admin ban",
    });
    await memoryAuth.handler(
        new Request("http://localhost:9876/api/auth/update-user", {
            method: "POST",
            headers: {
                origin: "http://localhost:9876",
                "content-type": "application/json",
                cookie,
            },
            body: JSON.stringify({
                name: "New name",
                isAdmin: true,
                isBanned: false,
                banReason: null,
                isAnonymous: false,
            }),
        }),
    );
    expect(database.user[0]).toMatchObject({
        isAdmin: false,
        isBanned: true,
        banReason: "admin ban",
        isAnonymous: true,
    });
});
