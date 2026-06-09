import { db } from "../db";
import type { Visit } from "../schema";
import { visits } from "../schema";

export type { Visit };

export async function recordVisit(userId: string, url: string): Promise<Visit> {
    const rows = await db.insert(visits).values({ userId, url }).returning();
    return rows[0];
}
