import type { Hono } from "hono";

import { type AppEnv, clientIp, readJsonBody } from "../../http";
import { posthog } from "../posthog";
import { createBlocksiFilterChecker } from "./checker";

export function useBlocksiMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/blocksi", async c => {
        const { url } = (await readJsonBody(c)) as {
            url: string;
        };

        const blocksiChecker = createBlocksiFilterChecker();

        const blocksiCheckResult = await blocksiChecker.checkUrl(url);

        if (blocksiCheckResult.isErr()) {
            posthog.capture({
                distinctId: clientIp(c) ?? "unknown",
                event: "filter_error",
                properties: {
                    filter: "blocksi",
                    url,
                    errorType: blocksiCheckResult.error.type,
                    errorMessage: blocksiCheckResult.error.message,
                },
            });
            return c.text(
                `Internal server error: ${blocksiCheckResult.error.type} - ${blocksiCheckResult.error.message}`,
                500,
            );
        } else {
            posthog.capture({
                distinctId: clientIp(c) ?? "unknown",
                event: "filter_check",
                properties: {
                    filter: "blocksi",
                    url,
                    result: blocksiCheckResult.value,
                },
            });
            return c.json(blocksiCheckResult.value);
        }
    });
}
