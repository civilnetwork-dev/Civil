import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The strike system is an abuse control, so the two properties that matter are
 * adversarial rather than functional:
 *
 *   1. A user who wipes their data and makes a fresh anonymous account must not
 *      reset their strike count — the per-IP counter has to survive.
 *   2. A ban must never apply to a whole IP, because an entire school sits
 *      behind one NAT address.
 *
 * Both are easy to break with a well-meaning refactor and neither fails loudly.
 */

const store = new Map<string, number>();
const expires = new Map<string, number>();
const banUser = vi.fn(async () => undefined);

vi.mock("../misc/database/cache", () => ({
    redis: {
        incr: vi.fn(async (key: string) => {
            const next = (store.get(key) ?? 0) + 1;
            store.set(key, next);
            return next;
        }),
        expire: vi.fn(async (key: string, ttl: number) => {
            expires.set(key, ttl);
            return 1;
        }),
        get: vi.fn(async (key: string) => {
            const v = store.get(key);
            return v === undefined ? null : String(v);
        }),
    },
    cached: async <T>(_k: string, fn: () => Promise<T>) => fn(),
    sessionKey: (t: string) => `session:${t}`,
}));

vi.mock("../misc/database/models/user", () => ({ banUser }));

const {
    extractClientIp,
    ipViolationKey,
    readViolationCount,
    recordViolation,
    userViolationKey,
    VIOLATION_LIMIT,
    VIOLATION_TTL,
} = await import("../misc/violations");

beforeEach(() => {
    store.clear();
    expires.clear();
    banUser.mockClear();
});

describe("extractClientIp", () => {
    it("prefers the first x-forwarded-for entry", () => {
        expect(
            extractClientIp({
                headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
            }),
        ).toBe("203.0.113.5");
    });

    it("handles x-forwarded-for arriving as an array", () => {
        expect(
            extractClientIp({
                headers: { "x-forwarded-for": ["203.0.113.5"] as never },
            }),
        ).toBe("203.0.113.5");
    });

    it("falls back to x-real-ip, then the socket", () => {
        expect(
            extractClientIp({ headers: { "x-real-ip": "203.0.113.9" } }),
        ).toBe("203.0.113.9");
        expect(
            extractClientIp({
                headers: {},
                socket: { remoteAddress: "203.0.113.7" },
            }),
        ).toBe("203.0.113.7");
    });

    it("normalizes IPv4-mapped IPv6 to plain IPv4", () => {
        // Otherwise the same client gets two independent strike counters
        // depending on how the connection was accepted.
        expect(
            extractClientIp({
                headers: {},
                socket: { remoteAddress: "::ffff:203.0.113.7" },
            }),
        ).toBe("203.0.113.7");
    });

    it("trims whitespace around a forwarded address", () => {
        expect(
            extractClientIp({
                headers: { "x-forwarded-for": "  203.0.113.5 , 10.0.0.1" },
            }),
        ).toBe("203.0.113.5");
    });

    it("returns null when nothing identifies the client", () => {
        expect(extractClientIp({ headers: {} })).toBeNull();
        expect(
            extractClientIp({ headers: { "x-forwarded-for": "" } }),
        ).toBeNull();
        expect(
            extractClientIp({ headers: {}, socket: { remoteAddress: "" } }),
        ).toBeNull();
    });
});

