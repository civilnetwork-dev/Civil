import type { Express } from "express";
import { posthog } from "../posthog";
import { isJsonEnabled } from "../utils/isJsonEnabled";
import { createBlocksiFilterChecker } from "./checker";

export function useBlocksiMiddleware(app: Express) {
    app.post("/filterCheck/blocksi", async (req, res) => {
        if (!isJsonEnabled(app)) {
            const { json } = await import("express");

            app.use(json());
        }

        const { url } = req.body as {
            url: string;
        };

        const blocksiChecker = createBlocksiFilterChecker();

        const blocksiCheckResult = await blocksiChecker.checkUrl(url);

        if (blocksiCheckResult.isErr()) {
            posthog.capture({
                distinctId: req.ip ?? "unknown",
                event: "filter_error",
                properties: {
                    filter: "blocksi",
                    url,
                    errorType: blocksiCheckResult.error.type,
                    errorMessage: blocksiCheckResult.error.message,
                },
            });
            res.status(500).send(
                `Internal server error: ${blocksiCheckResult.error.type} - ${blocksiCheckResult.error.message}`,
            );
        } else {
            posthog.capture({
                distinctId: req.ip ?? "unknown",
                event: "filter_check",
                properties: {
                    filter: "blocksi",
                    url,
                    result: blocksiCheckResult.value,
                },
            });
            res.json(blocksiCheckResult.value);
        }
    });
}
