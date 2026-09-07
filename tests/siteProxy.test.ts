import { describe, expect, it } from "vitest";

import { normalizeHostname } from "../misc/database/models/siteProxy";

describe("normalizeHostname", () => {
    it("extracts the hostname from a full URL", () => {
        expect(normalizeHostname("https://example.com/path?q=1")).toBe(
            "example.com",
        );
    });

    it("adds a scheme when one is missing", () => {
        expect(normalizeHostname("example.com")).toBe("example.com");
        expect(normalizeHostname("example.com/path")).toBe("example.com");
    });

    it("lowercases the hostname", () => {
        expect(normalizeHostname("https://EXAMPLE.COM/")).toBe("example.com");
    });

    it("strips a leading www.", () => {
        expect(normalizeHostname("https://www.example.com/")).toBe(
            "example.com",
        );
        expect(normalizeHostname("www.example.com")).toBe("example.com");
    });

    it("keeps non-www subdomains", () => {
        expect(normalizeHostname("https://api.example.com/")).toBe(
            "api.example.com",
        );
        // Only a leading "www." is stripped, not one in the middle.
        expect(normalizeHostname("https://a.www.example.com/")).toBe(
            "a.www.example.com",
        );
    });

    it("trims surrounding whitespace", () => {
        expect(normalizeHostname("  https://example.com/  ")).toBe(
            "example.com",
        );
    });

    it("drops the port", () => {
        expect(normalizeHostname("https://example.com:8443/")).toBe(
            "example.com",
        );
    });

    it("preserves non-https schemes it is given", () => {
        expect(normalizeHostname("http://example.com/")).toBe("example.com");
    });

    it("returns null for empty or unparseable input", () => {
        expect(normalizeHostname("")).toBeNull();
        expect(normalizeHostname("   ")).toBeNull();
        expect(normalizeHostname("http://")).toBeNull();
    });
});
