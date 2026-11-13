import { afterEach, expect, it, vi } from "vitest";

import { createIbossFilterChecker } from "./checker";

const replies = [
    { name: "explicit allow", body: { blockUrl: 0 }, status: "allowed" },
    { name: "explicit block", body: { blockUrl: 1 }, status: "blocked" },
    { name: "cloud error", body: { errorCode: 7 }, status: "blocked" },
    { name: "empty object", body: {}, status: null },
    { name: "null", body: null, status: null },
    { name: "array", body: [], status: null },
    { name: "string", body: "gateway unavailable", status: null },
    { name: "string decision", body: { blockUrl: "0" }, status: null },
    { name: "null decision", body: { blockUrl: null }, status: null },
    { name: "boolean decision", body: { blockUrl: false }, status: null },
] as const;

afterEach(() => vi.unstubAllGlobals());

it.each(replies)(
    "validates iboss cloud reply: $name",
    async ({ body, status }) => {
        const request = vi.fn().mockResolvedValue(Response.json(body));
        vi.stubGlobal("fetch", request);
        const checker = createIbossFilterChecker({
            gatewayHost: "gateway.example",
            securityKey: "test-key",
            userEmail: "probe@example.com",
            retries: 1,
        });
        const result = await checker.checkUrl("https://example.org/path");

        expect(request).toHaveBeenCalledOnce();
        if (status === null) {
            expect(result.isErr()).toBe(true);
            if (result.isErr()) expect(result.error.type).toBe("PARSE");
        } else {
            expect(result.isOk()).toBe(true);
            if (result.isOk()) expect(result.value.status).toBe(status);
        }
    },
);
