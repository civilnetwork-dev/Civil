/**
 * better-auth rejects a POST body that is not JSON. The auth route must hand it
 * a bodiless request whenever the client sent no content type or no content,
 * as better-auth's Node adapter did under Express, so the anonymous sign-in's
 * bare `fetch(url, { method: "POST" })` is not refused with 415.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const handler = vi.hoisted(() =>
    vi.fn(async (request: Request) =>
        Response.json({ hasBody: request.body !== null }),
    ),
);
const visits = vi.hoisted(() => ({
    recordVisit: vi.fn(async () => {}),
    isUserBanned: vi.fn(async () => false),
}));
vi.mock("./auth", () => ({ auth: { handler } }));
vi.mock("./graphql", () => ({ yoga: { fetch: () => new Response() } }));
vi.mock("./session", () => ({
    resolveSessionFromHeaders: async () => ({ user: { id: "student" } }),
}));
vi.mock("./models/user", () => ({
    isUserBanned: visits.isUserBanned,
    getUser: async () => ({ banReason: "Banned by an administrator" }),
}));
vi.mock("./models/visit", () => ({ recordVisit: visits.recordVisit }));
vi.mock("./bannedDomains", () => ({
    matchBannedDomain: (url: string) =>
        new URL(url).hostname === "restricted.example"
            ? "restricted.example"
            : null,
}));

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

async function trackVisit(url: string): Promise<unknown> {
    const res = await createDatabaseMiddleware().request(
        "/api/trackVisit",
        {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url }),
        },
        { incoming: { socket: { remoteAddress: "203.0.113.9" } } } as never,
    );
    return res.json();
}

/**
 * A restricted site is refused, never punished: the visit route names it so
 * the tab can say why, and asking again any number of times stays a refusal.
 */
describe("the visit route", () => {
    beforeEach(() => vi.clearAllMocks());

    it("names a restricted site instead of recording a visit", async () => {
        expect(await trackVisit("https://restricted.example/")).toEqual({
            ok: false,
            userBanned: false,
            banReason: null,
            restricted: "restricted.example",
        });
        expect(visits.recordVisit).not.toHaveBeenCalled();
    });

    it("never bans for asking for a restricted site again", async () => {
        for (let i = 0; i < 20; i++) {
            expect(
                await trackVisit("https://restricted.example/"),
            ).toMatchObject({ userBanned: false });
        }
    });

    it("records an ordinary visit", async () => {
        expect(await trackVisit("https://example.com/")).toMatchObject({
            ok: true,
        });
        expect(visits.recordVisit).toHaveBeenCalled();
    });

    it("answers an administrator's ban with its reason", async () => {
        visits.isUserBanned.mockResolvedValueOnce(true);
        expect(await trackVisit("https://example.com/")).toMatchObject({
            userBanned: true,
            banReason: "Banned by an administrator",
        });
        expect(visits.recordVisit).not.toHaveBeenCalled();
    });
});
