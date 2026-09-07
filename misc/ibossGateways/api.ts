import { desc, eq } from "drizzle-orm";
import { Router } from "express";

import { db } from "../database/db";
import { ibossGateways } from "../database/schema";

/** iboss cloud gateway host, e.g. cn1759617341-vnsg10840.ibosscloud.com */
const GATEWAY_HOST_RE =
    /^(?:cn-?\d+-vnsg\d+|[a-z0-9-]+)\.iboss(?:cloud|gov|test)?(?:-staging)?\.com$/i;

function normalizeGatewayHost(input: string): string | null {
    let raw = input.trim().toLowerCase();
    if (!raw) return null;
    // Accept a full URL, host:port, or bare host.
    raw = raw.replace(/^[a-z]+:\/\//, "").replace(/[/:].*$/, "");
    return GATEWAY_HOST_RE.test(raw) ? raw : null;
}

export function createIbossGatewaysRouter(): Router {
    const router = Router();

    /**
     * GET /api/iboss/gateway?leaId=<leaId>
     * Returns the most recently contributed gateway for a district.
     */
    router.get("/gateway", async (req, res) => {
        const leaId = req.query.leaId as string | undefined;
        if (!leaId) {
            return void res.status(400).json({ error: "leaId required" });
        }

        const rows = await db
            .select({
                gatewayHost: ibossGateways.gatewayHost,
                categorizationPort: ibossGateways.categorizationPort,
                hasSecurityKey: ibossGateways.securityKey,
            })
            .from(ibossGateways)
            .where(eq(ibossGateways.schoolDistrictLeaId, leaId))
            .orderBy(desc(ibossGateways.submittedAt))
            .limit(1);

        const row = rows[0];
        if (!row) {
            return void res
                .status(404)
                .json({ error: "No iboss gateway for this district" });
        }

        res.json({
            gatewayHost: row.gatewayHost,
            categorizationPort: row.categorizationPort,
            // Never leak the key itself; just signal whether a live check is possible.
            hasSecurityKey: Boolean(row.hasSecurityKey),
        });
    });

    /**
     * POST /api/iboss/submit-gateway
     * Body: { gatewayHost, leaId?, districtName?, securityKey?, port?, source? }
     * Validates the host shape, upserts by (host, leaId).
     */
    router.post("/submit-gateway", async (req, res) => {
        const { gatewayHost, leaId, districtName, securityKey, port, source } =
            req.body as {
                gatewayHost?: string;
                leaId?: string;
                districtName?: string;
                securityKey?: string;
                port?: number;
                source?: string;
            };

        if (!gatewayHost || typeof gatewayHost !== "string") {
            return void res.status(400).json({ error: "gatewayHost required" });
        }

        const host = normalizeGatewayHost(gatewayHost);
        if (!host) {
            return void res
                .status(400)
                .json({ error: "Invalid iboss gateway host" });
        }

        await db
            .insert(ibossGateways)
            .values({
                gatewayHost: host,
                categorizationPort:
                    typeof port === "number" && port > 0 ? port : 8026,
                securityKey: securityKey || null,
                schoolDistrictLeaId: leaId ?? null,
                schoolDistrictName: districtName ?? null,
                source: source === "auto" ? "auto" : "manual",
            })
            .onConflictDoUpdate({
                target: [
                    ibossGateways.gatewayHost,
                    ibossGateways.schoolDistrictLeaId,
                ],
                set: {
                    categorizationPort:
                        typeof port === "number" && port > 0 ? port : 8026,
                    // Only overwrite the key when a new one is supplied.
                    ...(securityKey ? { securityKey } : {}),
                    schoolDistrictName: districtName ?? null,
                    source: source === "auto" ? "auto" : "manual",
                    submittedAt: new Date(),
                },
            });

        res.json({ gatewayHost: host });
    });

    return router;
}
