/**
 * The filter blocker middleware: every tracked vendor's phone-home domain is
 * refused, ordinary traffic passes, and the header it trusts is the one it was
 * told to.
 */

import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import {
    createFilterBlockerMiddleware,
    filterVendorDomains,
} from "./filterBlockerMiddleware";

vi.mock("./posthog", () => ({
    posthog: { capture: () => {} },
}));

/** Drives the middleware with a host and returns whether it blocked (403) or
 *  called `next`. */
function run(
    host: string,
    opts?: Parameters<typeof createFilterBlockerMiddleware>[0],
    header: "host" | "x-forwarded-host" = "host",
): { blocked: boolean; status?: number } {
    const middleware = createFilterBlockerMiddleware(opts);
    let status: number | undefined;
    let blocked = false;
    let nexted = false;

    const req = {
        headers: { [header]: host },
        ip: "1.2.3.4",
    } as unknown as Request;
    const res = {
        status(code: number) {
            status = code;
            blocked = true;
            return this;
        },
        json() {
            return this;
        },
    } as unknown as Response;
    const next: NextFunction = () => {
        nexted = true;
    };

    middleware(req, res, next);
    return { blocked: blocked && !nexted, status };
}

describe("createFilterBlockerMiddleware", () => {
    const allDomains = Object.values(filterVendorDomains).flat();

    it("blocks every tracked vendor domain and their subdomains", () => {
        for (const domain of allDomains) {
            expect(run(domain).status, domain).toBe(403);
            expect(run(`telemetry.${domain}`).status, domain).toBe(403);
        }
    });

    it("passes hostnames that belong to no vendor", () => {
        for (const host of [
            "example.com",
            "wikipedia.org",
            "localhost",
            "civil.app",
        ])
            expect(run(host).blocked, host).toBe(false);
    });

    it("does not block a domain that merely contains a vendor name as a substring", () => {
        // `notsecurly.com` is not `securly.com` nor a subdomain of it.
        expect(run("notsecurly.com").blocked).toBe(false);
        expect(run("securly.com.evil.test").blocked).toBe(false);
    });

    it("reads x-forwarded-host only when told to trust it", () => {
        // With trust on, the forwarded header decides.
        expect(
            run(
                "goguardian.com",
                { trustProxyHostHeader: true },
                "x-forwarded-host",
            ).status,
        ).toBe(403);
        // With trust off (default), a forwarded header is ignored — only the
        // real Host counts, and there is none here, so it passes.
        expect(
            run("goguardian.com", undefined, "x-forwarded-host").blocked,
        ).toBe(false);
    });

    it("passes when there is no host header at all", () => {
        const middleware = createFilterBlockerMiddleware();
        let nexted = false;
        middleware(
            { headers: {} } as unknown as Request,
            {} as unknown as Response,
            (() => {
                nexted = true;
            }) as NextFunction,
        );
        expect(nexted).toBe(true);
    });

    it("accepts a caller-supplied domain list", () => {
        expect(
            run("custom-filter.test", { domains: ["custom-filter.test"] })
                .status,
        ).toBe(403);
        // And then the built-in ones no longer apply.
        expect(
            run("securly.com", { domains: ["custom-filter.test"] }).blocked,
        ).toBe(false);
    });
});
