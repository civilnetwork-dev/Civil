import { eq, inArray } from "drizzle-orm";

import { bannedKey, invalidate, invalidateTag, userKey } from "./cache";
import { db } from "./db";
import { goguardianManifestKeys, ibossGateways, users, visits } from "./schema";

/** Move owned data before Better Auth deletes the anonymous user and its cascades. */
export async function convertAnonymousUser(
    anonymousId: string,
    registeredId: string,
) {
    if (anonymousId === registeredId) return;
    const ban = await db.transaction(async tx => {
        const rows = await tx
            .select()
            .from(users)
            .where(inArray(users.id, [anonymousId, registeredId]))
            .orderBy(users.id)
            .for("update");
        const anonymous = rows.find(user => user.id === anonymousId);
        const registered = rows.find(user => user.id === registeredId);
        if (!anonymous?.isAnonymous || !registered || registered.isAnonymous) {
            throw new Error(
                "Anonymous conversion requires an anonymous source and registered target",
            );
        }
        await tx
            .update(visits)
            .set({ userId: registeredId })
            .where(eq(visits.userId, anonymousId));
        await tx
            .update(goguardianManifestKeys)
            .set({ submittedByUserId: registeredId })
            .where(eq(goguardianManifestKeys.submittedByUserId, anonymousId));
        await tx
            .update(ibossGateways)
            .set({ submittedByUserId: registeredId })
            .where(eq(ibossGateways.submittedByUserId, anonymousId));
        if (!anonymous.isBanned || registered.isBanned) return;
        const transferred = {
            isBanned: true,
            banReason: anonymous.banReason,
            bannedAt: anonymous.bannedAt,
        };
        // Privilege and primary email always belong to the registered account.
        await tx
            .update(users)
            .set(transferred)
            .where(eq(users.id, registeredId));
        return transferred;
    });
    await Promise.all([
        invalidateTag(userKey(anonymousId)),
        invalidateTag(userKey(registeredId)),
        invalidate(bannedKey(anonymousId), bannedKey(registeredId)),
    ]);
    return ban;
}
