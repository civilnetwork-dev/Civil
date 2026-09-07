import {
    enableCache as enableIpCaching,
    lookup as lookupIp,
} from "doc999tor-fast-geoip";
import type { Express } from "express";

import { posthog } from "../posthog";
import { isJsonEnabled } from "../utils/isJsonEnabled";
import type { Email, Hostname } from "./broker";
import { checkStatus } from "./broker";
import { decodeSecurlyCategoryId } from "./categories";

interface MiddlewareResponse {
    decision?: {
        allowed?: boolean;
        paused?: boolean;
        errored?: boolean;
        decisionIsKnown?: boolean;
    };
    categories?: string[];
}

export function useSecurlyMiddleware(app: Express) {
    app.post("/filterCheck/securly", async (req, res) => {
        enableIpCaching();

        if (!isJsonEnabled(app)) {
            const { json } = await import("express");

            app.use(json());
        }

        const { useremail, host, extensionId } = req.body as {
            useremail: Email;
            host: Hostname;
            extensionId: string;
        };

        const ipData = await lookupIp(req.ip!);
        const [lat, lng] = ipData?.ll ?? [0, 0];

        const result = await checkStatus({
            useremail,
            host,
            extensionId,
            lat,
            lng,
        });

        if (result.isErr()) {
            posthog.capture({
                distinctId: req.ip ?? "unknown",
                event: "filter_error",
                properties: {
                    filter: "securly",
                    host,
                    errorType: result.error.type,
                    errorMessage: result.error.message,
                },
            });
            res.status(500).send(
                `${result.error.type}: ${result.error.message}`,
            );
        } else {
            const { labels } = decodeSecurlyCategoryId(
                result.value.categoryId!,
            );
            const decision = {
                allowed: ["ALLOW", "SS", "YT", "GM"].includes(
                    result.value.decision ?? "",
                ),
                paused: result.value.decision === "PAUSE",
                errored: result.value.decision === "ERROR",
                decisionIsKnown: result.value.decision !== "UNKNOWN",
            };
            posthog.capture({
                distinctId: req.ip ?? "unknown",
                event: "filter_check",
                properties: {
                    filter: "securly",
                    host,
                    ...decision,
                    categories: Array.isArray(labels) ? labels : [labels],
                },
            });
            res.json({
                decision,
                categories: Array.isArray(labels) ? labels : [labels],
            } satisfies MiddlewareResponse);
        }
    });
}
