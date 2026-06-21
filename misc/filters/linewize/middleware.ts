import type { Express } from "express";
import { posthog } from "../posthog";
import { isJsonEnabled } from "../utils/isJsonEnabled";
import { createAutoLinewizeFilterChecker as createLinewizeFilterChecker } from "./checker";

export function useLinewizeMiddleware(app: Express) {
    app.post("/filterCheck/linewize", async (req, res) => {
        if (!isJsonEnabled(app)) {
            const { json } = await import("express");

            app.use(json());
        }

        const { url, identity } = req.body as {
            url: string;
            identity: string;
        };

        const linewizeCheckerResult = await createLinewizeFilterChecker({
            identity,
        });

        if (linewizeCheckerResult.isErr()) {
            posthog.capture({
                distinctId: req.ip ?? "unknown",
                event: "filter_error",
                properties: {
                    filter: "linewize",
                    url,
                    errorType: linewizeCheckerResult.error.type,
                    errorMessage: linewizeCheckerResult.error.message,
                    phase: "checker_init",
                },
            });
            res.status(500).send(
                `Internal Server Error - ${linewizeCheckerResult.error.type}: ${linewizeCheckerResult.error.message}`,
            );
        } else {
            const checkResult = await linewizeCheckerResult.value.checkUrl({
                url,
            });

            if (checkResult.isOk()) {
                posthog.capture({
                    distinctId: req.ip ?? "unknown",
                    event: "filter_check",
                    properties: {
                        filter: "linewize",
                        url,
                        blocked: checkResult.value.verdict === "BLOCK",
                        verdictIsKnown: checkResult.value.verdict !== "UNKNOWN",
                        categories: checkResult.value.categories,
                    },
                });
                res.json({
                    blocked: checkResult.value.verdict === "BLOCK",
                    verdictIsKnown: checkResult.value.verdict !== "UNKNOWN",
                    categories: checkResult.value.categories,
                    raw: checkResult.value.raw,
                });
            } else {
                posthog.capture({
                    distinctId: req.ip ?? "unknown",
                    event: "filter_error",
                    properties: {
                        filter: "linewize",
                        url,
                        errorType: checkResult.error.type,
                        errorMessage: checkResult.error.message,
                        phase: "url_check",
                    },
                });
                res.status(500).send(
                    `Internal server error: ${checkResult.error.type} - ${checkResult.error.message}`,
                );
            }
        }
    });
}
