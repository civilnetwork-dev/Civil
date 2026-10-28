import type { Context } from "hono";

import { type AppEnv, clientIp } from "../../http";
import { posthog } from "../posthog";

/** Records one finished vendor check against the visitor's address. */
export function captureFilterCheck(
    c: Context<AppEnv>,
    filter: string,
    url: string,
    properties: Record<string, unknown>,
): void {
    posthog.capture({
        distinctId: clientIp(c) ?? "unknown",
        event: "filter_check",
        properties: { filter, url, ...properties },
    });
}

/** Records one failed vendor check against the visitor's address. */
export function captureFilterError(
    c: Context<AppEnv>,
    filter: string,
    url: string,
    error: { type: string; message: string },
    properties: Record<string, unknown> = {},
): void {
    posthog.capture({
        distinctId: clientIp(c) ?? "unknown",
        event: "filter_error",
        properties: {
            filter,
            url,
            errorType: error.type,
            errorMessage: error.message,
            ...properties,
        },
    });
}
