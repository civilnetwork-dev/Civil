import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireEnv } from "../env";
import * as schema from "./schema";

const client = postgres(requireEnv("DATABASE_URL"), {
    max: 20,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: false,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
