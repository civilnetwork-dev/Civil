import { describe, expect, it, vi } from "vitest";
import xior from "xior";

import { createFortiGuardChecker } from "./checker";

const TARGET = "https://example.test/path?q=long#section";
const RETRY_RESPONSES = [
    { httpStatus: 414, body: {} },
    { httpStatus: 200, body: { status: 2 } },
    { httpStatus: 200, body: { status: 3 } },
];

function checkerWithResponses(...responses: Response[]) {
    const fetchRating = vi.fn<typeof fetch>();
    for (const response of responses)
        fetchRating.mockResolvedValueOnce(response);
    const checker = createFortiGuardChecker({
        clientKey: "test-client-key",
        baseUrl: "https://rating.test",
        categoryVersion: "10",
        blockCategories: [59],
        http: xior.create({ fetch: fetchRating }),
    });
    return { checker, fetchRating };
}

function requestedUrls(fetchRating: ReturnType<typeof vi.fn<typeof fetch>>) {
    return fetchRating.mock.calls.map(([url]) =>
        new URL(String(url)).searchParams.get("qurl"),
    );
}

describe("FortiGuard rating requests", () => {
    it.each(RETRY_RESPONSES)(
        "retries HTTP $httpStatus / $body once with the origin",
        async ({ httpStatus, body }) => {
            const { checker, fetchRating } = checkerWithResponses(
                Response.json(body, { status: httpStatus }),
                Response.json({ status: 0, data: [59] }),
            );
            const result = await checker.checkUrl(TARGET);
            expect(result.isOk() && result.value.status).toBe("blocked");
            expect(requestedUrls(fetchRating)).toEqual([
                TARGET,
                "https://example.test/",
            ]);
        },
    );

    it("keeps successful path-specific ratings without retrying", async () => {
        const { checker, fetchRating } = checkerWithResponses(
            Response.json({ status: 0, data: [59] }),
        );
        const result = await checker.checkUrl(TARGET);
        expect(result.isOk() && result.value.status).toBe("blocked");
        expect(requestedUrls(fetchRating)).toEqual([TARGET]);
    });

    it("stops after one retry when the rating service stays unavailable", async () => {
        const { checker, fetchRating } = checkerWithResponses(
            Response.json({ status: 2 }),
            Response.json({ status: 3 }),
        );
        const result = await checker.checkUrl(TARGET);
        expect(result.isErr() && result.error.type).toBe("NETWORK");
        expect(fetchRating).toHaveBeenCalledTimes(2);
    });
});

it("retries a plain-text HTTP 414 once and rejects another HTTP 414", async () => {
    const { checker, fetchRating } = checkerWithResponses(
        new Response("URI Too Long", { status: 414 }),
        Response.json({ status: 0, data: [59] }, { status: 414 }),
    );
    const result = await checker.checkUrl(TARGET);
    expect(result.isErr() && result.error.type).toBe("NETWORK");
    expect(requestedUrls(fetchRating)).toEqual([
        TARGET,
        "https://example.test/",
    ]);
});

it("rejects HTTP errors even when their body looks like a successful rating", async () => {
    const { checker, fetchRating } = checkerWithResponses(
        Response.json({ status: 0, data: [59] }, { status: 503 }),
    );
    const result = await checker.checkUrl(TARGET);
    expect(result.isErr() && result.error.type).toBe("NETWORK");
    expect(fetchRating).toHaveBeenCalledTimes(1);
});
