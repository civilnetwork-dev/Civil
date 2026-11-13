import { getTableName, Param, type SQL } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";

import { convertAnonymousUser } from "./anonymousConversion";
import { bannedKey, userKey } from "./cache";

interface Row extends Record<string, unknown> {
    id: string;
}
const fixture = vi.hoisted(() => ({
    rows: {} as Record<string, Row[]>,
    failTable: "",
    committed: false,
    invalidate: vi.fn(),
    invalidateTag: vi.fn(),
}));

function update(
    table: Parameters<typeof getTableName>[0],
    values: Record<string, unknown>,
    rows: Record<string, Row[]>,
) {
    const name = getTableName(table);
    return {
        where: async (condition: SQL) => {
            if (fixture.failTable === name) throw new Error("write failed");
            const value = condition.queryChunks.find(
                chunk => chunk instanceof Param,
            )?.value;
            const key =
                name === "users"
                    ? "id"
                    : name === "visits"
                      ? "userId"
                      : "submittedByUserId";
            for (const row of rows[name])
                if (row[key] === value) Object.assign(row, values);
        },
    };
}

vi.mock("./db", () => ({
    db: {
        transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
            const rows = structuredClone(fixture.rows);
            const selected = {
                where: () => selected,
                orderBy: () => selected,
                for: async () => rows.users,
            };
            const result = await callback({
                select: () => ({ from: () => selected }),
                update: (table: Parameters<typeof getTableName>[0]) => ({
                    set: (values: Record<string, unknown>) =>
                        update(table, values, rows),
                }),
            });
            fixture.rows = rows;
            fixture.committed = true;
            return result;
        },
    },
}));
vi.mock("./cache", () => ({
    bannedKey: (id: string) => `banned:${id}`,
    userKey: (id: string) => `user:${id}`,
    invalidate: fixture.invalidate,
    invalidateTag: fixture.invalidateTag,
}));

beforeEach(() => {
    vi.clearAllMocks();
    fixture.failTable = "";
    fixture.committed = false;
    fixture.rows = {
        users: [
            {
                id: "anonymous",
                isAnonymous: true,
                isBanned: true,
                banReason: "admin ban",
                bannedAt: new Date(123),
                isAdmin: true,
            },
            {
                id: "registered",
                isAnonymous: false,
                isBanned: false,
                isAdmin: false,
                email: "primary@example.com",
            },
        ],
        visits: [
            { id: "visit", userId: "anonymous", url: "https://example.com" },
        ],
        goguardian_manifest_keys: [
            { id: "key", submittedByUserId: "anonymous" },
        ],
        iboss_gateways: [{ id: "gateway", submittedByUserId: "anonymous" }],
    };
});

it("moves visits and contribution ownership, preserves bans without copying privilege or email", async () => {
    expect(await convertAnonymousUser("anonymous", "registered")).toEqual({
        isBanned: true,
        banReason: "admin ban",
        bannedAt: new Date(123),
    });
    expect(fixture.rows.visits[0].userId).toBe("registered");
    expect(fixture.rows.goguardian_manifest_keys[0].submittedByUserId).toBe(
        "registered",
    );
    expect(fixture.rows.iboss_gateways[0].submittedByUserId).toBe("registered");
    expect(fixture.rows.users[1]).toMatchObject({
        isBanned: true,
        isAdmin: false,
        email: "primary@example.com",
    });
    expect(fixture.invalidate).toHaveBeenCalledWith(
        bannedKey("anonymous"),
        bannedKey("registered"),
    );
    expect(fixture.invalidateTag).toHaveBeenCalledWith(userKey("registered"));
});

it("preserves an existing target ban", async () => {
    Object.assign(fixture.rows.users[1], {
        isBanned: true,
        banReason: "existing ban",
    });
    await convertAnonymousUser("anonymous", "registered");
    expect(fixture.rows.users[1].banReason).toBe("existing ban");
});

it("rolls back ownership and ban changes when any database write fails", async () => {
    fixture.failTable = "iboss_gateways";
    await expect(
        convertAnonymousUser("anonymous", "registered"),
    ).rejects.toThrow("write failed");
    expect(fixture.committed).toBe(false);
    expect(fixture.rows.visits[0].userId).toBe("anonymous");
    expect(fixture.rows.users[1].isBanned).toBe(false);
    expect(fixture.invalidate).not.toHaveBeenCalled();
});

it("rejects an invalid source before moving data", async () => {
    fixture.rows.users[0].isAnonymous = false;
    await expect(
        convertAnonymousUser("anonymous", "registered"),
    ).rejects.toThrow("anonymous source");
    expect(fixture.rows.visits[0].userId).toBe("anonymous");
});
