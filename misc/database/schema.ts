import { sql } from "drizzle-orm";
import {
    boolean,
    index,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name"),
    email: text("email").unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    isAnonymous: boolean("is_anonymous").notNull().default(false),
    isAdmin: boolean("is_admin").notNull().default(false),
    isBanned: boolean("is_banned").notNull().default(false),
    banReason: text("ban_reason"),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
});

export const sessions = pgTable("sessions", {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
        withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
        withTimezone: true,
    }),
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
});

export const verifications = pgTable("verifications", {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
});

export const visits = pgTable(
    "visits",
    {
        id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        url: text("url").notNull(),
        ipAddress: text("ip_address"),
        visitedAt: timestamp("visited_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    t => [
        index("idx_visits_user_id").on(t.userId),
        index("idx_visits_visited_at").on(t.visitedAt),
    ],
);

export const goguardianManifestKeys = pgTable(
    "goguardian_manifest_keys",
    {
        id: serial("id").primaryKey(),
        manifestKey: text("manifest_key").notNull(),
        extensionId: text("extension_id").notNull(),
        schoolDistrictLeaId: text("school_district_lea_id"),
        schoolDistrictName: text("school_district_name"),
        submittedByUserId: uuid("submitted_by_user_id").references(
            () => users.id,
            { onDelete: "set null" },
        ),
        submittedAt: timestamp("submitted_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        verifiedAt: timestamp("verified_at", { withTimezone: true }),
    },
    t => [
        uniqueIndex("goguardian_manifest_keys_extension_id_idx").on(
            t.extensionId,
        ),
        index("goguardian_manifest_keys_lea_id_idx").on(t.schoolDistrictLeaId),
    ],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Visit = typeof visits.$inferSelect;
export type GoGuardianManifestKey = typeof goguardianManifestKeys.$inferSelect;
