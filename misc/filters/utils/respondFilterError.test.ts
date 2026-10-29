import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import type { AppEnv } from "../../http";
import { respondFilterError } from "./respondFilterError";

const capture = vi.fn();
vi.mock("../posthog", () => ({
    posthog: { capture: (e: unknown) => capture(e) },
}));

async function fail(type: string, extra?: Record<string, unknown>) {
    const app = new Hono<AppEnv>();
    app.post("/", c =>
        respondFilterError(
            c,
            "blocksi",
            "https://a.com/",
            {
                type,
                message: "went wrong",
            },
            extra,
        ),
    );
    return app.request("/", { method: "POST" }, {
        incoming: { socket: { remoteAddress: "1.2.3.4" } },
    } as unknown as AppEnv["Bindings"]);
}

describe("respondFilterError", () => {
    it("answers with a status that says whose fault the failure was", async () => {
        expect((await fail("INVALID_URL")).status).toBe(400);
        expect((await fail("NETWORK")).status).toBe(502);
        const other = await fail("PARSE");
        expect(other.status).toBe(500);
        expect(await other.text()).toBe("PARSE: went wrong");
    });

    it("reports the failure with any extra properties", async () => {
        capture.mockClear();
        await fail("NETWORK", { phase: "url_check" });
        expect(capture).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "filter_error",
                properties: expect.objectContaining({
                    filter: "blocksi",
                    url: "https://a.com/",
                    errorType: "NETWORK",
                    phase: "url_check",
                }),
            }),
        );
    });
});
