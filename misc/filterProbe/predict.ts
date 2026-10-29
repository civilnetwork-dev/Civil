/**
 * Given a filter that flagged the proxy, predict the Civil source that has to
 * change to stop it.
 *
 * A pure traversal of the Civil checkout (no network, no build) so it runs
 * in the harness and in a unit test against this very repository. It does not
 * rewrite anything; it produces a ranked list of `file:line` pointers with a
 * reason, which is what the task's step 4 asks for: "find out the code that
 * needs to be changed in order for the blocking to stop".
 *
 * The prediction is driven entirely by the flag *signal*, because the signal
 * says *how* the filter caught us, and that determines where the fix lives:
 *
 *   - A `redirect` onto a vendor domain means the filter reached its own
 *     backend. The fix is to block that domain. So: is the domain already in
 *     `filterVendorDomains`? If not, that is the single highest-ranked
 *     suggestion. Either way, the vendor's dedicated handler under
 *     `misc/filters/<vendor>/` is where domain-level behaviour belongs, and
 *     if the vendor has no handler yet, creating one is the suggestion.
 *   - A `marker` / `vendor-name` means the filter's *content script* blocked
 *     the page in place, before any request Civil could intercept. The fix is
 *     upstream in how Civil serves or rewrites the flagged route: the route's
 *     own source, the proxy rewrite layer, and the vendor handler that is
 *     meant to neutralise that content script.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { filterVendorDomains } from "../filters/filterBlockerMiddleware";
import type { Verdict } from "./detect";

export interface Suggestion {
    file: string;
    line?: number;
    reason: string;
    /** Higher runs first. */
    rank: number;
}

/** Where each vendor's dedicated handler lives, relative to the Civil root.
 *  A vendor absent here has no handler yet, which is itself a finding. */
const VENDOR_HANDLER_DIR: Record<string, string> = {
    blocksi: "misc/filters/blocksi",
    cisco: "misc/filters/cisco",
    fortiguard: "misc/filters/fortiguard",
    goguardian: "misc/filters/goguardian",
    hapara: "misc/filters/hapara",
    iboss: "misc/filters/iboss",
    lanschool: "misc/filters/lanschool",
    lightspeed: "misc/filters/lightspeed",
    linewize: "misc/filters/linewize",
    securly: "misc/filters/securly",
};

const MIDDLEWARE = "misc/filters/filterBlockerMiddleware.ts";

/** The 1-based line of the first occurrence of `needle` in a repo file, or
 *  undefined. Cheap substring scan: the files this points at are small. */
function lineOf(
    civilDir: string,
    relPath: string,
    needle: string,
): number | undefined {
    const abs = join(civilDir, relPath);
    if (!existsSync(abs)) return undefined;
    const lines = readFileSync(abs, "utf8").split("\n");
    const i = lines.findIndex(l => l.includes(needle));
    return i >= 0 ? i + 1 : undefined;
}

