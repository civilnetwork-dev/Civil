import { expect, it, vi } from "vitest";

/**
 * better-auth skips its Origin check when NODE_ENV is "test" or TEST is set,
 * as vitest does, and reads NODE_ENV once, when it loads. Load it the way
 * production does so the check below runs. Top-level, not in a hook: under a
 * full parallel run the import outlasts a hook's ten-second timeout.
 */
vi.stubEnv("NODE_ENV", "production");
vi.stubEnv("TEST", "");
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
