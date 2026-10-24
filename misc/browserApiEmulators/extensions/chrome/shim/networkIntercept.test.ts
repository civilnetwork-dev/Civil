/**
 * How the shim evaluates an extension's declarativeNetRequest rules against
 * a page's fetch or XHR: highest priority first, the first block, allow or
 * redirect decides, and header changes pile up until something does.
 */

import { describe, expect, it } from "vitest";

import type { DNRRule } from "../types";
import { applyDnrRules } from "./networkIntercept";

const URL_ = "http://sub.example.com/api/data?x=1";

function rule(
    id: number,
    action: DNRRule["action"],
    condition: DNRRule["condition"] = { urlFilter: "||example.com" },
    priority?: number,
): DNRRule {
    return { id, action, condition, priority };
}

function run(rules: DNRRule[], url = URL_, method = "GET", headers = []) {
    return applyDnrRules(url, method, headers, rules);
}

describe("applyDnrRules", () => {
    it("lets the highest priority matching rule decide", () => {
        const rules = [
            rule(1, { type: "block" }, undefined, 1),
            rule(2, { type: "allow" }, undefined, 5),
        ];
        expect(run(rules).blocked).toBe(false);
        expect(run([rule(1, { type: "block" })]).blocked).toBe(true);
    });

    it("skips rules whose condition does not cover the request", () => {
        const block = { type: "block" };
        expect(
            run([rule(1, block, { resourceTypes: ["image"] })]).blocked,
        ).toBe(false);
        expect(
            run([rule(1, block, { excludedResourceTypes: ["xmlhttprequest"] })])
                .blocked,
        ).toBe(false);
        expect(
            run([rule(1, block, { requestMethods: ["post"] })]).blocked,
        ).toBe(false);
        expect(run([rule(1, block)], "https://example.org/").blocked).toBe(
            false,
        );
    });

    it("reads urlFilter wildcards the way Chrome does", () => {
        const blocks = (urlFilter: string, url: string) =>
            run([rule(1, { type: "block" }, { urlFilter })], url).blocked;
        // ^ is a separator or the end of the URL, never part of a hostname.
        expect(blocks("||example.com^", "https://sub.example.com/x")).toBe(
            true,
        );
        expect(blocks("||example.com^", "https://example.com")).toBe(true);
        expect(blocks("||example.com^", "https://example.community/")).toBe(
            false,
        );
        // * is any run of characters, not a regex quantifier.
        expect(blocks("/ads/*.js|", "https://a.test/ads/banner.js")).toBe(true);
        expect(blocks("/ads/*.js|", "https://a.test/ads/banner.json")).toBe(
            false,
        );
        // | inside a filter is a literal character.
        expect(blocks("a|b", "https://a.test/?q=a|b")).toBe(true);
        expect(blocks("a|b", "https://b.test/")).toBe(false);
    });

    it("redirects to a fixed URL or a transformed one", () => {
        expect(
            run([
                rule(1, {
                    type: "redirect",
                    redirect: { url: "https://x.test/" },
                }),
            ]).redirectUrl,
        ).toBe("https://x.test/");
        expect(
            run([
                rule(1, {
                    type: "redirect",
                    redirect: {
                        transform: {
                            scheme: "https",
                            host: "y.test",
                            path: "/p",
                        },
                    },
                }),
            ]).redirectUrl,
        ).toBe("https://y.test/p?x=1");
    });

    it("moves on past a redirect that names no target", () => {
        const result = run([
            rule(1, { type: "redirect", redirect: {} }, undefined, 2),
            rule(2, { type: "block" }, undefined, 1),
        ]);
        expect(result.blocked).toBe(true);
        expect(result.redirectUrl).toBeUndefined();
    });

    it("fills DNR capture references in a regexSubstitution", () => {
        const result = run([
            rule(
                1,
                {
                    type: "redirect",
                    redirect: { regexSubstitution: "https://mirror.test/\\1" },
                },
                { regexFilter: "^http://sub\\.example\\.com/(.*)$" },
            ),
        ]);
        expect(result.redirectUrl).toBe("https://mirror.test/api/data?x=1");
    });

    it("upgrades http to https and leaves https alone", () => {
        const upgrade = [rule(1, { type: "upgradeScheme" })];
        expect(run(upgrade).redirectUrl).toBe(
            "https://sub.example.com/api/data?x=1",
        );
        expect(
            run(upgrade, "https://sub.example.com/").redirectUrl,
        ).toBeUndefined();
    });

    it("accumulates header changes until a later rule decides", () => {
        const input = [
            { name: "X-Keep", value: "1" },
            { name: "x-set", value: "old" },
            { name: "Cookie", value: "c" },
        ];
        const result = applyDnrRules(URL_, "GET", input, [
            rule(
                1,
                {
                    type: "modifyHeaders",
                    requestHeaders: [
                        { header: "X-Set", operation: "set", value: "new" },
                        { header: "cookie", operation: "remove" },
                    ],
                },
                undefined,
                3,
            ),
            rule(
                2,
                {
                    type: "modifyHeaders",
                    requestHeaders: [
                        { header: "X-Added", operation: "append", value: "a" },
                    ],
                },
                undefined,
                2,
            ),
            rule(3, { type: "block" }, undefined, 1),
        ]);
        expect(result.blocked).toBe(true);
        expect(result.requestHeaders).toEqual([
            { name: "X-Keep", value: "1" },
            { name: "X-Set", value: "new" },
            { name: "X-Added", value: "a" },
        ]);
        expect(input).toHaveLength(3);
    });
});
