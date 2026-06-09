import { eq } from "drizzle-orm";
import {
    bannedKey,
    cached,
    invalidate,
    invalidateTag,
    redis,
    userKey,
} from "../cache";
import { db } from "../db";
import type { User } from "../schema";
import { users } from "../schema";

export type { User };

export async function getUser(id: string): Promise<User | null> {
    return cached(
        userKey(id),
        async () => {
            const rows = await db
                .select()
                .from(users)
                .where(eq(users.id, id))
                .limit(1);
            return rows[0] ?? null;
        },
        300,
        [userKey(id)],
    );
}

export async function createUser(
    id: string,
    email: string,
    name = "",
): Promise<User> {
    const rows = await db
        .insert(users)
        .values({ id, email, name })
        .onConflictDoUpdate({
            target: users.id,
            set: { updatedAt: new Date() },
        })
        .returning();
    return rows[0];
}

export async function isUserBanned(id: string): Promise<boolean> {
    const hit = await redis.get(bannedKey(id));
    if (hit !== null) return hit === "1";

    const user = await getUser(id);
    const banned = user?.isBanned ?? false;
    await redis.set(bannedKey(id), banned ? "1" : "0", "EX", 300);
    return banned;
}

export async function banUser(id: string, reason: string): Promise<User> {
    const rows = await db
        .update(users)
        .set({ isBanned: true, banReason: reason, bannedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
    await invalidateTag(userKey(id));
    await redis.set(bannedKey(id), "1", "EX", 300);
    return rows[0];
}

export async function unbanUser(id: string): Promise<User> {
    const rows = await db
        .update(users)
        .set({ isBanned: false, banReason: null, bannedAt: null })
        .where(eq(users.id, id))
        .returning();
    await invalidateTag(userKey(id));
    await invalidate(bannedKey(id));
    return rows[0];
}
