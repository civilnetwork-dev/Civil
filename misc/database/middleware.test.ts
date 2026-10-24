/**
 * better-auth rejects a POST body that is not JSON. The auth route must hand it
 * a bodiless request whenever the client sent no content type or no content,
 * as better-auth's Node adapter did under Express, so the anonymous sign-in's
 * bare `fetch(url, { method: "POST" })` is not refused with 415.
 */

import { describe, expect, it, vi } from "vitest";

const handler = vi.hoisted(() =>
    vi.fn(async (request: Request) =>
        Response.json({ hasBody: request.body !== null }),
    ),
);
vi.mock("./auth", () => ({ auth: { handler } }));
vi.mock("./graphql", () => ({ yoga: { fetch: () => new Response() } }));

import { createDatabaseMiddleware } from "./middleware";

async function bodySeenByAuth(init: RequestInit): Promise<boolean> {
    const res = await createDatabaseMiddleware().request(
        "/api/auth/sign-in/anonymous",
        { method: "POST", ...init },
    );
    return ((await res.json()) as { hasBody: boolean }).hasBody;
}

describe("the better-auth route", () => {
    it("drops the body of a POST with no content type", async () => {
        expect(await bodySeenByAuth({})).toBe(false);
        expect(await bodySeenByAuth({ body: "ignored" })).toBe(false);
    });

    it("drops an empty JSON body", async () => {
        expect(
            await bodySeenByAuth({
                headers: {
                    "content-type": "application/json",
                    "content-length": "0",
                },
            }),
        ).toBe(false);
    });

    it("passes a JSON body through", async () => {
        expect(
            await bodySeenByAuth({
                headers: {
                    "content-type": "application/json",
                    "content-length": "2",
                },
                body: "{}",
            }),
        ).toBe(true);
    });
});
