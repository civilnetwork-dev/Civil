import { describe, expect, it } from "vitest";

import genProxyPath from "../misc/config/shared/genProxyPath";

/**
 * These build the URL prefixes the service worker registers its scope against.
 * A stray or missing slash produces a scope that doesn't match the requests it
 * is supposed to intercept, and the symptom is "the proxy does nothing" with no
 * error anywhere.
 */

describe("genProxyPath", () => {
    it("builds a slash-delimited prefix", () => {
        expect(genProxyPath("/", "scramjet")).toBe("/scramjet/");
    });

    it("strips exactly one trailing slash from the base", () => {
        expect(genProxyPath("/app/", "uv")).toBe("/app/uv/");
        expect(genProxyPath("/app", "uv")).toBe("/app/uv/");
    });

    it("treats an empty base as root", () => {
        expect(genProxyPath("", "uv")).toBe("/uv/");
    });

    it("treats a missing base as root", () => {
        expect(genProxyPath(undefined, "uv")).toBe("/uv/");
    });

    it("always ends with a slash so it can be used as a scope", () => {
        for (const base of [undefined, "", "/", "/app", "/app/", "/a/b/"]) {
            expect(genProxyPath(base, "scramjet").endsWith("/")).toBe(true);
        }
    });

    it("always starts with a slash", () => {
        for (const base of [undefined, "", "/", "/app", "/app/"]) {
            expect(genProxyPath(base, "scramjet").startsWith("/")).toBe(true);
        }
    });

    it("never emits a doubled slash", () => {
        for (const base of [undefined, "", "/", "/app", "/app/", "/a/b/"]) {
            expect(genProxyPath(base, "scramjet")).not.toMatch(/\/\//);
        }
    });

    it("produces distinct prefixes per engine", () => {
        expect(genProxyPath("/", "scramjet")).not.toBe(genProxyPath("/", "uv"));
    });

    /**
     * Documented sharp edge: `proxy` is typed optional but interpolated
     * unconditionally, so omitting it yields the string "undefined" in the path
     * rather than throwing or returning the base. Callers must always pass one.
     */
    it("stringifies a missing proxy name rather than failing", () => {
        expect(genProxyPath("/", undefined)).toBe("/undefined/");
    });
});
