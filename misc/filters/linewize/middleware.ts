import type { Hono } from "hono";

import { type AppEnv, clientIp, readJsonBody } from "../../http";
import { posthog } from "../posthog";
import { createAutoLinewizeFilterChecker as createLinewizeFilterChecker } from "./checker";

export function useLinewizeMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/linewize", async c => {
        const { url, identity } = (await readJsonBody(c)) as {
            url: string;
            identity: string;
        };

        const linewizeCheckerResult = await createLinewizeFilterChecker({
            identity,
        });

        if (linewizeCheckerResult.isErr()) {
            posthog.capture({
                distinctId: clientIp(c) ?? "unknown",
                event: "filter_error",
                properties: {
                    filter: "linewize",
                    url,
                    errorType: linewizeCheckerResult.error.type,
                    errorMessage: linewizeCheckerResult.error.message,
                    phase: "checker_init",
                },
            });
            return c.text(
                `Internal Server Error - ${linewizeCheckerResult.error.type}: ${linewizeCheckerResult.error.message}`,
                500,
            );
        } else {
            const checkResult = await linewizeCheckerResult.value.checkUrl({
                url,
            });

            if (checkResult.isOk()) {
                posthog.capture({
                    distinctId: clientIp(c) ?? "unknown",
                    event: "filter_check",
                    properties: {
                        filter: "linewize",
                        url,
                        blocked: checkResult.value.verdict === "BLOCK",
                        verdictIsKnown: checkResult.value.verdict !== "UNKNOWN",
                        categories: checkResult.value.categories,
                    },
                });
                return c.json({
                    blocked: checkResult.value.verdict === "BLOCK",
                    verdictIsKnown: checkResult.value.verdict !== "UNKNOWN",
                    categories: checkResult.value.categories,
                    raw: checkResult.value.raw,
                });
            } else {
                posthog.capture({
                    distinctId: clientIp(c) ?? "unknown",
                    event: "filter_error",
                    properties: {
                        filter: "linewize",
                        url,
                        errorType: checkResult.error.type,
                        errorMessage: checkResult.error.message,
                        phase: "url_check",
                    },
                });
                return c.text(
                    `Internal server error: ${checkResult.error.type} - ${checkResult.error.message}`,
                    500,
                );
            }
        }
    });
}
