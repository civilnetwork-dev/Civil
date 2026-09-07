import type { Express } from "express";

import { posthog } from "../posthog";
import { isJsonEnabled } from "../utils/isJsonEnabled";
import {
    checkLightspeedFilter,
    type LightspeedCheckerOptions,
} from "./checker";

export function useLightspeedMiddleware(app: Express) {
    app.post("/filterCheck/lightspeed", async (req, res) => {
        if (!isJsonEnabled(app)) {
            const { json } = await import("express");
            app.use(json());
        }

        const { url, blockedCategories, apiBaseUrl, timeoutMs } = req.body as {
            url?: string;
            blockedCategories?: string[];
            apiBaseUrl?: string;
            timeoutMs?: number;
        };

        if (!url) {
            res.status(400).json({ error: "url is required." });
            return;
        }

        const options: LightspeedCheckerOptions = {
            ...(apiBaseUrl !== undefined && { apiBaseUrl }),
            ...(timeoutMs !== undefined && { timeoutMs }),
        };

        const result = await checkLightspeedFilter(
            {
                url,
                ...(Array.isArray(blockedCategories) && { blockedCategories }),
            },
            options,
        );

        if (result.isErr()) {
            posthog.capture({
                distinctId: req.ip ?? "unknown",
                event: "filter_error",
                properties: {
                    filter: "lightspeed",
                    url,
                    errorType: result.error.type,
                    errorMessage: result.error.message,
                },
            });

            const statusCode =
                result.error.type === "INVALID_URL"
                    ? 400
                    : result.error.type === "NETWORK"
                      ? 502
                      : 500;

            res.status(statusCode).send(
                `${result.error.type}: ${result.error.message}`,
            );
            return;
        }

        const {
            verdict,
            blocked,
            categories,
            matchedCategory,
            reason,
            hostname,
        } = result.value;

        posthog.capture({
            distinctId: req.ip ?? "unknown",
            event: "filter_check",
            properties: {
                filter: "lightspeed",
                url,
                verdict,
                blocked,
                statusIsKnown: verdict !== "UNKNOWN",
                matchedCategory,
                categories,
            },
        });

        res.json({
            verdict,
            blocked,
            statusIsKnown: verdict !== "UNKNOWN",
            categories,
            matchedCategory,
            reason,
            hostname,
        });
    });
}