describe("recordViolation", () => {
    it("increments both the user and IP counters", async () => {
        await recordViolation("user-1", "203.0.113.5");
        expect(store.get(userViolationKey("user-1"))).toBe(1);
        expect(store.get(ipViolationKey("203.0.113.5"))).toBe(1);
    });

    it("sets a 24h TTL on every counter it touches", async () => {
        await recordViolation("user-1", "203.0.113.5");
        expect(expires.get(userViolationKey("user-1"))).toBe(VIOLATION_TTL);
        expect(expires.get(ipViolationKey("203.0.113.5"))).toBe(VIOLATION_TTL);
        expect(VIOLATION_TTL).toBe(86400);
    });

    it("reports the max of the user and IP counts", async () => {
        store.set(ipViolationKey("203.0.113.5"), 3);
        const { violations } = await recordViolation(
            "fresh-user",
            "203.0.113.5",
        );
        // User counter is now 1, IP counter is 4 → effective count is 4.
        expect(violations).toBe(4);
    });

    it("does not ban before the limit", async () => {
        for (let i = 1; i < VIOLATION_LIMIT; i++) {
            const { banned } = await recordViolation("user-1", "203.0.113.5");
            expect(banned).toBe(false);
        }
        expect(banUser).not.toHaveBeenCalled();
    });

    it("bans exactly at the limit", async () => {
        let last = { violations: 0, banned: false };
        for (let i = 0; i < VIOLATION_LIMIT; i++) {
            last = await recordViolation("user-1", "203.0.113.5");
        }
        expect(last.violations).toBe(VIOLATION_LIMIT);
        expect(last.banned).toBe(true);
        expect(banUser).toHaveBeenCalledOnce();
        expect(banUser).toHaveBeenCalledWith(
            "user-1",
            "Repeatedly accessed restricted domains via proxy",
        );
    });

    it("bans the USER, never the IP", async () => {
        for (let i = 0; i < VIOLATION_LIMIT; i++) {
            await recordViolation("user-1", "203.0.113.5");
        }
        // A whole-IP ban would take out every student behind the same NAT.
        for (const [, args] of banUser.mock.calls.entries()) {
            expect(args).not.toContain("203.0.113.5");
        }
        expect(banUser).toHaveBeenCalledWith(
            "user-1",
            expect.stringContaining("restricted domains"),
        );
    });

    it("resists ban evasion by creating a fresh anonymous account", async () => {
        const ip = "203.0.113.5";

        // Burn through the limit on one identity.
        for (let i = 0; i < VIOLATION_LIMIT; i++) {
            await recordViolation("user-old", ip);
        }
        expect(banUser).toHaveBeenCalledWith("user-old", expect.any(String));
        banUser.mockClear();

        // Clearing site data wipes the user counter but not the IP counter.
        store.delete(userViolationKey("user-old"));

        // The very first strike on the new identity should ban immediately,
        // because the IP counter is already past the limit.
        const { violations, banned } = await recordViolation("user-new", ip);
        expect(violations).toBeGreaterThanOrEqual(VIOLATION_LIMIT);
        expect(banned).toBe(true);
        expect(banUser).toHaveBeenCalledWith("user-new", expect.any(String));
    });

    it("still works when there is no IP", async () => {
        const { violations, banned } = await recordViolation("user-1", null);
        expect(violations).toBe(1);
        expect(banned).toBe(false);
        expect(store.has(ipViolationKey("null"))).toBe(false);
    });

    it("does not let one user's strikes ban a different user", async () => {
        // Different users on different IPs must stay independent.
        for (let i = 0; i < VIOLATION_LIMIT; i++) {
            await recordViolation("user-1", "203.0.113.1");
        }
        banUser.mockClear();
        const { banned } = await recordViolation("user-2", "203.0.113.2");
        expect(banned).toBe(false);
        expect(banUser).not.toHaveBeenCalled();
    });
});

describe("readViolationCount", () => {
    it("reports the max of both counters without incrementing", async () => {
        store.set(userViolationKey("user-1"), 2);
        store.set(ipViolationKey("203.0.113.5"), 4);

        expect(await readViolationCount("user-1", "203.0.113.5")).toBe(4);
        // Read-only: counters must be untouched.
        expect(store.get(userViolationKey("user-1"))).toBe(2);
        expect(store.get(ipViolationKey("203.0.113.5"))).toBe(4);
    });

    it("returns 0 for an unknown user", async () => {
        expect(await readViolationCount("nobody", null)).toBe(0);
    });

    it("ignores the IP counter when no IP is given", async () => {
        store.set(ipViolationKey("203.0.113.5"), 4);
        expect(await readViolationCount("user-1", null)).toBe(0);
    });
});
