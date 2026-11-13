import { describe, expect, it, vi } from "vitest";

import { getClassLinkConfig, validateEnv } from "../env";
import { classLinkAvailable, classLinkProvider } from "./classlink";

const configured = {
    CLASSLINK_ISSUER: "https://idp.example",
    CLASSLINK_CLIENT_ID: "client",
    CLASSLINK_CLIENT_SECRET: "secret",
    BETTER_AUTH_URL: "https://civil.example",
    NODE_ENV: "production",
};
const config = getClassLinkConfig(configured)!;
const invalidConfig = [
    ["partial credentials", { CLASSLINK_CLIENT_SECRET: "" }],
    ["missing canonical origin", { BETTER_AUTH_URL: "" }],
    ["HTTP production origin", { BETTER_AUTH_URL: "http://localhost:9876" }],
    ["HTTP issuer", { CLASSLINK_ISSUER: "http://idp.example" }],
    ["invalid issuer", { CLASSLINK_ISSUER: "broken" }],
    ["origin with path", { BETTER_AUTH_URL: "https://civil.example/auth" }],
    ["URL credentials", { BETTER_AUTH_URL: "https://user:pass@civil.example" }],
    ["URL query", { CLASSLINK_ISSUER: "https://idp.example?key=value" }],
] as const;
const invalidClaims = [
    { sub: undefined },
    { sub: "" },
    { sub: " " },
    { sub: 123 },
    { email: undefined },
    { email: "bad" },
    { iss: "https://another.example" },
];

function token(claims: Record<string, unknown>) {
    return `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
}

async function profile(overrides: Record<string, unknown> = {}) {
    return classLinkProvider(config).getUserInfo!({
        idToken: token({
            iss: config.issuer,
            sub: "subject",
            email: "student@school.example",
            ...overrides,
        }),
    });
}

describe("ClassLink configuration", () => {
    it("fails server startup for incomplete ClassLink configuration", () => {
        vi.stubEnv("CLASSLINK_ISSUER", "https://idp.example");
        vi.stubEnv("CLASSLINK_CLIENT_ID", "");
        vi.stubEnv("CLASSLINK_CLIENT_SECRET", "");
        try {
            expect(() => validateEnv()).toThrow(
                "ClassLink requires all configuration variables",
            );
        } finally {
            vi.unstubAllEnvs();
        }
    });
    it("stays disabled when credentials are absent or empty", () => {
        expect(getClassLinkConfig({})).toBeNull();
        expect(
            getClassLinkConfig({
                CLASSLINK_ISSUER: "",
                CLASSLINK_CLIENT_ID: "",
            }),
        ).toBeNull();
    });
    it.each(invalidConfig)("rejects %s", (_, override) => {
        expect(() =>
            getClassLinkConfig({ ...configured, ...override }),
        ).toThrow();
    });
    it("allows HTTP localhost only during development", () => {
        expect(
            getClassLinkConfig({
                ...configured,
                NODE_ENV: "development",
                BETTER_AUTH_URL: "http://localhost:9876",
            })?.authOrigin,
        ).toBe("http://localhost:9876");
    });
});

describe("ClassLink capability", () => {
    it("requires configuration and the canonical origin", () => {
        const request = new Request("https://civil.example/api/authProviders");
        expect(classLinkAvailable(null, request)).toBe(false);
        expect(classLinkAvailable(config, request)).toBe(true);
        expect(
            classLinkAvailable(
                config,
                new Request("https://mirror.example/api/authProviders"),
            ),
        ).toBe(false);
        expect(
            classLinkAvailable(
                config,
                new Request(request, {
                    headers: { origin: "https://evil.example" },
                }),
            ),
        ).toBe(false);
    });
});

describe("ClassLink claim mapping after library verification", () => {
    it.each(invalidClaims)(
        "rejects incomplete or mismatched claims %j",
        async claims => {
            expect(await profile(claims)).toBeNull();
        },
    );
    it.each([undefined, false, "true", 1])(
        "never assumes verified email from %j",
        async verified => {
            expect(await profile({ email_verified: verified })).toMatchObject({
                emailVerified: false,
            });
        },
    );
    it("accepts only a true email verification claim", async () => {
        expect(await profile({ email_verified: true })).toMatchObject({
            emailVerified: true,
        });
        expect(await classLinkProvider(config).getUserInfo!({})).toBeNull();
    });
    it("keys the account by issuer and subject", async () => {
        const provider = classLinkProvider(config);
        expect(
            await provider.accountSubject!({
                tokens: {},
                profile: { sub: "stable-id", emailVerified: false },
            }),
        ).toBe('["https://idp.example","stable-id"]');
    });
});
