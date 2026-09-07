import { describe, expect, it } from "vitest";

import {
    FILTER_CONFIGS,
    findFilterConfig,
    formatRetryAfter,
    prettifyFilterName,
} from "./filterCheckVendors";

/**
 * This table is what breaks when a vendor changes its API, so the tests pin its
 * shape rather than any single vendor's values. An alias collision in particular
 * is silent: two vendors claiming the same alias means one of them can never be
 * found, and nothing anywhere would throw.
 */

describe("FILTER_CONFIGS", () => {
    it("gives every vendor an endpoint under /filterCheck", () => {
        for (const [key, config] of Object.entries(FILTER_CONFIGS)) {
            expect(config.endpoint, key).toMatch(/^\/filterCheck\//);
        }
    });

    it("gives every vendor a display name and at least one alias", () => {
        for (const [key, config] of Object.entries(FILTER_CONFIGS)) {
            expect(config.name, key).toBeTruthy();
            expect(config.aliases.length, key).toBeGreaterThan(0);
        }
    });

    it("never reuses an alias across vendors", () => {
        const seen = new Map<string, string>();
        for (const [key, config] of Object.entries(FILTER_CONFIGS)) {
            for (const alias of config.aliases) {
                expect(
                    seen.has(alias),
                    `${alias} claimed by both ${seen.get(alias)} and ${key}`,
                ).toBe(false);
                seen.set(alias, key);
            }
        }
    });

    it("exposes buildPayload and parseResult as functions on every vendor", () => {
        for (const [key, config] of Object.entries(FILTER_CONFIGS)) {
            expect(typeof config.buildPayload, key).toBe("function");
            expect(typeof config.parseResult, key).toBe("function");
        }
    });
});

describe("findFilterConfig", () => {
    it("finds a vendor by its own key", () => {
        const found = findFilterConfig("securly");
        expect(found?.[0]).toBe("securly");
    });

    it("is case-insensitive", () => {
        expect(findFilterConfig("SECURLY")?.[0]).toBe("securly");
    });

    it("finds a vendor by any of its aliases", () => {
        for (const [key, config] of Object.entries(FILTER_CONFIGS)) {
            for (const alias of config.aliases) {
                expect(findFilterConfig(alias)?.[0], alias).toBe(key);
            }
        }
    });

    it("returns null for an unknown vendor", () => {
        expect(findFilterConfig("definitely-not-a-filter")).toBeNull();
    });

    /**
     * The real contract, and it is not "look up by key". Matching is
     * `input.includes(alias)`, and callers only ever pass names produced by
     * extension detection (`misc/config/service/filterDetect.ts`) — never a
     * FILTER_CONFIGS key. `findFilterConfig("lightspeed")` returns null, which
     * looks alarming and is fine: nothing asks that question.
     */
    it("resolves the detection names the service worker actually emits", () => {
        expect(findFilterConfig("lightspeedFilterAgent")?.[0]).toBe(
            "lightspeed",
        );
        expect(findFilterConfig("securlyExtension")?.[0]).toBe("securly");
    });

    /**
     * Substring matching means a shorter alias swallows a longer one. Today no
     * vendor's alias contains another's, so lookups are unambiguous — if that
     * ever changes, one vendor becomes permanently unreachable and nothing
     * throws.
     */
    it("keeps aliases free of substring collisions across vendors", () => {
        const all = Object.entries(FILTER_CONFIGS).flatMap(([key, c]) =>
            c.aliases.map(a => [key, a] as const),
        );
        for (const [keyA, aliasA] of all) {
            for (const [keyB, aliasB] of all) {
                if (keyA === keyB) continue;
                expect(
                    aliasA.includes(aliasB),
                    `${keyA}'s "${aliasA}" contains ${keyB}'s "${aliasB}"`,
                ).toBe(false);
            }
        }
    });
});

describe("prettifyFilterName", () => {
    it("returns a non-empty label for every configured vendor", () => {
        for (const key of Object.keys(FILTER_CONFIGS)) {
            expect(prettifyFilterName(key).length, key).toBeGreaterThan(0);
        }
    });
});

describe("formatRetryAfter", () => {
    /**
     * The values are the ones production actually produced: PostHog's
     * `filter_rate_limited` events carry retryAfterSeconds of 477, 3829, 11766,
     * 28511 and 86372. Each has to come out as something a person can act on.
     */
    it("humanises the retry windows production emits", () => {
        expect(formatRetryAfter(30)).toBe("in 30s");
        expect(formatRetryAfter(477)).toBe("in about 8 min");
        expect(formatRetryAfter(3829)).toBe("in about 1 hour");
        expect(formatRetryAfter(86372)).toBe("in about 24 hours");
    });

    it("never renders a negative or absent window as a duration", () => {
        expect(formatRetryAfter(0)).toBe("in a moment");
        expect(formatRetryAfter(-5)).toBe("in a moment");
        expect(formatRetryAfter(Number.NaN)).toBe("in a moment");
    });
});
