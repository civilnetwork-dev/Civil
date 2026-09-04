import { describe, expect, it } from "vitest";
import { compileUrlFilter } from "./declarativeNetRequest";

describe("compileUrlFilter", () => {
    it("|| anchors to a domain-label boundary, not just any substring", () => {
        const re = compileUrlFilter("||example.com", false);
        expect(re.test("https://example.com/")).toBe(true);
        expect(re.test("https://www.example.com/")).toBe(true);
        expect(re.test("https://sub.example.com/path")).toBe(true);
        // The real bug this anchor exists to avoid: a naive substring match
        // would also block "notexample.com" and "example.com.evil.test".
        expect(re.test("https://notexample.com/")).toBe(false);
    });

    it("| anchors to the exact start or end of the URL", () => {
        const start = compileUrlFilter("|https://exact.example", false);
        expect(start.test("https://exact.example/x")).toBe(true);
        expect(start.test("http://x/https://exact.example")).toBe(false);

        const end = compileUrlFilter("tracker.js|", false);
        expect(end.test("https://cdn.example/tracker.js")).toBe(true);
        expect(end.test("https://cdn.example/tracker.js.map")).toBe(false);
    });

    it("* matches any run of characters including zero", () => {
        const re = compileUrlFilter("||ads.example/*/click", false);
        expect(re.test("https://ads.example/a/b/click")).toBe(true);
        expect(re.test("https://ads.example//click")).toBe(true);
        expect(re.test("https://ads.example/click")).toBe(false);
    });

    it("^ matches a separator character or end of URL, never a bare letter", () => {
        const re = compileUrlFilter("||example.com^", false);
        expect(re.test("https://example.com/")).toBe(true);
        expect(re.test("https://example.com:8080/")).toBe(true);
        expect(re.test("https://example.com")).toBe(true); // ^ matches end-of-URL too
        expect(re.test("https://example.comics.test/")).toBe(false);
    });

    it("is case-insensitive by default, matching isUrlFilterCaseSensitive's documented false default", () => {
        const re = compileUrlFilter("||Example.com", false);
        expect(re.test("https://EXAMPLE.COM/")).toBe(true);
    });

    it("respects an explicit case-sensitive request", () => {
        const re = compileUrlFilter("||Example.com", true);
        expect(re.test("https://Example.com/")).toBe(true);
        expect(re.test("https://example.com/")).toBe(false);
    });

    it("escapes regex metacharacters in the literal parts of the pattern", () => {
        // A dot in a urlFilter is literal, not "any character" — a common
        // regex-injection-shaped bug if the compiler forgets to escape it.
        const re = compileUrlFilter("||example.com/a.b", false);
        expect(re.test("https://example.com/a.b")).toBe(true);
        expect(re.test("https://example.com/aXb")).toBe(false);
    });
});
