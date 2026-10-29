/**
 * The browser analytics proxy: static bundles go to the assets host, everything
 * else to ingestion, the visitor's headers and body cross over, and the decoded
 * upstream response comes back with the stale encoding headers dropped.
 */

import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppEnv } from "../http";
import { usePosthogProxy } from "./posthogProxy";

/** Sends a request through the relay as mounted on the app. The socket peer
 *  is what `clientIp` reports while `REVERSE_PROXY` is unset. */
async function relay(
    path: string,
    init: RequestInit = {},
    peer = "203.0.113.7",
): Promise<Response> {
    const app = new Hono<AppEnv>();
    usePosthogProxy(app);
    return app.request(`/api/relay${path}`, init, {
        incoming: { socket: { remoteAddress: peer } },
    } as unknown as AppEnv["Bindings"]);
}

afterEach(() => vi.restoreAllMocks());

describe("usePosthogProxy", () => {
    it("routes /static/ requests to the assets host", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response("ok", { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        await relay("/static/array.js?v=2");

        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            "https://us-assets.i.posthog.com/static/array.js?v=2",
        );
    });

    it("routes capture requests to ingestion, forwarding body and IP", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response("1", { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        await relay("/e/?ver=1.2", {
            method: "POST",
            headers: {
                host: "civil.quartinal.me",
                "content-type": "text/plain",
            },
            body: "payload",
        });

        const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Headers;
        expect(target).toBe("https://us.i.posthog.com/e/?ver=1.2");
        expect(init.method).toBe("POST");
        expect(headers.get("host")).toBeNull();
        expect(headers.get("content-type")).toBe("text/plain");
        expect(headers.get("x-forwarded-for")).toBe("203.0.113.7");
        expect(Buffer.from(init.body as ArrayBuffer).toString()).toBe(
            "payload",
        );
    });

    it("routes the capture and replay paths remote config sets to ingestion", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response("1", { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        await relay("/i/v0/e/?ver=1.440.0", { method: "POST", body: "e" });
        await relay("/s/?ver=1.440.0", { method: "POST", body: "s" });

        expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
            "https://us.i.posthog.com/i/v0/e/?ver=1.440.0",
            "https://us.i.posthog.com/s/?ver=1.440.0",
        ]);
    });
});

describe("usePosthogProxy forwarded headers", () => {
    it("strips cookie and authorization from forwarded headers", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response("1", { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        await relay("/e/", {
            method: "POST",
            headers: {
                cookie: "better-auth.session_token=secret",
                authorization: "Bearer secret",
                "content-type": "text/plain",
            },
            body: "payload",
        });

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Headers;
        expect(headers.get("cookie")).toBeNull();
        expect(headers.get("authorization")).toBeNull();
        expect(headers.get("content-type")).toBe("text/plain");
    });
});

describe("usePosthogProxy responses", () => {
    it("relays upstream status but drops stale encoding headers", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response("body", {
                    status: 202,
                    headers: {
                        "content-encoding": "gzip",
                        "content-length": "999",
                        "x-keep": "1",
                    },
                }),
            ),
        );

        const res = await relay("/flags/");

        expect(res.status).toBe(202);
        expect(res.headers.get("x-keep")).toBe("1");
        expect(res.headers.get("content-encoding")).toBeNull();
        expect(res.headers.get("content-length")).not.toBe("999");
        expect(await res.text()).toBe("body");
    });
});

describe("usePosthogProxy cached and failed responses", () => {
    it("relays a 304 for a cached bundle without a body", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(null, {
                    status: 304,
                    headers: { etag: '"a"' },
                }),
            ),
        );

        const res = await relay("/static/recorder.js", {
            headers: { "if-none-match": '"a"' },
        });

        expect(res.status).toBe(304);
        expect(res.headers.get("etag")).toBe('"a"');
    });

    it("answers 502 when the upstream is unreachable", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));

        expect((await relay("/e/")).status).toBe(502);
    });

    it("strips set-cookie from the relayed response", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response("1", {
                    status: 200,
                    headers: { "set-cookie": "sneaky=1; Path=/" },
                }),
            ),
        );

        const res = await relay("/e/");

        expect(res.headers.get("set-cookie")).toBeNull();
    });
});

describe("usePosthogProxy guards", () => {
    it("404s a path outside the allowlist instead of relaying it", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const res = await relay("/organizations/whoami");

        expect(res.status).toBe(404);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("uses the resolved client IP, not a client-supplied x-forwarded-for", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response("1", { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        await relay(
            "/e/",
            { headers: { "x-forwarded-for": "1.2.3.4, evil-spoofed" } },
            "198.51.100.9",
        );

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect((init.headers as Headers).get("x-forwarded-for")).toBe(
            "198.51.100.9",
        );
    });

    it("rejects a body over the size cap with 413, without forwarding it", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const res = await relay("/e/", {
            method: "POST",
            body: "x".repeat(9 * 1024 * 1024),
        });

        expect(res.status).toBe(413);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
