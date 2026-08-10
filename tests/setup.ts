import { hasFileScope, setFileScope } from "@vanilla-extract/css/fileScope";

/**
 * Placeholder credentials for the test environment.
 *
 * Several modules under test transitively import misc/database/db.ts or
 * cache.ts, which call requireEnv() at module scope. Neither driver actually
 * connects on import — postgres.js is lazy and ioredis is configured with
 * `lazyConnect: true` — so dummy values are enough to let the modules load.
 *
 * Set before any test file is imported. Real values in the environment win, so
 * this never silently overrides a deliberately configured test database.
 */
const TEST_ENV_DEFAULTS: Record<string, string> = {
    DATABASE_URL: "postgresql://civil:test@127.0.0.1:5432/civil_test",
    REDIS_URL: "redis://127.0.0.1:6379",
    BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
    PATREON_CLIENT_ID: "test-client-id",
    PATREON_CLIENT_SECRET: "test-client-secret",
    IBOSS_SECURITY_KEY: "test-iboss-key",
};

for (const [key, value] of Object.entries(TEST_ENV_DEFAULTS)) {
    process.env[key] ??= value;
}

/**
 * File scope for vanilla-extract's `.css.ts` modules.
 *
 * `style()`/`styleVariants()` call `getFileScope()` at module scope, which
 * throws unless something has called `setFileScope()` first. Normally that's
 * the `@vanilla-extract/vite-plugin` transform, which vitest.config.ts does
 * not register — none of this repo's other `.css.ts` files are ever imported
 * from a test, only from each other, so the gap was invisible until now.
 *
 * Registering the plugin in vitest.config.ts instead was tried and rejected:
 * it makes the plugin re-serialize the whole module for every `.css.ts`
 * import, which throws on any function export (e.g. `field()` in
 * schematic.css.ts) because a function isn't a value the plugin can inline as
 * static CSS outside a full bundler build. Calling `setFileScope` directly
 * uses vanilla-extract's own public `fileScope` subpath export and only
 * establishes a scope for `style()` to register into — it does not attempt
 * to serialize anything, so function exports are unaffected.
 *
 * Guarded so this is a no-op if a real build pipeline ever does provide a
 * scope first.
 */
if (!hasFileScope()) {
    setFileScope("tests/setup.ts");
}
