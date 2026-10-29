import type { Hono } from "hono";

import { type AppEnv, clientIp, readJsonBody } from "../../http";
import { posthog } from "../posthog";
import { respondFilterError } from "../utils/respondFilterError";
import { createBlocksiFilterChecker } from "./checker";

export function useBlocksiMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/blocksi", async c => {
        const { url } = (await readJsonBody(c)) as {
            url: string;
        };

        const blocksiChecker = createBlocksiFilterChecker();

        const blocksiCheckResult = await blocksiChecker.checkUrl(url);

        if (blocksiCheckResult.isErr()) {
            return respondFilterError(
                c,
                "blocksi",
                url,
                blocksiCheckResult.error,
            );
        }
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
    });
}
