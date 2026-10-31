import { type Context, Hono } from "hono";

import { db } from "../database/db";
import { getLatestIbossGateway } from "../database/models/ibossGateway";
import { ibossGateways } from "../database/schema";
import { readJsonBody } from "../http";

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

/**
 * GET /api/iboss/gateway?leaId=<leaId>
 * Returns the most recently contributed gateway for a district.
 */
async function getGateway(c: Context) {
    const leaId = c.req.query("leaId");
    if (!leaId) {
        return c.json({ error: "leaId required" }, 400);
    }

    const row = await getLatestIbossGateway(leaId);
    if (!row) {
        return c.json({ error: "No iboss gateway for this district" }, 404);
    }

    return c.json({
        gatewayHost: row.gatewayHost,
        categorizationPort: row.categorizationPort,
        // Never leak the key itself; just signal whether a live check is possible.
        hasSecurityKey: Boolean(row.securityKey),
    });
}

/**
 * POST /api/iboss/submitGateway
 * Body: { gatewayHost, leaId?, districtName?, securityKey?, port?, source? }
 * Validates the host shape, upserts by (host, leaId).
 */
async function submitGateway(c: Context) {
    const { gatewayHost, leaId, districtName, securityKey, port, source } =
        (await readJsonBody(c)) as {
            gatewayHost?: string;
            leaId?: string;
            districtName?: string;
            securityKey?: string;
            port?: number;
            source?: string;
        };

    if (!gatewayHost || typeof gatewayHost !== "string") {
        return c.json({ error: "gatewayHost required" }, 400);
    }

    const host = normalizeGatewayHost(gatewayHost);
    if (!host) {
        return c.json({ error: "Invalid iboss gateway host" }, 400);
    }

    const categorizationPort =
        typeof port === "number" && port > 0 ? port : 8026;
    const origin = source === "auto" ? "auto" : "manual";

    await db
        .insert(ibossGateways)
        .values({
            gatewayHost: host,
            categorizationPort,
            securityKey: securityKey || null,
            schoolDistrictLeaId: leaId ?? null,
            schoolDistrictName: districtName ?? null,
            source: origin,
        })
        .onConflictDoUpdate({
            target: [
                ibossGateways.gatewayHost,
                ibossGateways.schoolDistrictLeaId,
            ],
            set: {
                categorizationPort,
                // Only overwrite the key when a new one is supplied.
                ...(securityKey ? { securityKey } : {}),
                schoolDistrictName: districtName ?? null,
                source: origin,
                submittedAt: new Date(),
            },
        });

    return c.json({ gatewayHost: host });
}

export function createIbossGatewaysRouter() {
    const router = new Hono();
    router.get("/gateway", getGateway);
    router.post("/submitGateway", submitGateway);
    return router;
}
