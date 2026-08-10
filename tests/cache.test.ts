import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The load-bearing property of this module is not "caching works" — it's that
 * **a Redis failure never fails a request**. Every proxy decision, session
 * lookup and Patreon entitlement check goes through `cached()`, so if it starts
 * propagating Redis errors the whole app goes down with Redis instead of
 * degrading to "slow but correct".
 *
 * That behaviour is expressed as bare `catch {}` blocks, which are exactly the
 * kind of thing a cleanup pass deletes. These tests are the guard.
 */

const redisMock = {
    getBuffer: vi.fn(),
    set: vi.fn(),
    sadd: vi.fn(),
    smembers: vi.fn(),
    del: vi.fn(),
    get: vi.fn(),
};

// `new Redis(url, opts)` must yield the mock. A plain function declaration is
// constructible (an object returned from a constructor call replaces `this`),
// unlike an arrow function, and avoids lint/correctness/noConstructorReturn.
vi.mock("ioredis", () => ({
    default: function RedisMock() {
        return redisMock;
    },
}));

const { bannedKey, cached, invalidate, invalidateTag, sessionKey, userKey } =
    await import("../misc/database/cache");

beforeEach(() => {
    vi.clearAllMocks();
    redisMock.getBuffer.mockResolvedValue(null);
    redisMock.set.mockResolvedValue("OK");
    redisMock.sadd.mockResolvedValue(1);
    redisMock.smembers.mockResolvedValue([]);
    redisMock.del.mockResolvedValue(1);
});

describe("cached: happy path", () => {
    it("calls the producer on a miss and returns its value", async () => {
        const fn = vi.fn(async () => ({ hello: "world" }));
        await expect(cached("k", fn)).resolves.toEqual({ hello: "world" });
        expect(fn).toHaveBeenCalledOnce();
    });

    it("stores the value with the requested TTL", async () => {
        await cached("k", async () => ({ a: 1 }), 123);
        expect(redisMock.set).toHaveBeenCalledWith(
            "k",
            expect.any(Buffer),
            "EX",
            123,
        );
    });

    it("defaults to a 300s TTL", async () => {
        await cached("k", async () => 1);
        expect(redisMock.set).toHaveBeenCalledWith(
            "k",
            expect.any(Buffer),
            "EX",
            300,
        );
    });

    it("returns the cached value on a hit without calling the producer", async () => {
        // Round-trip through the real MessagePack encoder by priming the mock
        // with whatever cached() wrote on the miss.
        const value = { hello: "world", n: 42 };
        await cached("k", async () => value);
        const stored = redisMock.set.mock.calls[0][1] as Buffer;

        redisMock.getBuffer.mockResolvedValue(stored);
        const fn = vi.fn(async () => ({ should: "not run" }));
        await expect(cached("k", fn)).resolves.toEqual(value);
        expect(fn).not.toHaveBeenCalled();
    });

    it("preserves Date values through the cache", async () => {
        // MessagePack (not JSON) is used precisely so this holds — session
        // objects carry expiry Dates.
        const value = { at: new Date("2026-01-02T03:04:05.000Z") };
        await cached("k", async () => value);
        const stored = redisMock.set.mock.calls[0][1] as Buffer;

        redisMock.getBuffer.mockResolvedValue(stored);
        const out = await cached<typeof value>("k", async () => value);
        expect(out.at).toBeInstanceOf(Date);
        expect(out.at.toISOString()).toBe("2026-01-02T03:04:05.000Z");
    });

    it("registers the key under each tag", async () => {
        await cached("k", async () => 1, 60, ["tag-a", "tag-b"]);
        expect(redisMock.sadd).toHaveBeenCalledWith("tag:tag-a", "k");
        expect(redisMock.sadd).toHaveBeenCalledWith("tag:tag-b", "k");
    });
});

describe("cached: degrades instead of failing", () => {
    it("still returns a value when the read throws", async () => {
        redisMock.getBuffer.mockRejectedValue(new Error("ECONNREFUSED"));
        const fn = vi.fn(async () => "fresh");
        await expect(cached("k", fn)).resolves.toBe("fresh");
        expect(fn).toHaveBeenCalledOnce();
    });

    it("does not attempt to write when the read already failed", async () => {
        // The read-failure path returns fn() directly, skipping the write.
        redisMock.getBuffer.mockRejectedValue(new Error("ECONNREFUSED"));
        await cached("k", async () => "fresh");
        expect(redisMock.set).not.toHaveBeenCalled();
    });

    it("still returns a value when the write throws", async () => {
        redisMock.set.mockRejectedValue(new Error("READONLY"));
        await expect(cached("k", async () => "fresh")).resolves.toBe("fresh");
    });

    it("still returns a value when tag registration throws", async () => {
        redisMock.sadd.mockRejectedValue(new Error("ECONNREFUSED"));
        await expect(
            cached("k", async () => "fresh", 60, ["tag-a"]),
        ).resolves.toBe("fresh");
    });

    it("still returns a value when the cached payload is corrupt", async () => {
        redisMock.getBuffer.mockResolvedValue(
            Buffer.from([0xc1, 0xff, 0xff, 0xff]),
        );
        await expect(cached("k", async () => "fresh")).resolves.toBe("fresh");
    });

    it("propagates an error thrown by the producer itself", async () => {
        // Redis failures are swallowed; a genuine application error must not be.
        await expect(
            cached("k", async () => {
                throw new Error("upstream exploded");
            }),
        ).rejects.toThrow("upstream exploded");
    });
});

describe("invalidate", () => {
    it("deletes the given keys", async () => {
        await invalidate("a", "b");
        expect(redisMock.del).toHaveBeenCalledWith("a", "b");
    });

    it("is a no-op with no keys, rather than a `del` with none", async () => {
        // `redis.del()` with zero arguments is an error in Redis.
        await invalidate();
        expect(redisMock.del).not.toHaveBeenCalled();
    });
});

describe("invalidateTag", () => {
    it("deletes every key in the tag set, then the set itself", async () => {
        redisMock.smembers.mockResolvedValue(["k1", "k2"]);
        await invalidateTag("tag-a");
        expect(redisMock.del).toHaveBeenCalledWith("k1", "k2");
        expect(redisMock.del).toHaveBeenCalledWith("tag:tag-a");
    });

    it("still clears the set when the tag has no keys", async () => {
        redisMock.smembers.mockResolvedValue([]);
        await invalidateTag("tag-a");
        expect(redisMock.del).toHaveBeenCalledExactlyOnceWith("tag:tag-a");
    });
});

describe("key builders", () => {
    it("namespace their keys so they cannot collide", () => {
        expect(sessionKey("abc")).toBe("session:abc");
        expect(userKey("abc")).toBe("user:abc");
        expect(bannedKey("abc")).toBe("banned:abc");

        const keys = [sessionKey("x"), userKey("x"), bannedKey("x")];
        expect(new Set(keys).size).toBe(keys.length);
    });
});
