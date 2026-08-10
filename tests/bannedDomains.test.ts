import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * initBannedDomains() fetches a remote blocklist. Stub fetch so the parser and
 * matcher are tested against known input with no network access.
 */
const META = { blocklist: { name: "domains.txt" } };

const BLOCKLIST = [
    "# a comment line",
    "",
    "blocked.example",
    "www.withprefix.example",
    "UPPERCASE.example",
    // hosts-file style: "0.0.0.0 domain". The second field is the domain.
    "0.0.0.0 hostsformat.example",
    "   whitespace.example   ",
].join("\n");

let initBannedDomains: typeof import("../misc/database/bannedDomains").initBannedDomains;
let matchBannedDomain: typeof import("../misc/database/bannedDomains").matchBannedDomain;
let getBannedDomains: typeof import("../misc/database/bannedDomains").getBannedDomains;

beforeAll(async () => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
            if (url.endsWith("meta.json")) {
                return { json: async () => META } as unknown as Response;
            }
            return { text: async () => BLOCKLIST } as unknown as Response;
        }),
    );

    const mod = await import("../misc/database/bannedDomains");
    initBannedDomains = mod.initBannedDomains;
    matchBannedDomain = mod.matchBannedDomain;
    getBannedDomains = mod.getBannedDomains;

    await initBannedDomains();
});

describe("initBannedDomains", () => {
    it("skips comments and blank lines", () => {
        const domains = getBannedDomains();
        expect(domains).not.toContain("# a comment line");
        expect(domains).not.toContain("");
    });

    it("normalizes case and strips a leading www.", () => {
        const domains = getBannedDomains();
        expect(domains).toContain("uppercase.example");
        expect(domains).toContain("withprefix.example");
    });

    it("takes the domain field from hosts-file style lines", () => {
        expect(getBannedDomains()).toContain("hostsformat.example");
    });
});

describe("matchBannedDomain", () => {
    it("matches a banned host and returns the normalized hostname", () => {
        expect(matchBannedDomain("https://blocked.example/some/path")).toBe(
            "blocked.example",
        );
    });

    it("matches regardless of the www. prefix or casing in the input", () => {
        expect(matchBannedDomain("https://www.blocked.example/")).toBe(
            "blocked.example",
        );
        expect(matchBannedDomain("https://BLOCKED.example/")).toBe(
            "blocked.example",
        );
    });

    it("returns null for an allowed host", () => {
        expect(matchBannedDomain("https://example.com/")).toBeNull();
    });

    it("returns null rather than throwing on an unparseable URL", () => {
        expect(matchBannedDomain("not a url")).toBeNull();
        expect(matchBannedDomain("")).toBeNull();
    });

    it("does not match a subdomain of a banned domain", () => {
        // Documents current behaviour: matching is exact-host, not suffix-based,
        // so sub.blocked.example is NOT blocked. If that is wrong for the
        // product, this test is the place to change it deliberately.
        expect(matchBannedDomain("https://sub.blocked.example/")).toBeNull();
    });
});