/** The route's own source file, if the path maps to one under src/routes. */
function routeSource(civilDir: string, route: string): string | undefined {
    const name =
        route === "/" ? "index" : route.replace(/^\//, "").split("/")[0];
    if (!name) return undefined;
    const rel = `src/routes/${name}.tsx`;
    return existsSync(join(civilDir, rel)) ? rel : undefined;
}

type Signal = NonNullable<Verdict["signal"]>;
type SignalOf<K extends Signal["kind"]> = Extract<Signal, { kind: K }>;

/** Where `vendor`'s filtering is neutralised, or where it would have to be. */
function handlerSuggestion(vendor: string, civilDir: string): Suggestion {
    const handlerDir = VENDOR_HANDLER_DIR[vendor];
    if (handlerDir && existsSync(join(civilDir, handlerDir))) {
        const middleware = `${handlerDir}/middleware.ts`;
        return {
            file: existsSync(join(civilDir, middleware))
                ? middleware
                : handlerDir,
            reason: `${vendor}'s dedicated handler, where its filtering behaviour is neutralised.`,
            rank: 40,
        };
    }
    return {
        file: `misc/filters/${vendor}/`,
        reason: `${vendor} has no dedicated handler yet; blocking it will need one.`,
        rank: 45,
    };
}

/** The proxy rewrite layer, for a flagged proxied-site route only. */
function rewriteLayerSuggestion(
    route: string,
    civilDir: string,
    reason: string,
    rank: number,
): Suggestion[] {
    const rewrite = "src/lib/useIframeManager.ts";
    return route.startsWith("/~/") && existsSync(join(civilDir, rewrite))
        ? [{ file: rewrite, reason, rank }]
        : [];
}

/** The route's own source, when the route has one, as a suggestion. */
function routeSourceSuggestion(
    route: string,
    civilDir: string,
    reason: string,
    rank: number,
): Suggestion[] {
    const source = routeSource(civilDir, route);
    return source ? [{ file: source, reason, rank }] : [];
}

function redirectSuggestions(
    vendor: string,
    signal: SignalOf<"redirect">,
    civilDir: string,
): Suggestion[] {
    const known = (
        filterVendorDomains as unknown as Record<string, readonly string[]>
    )[vendor]?.includes(signal.domain as never);
    if (!known) {
        return [
            {
                file: MIDDLEWARE,
                line: lineOf(civilDir, MIDDLEWARE, "filterVendorDomains"),
                reason: `Redirected to ${signal.finalHost}, but ${signal.domain} is not in filterVendorDomains. Add it so the proxy blocks the phone-home.`,
                rank: 100,
            },
        ];
    }
    // Domain is blocked yet the redirect still happened: the filter
    // reached it another way (its content script drove navigation, or
    // hit an unblocked subdomain path), so the fix is upstream.
    return [
        {
            file: MIDDLEWARE,
            line: lineOf(civilDir, MIDDLEWARE, signal.domain),
            reason: `${signal.domain} is already blocked, yet the page still reached ${signal.finalHost}, so the filter's content script drove the redirect; neutralise it in the vendor handler.`,
            rank: 60,
        },
    ];
}

function dnrBlockSuggestions(
    vendor: string,
    route: string,
    signal: SignalOf<"dnr-block">,
    civilDir: string,
): Suggestion[] {
    // The vendor's own declarativeNetRequest rules matched this exact
    // URL before any page even rendered. Those rules ship inside the
    // (static) extension bundle, so they cannot be keyed on this run's
    // randomly generated FreeDNS hostname: the match is almost
    // certainly on the URL's path/query shape, which is Civil's own
    // route/proxy structure, not a domain to add to a blocklist.
    return [
        ...routeSourceSuggestion(
            route,
            civilDir,
            `${vendor}'s declarativeNetRequest rules matched this URL directly (rule ${signal.matchedRuleId}), before the page even loaded. The rule ships in the bundle and can't target this run's random hostname, so it matched on the URL's path/query shape. This route's own URL structure is what to change.`,
            90,
        ),
        ...rewriteLayerSuggestion(
            route,
            civilDir,
            `The matched rule fired on the proxy route's URL shape; the rewrite layer controls what that URL looks like.`,
            85,
        ),
    ];
}

function inPlaceBlockSuggestions(
    vendor: string,
    route: string,
    signal: Signal,
    civilDir: string,
): Suggestion[] {
    // In-place block: the content script rewrote the page before any
    // request Civil could see. The fix is in how Civil serves/rewrites
    // the flagged route.
    return [
        ...routeSourceSuggestion(
            route,
            civilDir,
            `${vendor} blocked ${route} in place (${signal.kind}). This route's markup is what its content script matched against.`,
            70,
        ),
        {
            file: MIDDLEWARE,
            line: lineOf(civilDir, MIDDLEWARE, "createFilterBlockerMiddleware"),
            reason: `An in-place block bypasses the hostname blocklist. Civil needs to strip ${vendor}'s content script or its injected markers for this route.`,
            rank: 55,
        },
        // The proxy rewrite layer, for the proxied-site route specifically.
        ...rewriteLayerSuggestion(
            route,
            civilDir,
            `The flagged route is proxied content; the rewrite layer is where a filter's injected markers can be scrubbed before they render.`,
            65,
        ),
    ];
}

/** The suggestions that depend on how the filter flagged the route. */
function signalSuggestions(
    vendor: string,
    route: string,
    signal: Signal,
    civilDir: string,
): Suggestion[] {
    switch (signal.kind) {
        case "redirect":
            return redirectSuggestions(vendor, signal, civilDir);
        case "keyword-match":
            // GoGuardian only (misc/filterProbe/goguardianCheck.ts): its own
            // authenticated keyword model matched the route's content directly:
            // no content script or hostname involved, so neither the redirect
            // nor the generic in-place-block reasoning below is accurate for it.
            return routeSourceSuggestion(
                route,
                civilDir,
                `GoGuardian's keyword model matched this route's content (${signal.keywords.join(", ")}). This route's markup is what it matched against.`,
                70,
            );
        case "dnr-block":
            return dnrBlockSuggestions(vendor, route, signal, civilDir);
        default:
            return inPlaceBlockSuggestions(vendor, route, signal, civilDir);
    }
}

/**
 * Rank the Civil files that most likely need to change so `verdict.vendor`
 * stops flagging `verdict.route`. Returns [] for a clean verdict.
 */
export function predictFix(verdict: Verdict, civilDir: string): Suggestion[] {
    if (!verdict.flagged || !verdict.signal) return [];
    const { vendor, route, signal } = verdict;

    // Nothing in a route, a handler or the rewrite layer changes a cloud
    // rating of the hostname itself; the only fix is a different domain, and
    // the picker is what should have supplied one.
    if (signal.kind === "domain-rating") {
        return [
            {
                file: "misc/tunnel/pickDomain.ts",
                reason: `${vendor} rates ${signal.hostname} itself as blocked, so every route on it is, and no route-level change helps. This domain should never have been picked; check its ${vendor} checker in misc/filters/domainReputation.ts.`,
                rank: 100,
            },
        ];
    }

    return [
        handlerSuggestion(vendor, civilDir),
        ...signalSuggestions(vendor, route, signal, civilDir),
    ].toSorted((a, b) => b.rank - a.rank);
}
