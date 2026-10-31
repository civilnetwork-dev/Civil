import { eq } from "drizzle-orm";
import { type Context, Hono } from "hono";

import { db } from "../database/db";
import { goguardianManifestKeys } from "../database/schema";
import { computeExtensionIdFromKey } from "../filters/goguardian/generateAuthToken";
import { readJsonBody } from "../http";

/**
 * GET /api/goguardian/manifestKey?leaId=<leaId>
 * Returns the known extensionId for a given school district LEA ID.
 */
async function getManifestKey(c: Context) {
    const leaId = c.req.query("leaId");
    if (!leaId) {
        return c.json({ error: "leaId required" }, 400);
    }

    const rows = await db
        .select({ extensionId: goguardianManifestKeys.extensionId })
        .from(goguardianManifestKeys)
        .where(eq(goguardianManifestKeys.schoolDistrictLeaId, leaId))
        .limit(1);

    if (!rows.length) {
        return c.json({ error: "No manifest key for this district" }, 404);
    }

    return c.json({ extensionId: rows[0]!.extensionId });
}

/**
 * POST /api/goguardian/submitManifestKey
 * Body: { manifestKey: string, leaId?: string, districtName?: string }
 * Computes extensionId from the key, upserts to DB, returns extensionId.
 */
async function submitManifestKey(c: Context) {
    const { manifestKey, leaId, districtName } = (await readJsonBody(c)) as {
        manifestKey?: string;
        leaId?: string;
        districtName?: string;
    };

    if (!manifestKey || typeof manifestKey !== "string") {
        return c.json({ error: "manifestKey required" }, 400);
    }

    let extensionId: string;
    try {
        extensionId = computeExtensionIdFromKey(manifestKey);
    } catch {
        return c.json({ error: "Invalid manifest key" }, 400);
    }

    const district = {
        schoolDistrictLeaId: leaId ?? null,
        schoolDistrictName: districtName ?? null,
    };
    await db
        .insert(goguardianManifestKeys)
        .values({ manifestKey, extensionId, ...district })
        .onConflictDoUpdate({
            target: goguardianManifestKeys.extensionId,
            set: { manifestKey, ...district, submittedAt: new Date() },
        });

    return c.json({ extensionId });
}

export function createGoGuardianKeysRouter() {
    const router = new Hono();
    router.get("/manifestKey", getManifestKey);
    router.post("/submitManifestKey", submitManifestKey);
    return router;
}
