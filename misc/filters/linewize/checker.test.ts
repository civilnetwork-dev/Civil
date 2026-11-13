import { expect, it, vi } from "vitest";
import xior from "xior";

import { createLinewizeFilterChecker } from "./checker";

const CASES = [
    [{ verdict: 0 }, "blocked"],
    [{ verdict: 1 }, "allowed"],
    [{ verdict: 2 }, "unknown"],
    [{ verdict: 3 }, "unknown"],
    [{ verdict: 0, method: "fallback" }, "blocked"],
    [{ verdict: 1, method: "fallback" }, "unknown"],
    [{ verdict: 0, signatures: { signature: "Fallback" } }, "blocked"],
    [{ verdict: 1, signatures: { signature: "Fallback" } }, "unknown"],
    [{ verdict: "WARN" }, "warned"],
    [{ verdict: "BYPASS" }, "allowed"],
] as const;

it.each(CASES)("maps the Linewize reply %j to %s", async (body, status) => {
    const fetchVerdict = vi.fn<typeof fetch>();
    fetchVerdict.mockResolvedValue(Response.json(body));
    const checker = createLinewizeFilterChecker(
        {
            verdictServerUrl: "https://verdict.test",
            identity: "audit",
            deviceId: "audit-device",
        },
        xior.create({ fetch: fetchVerdict }),
    );
    const result = await checker.checkUrl({ url: "https://example.test" });
    expect(result._unsafeUnwrap().status).toBe(status);
    expect(fetchVerdict).toHaveBeenCalledOnce();
});
