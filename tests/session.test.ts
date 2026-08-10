import { describe, expect, it } from "vitest";
import {
    extractSessionTokenFromHeaders,
    extractSessionTokenFromRequest,
    SESSION_COOKIE_NAME,
} from "../misc/database/session";

const cookie = (value: string) => `${SESSION_COOKIE_NAME}=${value}`;

describe("extractSessionTokenFromRequest", () => {
    it("reads a bearer token from the Authorization header", () => {
        expect(
            extractSessionTokenFromRequest({
                headers: { authorization: "Bearer abc123" },
            }),
        ).toBe("abc123");
    });

    it("reads the token from the session cookie", () => {
        expect(
            extractSessionTokenFromRequest({
                headers: { cookie: cookie("abc123") },
            }),
        ).toBe("abc123");
    });

    it("prefers the bearer token when both are present", () => {
        expect(
            extractSessionTokenFromRequest({
                headers: {
                    authorization: "Bearer from-header",
                    cookie: cookie("from-cookie"),
                },
            }),
        ).toBe("from-header");
    });

    it("finds the session cookie among other cookies", () => {
        expect(
            extractSessionTokenFromRequest({
                headers: {
                    cookie: `theme=dark; ${cookie("abc123")}; other=1`,
                },
            }),
        ).toBe("abc123");
    });

    it("preserves '=' inside the token value", () => {
        // Regression guard: `split("=")[1]` truncates base64 padding.
        expect(
            extractSessionTokenFromRequest({
                headers: { cookie: cookie("YWJjMTIz==") },
            }),
        ).toBe("YWJjMTIz==");
    });

    it("returns undefined when no token is present", () => {
        expect(extractSessionTokenFromRequest({ headers: {} })).toBeUndefined();
        expect(
            extractSessionTokenFromRequest({
                headers: { cookie: "theme=dark" },
            }),
        ).toBeUndefined();
    });

    it("treats an empty bearer or empty cookie value as absent", () => {
        expect(
            extractSessionTokenFromRequest({
                headers: { authorization: "Bearer " },
            }),
        ).toBeUndefined();
        expect(
            extractSessionTokenFromRequest({ headers: { cookie: cookie("") } }),
        ).toBeUndefined();
    });

    it("does not match a cookie whose name merely ends with the session name", () => {
        expect(
            extractSessionTokenFromRequest({
                headers: { cookie: `not-${SESSION_COOKIE_NAME}=nope` },
            }),
        ).toBeUndefined();
    });
});

describe("extractSessionTokenFromHeaders", () => {
    it("behaves the same for a Fetch API Headers object", () => {
        expect(
            extractSessionTokenFromHeaders(
                new Headers({ authorization: "Bearer abc123" }),
            ),
        ).toBe("abc123");

        expect(
            extractSessionTokenFromHeaders(
                new Headers({ cookie: cookie("abc123") }),
            ),
        ).toBe("abc123");

        expect(extractSessionTokenFromHeaders(new Headers())).toBeUndefined();
    });
});
