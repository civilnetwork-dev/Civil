import type { Hono } from "hono";

import { type AppEnv, clientIp, readJsonBody } from "../../http";
import { posthog } from "../posthog";
import { createFortiGuardChecker } from "./checker";

export function useFortiGuardMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/fortiguard", async c => {
        const { url } = (await readJsonBody(c)) as { url: string };

        const fortiguardChecker = createFortiGuardChecker();

        const checkResult = await fortiguardChecker.checkUrl(url);

        if (checkResult.isErr()) {
            posthog.capture({
                distinctId: clientIp(c) ?? "unknown",
                event: "filter_error",
                properties: {
                    filter: "fortiguard",
                    url,
                    errorType: checkResult.error.type,
                    errorMessage: checkResult.error.message,
                },
            });
            return c.text(
                `Internal Server Error - ${checkResult.error.type}: ${checkResult.error.message}`,
                500,
            );
        } else {
            posthog.capture({
                distinctId: clientIp(c) ?? "unknown",
                event: "filter_check",
                properties: {
                    filter: "fortiguard",
                    url,
                    result: checkResult.value,
                },
            });
            return c.json(checkResult.value);
        }
    });
}
