import { afterEach, expect, it, vi } from "vitest";

import { checkBlocksiUrl } from "./checker";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("xior", () => ({ default: { create: () => ({ get }) } }));

afterEach(() => {
    get.mockReset();
    vi.useRealTimers();
});

it("retries malformed ratings before accepting a numeric category", async () => {
    vi.useFakeTimers();
    get.mockResolvedValueOnce({ data: { Category: false } })
        .mockResolvedValueOnce({ data: { Category: "206" } })
        .mockResolvedValueOnce({ data: { Category: 206 } });
    const verdict = checkBlocksiUrl("https://example.test");
    await vi.runAllTimersAsync();
    expect((await verdict)._unsafeUnwrap().status).toBe("blocked");
    expect(get).toHaveBeenCalledTimes(3);
});

it.each([{}, { Category: -1 }, { data: { Category: 206 } }])(
    "keeps a missing category inconclusive for %j",
    async data => {
        get.mockResolvedValue({ data });
        const result = await checkBlocksiUrl("https://example.test", {
            retries: 1,
        });
        expect(result._unsafeUnwrap().status).toBe("unknown");
    },
);

it("accepts zero as a numeric category", async () => {
    get.mockResolvedValue({ data: { Category: 0 } });
    const result = await checkBlocksiUrl("https://example.test");
    expect(result._unsafeUnwrap().status).toBe("allowed");
    expect(get).toHaveBeenCalledOnce();
});
