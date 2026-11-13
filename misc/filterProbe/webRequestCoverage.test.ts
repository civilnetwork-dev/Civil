import { join } from "node:path";

import { expect, it } from "vitest";

import { detectFlagging } from "./detect";
import { observeRoute } from "./sandbox";

const EXTENSION = join(import.meta.dirname, "fixtures", "web-request-coverage");

const REQUEST_CASES = [
    ["/covered", true, undefined],
    ["/anyType", true, undefined],
    ["/other", false, undefined],
    ["/images", false, undefined],
    ["/anotherTab", false, undefined],
    ["/anotherWindow", false, undefined],
    ["/removed", false, undefined],
    ["/nonblocking", false, undefined],
    ["/async", false, undefined],
    ["/late", false, undefined],
    [
        "/throws",
        false,
        "Filter request listener failed: Error: Request policy failure",
    ],
    [
        "/promise",
        false,
        "Asynchronous blocking request timing requires a managed browser",
    ],
    [
        "/reject",
        false,
        "Filter request listener failed: Error: Rejected policy",
    ],
    ["/redirect", true, undefined],
    [
        "/conflict",
        false,
        "Conflicting request redirects require browser arbitration",
    ],
] as const;

it.each(REQUEST_CASES)(
    "replays declared main-frame request policy for %s",
    async (route, blocked, incomplete) => {
        const observation = await observeRoute({
            extensionDir: EXTENSION,
            baseUrl: "https://probe.invalid",
            route,
            waitMs: 5,
            fetchImpl: (async () =>
                new Response(
                    "<body>Civil page</body>",
                )) as unknown as typeof fetch,
        });
        expect(observation.unreplayedBlockingRequest).toBe(false);
        const verdict = detectFlagging(observation, "goguardian");
        expect(verdict.flagged).toBe(blocked);
        expect(verdict.inconclusive).toBe(incomplete);
    },
);

it("skips a blocking listener outside declared host permissions", async () => {
    const observation = await observeRoute({
        extensionDir: EXTENSION,
        baseUrl: "https://outside.invalid",
        route: "/covered",
        waitMs: 0,
        fetchImpl: (async () =>
            new Response("<body>Civil page</body>")) as unknown as typeof fetch,
    });
    expect(observation.backgroundError).toBeUndefined();
    expect(observation.unreplayedBlockingRequest).toBe(false);
});

it("keeps independent block evidence when webRequest was not replayed", () => {
    const verdict = detectFlagging(
        {
            route: "/covered",
            finalUrl: "https://probe.invalid/covered",
            pageText: "Civil page",
            originalLength: 10,
            unreplayedBlockingRequest: true,
            dnrMatch: { action: "block", matchedRuleId: 5 },
        },
        "goguardian",
    );
    expect(verdict.signal).toEqual({ kind: "dnr-block", matchedRuleId: 5 });
    expect(verdict.inconclusive).toBeUndefined();
});
