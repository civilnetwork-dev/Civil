/**
 * A hostname the way the best-proxy cache (run.ts) and the browser's per-site
 * rules (src/lib/settings.ts) key it: lower-cased and without `www.`. Accepts
 * a bare host or a full URL; null when neither parses.
 */
export function hostKey(input: string): string | null {
    let raw = input.trim();
    if (!raw) return null;
    if (!/^[a-z][\w+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
    try {
        const host = new URL(raw).hostname.toLowerCase();
        return host.startsWith("www.") ? host.slice(4) : host;
    } catch {
        return null;
    }
}
