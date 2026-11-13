import { existsSync } from "node:fs";

// Bun loads .env on its own, Node (vitest, drizzle-kit) only through this.
// Like dotenv, it never overrides a variable the environment already set.
if (existsSync(".env")) process.loadEnvFile();

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

export interface ClassLinkConfig {
    issuer: string;
    clientId: string;
    clientSecret: string;
    authOrigin: string;
}

const CLASSLINK_ENV = [
    "CLASSLINK_ISSUER",
    "CLASSLINK_CLIENT_ID",
    "CLASSLINK_CLIENT_SECRET",
] as const;

function authConfigUrl(value: string, name: string, production: boolean): URL {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`${name} must be an absolute URL`);
    }
    const localhost = ["localhost", "127.0.0.1", "[::1]"].includes(
        url.hostname,
    );
    if (
        (url.protocol !== "https:" &&
            !(url.protocol === "http:" && localhost && !production)) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
    ) {
        throw new Error(
            `${name} must use HTTPS without credentials, query or fragment (HTTP localhost is allowed in development)`,
        );
    }
    return url;
}

/** ClassLink is optional, but a partially configured provider must never start. */
export function getClassLinkConfig(
    env: Record<string, string | undefined> = process.env,
): ClassLinkConfig | null {
    if (!CLASSLINK_ENV.some(name => env[name])) return null;
    const missing: string[] = CLASSLINK_ENV.filter(name => !env[name]?.trim());
    if (!env.BETTER_AUTH_URL?.trim()) missing.push("BETTER_AUTH_URL");
    if (missing.length) {
        throw new Error(
            `ClassLink requires all configuration variables: ${missing.join(", ")}`,
        );
    }
    const production = env.NODE_ENV === "production";
    const issuer = env.CLASSLINK_ISSUER!.trim();
    authConfigUrl(issuer, "CLASSLINK_ISSUER", production);
    const auth = authConfigUrl(
        env.BETTER_AUTH_URL!,
        "BETTER_AUTH_URL",
        production,
    );
    if (auth.pathname !== "/") {
        throw new Error(
            "BETTER_AUTH_URL must be the canonical origin without a path when ClassLink is enabled",
        );
    }
    return {
        issuer,
        clientId: env.CLASSLINK_CLIENT_ID!.trim(),
        clientSecret: env.CLASSLINK_CLIENT_SECRET!,
        authOrigin: auth.origin,
    };
}

/**
 * Every env var the server needs in order to start at all.
 *
 * `BETTER_AUTH_URL` and `CHII_DOMAIN` have defaults. Enabling ClassLink
 * additionally requires an explicit canonical `BETTER_AUTH_URL`.
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

    getClassLinkConfig();

    const secret = process.env.BETTER_AUTH_SECRET as string;
    if (secret.length < MIN_AUTH_SECRET_LENGTH) {
        throw new Error(
            `BETTER_AUTH_SECRET must be at least ${MIN_AUTH_SECRET_LENGTH} characters (got ${secret.length}). It signs every session token.`,
        );
    }
}
