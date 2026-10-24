import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { requireEnv } from "../env";

const client = postgres(requireEnv("DATABASE_URL"), {
    max: 20,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: false,
});

// Drizzle 1.0 dropped the `schema` option along with relational queries v1.
// Nothing here uses `db.query`, and better-auth gets its tables passed in
// explicitly (auth.ts), so the client needs no schema.
export const db = drizzle({ client });
export type DB = typeof db;
