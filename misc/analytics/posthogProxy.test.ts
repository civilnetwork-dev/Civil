/**
 * The browser analytics proxy: static bundles go to the assets host, everything
 * else to ingestion, the visitor's headers and body cross over, and the decoded
 * upstream response comes back with the stale encoding headers dropped.
 */

import { Readable } from "node:stream";

import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPosthogProxy } from "./posthogProxy";

function makeReq(opts: {
    method?: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
    /** Express's own resolved client IP (what `req.ip` returns on a real
     *  request once `trust proxy` has been applied) -- not the raw socket
     *  peer, which the proxy no longer reads. */
    ip?: string | null;
}): Request {
    const req = Readable.from(
        opts.body ? [Buffer.from(opts.body)] : [],
    ) as unknown as Record<string, unknown>;
    req.method = opts.method ?? "GET";
    req.url = opts.url;
    req.headers = opts.headers ?? {};
    req.socket = { remoteAddress: "203.0.113.7" };
    req.ip = opts.ip === undefined ? "203.0.113.7" : opts.ip;
    return req as unknown as Request;
}

function makeRes() {
    const res = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: undefined as Buffer | undefined,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        setHeader(name: string, value: string) {
            this.headers[name.toLowerCase()] = value;
        },
        json(obj: unknown) {
            this.body = Buffer.from(JSON.stringify(obj));
            return this;
        },
        end(buf?: Buffer) {
            this.body = buf;
        },
    };
    return res;
}

describe("createPosthogProxy", () => {
    afterEach(() => vi.restoreAllMocks());

    it("routes /static/ requests to the assets host", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response("ok", { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        const res = makeRes();
        await createPosthogProxy()(
            makeReq({ url: "/static/array.js?v=2" }),
            res as unknown as Response,
        );

        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            "https://us-assets.i.posthog.com/static/array.js?v=2",
        );
    });

    it("routes capture requests to ingestion, forwarding body and IP", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response("1", { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        const res = makeRes();
        await createPosthogProxy()(
            makeReq({
                method: "POST",
                url: "/e/?ver=1.2",
                headers: {
                    host: "civil.quartinal.me",
                    "content-type": "text/plain",
                },
                body: "payload",
            }),
            res as unknown as Response,
        );

        const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Headers;
        expect(target).toBe("https://us.i.posthog.com/e/?ver=1.2");
        expect(init.method).toBe("POST");
        expect(headers.get("host")).toBeNull();
        expect(headers.get("content-type")).toBe("text/plain");
        expect(headers.get("x-forwarded-for")).toBe("203.0.113.7");
        expect(Buffer.from(init.body as Buffer).toString()).toBe("payload");
    });

    it("strips cookie and authorization from forwarded headers", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response("1", { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        const res = makeRes();
        await createPosthogProxy()(
            makeReq({
                method: "POST",
                url: "/e/",
                headers: {
                    cookie: "better-auth.session_token=secret",
                    authorization: "Bearer secret",
                    "content-type": "text/plain",
                },
                body: "payload",
            }),
            res as unknown as Response,
        );

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Headers;
        expect(headers.get("cookie")).toBeNull();
        expect(headers.get("authorization")).toBeNull();
        expect(headers.get("content-type")).toBe("text/plain");
    });

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

        const res = makeRes();
        await createPosthogProxy()(
            makeReq({ url: "/flags/" }),
            res as unknown as Response,
        );

        expect(res.statusCode).toBe(202);
        expect(res.headers["x-keep"]).toBe("1");
        expect(res.headers["content-encoding"]).toBeUndefined();
        expect(res.headers["content-length"]).toBeUndefined();
        expect(res.body?.toString()).toBe("body");
    });

    it("answers 502 when the upstream is unreachable", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));

        const res = makeRes();
        await createPosthogProxy()(
            makeReq({ url: "/e/" }),
            res as unknown as Response,
        );

        expect(res.statusCode).toBe(502);
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

        const res = makeRes();
        await createPosthogProxy()(
            makeReq({ url: "/e/" }),
            res as unknown as Response,
        );

        expect(res.headers["set-cookie"]).toBeUndefined();
    });

    it("404s a path outside the allowlist instead of relaying it", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const res = makeRes();
        await createPosthogProxy()(
            makeReq({ url: "/organizations/whoami" }),
            res as unknown as Response,
        );

        expect(res.statusCode).toBe(404);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("uses req.ip, not a client-supplied x-forwarded-for, for the visitor IP", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response("1", { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        const res = makeRes();
        await createPosthogProxy()(
            makeReq({
                url: "/e/",
                ip: "198.51.100.9",
                headers: { "x-forwarded-for": "1.2.3.4, evil-spoofed" },
            }),
            res as unknown as Response,
        );

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect((init.headers as Headers).get("x-forwarded-for")).toBe(
            "198.51.100.9",
        );
    });

    it("rejects a body over the size cap with 413, without forwarding it", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const res = makeRes();
        await createPosthogProxy()(
            makeReq({
                method: "POST",
                url: "/e/",
                body: "x".repeat(9 * 1024 * 1024),
            }),
            res as unknown as Response,
        );

        expect(res.statusCode).toBe(413);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
