import "dotenv/config";

/**
 * Read a required environment variable, or throw with the variable's name.
 *
 * Preferred over `process.env.X!`, which type-checks fine and then fails deep
 * inside a driver with an unrelated-looking error (or, worse, connects to a
 * URL built from "undefined").
 */
export function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required env var: ${name}`);
    return value;
}

/** Read an optional environment variable, falling back to `fallback`. */
export function optionalEnv(name: string, fallback: string): string {
    const value = process.env[name];
    return value && value.length > 0 ? value : fallback;
}

/**
 * Every env var the server needs in order to start at all.
 *
 * `BETTER_AUTH_URL` and `CHII_DOMAIN` are deliberately absent: both have
 * working defaults in their consumers.
 */
const REQUIRED_ENV = [
    "DATABASE_URL",
    "REDIS_URL",
    "BETTER_AUTH_SECRET",
    "PATREON_CLIENT_ID",
    "PATREON_CLIENT_SECRET",
    "IBOSS_SECURITY_KEY",
] as const;

const MIN_AUTH_SECRET_LENGTH = 32;

/**
 * Check all required env vars up front and fail with a single message listing
 * everything that is missing, instead of crashing once per variable as each
 * module happens to be imported.
 *
 * Call this as early as possible in the server entrypoint.
 */
export function validateEnv(): void {
    const missing = REQUIRED_ENV.filter(name => !process.env[name]);

    if (missing.length > 0) {
        throw new Error(
            [
                `Missing ${missing.length} required env var(s):`,
                ...missing.map(name => `  - ${name}`),
                "",
                "Copy .env.example to .env and fill it in.",
            ].join("\n"),
        );
    }

    const secret = process.env.BETTER_AUTH_SECRET as string;
    if (secret.length < MIN_AUTH_SECRET_LENGTH) {
        throw new Error(
            `BETTER_AUTH_SECRET must be at least ${MIN_AUTH_SECRET_LENGTH} characters (got ${secret.length}). It signs every session token.`,
        );
    }
}
