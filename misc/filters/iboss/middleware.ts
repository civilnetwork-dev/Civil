import type { Hono } from "hono";

import { getLatestIbossGateway } from "../../database/models/ibossGateway";
import { type AppEnv, clientIp, readJsonBody } from "../../http";
import { posthog } from "../posthog";
import { createIbossFilterChecker, type IbossCheckerOptions } from "./checker";

/**
 * Registers `POST /filterCheck/iboss`.
 *
 * Two modes:
 * - District mode: body has `leaId` (+ `url`, `userEmail`). The gateway host and
 *   account security key are loaded from the DB; the key never leaves the server.
 * - Direct mode: body carries `gatewayHost` + `securityKey` (+ `userEmail`), or
 *   they come from `defaults`.
 */
export function useIbossMiddleware(
    app: Hono<AppEnv>,
    defaults?: Partial<IbossCheckerOptions>,
) {
    app.post("/filterCheck/iboss", async c => {
        const body = (await readJsonBody(c)) as Partial<IbossCheckerOptions> & {
            url?: string;
            leaId?: string;
        };

        const { url, leaId, ...bodyOptions } = body;

        if (!url) {
            return c.json({ error: "url required" }, 400);
        }

        let options = {
            ...defaults,
            ...bodyOptions,
        } as IbossCheckerOptions;

        // District mode: resolve the stored gateway + key by LEA id.
        if (leaId && !options.gatewayHost) {
            const row = await getLatestIbossGateway(leaId);
            if (!row) {
                return c.json(
                    {
                        statusIsKnown: false,
                        error: "No iboss gateway for this district",
                    },
                    404,
                );
            }

            // Host known, but categorization needs the account key, which
            // auto-detection can't obtain. Surface as "unknown", not an error.
            if (!row.securityKey) {
                return c.json({
                    statusIsKnown: false,
                    needsSecurityKey: true,
                    gatewayHost: row.gatewayHost,
                });
            }

            options = {
                ...options,
                gatewayHost: row.gatewayHost,
                categorizationPort: row.categorizationPort,
                securityKey: row.securityKey,
            };
        }

        if (
            !options.gatewayHost ||
            !options.securityKey ||
            !options.userEmail
        ) {
            return c.json(
                {
                    error: "Missing iboss credentials: provide leaId (with a stored gateway) or gatewayHost + securityKey + userEmail.",
                },
                400,
            );
        }

        const ibossChecker = createIbossFilterChecker(options);

        const ibossCheckResult = await ibossChecker.checkUrl(url);

        if (ibossCheckResult.isErr()) {
            posthog.capture({
                distinctId: clientIp(c) ?? "unknown",
                event: "filter_error",
                properties: {
                    filter: "iboss",
                    url,
                    errorType: ibossCheckResult.error.type,
                    errorMessage: ibossCheckResult.error.message,
                },
            });
            return c.json(
                {
                    statusIsKnown: false,
                    error: ibossCheckResult.error.message,
                },
                502,
            );
        } else {
            posthog.capture({
                distinctId: clientIp(c) ?? "unknown",
                event: "filter_check",
                properties: {
                    filter: "iboss",
                    url,
                    result: ibossCheckResult.value,
                },
            });
            return c.json({ statusIsKnown: true, ...ibossCheckResult.value });
        }
    });
}
