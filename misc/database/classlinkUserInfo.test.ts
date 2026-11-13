import { afterEach, expect, it, vi } from "vitest";

import {
    completeFlow,
    createClassLinkTestAuth,
    mockClassLink,
    startFlow,
    userInfoEndpoint,
} from "./classlink.testHelpers";

const validProfile = {
    sub: "student-subject",
    email: "profile@school.example",
    email_verified: true,
    name: "Profile Student",
    picture: "https://profile.classlink.example/avatar.png",
};
const invalidProfiles = [
    ["subject mismatch", { ...validProfile, sub: "someone-else" }],
    ["missing subject", { ...validProfile, sub: undefined }],
    ["numeric subject", { ...validProfile, sub: 123 }],
    ["missing email", { ...validProfile, email: undefined }],
    ["invalid email", { ...validProfile, email: "broken" }],
    ["untyped verification", { ...validProfile, email_verified: "true" }],
    ["null response", null],
    ["array response", [validProfile]],
] as const;
const unsafeEndpoints = [
    undefined,
    "http://profile.classlink.example/userinfo",
    "/userinfo",
    "https://user:pass@profile.classlink.example/userinfo",
];

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

async function profileFlow() {
    const mocked = mockClassLink();
    mocked.state.claims = {
        email: undefined,
        email_verified: undefined,
        name: undefined,
    };
    mocked.state.userInfo = validProfile;
    const harness = createClassLinkTestAuth();
    const flow = await startFlow(harness.auth);
    mocked.state.nonce = flow.authorization.searchParams.get("nonce")!;
    return { ...mocked, ...harness, flow };
}

it("supplements a verified subject-only ID token with discovered, subject-bound UserInfo", async () => {
    const { auth, flow, database, fetch } = await profileFlow();
    expect((await completeFlow(auth, flow)).headers.get("location")).toBe(
        "/settings",
    );
    expect(database.user[0]).toMatchObject({
        email: validProfile.email,
        emailVerified: true,
        name: validProfile.name,
    });
    expect(database.account[0].accountId).toBe(
        '["https://classlink.example","student-subject"]',
    );
    const request = fetch.mock.calls.find(
        ([url]) => String(url) === userInfoEndpoint,
    )!;
    expect(new Headers(request[1]?.headers).get("authorization")).toBe(
        "Bearer access",
    );
    expect(request[1]?.redirect).toBe("error");
    expect(request[1]?.signal).toBeInstanceOf(AbortSignal);
});

it.each([false, undefined])(
    "does not assume UserInfo email verification from %j",
    async verified => {
        const { auth, flow, database, state } = await profileFlow();
        state.userInfo = { ...validProfile, email_verified: verified };
        expect((await completeFlow(auth, flow)).headers.get("location")).toBe(
            "/settings",
        );
        expect(database.user[0].emailVerified).toBe(false);
    },
);

it.each(invalidProfiles)("rejects UserInfo %s", async (_, profile) => {
    const { auth, flow, database, state } = await profileFlow();
    state.userInfo = profile;
    expect((await completeFlow(auth, flow)).headers.get("location")).toContain(
        "error=",
    );
    expect(database.account).toHaveLength(0);
    expect(database.session).toHaveLength(0);
});

it.each(["non-json", "error", "network-error"] as const)(
    "rejects UserInfo %s responses",
    async mode => {
        const { auth, flow, database, state } = await profileFlow();
        state.userInfoMode = mode;
        expect(
            (await completeFlow(auth, flow)).headers.get("location"),
        ).toContain("error=");
        expect(database.account).toHaveLength(0);
    },
);

it.each(unsafeEndpoints)(
    "refuses an absent or unsafe discovered UserInfo endpoint %j",
    async endpoint => {
        const { auth, flow, database, state, fetch } = await profileFlow();
        state.discovery.userinfo_endpoint = endpoint;
        expect(
            (await completeFlow(auth, flow)).headers.get("location"),
        ).toContain("error=");
        expect(
            fetch.mock.calls.some(
                ([url]) => new URL(String(url)).pathname === "/userinfo",
            ),
        ).toBe(false);
        expect(database.account).toHaveLength(0);
    },
);

it("does not send credentials if an access token is missing", async () => {
    const { auth, flow, database, state, fetch } = await profileFlow();
    state.missingAccessToken = true;
    expect((await completeFlow(auth, flow)).headers.get("location")).toContain(
        "error=",
    );
    expect(
        fetch.mock.calls.some(([url]) => String(url) === userInfoEndpoint),
    ).toBe(false);
    expect(database.account).toHaveLength(0);
});

it.each(["badSignature", "missingToken"] as const)(
    "never uses UserInfo to replace %s ID-token verification",
    async condition => {
        const { auth, flow, database, state, fetch } = await profileFlow();
        state[condition] = true;
        expect(
            (await completeFlow(auth, flow)).headers.get("location"),
        ).toContain("error=");
        expect(
            fetch.mock.calls.some(([url]) => String(url) === userInfoEndpoint),
        ).toBe(false);
        expect(database.account).toHaveLength(0);
    },
);

it("rejects a changed discovery issuer before sending its endpoint credentials", async () => {
    const { auth, flow, database, state, fetch } = await profileFlow();
    state.discovery.issuer = "https://different.example";
    expect((await completeFlow(auth, flow)).headers.get("location")).toContain(
        "error=",
    );
    expect(
        fetch.mock.calls.some(([url]) => String(url) === userInfoEndpoint),
    ).toBe(false);
    expect(database.account).toHaveLength(0);
});

it("does not fetch UserInfo when signed claims already supply a valid email", async () => {
    const { state, fetch } = mockClassLink();
    const { auth } = createClassLinkTestAuth();
    const flow = await startFlow(auth);
    state.nonce = flow.authorization.searchParams.get("nonce")!;
    expect((await completeFlow(auth, flow)).headers.get("location")).toBe(
        "/settings",
    );
    expect(
        fetch.mock.calls.some(([url]) => String(url) === userInfoEndpoint),
    ).toBe(false);
    expect(
        fetch.mock.calls.filter(([url]) => String(url).includes(".well-known")),
    ).toHaveLength(1);
});

it("rejects UserInfo after the bounded request is aborted", async () => {
    const { auth, flow, database, state, fetch } = await profileFlow();
    const controller = new AbortController();
    const timeout = vi
        .spyOn(AbortSignal, "timeout")
        .mockReturnValue(controller.signal);
    state.userInfoMode = "timeout";
    const pending = completeFlow(auth, flow);
    await vi.waitFor(() =>
        expect(
            fetch.mock.calls.some(([url]) => String(url) === userInfoEndpoint),
        ).toBe(true),
    );
    expect(timeout).toHaveBeenCalledWith(5_000);
    controller.abort(new DOMException("request timeout", "TimeoutError"));
    expect((await pending).headers.get("location")).toContain("error=");
    expect(database.account).toHaveLength(0);
});
