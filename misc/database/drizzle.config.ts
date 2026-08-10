import { defineConfig } from "drizzle-kit";
import { requireEnv } from "../env";

export default defineConfig({
    schema: "./misc/database/schema.ts",
    out: "./misc/database/migrations",
    dialect: "postgresql",
    dbCredentials: {
        url: requireEnv("DATABASE_URL"),
    },
});
