import { afterEach, expect, it, vi } from "vitest";

import { checkSecurlyFilter } from "./checker";

const unavailable = ["UNKNOWN_SCHOOL", "AVOID_OS", "unknown"] as const;

afterEach(() => vi.unstubAllGlobals());

it.each(unavailable)("stops broker lookup for cluster %s", async status => {
    const request = vi.fn().mockResolvedValueOnce(new Response(status));
    vi.stubGlobal("fetch", request);

    const result = await checkSecurlyFilter({
        useremail: "student@school.invalid",
        host: "lesson.invalid",
        extensionId: "ckecmkbnoanpgplccmnoikfmpcdladkc",
    });

    expect(result._unsafeUnwrap()).toEqual({
        status: "unknown",
        categories: [],
        detail: "Securly did not provide a filtering cluster.",
        matched: [],
    });
    expect(request).toHaveBeenCalledOnce();
});
