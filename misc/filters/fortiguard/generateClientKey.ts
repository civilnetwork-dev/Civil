import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

let cachedClientKey: string | undefined;

function generateClientKey(bytes = 32): string {
    return randomBytes(bytes).toString("hex");
}

/**
 * Returns the same generated key for the lifetime
 * of the current NodeJS/Bun process.
 */
export function getCachedClientKey(bytes = 32): string {
    cachedClientKey ??= generateClientKey(bytes);
    return cachedClientKey;
}

/**
 * Forces regeneration of the in-memory cached key.
 */
export function rotateClientKey(bytes = 32): string {
    cachedClientKey = generateClientKey(bytes);
    return cachedClientKey;
}

function signClientKey(clientKey: string, secret: string): string {
    return createHmac("sha256", secret).update(clientKey).digest("hex");
}

export function verifySignature(
    clientKey: string,
    signature: string,
    secret: string,
): boolean {
    const expected = Buffer.from(signClientKey(clientKey, secret), "hex");

    const received = Buffer.from(signature, "hex");

    return (
        expected.length === received.length &&
        timingSafeEqual(expected, received)
    );
}
