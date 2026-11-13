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
    request: { path?: string; method?: string } = {},
): Promise<{ blocked: boolean; status: number }> {
    const app = new Hono<AppEnv>();
    app.use(createFilterBlockerMiddleware(opts));
    app.all("*", c => c.text("passed"));

    const res = await app.request(
        request.path ?? "/",
        {
            method: request.method ?? "GET",
            headers: host === undefined ? {} : { [header]: host },
        },
        {
            incoming: { socket: { remoteAddress: "1.2.3.4" } },
        } as unknown as AppEnv["Bindings"],
    );
    return { blocked: res.status === 403, status: res.status };
}

it("preserves the caller's explicit domain-list override for telemetry paths", async () => {
    expect(
        (
            await run(
                "pubsub.googleapis.com",
                { domains: ["custom-filter.test"] },
                "host",
                {
                    method: "POST",
                    path: "/v1/projects/gopher-buddy-prod/topics/session-ingest:publish",
                },
            )
        ).status,
    ).toBe(200);
});

const allDomains = Object.values(filterVendorDomains).flat();

describe("createFilterBlockerMiddleware", () => {
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
});

describe("createFilterBlockerMiddleware hosts", () => {
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
        // With trust off (default), a forwarded header is ignored: only the
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

const functionalHosts = [
    "launchpad.classlink.com",
    "nodeapi.classlink.com",
    "myapps.classlink.com",
    "teacherconsole.classlink.com",
    "gopher-buddy-prod.appspot.com",
    "amplifiedlabs.zendesk.com",
    "pubsub.googleapis.com",
    "oauth.dyknow.me",
    "diag.dyknow.com",
];

it.each(functionalHosts)(
    "preserves authentication and support on %s",
    async host => {
        expect((await run(host)).status).toBe(200);
    },
);

const gopherTopic =
    "/v1/projects/gopher-buddy-prod/topics/session-ingest:publish";
const topicRequests = [
    ["pubsub.googleapis.com", gopherTopic + "?key=test", "POST", 403],
    ["pubsub.googleapis.com", gopherTopic, "GET", 200],
    [
        "pubsub.googleapis.com",
        "/v1/projects/other/topics/session-ingest:publish",
        "POST",
        200,
    ],
    ["pubsub.googleapis.com", gopherTopic + "/other", "POST", 200],
    ["other.pubsub.googleapis.com", gopherTopic, "POST", 200],
] as const;

it.each(topicRequests)(
    "scopes telemetry blocking to %s%s %s",
    async (host, path, method, status) => {
        expect(
            (await run(host, undefined, "host", { path, method })).status,
        ).toBe(status);
    },
);
