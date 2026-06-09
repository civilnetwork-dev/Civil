import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./misc/database/schema.ts",
    out: "./misc/database/migrations",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});
