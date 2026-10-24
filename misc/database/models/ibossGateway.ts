import { desc, eq } from "drizzle-orm";

import { db } from "../db";
import { ibossGateways } from "../schema";

/**
 * The iboss gateway most recently contributed for a school district, or null.
 * The result carries the account security key, which must stay on the server.
 */
export async function getLatestIbossGateway(leaId: string) {
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
    return rows[0] ?? null;
}
