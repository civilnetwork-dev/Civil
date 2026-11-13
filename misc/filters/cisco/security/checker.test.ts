import { expect, it, vi } from "vitest";

import { createCiscoSecurityChecker } from "./checker";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("xior", () => ({ default: { create: () => ({ post }) } }));

function answer(type: number, data: number[]): ArrayBuffer {
    const packet = Uint8Array.from([
        0x12,
        0x34,
        0x81,
        0x80,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        type,
        0,
        1,
        0,
        0,
        0,
        60,
        0,
        data.length,
        ...data,
    ]);
    return packet.buffer;
}

it.each([104, 105, 106, 107, 108, 110])(
    "recognizes the documented Umbrella block address ending in %d",
    async suffix => {
        post.mockResolvedValueOnce({ data: answer(1, [146, 112, 61, suffix]) });
        const result =
            await createCiscoSecurityChecker().checkUrl("example.test");
        expect(result._unsafeUnwrap().status).toBe("blocked");
    },
);

it("keeps a Cisco infrastructure address inconclusive", async () => {
    post.mockResolvedValueOnce({ data: answer(1, [146, 112, 255, 155]) });
    const result = await createCiscoSecurityChecker().checkUrl("example.test");
    expect(result._unsafeUnwrap().status).toBe("unknown");
});

it("does not treat a proxy-like alias as evidence of a block", async () => {
    const alias = [5, ...Buffer.from("proxy"), 7, ...Buffer.from("example"), 0];
    post.mockResolvedValueOnce({ data: answer(5, alias) });
    const result = await createCiscoSecurityChecker().checkUrl("example.test");
    expect(result._unsafeUnwrap().status).toBe("unknown");
});

it("caches authenticated verdicts by full URL", async () => {
    const allowed = "https://example.test/lesson";
    const blocked = "https://example.test/games";
    const policyChecker = vi.fn(async (url: string) => ({
        verdict:
            url === allowed
                ? ("POLICY_ALLOW" as const)
                : ("POLICY_BLOCK" as const),
        reason: "Synthetic policy",
    }));
    post.mockResolvedValueOnce({ data: answer(1, [192, 0, 2, 1]) });
    post.mockResolvedValueOnce({ data: answer(1, [192, 0, 2, 1]) });
    const checker = createCiscoSecurityChecker({
        policyIdentity: {
            organizationId: "audit",
            deviceId: "audit-device",
            accessToken: "synthetic",
        },
        policyChecker,
    });

    expect((await checker.checkUrl(allowed))._unsafeUnwrap().status).toBe(
        "allowed",
    );
    expect((await checker.checkUrl(blocked))._unsafeUnwrap().status).toBe(
        "blocked",
    );
    expect((await checker.checkUrl(allowed))._unsafeUnwrap().status).toBe(
        "allowed",
    );
    expect(policyChecker.mock.calls).toEqual([
        [allowed, expect.objectContaining({ organizationId: "audit" })],
        [blocked, expect.objectContaining({ organizationId: "audit" })],
    ]);
});
