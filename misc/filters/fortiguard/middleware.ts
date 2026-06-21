import type { Express } from "express";
import { posthog } from "../posthog";
import { isJsonEnabled } from "../utils/isJsonEnabled";
import { createFortiGuardChecker } from "./checker";

export function useFortiGuardMiddleware(app: Express) {
    app.post("/filterCheck/fortiguard", async (req, res) => {
        if (!isJsonEnabled(app)) {
            const { json } = await import("express");

            app.use(json());
        }

        const { url } = req.body as { url: string };

        const fortiguardChecker = createFortiGuardChecker();

        const checkResult = await fortiguardChecker.checkUrl(url);

        if (checkResult.isErr()) {
            posthog.capture({
                distinctId: req.ip ?? "unknown",
                event: "filter_error",
                properties: {
                    filter: "fortiguard",
                    url,
                    errorType: checkResult.error.type,
                    errorMessage: checkResult.error.message,
                },
            });
            res.sendStatus(500).send(
                `Internal Server Error - ${checkResult.error.type}: ${checkResult.error.message}`,
            );
        } else {
            posthog.capture({
                distinctId: req.ip ?? "unknown",
                event: "filter_check",
                properties: {
                    filter: "fortiguard",
                    url,
                    result: checkResult.value,
                },
            });
            res.json(checkResult.value);
        }
    });
}
