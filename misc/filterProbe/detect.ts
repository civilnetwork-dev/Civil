/**
 * The verdict: did filter vendor `V` flag the proxy?
 *
 * A pure function of what the sandbox observed after loading a proxied route
 * with exactly one filter installed (see sandbox.ts) and the committed
 * `probeData.json`. Kept pure and separate from the harness for the usual
 * reason — it is the part with the real risk of being wrong, and it is the
 * part worth testing exhaustively without a browser, a tunnel or a wait.
 *
 * A broken probe is excluded first: a fetch failure or a 5xx from Civil
 * itself proves nothing about the vendor and must never read as "clean" (see
 * `fetchError`/`status` on `PageObservation`). Past that, five channels, most
 * direct evidence first:
 *
 *   1. `declarativeNetRequest` — the filter's own configured rules, asked
 *      directly whether they block this exact URL. Needs no rendered page,
 *      no wait, and no guess at what the resulting page would have looked
 *      like; a `redirect`-action match is folded into channel 2 below (it has
 *      a real destination host to check the same way).
 *   2. `location.href` — a filter that blocks redirects the tab to its own
 *      block page, so a final URL whose host sits under one of the vendor's
 *      domains is the clearest DOM-observable "flagged".
 *   3. a vendor block marker in the page text — a content script that blocks
 *      *in place* (rewrites the page or throws up an overlay) leaves its
 *      block-page wording behind. `pageText` is enriched with alt/aria/title
 *      attribute text, so an image-only overlay isn't invisible here.
 *   4. the vendor's own name in a blocking phrase, for a marker that's
 *      drifted from what's curated in probeData.json.
 *   5. a generic, vendor-agnostic fallback: the page's own text collapsed to
 *      a short fraction of what was served, matching no specific marker at
 *      all — catches an in-place block whose wording isn't curated yet.
 *
 * Attribution is not in question: the harness installs one filter at a time,
 * so "flagged" is always "flagged *by the vendor under test*". That is what
 * lets a marker as generic as "Access Denied" count — while only Securly is
 * loaded, Securly is who denied access.
 */

import type { DNRMatchResult } from "../extensionHost/types";
import type { ProbeData, VendorProbe } from "./buildProbeData";
import probeDataJson from "./probeData.json";

const PROBE_DATA = probeDataJson as ProbeData;

/** What the sandbox reports back for one proxied route under one filter. */
export interface PageObservation {
    /** The route that was opened, e.g. "/newtab". */
    route: string;
    /** `window.location.href` after the filter has had its fifteen seconds. */
    finalUrl: string;
    /** `document.body.innerText`, enriched with `alt`/`aria-label`/`title`
     *  attribute text and the document title — an image-only block overlay
     *  (a shield icon with no visible text run) leaves nothing in
     *  `textContent` alone. */
    pageText: string;
    /** Length of the page's own rendered text as originally served, before
     *  any content script ran — the baseline the generic dom-replaced check
     *  compares `pageText`'s final length against. */
    originalLength: number;
    /** HTTP status of the page fetch. Never vendor-driven — the fetch that
     *  produces this runs outside any extension's request pipeline, so a
     *  filter's content scripts and background have no way to affect it —
     *  only used to tell a broken probe apart from a real, clean read. */
    status?: number;
    /** Set when the page fetch itself failed outright (network/tunnel/DNS),
     *  after sandbox.ts's own retries. Same reasoning as `status`: proves
     *  nothing about the vendor, but must not be read as "clean" either. */
    fetchError?: string;
    /** The loaded filter's own declarativeNetRequest ruleset, asked directly
     *  whether it blocks this exact page URL (misc/extensionHost's
     *  `matchRequest`) — independent of whatever the rendered page ended up
     *  looking like, and of the fifteen-second wait entirely. */
    dnrMatch?: DNRMatchResult;
}

export type FlagSignal =
    | { kind: "redirect"; domain: string; finalHost: string }
    | { kind: "marker"; marker: string }
    | { kind: "vendor-name"; phrase: string }
    /** GoGuardian only (misc/filterProbe/goguardianCheck.ts): its own
     *  authenticated keyword model matched the route's URL/title/text
     *  directly, bypassing the sandboxed-extension observation this file
     *  otherwise assumes. */
    | { kind: "keyword-match"; keywords: string[] }
    /** The filter's own declarativeNetRequest rules block this URL — no
     *  redirect destination, just a hard block. A `redirect`-action DNR
     *  match is reported as the existing `"redirect"` kind instead (it has a
     *  real destination host to check against `probe.domains`, the same as
     *  a content-script-driven redirect). */
    | { kind: "dnr-block"; matchedRuleId: number }
    /** Generic, vendor-agnostic: the page's own text collapsed to a short
     *  fraction of what was served, with no specific marker or phrase
     *  matched — an in-place block whose exact wording isn't in
     *  probeData.json yet. */
    | { kind: "dom-replaced"; originalLength: number; finalLength: number }
    /** Not observed in the sandbox at all: the vendor's own cloud rating of
     *  the tunnel hostname (misc/filters/domainReputation) blocks it, so
     *  every route is blocked before any page-level signal could matter.
     *  The domain picker (misc/tunnel/pickDomain) exists to keep such a
     *  domain from ever being swept; this is the sweep refusing to report
     *  "ok" if one gets through anyway. */
    | { kind: "domain-rating"; hostname: string };

