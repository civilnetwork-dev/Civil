import { eq } from "drizzle-orm";
import { Router } from "express";
import { db } from "../database/db";
import { goguardianManifestKeys } from "../database/schema";
import { computeExtensionIdFromKey } from "../filters/goguardian/generateAuthToken";

export function createGoGuardianKeysRouter(): Router {
    const router = Router();

    /**
     * GET /api/goguardian/manifest-key?leaId=<leaId>
     * Returns the known extensionId for a given school district LEA ID.
     */
    router.get("/manifest-key", async (req, res) => {
        const leaId = req.query.leaId as string | undefined;
        if (!leaId) {
            return void res.status(400).json({ error: "leaId required" });
        }

        const rows = await db
            .select({ extensionId: goguardianManifestKeys.extensionId })
            .from(goguardianManifestKeys)
            .where(eq(goguardianManifestKeys.schoolDistrictLeaId, leaId))
            .limit(1);

        if (!rows.length) {
            return void res
                .status(404)
                .json({ error: "No manifest key for this district" });
        }

        res.json({ extensionId: rows[0]!.extensionId });
    });

    /**
     * POST /api/goguardian/submit-manifest-key
     * Body: { manifestKey: string, leaId?: string, districtName?: string }
     * Computes extensionId from the key, upserts to DB, returns extensionId.
     */
    router.post("/submit-manifest-key", async (req, res) => {
        const { manifestKey, leaId, districtName } = req.body as {
            manifestKey?: string;
            leaId?: string;
            districtName?: string;
        };

        if (!manifestKey || typeof manifestKey !== "string") {
            return void res.status(400).json({ error: "manifestKey required" });
        }

        let extensionId: string;
        try {
            extensionId = computeExtensionIdFromKey(manifestKey);
        } catch {
            return void res.status(400).json({ error: "Invalid manifest key" });
        }

        await db
            .insert(goguardianManifestKeys)
            .values({
                manifestKey,
                extensionId,
                schoolDistrictLeaId: leaId ?? null,
                schoolDistrictName: districtName ?? null,
            })
            .onConflictDoUpdate({
                target: goguardianManifestKeys.extensionId,
                set: {
                    manifestKey,
                    schoolDistrictLeaId: leaId ?? null,
                    schoolDistrictName: districtName ?? null,
                    submittedAt: new Date(),
                },
            });

        res.json({ extensionId });
    });

    return router;
}
