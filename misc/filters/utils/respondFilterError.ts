import type { Context } from "hono";

import type { AppEnv } from "../../http";
import { captureFilterError } from "./captureFilter";

/**
 * Reports a failed vendor check and answers with a status that says whose
 * fault it was: 400 for a target URL the checker refused, 502 when the vendor
 * could not be reached, 500 for anything else. `extra` rides along on the
 * PostHog event, such as which step of the check failed.
 */
export function respondFilterError(
    c: Context<AppEnv>,
    filter: string,
    url: string,
    error: { type: string; message: string },
    extra?: Record<string, unknown>,
): Response {
    captureFilterError(c, filter, url, error, extra);

    const statusCode =
        error.type === "INVALID_URL"
            ? 400
            : error.type === "NETWORK"
              ? 502
              : 500;

    return c.text(`${error.type}: ${error.message}`, statusCode);
}