export interface Verdict {
    vendor: string;
    route: string;
    flagged: boolean;
    /** Present iff `flagged`. What tripped the detector — carried into the
     *  prediction step so it can point at the right Civil code. */
    signal?: FlagSignal;
}

function hostOf(url: string): string {
    try {
        return new URL(url).host.toLowerCase().replace(/:\d+$/, "");
    } catch {
        return "";
    }
}

function hostUnderDomain(host: string, domain: string): boolean {
    const d = domain.toLowerCase();
    return host === d || host.endsWith(`.${d}`);
}

/** A blocking phrase built around the vendor's own name, e.g. "blocked by
 *  GoGuardian". Catches an in-place block page that names the vendor even
 *  when its exact marker string has drifted between releases. */
function vendorNamePhrase(
    text: string,
    probe: VendorProbe,
): string | undefined {
    const name = probe.displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
        `(?:blocked|denied|restricted|filtered)[^.\\n]{0,40}${name}|${name}[^.\\n]{0,40}(?:blocked|denied|restricted|has blocked|web filter)`,
        "i",
    );
    return re.exec(text)?.[0]?.trim();
}

/**
 * The verdict for one observation under one vendor. `vendor` must be a key of
 * `probeData.json`; an unknown vendor is treated as "no data, not flagged"
 * rather than throwing, so a newly-tracked filter that hasn't been rescanned
 * yet degrades to a clean result instead of breaking the run.
 */
export function detectFlagging(
    observation: PageObservation,
    vendor: string,
): Verdict {
    const probe = PROBE_DATA[vendor];
    const base = { vendor, route: observation.route };
    if (!probe) return { ...base, flagged: false };

    // A probe that never actually loaded the page proves nothing about the
    // vendor — a broken/empty read must never pass as "clean". Checked before
    // any other signal so a marker-shaped string that happens to survive a
    // failed fetch (an empty string can't match anything anyway, but this
    // stays correct even if that ever changes) can't sneak a flag through
    // either.
    if (
        observation.fetchError ||
        (observation.status !== undefined &&
            (observation.status === 0 || observation.status >= 500))
    )
        return { ...base, flagged: false };

    // 1. The filter's own declarativeNetRequest rules, asked directly — a
    //    match here needed no rendered page and no wait at all.
    if (observation.dnrMatch) {
        const { action, matchedRuleId, redirectUrl } = observation.dnrMatch;
        if (action === "redirect" && redirectUrl) {
            const finalHost = hostOf(redirectUrl);
            // Prefer the canonical probe domain when the redirect lands
            // under one; otherwise the host itself is the finding — a DNR
            // redirect nobody's curated yet, which is exactly the top-ranked
            // case predictFix already has a suggestion for.
            const domain =
                probe.domains.find(d => hostUnderDomain(finalHost, d)) ??
                finalHost;
            return {
                ...base,
                flagged: true,
                signal: { kind: "redirect", domain, finalHost },
            };
        }
        if (action === "block" && matchedRuleId !== null) {
            return {
                ...base,
                flagged: true,
                signal: { kind: "dnr-block", matchedRuleId },
            };
        }
    }

    // 2. Redirected onto a vendor block-page host (content-script/background
    //    driven — chrome.tabs.update or a location.href write).
    const finalHost = hostOf(observation.finalUrl);
    for (const domain of probe.domains) {
        if (hostUnderDomain(finalHost, domain))
            return {
                ...base,
                flagged: true,
                signal: { kind: "redirect", domain, finalHost },
            };
    }

    // 3. A vendor block marker in the page text.
    const haystack = observation.pageText.toLowerCase();
    for (const marker of probe.blockMarkers) {
        if (haystack.includes(marker.toLowerCase()))
            return {
                ...base,
                flagged: true,
                signal: { kind: "marker", marker },
            };
    }

    // 4. The vendor's name in a blocking phrase.
    const phrase = vendorNamePhrase(observation.pageText, probe);
    if (phrase)
        return {
            ...base,
            flagged: true,
            signal: { kind: "vendor-name", phrase },
        };

    // 5. Generic, vendor-agnostic fallback: the page's own text collapsed to
    //    a short fraction of what was served, matching no specific marker —
    //    an in-place block whose exact wording isn't curated yet (a new
    //    release, or a vendor with no distinctive block text at all). Both
    //    conditions must hold, not just one: a real block page is both short
    //    in absolute terms and a small fraction of a real app shell.
    // ponytail: thresholds picked by eyeball against the block pages already
    // in probeData.json, not fit to a corpus — loosen/tighten if this misses
    // a real block or trips on a legitimately terse route.
    const finalLength = observation.pageText.length;
    if (
        observation.originalLength >= 200 &&
        finalLength < observation.originalLength * 0.25 &&
        finalLength < 400
    )
        return {
            ...base,
            flagged: true,
            signal: {
                kind: "dom-replaced",
                originalLength: observation.originalLength,
                finalLength,
            },
        };

    return { ...base, flagged: false };
}

export { PROBE_DATA };
