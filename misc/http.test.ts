/**
 * The client address handlers log and rate-limit by: the socket peer, or, only
 * behind the declared reverse proxy, the hop that proxy appended. A client
 * that writes its own `x-forwarded-for` must not be able to pick its address.
 */

import type { IncomingMessage } from "node:http";

import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type AppEnv, clientIp, readJsonBody, requestIp } from "./http";

async function ipFor(headers: Record<string, string>): Promise<string> {
    const app = new Hono<AppEnv>();
    app.get("/", c => c.text(clientIp(c) ?? "none"));
    const res = await app.request("/", { headers }, {
        incoming: { socket: { remoteAddress: "10.0.0.2" } },
    } as unknown as AppEnv["Bindings"]);
    return res.text();
}

describe("clientIp", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("uses the socket peer and ignores x-forwarded-for without a proxy", async () => {
        vi.stubEnv("REVERSE_PROXY", "");
        expect(await ipFor({ "x-forwarded-for": "1.2.3.4" })).toBe("10.0.0.2");
    });

    it("uses the hop the proxy appended, not the client's own entries", async () => {
        vi.stubEnv("REVERSE_PROXY", "true");
        expect(
            await ipFor({ "x-forwarded-for": "1.2.3.4, 198.51.100.9" }),
        ).toBe("198.51.100.9");
    });

    it("falls back to the socket peer when the proxy sent no header", async () => {
        vi.stubEnv("REVERSE_PROXY", "true");
        expect(await ipFor({})).toBe("10.0.0.2");
    });
});

describe("requestIp", () => {
    afterEach(() => vi.unstubAllEnvs());

    const upgrade = (forwardedFor: string) =>
        ({
            headers: { "x-forwarded-for": forwardedFor },
            socket: { remoteAddress: "10.0.0.2" },
        }) as unknown as IncomingMessage;

    it("applies clientIp's rule to a request Hono never saw", () => {
        vi.stubEnv("REVERSE_PROXY", "");
        expect(requestIp(upgrade("1.2.3.4"))).toBe("10.0.0.2");
        vi.stubEnv("REVERSE_PROXY", "true");
        expect(requestIp(upgrade("1.2.3.4, 198.51.100.9"))).toBe(
            "198.51.100.9",
        );
    });
});

describe("readJsonBody", () => {
    async function bodyOf(init: RequestInit): Promise<unknown> {
        const app = new Hono();
        app.post("/", async c => c.json(await readJsonBody(c)));
        return (await app.request("/", { method: "POST", ...init })).json();
    }

    it("returns the parsed object", async () => {
        expect(
            await bodyOf({
                body: JSON.stringify({ url: "https://example.com" }),
                headers: { "content-type": "application/json" },
            }),
        ).toEqual({ url: "https://example.com" });
    });

    it("returns an empty object for a malformed or non-object body", async () => {
        expect(await bodyOf({ body: "{nope" })).toEqual({});
        expect(await bodyOf({ body: "42" })).toEqual({});
        expect(await bodyOf({})).toEqual({});
    });
});
