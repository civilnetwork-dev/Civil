import { desc, eq } from "drizzle-orm";
import type { Express } from "express";
import { db } from "../../database/db";
import { ibossGateways } from "../../database/schema";
import { posthog } from "../posthog";
import { isJsonEnabled } from "../utils/isJsonEnabled";
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
    app: Express,
    defaults?: Partial<IbossCheckerOptions>,
) {
    app.post("/filterCheck/iboss", async (req, res) => {
        if (!isJsonEnabled(app)) {
            const { json } = await import("express");

            app.use(json());
        }

        const body = req.body as Partial<IbossCheckerOptions> & {
            url?: string;
            leaId?: string;
        };

        const { url, leaId, ...bodyOptions } = body;

        if (!url) {
            res.status(400).json({ error: "url required" });
            return;
        }

        let options = {
            ...defaults,
            ...bodyOptions,
        } as IbossCheckerOptions;

        // District mode: resolve the stored gateway + key by LEA id.
        if (leaId && !options.gatewayHost) {
            const rows = await db
                .select({
                    gatewayHost: ibossGateways.gatewayHost,
                    categorizationPort: ibossGateways.categorizationPort,
                    securityKey: ibossGateways.securityKey,
                })
                .from(ibossGateways)
                .where(eq(ibossGateways.schoolDistrictLeaId, leaId))
                .orderBy(desc(ibossGateways.submittedAt))
                .limit(1);

            const row = rows[0];
            if (!row) {
                res.status(404).json({
                    statusIsKnown: false,
                    error: "No iboss gateway for this district",
                });
                return;
            }

            // Host known, but categorization needs the account key, which
            // auto-detection can't obtain. Surface as "unknown", not an error.
            if (!row.securityKey) {
                res.json({
                    statusIsKnown: false,
                    needsSecurityKey: true,
                    gatewayHost: row.gatewayHost,
                });
                return;
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
            res.status(400).json({
                error: "Missing iboss credentials: provide leaId (with a stored gateway) or gatewayHost + securityKey + userEmail.",
            });
            return;
        }

        const ibossChecker = createIbossFilterChecker(options);

        const ibossCheckResult = await ibossChecker.checkUrl(url);

        if (ibossCheckResult.isErr()) {
            posthog.capture({
                distinctId: req.ip ?? "unknown",
                event: "filter_error",
                properties: {
                    filter: "iboss",
                    url,
                    errorType: ibossCheckResult.error.type,
                    errorMessage: ibossCheckResult.error.message,
                },
            });
            res.status(502).json({
                statusIsKnown: false,
                error: ibossCheckResult.error.message,
            });
        } else {
            posthog.capture({
                distinctId: req.ip ?? "unknown",
                event: "filter_check",
                properties: {
                    filter: "iboss",
                    url,
                    result: ibossCheckResult.value,
                },
            });
            res.json({ statusIsKnown: true, ...ibossCheckResult.value });
        }
    });
}
