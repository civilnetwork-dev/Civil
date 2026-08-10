import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { optionalEnv, requireEnv, validateEnv } from "../misc/env";

/**
 * validateEnv() is the first statement in run.ts, so it is the difference
 * between "the server tells you which variable is missing" and "the server dies
 * somewhere inside a database driver". Worth pinning, because it's the kind of
 * code nobody exercises deliberately until a deploy goes wrong.
 */

const MANAGED = [
    "DATABASE_URL",
    "REDIS_URL",
    "BETTER_AUTH_SECRET",
    "PATREON_CLIENT_ID",
    "PATREON_CLIENT_SECRET",
    "IBOSS_SECURITY_KEY",
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
    saved = {};
    for (const key of MANAGED) saved[key] = process.env[key];
});

afterEach(() => {
    for (const key of MANAGED) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
    }
});

/** tests/setup.ts already provides valid values for every managed var. */
function withAllSet() {
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.BETTER_AUTH_SECRET = "x".repeat(32);
    process.env.PATREON_CLIENT_ID = "id";
    process.env.PATREON_CLIENT_SECRET = "secret";
    process.env.IBOSS_SECURITY_KEY = "key";
}

describe("requireEnv", () => {
    it("returns the value when set", () => {
        process.env.DATABASE_URL = "postgresql://example";
        expect(requireEnv("DATABASE_URL")).toBe("postgresql://example");
    });

    it("throws naming the variable when unset", () => {
        delete process.env.DATABASE_URL;
        expect(() => requireEnv("DATABASE_URL")).toThrow(
            "Missing required env var: DATABASE_URL",
        );
    });

    it("treats an empty string as missing", () => {
        // A blank line in .env is a configuration mistake, not a valid value.
        process.env.DATABASE_URL = "";
        expect(() => requireEnv("DATABASE_URL")).toThrow(
            "Missing required env var: DATABASE_URL",
        );
    });
});

describe("optionalEnv", () => {
    it("returns the value when set", () => {
        process.env.BETTER_AUTH_SECRET = "real";
        expect(optionalEnv("BETTER_AUTH_SECRET", "fallback")).toBe("real");
    });

    it("falls back when unset or empty", () => {
        delete process.env.BETTER_AUTH_SECRET;
        expect(optionalEnv("BETTER_AUTH_SECRET", "fallback")).toBe("fallback");
        process.env.BETTER_AUTH_SECRET = "";
        expect(optionalEnv("BETTER_AUTH_SECRET", "fallback")).toBe("fallback");
    });
});

describe("validateEnv", () => {
    it("passes when everything is set", () => {
        withAllSet();
        expect(() => validateEnv()).not.toThrow();
    });

    it.each(MANAGED)("fails when %s is missing", key => {
        withAllSet();
        delete process.env[key];
        expect(() => validateEnv()).toThrow(key);
    });

    it("reports every missing variable at once, not just the first", () => {
        withAllSet();
        delete process.env.REDIS_URL;
        delete process.env.IBOSS_SECURITY_KEY;

        let message = "";
        try {
            validateEnv();
        } catch (e) {
            message = (e as Error).message;
        }

        expect(message).toContain("Missing 2 required env var(s)");
        expect(message).toContain("REDIS_URL");
        expect(message).toContain("IBOSS_SECURITY_KEY");
        expect(message).toContain(".env.example");
    });

    it("rejects a BETTER_AUTH_SECRET shorter than 32 characters", () => {
        // Short secrets weaken session-token signing, so this is a real check
        // rather than a style preference.
        withAllSet();
        process.env.BETTER_AUTH_SECRET = "tooshort";
        expect(() => validateEnv()).toThrow(/at least 32 characters/);
    });

    it("accepts a BETTER_AUTH_SECRET of exactly 32 characters", () => {
        withAllSet();
        process.env.BETTER_AUTH_SECRET = "y".repeat(32);
        expect(() => validateEnv()).not.toThrow();
    });

    it("reports missing variables before complaining about the secret length", () => {
        // Otherwise a deploy with several problems only ever surfaces one.
        withAllSet();
        process.env.BETTER_AUTH_SECRET = "short";
        delete process.env.REDIS_URL;
        expect(() => validateEnv()).toThrow(/Missing 1 required env var/);
    });

    it("does not require BETTER_AUTH_URL, which has a default", () => {
        withAllSet();
        delete process.env.BETTER_AUTH_URL;
        expect(() => validateEnv()).not.toThrow();
    });
});
