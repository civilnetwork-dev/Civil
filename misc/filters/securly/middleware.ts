import {
    enableCache as enableIpCaching,
    lookup as lookupIp,
} from "doc999tor-fast-geoip";
import type { Hono } from "hono";

import { type AppEnv, clientIp, readJsonBody } from "../../http";
import { posthog } from "../posthog";
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

export function useSecurlyMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/securly", async c => {
        enableIpCaching();

        const { useremail, host, extensionId } = (await readJsonBody(c)) as {
            useremail: Email;
            host: Hostname;
            extensionId: string;
        };

        const ipData = await lookupIp(clientIp(c) ?? "");
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
                distinctId: clientIp(c) ?? "unknown",
                event: "filter_error",
                properties: {
                    filter: "securly",
                    host,
                    errorType: result.error.type,
                    errorMessage: result.error.message,
                },
            });
            return c.text(`${result.error.type}: ${result.error.message}`, 500);
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
                distinctId: clientIp(c) ?? "unknown",
                event: "filter_check",
                properties: {
                    filter: "securly",
                    host,
                    ...decision,
                    categories: Array.isArray(labels) ? labels : [labels],
                },
            });
            return c.json({
                decision,
                categories: Array.isArray(labels) ? labels : [labels],
            } satisfies MiddlewareResponse);
        }
    });
}
