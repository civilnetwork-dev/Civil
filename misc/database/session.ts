import { auth } from "./auth";
import { cached, sessionKey } from "./cache";

/**
 * Name of the cookie better-auth stores the session token in. Kept in one place
 * so a change to better-auth's cookie naming is a one-line edit rather than a
 * hunt through run.ts, the Express middleware and the GraphQL resolvers.
 */
export const SESSION_COOKIE_NAME = "better-auth.session_token";

export type ResolvedSession = Awaited<
    ReturnType<typeof auth.api.getSession>
> | null;

/**
 * Pull the session token out of an Authorization header or a Cookie header.
 * Bearer wins when both are present.
 *
 * The cookie value is returned raw (still percent-encoded, if it was encoded).
 * `resolveSession` hands it straight back to better-auth, which does its own
 * decoding, so decoding here would double-decode.
 */
function tokenFromHeaderPair(
    authorization: string | undefined,
    cookie: string | undefined,
): string | undefined {
    const bearer = authorization?.replace("Bearer ", "").trim();
    if (bearer) return bearer;

    const entry = cookie
        ?.split(";")
        .find(c => c.trim().startsWith(`${SESSION_COOKIE_NAME}=`));
    if (!entry) return undefined;

    // Split on the FIRST "=" only: token values may legitimately contain "="
    // (base64 padding), and `split("=")[1]` would truncate them.
    const value = entry.slice(entry.indexOf("=") + 1).trim();
    return value || undefined;
}

/** Extract the session token from a Fetch API `Headers` object. */
export function extractSessionTokenFromHeaders(
    headers: Headers,
): string | undefined {
    return tokenFromHeaderPair(
        headers.get("authorization") ?? undefined,
        headers.get("cookie") ?? undefined,
    );
}

/** Extract the session token from a Node/Express request. */
export function extractSessionTokenFromRequest(req: {
    headers: {
        authorization?: string;
        cookie?: string;
    };
}): string | undefined {
    return tokenFromHeaderPair(req.headers.authorization, req.headers.cookie);
}

/**
 * Resolve a session token to a session, cached in Redis for 60s.
 * Returns null for a missing token, an invalid token, or any lookup failure —
 * callers treat all three as "not authenticated".
 */
export async function resolveSession(
    token: string | undefined,
): Promise<ResolvedSession> {
    if (!token) return null;
    return cached(
        sessionKey(token),
        () =>
            auth.api.getSession({
                headers: new Headers({
                    cookie: `${SESSION_COOKIE_NAME}=${token}`,
                    authorization: `Bearer ${token}`,
                }),
            }),
        60,
    ).catch(() => null);
}

/** Convenience: token extraction + resolution for a Fetch API request. */
export function resolveSessionFromHeaders(
    headers: Headers,
): Promise<ResolvedSession> {
    return resolveSession(extractSessionTokenFromHeaders(headers));
}

/** Convenience: token extraction + resolution for a Node/Express request. */
export function resolveSessionFromRequest(req: {
    headers: { authorization?: string; cookie?: string };
}): Promise<ResolvedSession> {
    return resolveSession(extractSessionTokenFromRequest(req));
}
