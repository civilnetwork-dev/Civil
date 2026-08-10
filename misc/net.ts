/**
 * Hosts that must never be reachable through a server-side fetch.
 *
 * This is an SSRF guard, not a convenience filter. `/api/ext-proxy` and
 * `/api/best-proxy` both take a user-supplied URL and fetch it from inside the
 * network the app is deployed in, so without this check a user could reach
 * Postgres, Redis, the metadata service of a cloud host, or anything else on
 * the private network.
 *
 * Extracted from run.ts so it can be unit-tested. See tests/net.test.ts.
 */
export function isPrivateHost(hostname: string): boolean {
    const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
        h === "localhost" ||
        h === "127.0.0.1" ||
        h === "::1" ||
        h === "::" ||
        h.endsWith(".local") ||
        h.endsWith(".internal") ||
        h.endsWith(".localhost")
    ) {
        return true;
    }
    return (
        /^10\./.test(h) ||
        /^192\.168\./.test(h) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
        /^169\.254\./.test(h) ||
        /^127\./.test(h) ||
        /^0\./.test(h) ||
        /^fc00:/i.test(h) ||
        /^fd[0-9a-f]{2}:/i.test(h) ||
        /^fe80:/i.test(h)
    );
}
