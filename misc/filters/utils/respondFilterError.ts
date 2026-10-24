import type { Context } from "hono";

import { type AppEnv, clientIp } from "../../http";
import { posthog } from "../posthog";

/**
 * Reports a failed vendor check and answers with a status that says whose
 * fault it was: 400 for a target URL the checker refused, 502 when the vendor
 * could not be reached, 500 for anything else.
 */
export function respondFilterError(
    c: Context<AppEnv>,
    filter: string,
    url: string,
    error: { type: string; message: string },
): Response {
    posthog.capture({
        distinctId: clientIp(c) ?? "unknown",
        event: "filter_error",
        properties: {
            filter,
            url,
            errorType: error.type,
            errorMessage: error.message,
        },
    });

    const statusCode =
        error.type === "INVALID_URL"
            ? 400
            : error.type === "NETWORK"
              ? 502
              : 500;

    return c.text(`${error.type}: ${error.message}`, statusCode);
}
