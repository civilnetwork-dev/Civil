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
