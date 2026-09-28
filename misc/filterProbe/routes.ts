/**
 * The Civil routes the harness exercises against each filter.
 *
 * These are the user-facing pages a student actually lands on — the ones a
 * filter watches and blocks — plus the proxy service prefix, which is the one
 * that matters most: it is Civil rewriting a *third-party* site, and the point
 * a filter is most likely to flag.
 *
 * Discovered from `src/routes/*.tsx` (the TanStack file routes) and `run.ts`
 * (the server mounts). Kept as a written list rather than derived at runtime
 * because the harness has to name each route in its report and, for the proxy
 * prefix, pick a representative third-party target to fetch through it.
 */

export interface CivilRoute {
    /** Path opened through the proxy, e.g. "/newtab". */
    path: string;
    /** What the route is, for the report. */
    label: string;
    /**
     * For the proxy service prefix, a third-party URL to route *through* Civil
     * — the real test of whether a filter flags a proxied site. Absent for
     * Civil's own pages, which are fetched directly.
     */
    proxyTarget?: string;
}

export const CIVIL_ROUTES: readonly CivilRoute[] = [
    { path: "/", label: "landing" },
    { path: "/newtab", label: "new tab" },
    { path: "/apps", label: "apps" },
    { path: "/bookmarks", label: "bookmarks" },
    { path: "/history", label: "history" },
    { path: "/extensions", label: "extensions" },
    { path: "/checkfilters", label: "filter check" },
    { path: "/baninfo", label: "ban info" },
    // The proxy itself, exercising a real third-party site through Civil's
    // Scramjet path — the case a filter is likeliest to catch. `example.com`
    // is chosen because it is inoffensive and always up; the point is the
    // *proxying*, not the destination.
    {
        path: "/~/scramjet/",
        label: "proxy (scramjet)",
        proxyTarget: "https://example.com/",
    },
];
