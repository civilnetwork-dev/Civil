import { expect, it } from "vitest";

import { auth } from "../misc/database/auth";

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
