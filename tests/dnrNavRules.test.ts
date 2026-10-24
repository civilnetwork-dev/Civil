/**
 * Navigation-redirect rules the service worker applies to main-frame requests.
 * These pin the declarativeNetRequest semantics the service worker relied on
 * when the matching lived inline in sw.ts: filters test the raw URL string,
 * a regexFilter wins over a urlFilter, and DNR's `\1` substitutions become
 * JavaScript's `$1`.
 */

import {
    navConditionMatches,
    navRedirectTarget,
} from "$config/shared/dnrNavMatch";
import { type DnrNavRule, isNavRedirectRule } from "$config/shared/dnrNavRules";
import { describe, expect, it } from "vitest";

function matches(cond: DnrNavRule["condition"], rawUrl: string): boolean {
    return navConditionMatches(cond, new URL(rawUrl), rawUrl);
}

describe("isNavRedirectRule", () => {
    it("keeps redirects that can apply to a top-level or frame navigation", () => {
        expect(isNavRedirectRule({ action: { type: "redirect" } })).toBe(true);
        expect(
            isNavRedirectRule({
                action: { type: "redirect" },
                condition: { resourceTypes: ["sub_frame"] },
            }),
        ).toBe(true);
    });

    it("drops other actions and redirects scoped to subresources", () => {
        expect(isNavRedirectRule({ action: { type: "block" } })).toBe(false);
        expect(
            isNavRedirectRule({
                action: { type: "redirect" },
                condition: { resourceTypes: ["script"] },
            }),
        ).toBe(false);
    });
});

describe("navConditionMatches", () => {
    it("needs a URL filter to match at all", () => {
        expect(matches(undefined, "https://example.com/")).toBe(false);
        expect(matches({}, "https://example.com/")).toBe(false);
    });

    it("treats urlFilter as a case-insensitive glob with literal metacharacters", () => {
        const cond = { urlFilter: "*.user.js" };
        expect(matches(cond, "https://greasyfork.org/x/A.USER.JS")).toBe(true);
        expect(matches(cond, "https://example.com/app.js")).toBe(false);
        expect(matches({ urlFilter: "a.b" }, "https://axb.test/")).toBe(false);
    });

    it("prefers regexFilter, even one that does not compile", () => {
        expect(
            matches(
                { regexFilter: "^https://example\\.com/" },
                "https://EXAMPLE.com/x",
            ),
        ).toBe(true);
        expect(
            matches(
                { regexFilter: "(", urlFilter: "*" },
                "https://example.com/",
            ),
        ).toBe(false);
    });

    it("tests the URL as written, not its normalized form", () => {
        // new URL() would append the trailing slash.
        expect(matches({ regexFilter: "\\.com$" }, "https://example.com")).toBe(
            true,
        );
    });

    it("applies the resource type, method and domain conditions", () => {
        const url = "https://sub.example.com/a.user.js";
        const base = { urlFilter: "*.user.js" };
        expect(matches({ ...base, resourceTypes: ["sub_frame"] }, url)).toBe(
            false,
        );
        expect(matches({ ...base, resourceTypes: ["main_frame"] }, url)).toBe(
            true,
        );
        expect(matches({ ...base, requestMethods: ["POST"] }, url)).toBe(false);
        expect(matches({ ...base, requestMethods: ["get"] }, url)).toBe(true);
        expect(matches({ ...base, requestDomains: ["example.com"] }, url)).toBe(
            true,
        );
        expect(
            matches({ ...base, requestDomains: ["notexample.com"] }, url),
        ).toBe(false);
        expect(
            matches({ ...base, excludedRequestDomains: ["example.com"] }, url),
        ).toBe(false);
    });
});

describe("navRedirectTarget", () => {
    const origin = "https://civil.test";
    const userScript = "https://example.com/scripts/foo.user.js";

    it("returns an absolute redirect URL as given", () => {
        expect(
            navRedirectTarget(
                { action: { redirect: { url: "https://elsewhere.test/" } } },
                "ext",
                userScript,
                origin,
            ),
        ).toBe("https://elsewhere.test/");
    });

    it("converts DNR capture references to JavaScript ones", () => {
        const rule: DnrNavRule = {
            condition: {
                regexFilter: "^https://example\\.com/scripts/(.*)\\.user\\.js$",
            },
            action: {
                redirect: {
                    regexSubstitution: "https://install.test/?s=\\1&all=\\0",
                },
            },
        };
        expect(navRedirectTarget(rule, "ext", userScript, origin)).toBe(
            `https://install.test/?s=foo&all=${userScript}`,
        );
    });

    it("returns null when the substitution regex does not compile", () => {
        const rule: DnrNavRule = {
            condition: { regexFilter: "(" },
            action: { redirect: { regexSubstitution: "\\1" } },
        };
        expect(navRedirectTarget(rule, "ext", userScript, origin)).toBeNull();
    });

    it("resolves an extension path under /civil-ext/ with its placeholders filled", () => {
        const rule: DnrNavRule = {
            action: {
                redirect: {
                    extensionPath: "/confirm.html?u=[[URL]]&s=%SPEC_URL%",
                },
            },
        };
        const encoded = encodeURIComponent(userScript);
        expect(navRedirectTarget(rule, "ext1", userScript, origin)).toBe(
            `${origin}/civil-ext/ext1/confirm.html?u=${encoded}&s=${encoded}`,
        );
    });

    it("returns null for a redirect that names no target", () => {
        expect(
            navRedirectTarget(
                { action: { type: "redirect" } },
                "ext",
                userScript,
                origin,
            ),
        ).toBeNull();
    });
});
