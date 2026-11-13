/**
 * better-auth rejects a POST body that is not JSON. The auth route must hand it
 * a bodiless request whenever the client sent no content type or no content,
 * as better-auth's Node adapter did under Express, so the anonymous sign-in's
 * bare `fetch(url, { method: "POST" })` is not refused with 415.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

const handler = vi.hoisted(() =>
    vi.fn(async (request: Request) =>
        Response.json({ hasBody: request.body !== null }),
    ),
);
const visits = vi.hoisted(() => ({
    recordVisit: vi.fn(async () => {}),
    isUserBanned: vi.fn(async () => false),
}));
vi.mock("./auth", () => ({
    auth: { handler },
    classLinkConfig: { authOrigin: "https://civil.example" },
}));
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

it("advertises ClassLink only on the canonical host without leaking configuration", async () => {
    const router = createDatabaseMiddleware();
    const enabled = await router.request(
        "https://civil.example/api/authProviders",
    );
    expect(await enabled.json()).toEqual({ classlink: true });
    expect(enabled.headers.get("cache-control")).toBe("no-store");
    const mirror = await router.request(
        "https://mirror.example/api/authProviders",
    );
    expect(await mirror.json()).toEqual({ classlink: false });
});

it("uses the configured reverse proxy's scheme for ClassLink availability", async () => {
    vi.stubEnv("REVERSE_PROXY", "true");
    const router = createDatabaseMiddleware();
    const request = async (
        host: string,
        scheme?: string,
        origin = "https://civil.example",
    ) => {
        const response = await router.request(
            `http://${host}/api/authProviders`,
            {
                headers: {
                    origin,
                    "x-forwarded-host": "civil.example",
                    ...(scheme ? { "x-forwarded-proto": scheme } : {}),
                },
            },
        );
        return response.json();
    };
    expect(await request("civil.example", "http, https")).toEqual({
        classlink: true,
    });
    expect(await request("civil.example", "https, http")).toEqual({
        classlink: false,
    });
    expect(await request("civil.example", "unknown")).toEqual({
        classlink: false,
    });
    expect(await request("civil.example")).toEqual({ classlink: false });
    expect(await request("mirror.example", "https")).toEqual({
        classlink: false,
    });
    expect(
        await request("civil.example", "https", "https://mirror.example"),
    ).toEqual({ classlink: false });
    vi.stubEnv("REVERSE_PROXY", undefined);
    expect(await request("civil.example", "https")).toEqual({
        classlink: false,
    });
});

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
