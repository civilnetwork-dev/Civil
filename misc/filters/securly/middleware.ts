import {
    enableCache as enableIpCaching,
    lookup as lookupIp,
} from "doc999tor-fast-geoip";
import type { Context, Hono } from "hono";

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

function captureSecurly(
    c: Context<AppEnv>,
    event: "filter_check" | "filter_error",
    properties: Record<string, unknown>,
) {
    posthog.capture({
        distinctId: clientIp(c) ?? "unknown",
        event,
        properties: { filter: "securly", ...properties },
    });
}

function decisionFor(decision: string | undefined) {
    return {
        allowed: ["ALLOW", "SS", "YT", "GM"].includes(decision ?? ""),
        paused: decision === "PAUSE",
        errored: decision === "ERROR",
        decisionIsKnown: decision !== "UNKNOWN",
    };
}

async function checkSecurly(c: Context<AppEnv>) {
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
        captureSecurly(c, "filter_error", {
            host,
            errorType: result.error.type,
            errorMessage: result.error.message,
        });
        return c.text(`${result.error.type}: ${result.error.message}`, 500);
    }

    const { labels } = decodeSecurlyCategoryId(result.value.categoryId!);
    const decision = decisionFor(result.value.decision);
    const categories = Array.isArray(labels) ? labels : [labels];
    captureSecurly(c, "filter_check", { host, ...decision, categories });
    return c.json({ decision, categories } satisfies MiddlewareResponse);
}

export function useSecurlyMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/securly", checkSecurly);
}
