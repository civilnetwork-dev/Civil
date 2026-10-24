/**
 * Whether `url` matches any of an extension's match patterns.
 * https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
 */
export function matchesAnyPattern(patterns: string[], url: string): boolean {
    try {
        const parsed = new URL(url);
        return patterns.some(pattern => matchesPattern(pattern, parsed));
    } catch {
        return false;
    }
}

function matchesPattern(pattern: string, u: URL): boolean {
    if (pattern === "<all_urls>") return true;
    const m = /^(\*|https?|ftp|file):\/\/(\*|[^/]*)(\/.*)?$/.exec(pattern);
    if (!m) return false;
    const [, scheme, host, path = "/*"] = m;
    if (scheme !== "*" && scheme !== u.protocol.slice(0, -1)) return false;
    if (host !== "*") {
        if (host.startsWith("*.")) {
            const base = host.slice(2);
            if (u.hostname !== base && !u.hostname.endsWith("." + base)) {
                return false;
            }
        } else if (u.hostname !== host) return false;
    }
    return new RegExp(
        "^" +
            path.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") +
            "$",
    ).test(u.pathname + (u.search ?? ""));
}
