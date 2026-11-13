import { PROXY_PREFIX } from "../config/shared/runtimeScripts";
import { encode } from "../config/shared/xorCodec";

/**
 * The Civil routes the harness exercises against each filter.
 *
 * These are the user-facing pages a student actually lands on, the ones a
 * filter watches and blocks, plus the proxy service prefix, which is the one
 * that matters most: it is Civil rewriting a *third-party* site, and the point
 * a filter is most likely to flag.
 *
 * Discovered from `src/routes/*.tsx` (the TanStack file routes) and `run.ts`
 * (the server mounts). Kept as a written list rather than derived at runtime
 * because the harness has to name each route in its report and, for the proxy
 * prefix, pick a representative third-party target to fetch through it.
 */

export interface CivilRoute {
    /** Path opened through the proxy, e.g. "/newTab". */
    path: string;
    /** What the route is, for the report. */
    label: string;
    /**
     * For the proxy service prefix, a third-party URL to route *through* Civil:
     * the real test of whether a filter flags a proxied site. Absent for
     * Civil's own pages, which are fetched directly.
     */
    proxyTarget?: string;
}

export function probeRouteUrl(
    baseUrl: string,
    path: string,
    proxyTarget?: string,
): string {
    return `${baseUrl.replace(/\/$/, "")}${path}${proxyTarget ? encode(proxyTarget) : ""}`;
}

export const CIVIL_ROUTES: readonly CivilRoute[] = [
    { path: "/", label: "landing" },
    { path: "/newTab", label: "new tab" },
    { path: "/apps", label: "apps" },
    { path: "/bookmarks", label: "bookmarks" },
    { path: "/history", label: "history" },
    { path: "/extensions", label: "extensions" },
    { path: "/settings", label: "settings" },
    { path: "/setup", label: "setup" },
    { path: "/connectionError", label: "connection error" },
    { path: "/checkFilters", label: "filter check" },
    { path: "/ban", label: "ban" },
    { path: "/banInfo", label: "ban info" },
    // This path requires a browser-controlled service worker to produce the
    // rewritten document. An HTTP-only sweep reports the cell as incomplete.
    {
        path: PROXY_PREFIX,
        label: "proxy (scramjet)",
        proxyTarget: "https://example.com/",
    },
];
