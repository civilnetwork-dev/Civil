/**
 * The filter blocker middleware: every tracked vendor's phone-home domain is
 * refused, ordinary traffic passes, and the header it trusts is the one it was
 * told to.
 */

import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import type { AppEnv } from "../http";
import {
    createFilterBlockerMiddleware,
    filterVendorDomains,
} from "./filterBlockerMiddleware";

vi.mock("./posthog", () => ({
    posthog: { capture: () => {} },
}));

/** Drives the middleware with a host and returns whether it blocked (403) or
 *  let the request through to the next handler. */
async function run(
    host: string | undefined,
    opts?: Parameters<typeof createFilterBlockerMiddleware>[0],
    header: "host" | "x-forwarded-host" = "host",
): Promise<{ blocked: boolean; status: number }> {
    const app = new Hono<AppEnv>();
    app.use(createFilterBlockerMiddleware(opts));
    app.get("*", c => c.text("passed"));

    const res = await app.request(
        "/",
        { headers: host === undefined ? {} : { [header]: host } },
        {
            incoming: { socket: { remoteAddress: "1.2.3.4" } },
        } as unknown as AppEnv["Bindings"],
    );
    return { blocked: res.status === 403, status: res.status };
}

describe("createFilterBlockerMiddleware", () => {
    const allDomains = Object.values(filterVendorDomains).flat();

    it("blocks every tracked vendor domain and their subdomains", async () => {
        for (const domain of allDomains) {
            expect((await run(domain)).status, domain).toBe(403);
            expect((await run(`telemetry.${domain}`)).status, domain).toBe(403);
        }
    });

    it("passes hostnames that belong to no vendor", async () => {
        for (const host of [
            "example.com",
            "wikipedia.org",
            "localhost",
            "civil.app",
        ])
            expect((await run(host)).blocked, host).toBe(false);
    });

    it("does not block a domain that merely contains a vendor name as a substring", async () => {
        // `notsecurly.com` is not `securly.com` nor a subdomain of it.
        expect((await run("notsecurly.com")).blocked).toBe(false);
        expect((await run("securly.com.evil.test")).blocked).toBe(false);
    });

    it("reads x-forwarded-host only when told to trust it", async () => {
        // With trust on, the forwarded header decides.
        expect(
            (
                await run(
                    "goguardian.com",
                    { trustProxyHostHeader: true },
                    "x-forwarded-host",
                )
            ).status,
        ).toBe(403);
        // With trust off (default), a forwarded header is ignored — only the
        // real Host counts, and there is none here, so it passes.
        expect(
            (await run("goguardian.com", undefined, "x-forwarded-host"))
                .blocked,
        ).toBe(false);
    });

    it("passes when there is no host header at all", async () => {
        expect(await run(undefined)).toEqual({ blocked: false, status: 200 });
    });

    it("accepts a caller-supplied domain list", async () => {
        expect(
            (
                await run("custom-filter.test", {
                    domains: ["custom-filter.test"],
                })
            ).status,
        ).toBe(403);
        // And then the built-in ones no longer apply.
        expect(
            (await run("securly.com", { domains: ["custom-filter.test"] }))
                .blocked,
        ).toBe(false);
    });
});
