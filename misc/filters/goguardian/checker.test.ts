import { afterEach, expect, it, vi } from "vitest";

import { checkGoGuardianFilterAuthenticated } from "./checker";

const cases = [
    { text: "proxyterm", categories: ["Proxy & VPN"], matched: ["proxyterm"] },
    { text: "threatterm", categories: [], matched: ["threatterm"] },
    { text: "lesson", categories: [], matched: [] },
];

afterEach(() => vi.unstubAllGlobals());

it.each(cases)("reports legacy keyword evidence for $text", async fixture => {
    vi.stubGlobal("fetch", async (request: Request | string | URL) => {
        const { pathname } = new URL(
            request instanceof Request ? request.url : request,
        );
        if (pathname.endsWith("/version/current"))
            return Response.json({ version: "fixture" });
        if (pathname.endsWith("/proxies/fixture/model.json"))
            return Response.json({ proxy_keywords: ["proxyterm"] });
        if (pathname.endsWith("/threats/fixture/model.json"))
            return Response.json({ keywords: ["threatterm"] });
        throw new Error("Unexpected model route");
    });

    const result = await checkGoGuardianFilterAuthenticated(
        { url: "https://lesson.invalid", text: fixture.text },
        { authToken: "fixture", extensionVersion: "4.0.7393.1" },
    );

    expect(result._unsafeUnwrap()).toMatchObject({
        status: "unknown",
        categories: fixture.categories,
        matched: fixture.matched,
    });
});
