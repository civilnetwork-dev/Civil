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
}): Request {
    const req = Readable.from(
        opts.body ? [Buffer.from(opts.body)] : [],
    ) as unknown as Record<string, unknown>;
    req.method = opts.method ?? "GET";
    req.url = opts.url;
    req.headers = opts.headers ?? {};
    req.socket = { remoteAddress: "203.0.113.7" };
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
});
