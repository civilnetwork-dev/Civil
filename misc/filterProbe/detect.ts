/**
 * The verdict: did filter vendor `V` flag the proxy?
 *
 * A pure function of what the sandbox observed after loading a proxied route
 * with exactly one filter installed (see sandbox.ts) and the committed
 * `probeData.json`. Kept pure and separate from the harness for the usual
 * reason: it is the part with the real risk of being wrong, and it is the
 * part worth testing exhaustively without a browser, a tunnel or a wait.
 *
 * A broken probe is excluded first: a fetch failure or a 5xx from Civil
 * itself proves nothing about the vendor and must never read as "clean" (see
 * `fetchError`/`status` on `PageObservation`). Past that, five channels, most
 * direct evidence first:
 *
 *   1. `declarativeNetRequest`: the filter's own configured rules, asked
 *      directly whether they block this exact URL. Needs no rendered page,
 *      no wait, and no guess at what the resulting page would have looked
 *      like; a `redirect`-action match is folded into channel 2 below (it has
 *      a real destination host to check the same way).
 *   2. `location.href`: a filter that blocks redirects the tab to its own
 *      block page, so a final URL whose host sits under one of the vendor's
 *      domains, or on one of its `blockPages` (most live inside the
 *      extension itself), is the clearest DOM-observable "flagged".
 *   3. a vendor block marker in the page text: a content script that blocks
 *      *in place* (rewrites the page or throws up an overlay) leaves its
 *      block-page wording behind. `pageText` is enriched with alt/aria/title
 *      attribute text, so an image-only overlay isn't invisible here.
 *   4. the vendor's own name in a blocking phrase, for a marker that's
 *      drifted from what's curated in probeData.json.
 *   5. a generic, vendor-agnostic fallback: the page's own text collapsed to
 *      a short fraction of what was served, matching no specific marker at
 *      all: catches an in-place block whose wording isn't curated yet.
 *
 * Attribution is not in question: the harness installs one filter at a time,
 * so "flagged" is always "flagged *by the vendor under test*". That is what
 * lets a marker as generic as "Access Denied" count, while only Securly is
 * loaded, Securly is who denied access.
 */

import type { DNRMatchResult } from "../extensionHost/types";
import type { ProbeData, VendorProbe } from "./buildProbeData";
import probeDataJson from "./probeData.json";

const PROBE_DATA = probeDataJson as ProbeData;
const INTERCLASS_BLOCK_MODES = new Set([
    "blocked",
    "outoftime",
    "safetyinput",
    "cumulativelimit",
]);

/** What the sandbox reports back for one proxied route under one filter. */
export interface PageObservation {
    /** The route that was opened, e.g. "/newTab". */
    route: string;
    /** Runtime ID assigned to the filter under test. */
    extensionId?: string;
    /** `window.location.href` after the filter has had its fifteen seconds. */
    finalUrl: string;
    /** `document.body.textContent`, enriched with `alt`/`aria-label`/`title`
     *  attribute text and the document title: an image-only block overlay
     *  (a shield icon with no visible text run) leaves nothing in
     *  `textContent` alone. */
    pageText: string;
    /** The same text extraction before any content scripts run. */
    originalPageText?: string;
    /** Length of the page's own extracted text as originally served, before
     *  any content script ran: the baseline the generic dom-replaced check
     *  compares `pageText`'s final length against. */
    originalLength: number;
    /** HTTP status of the page fetch. Never vendor-driven (the fetch that
     *  produces this runs outside any extension's request pipeline, so a
     *  filter's content scripts and background have no way to affect it),
     *  so it is only used to tell a broken probe apart from a real, clean read. */
    status?: number;
    /** Set when the page fetch itself failed outright (network/tunnel/DNS),
     *  after sandbox.ts's own retries. Same reasoning as `status`: proves
     *  nothing about the vendor, but must not be read as "clean" either. */
    fetchError?: string;
    /** The direct page fetch received a redirect outside extension execution. */
    networkRedirectUrl?: string;
    /** A partial observation can still contain a block from a content script. */
    backgroundError?: string;
    /** A matching manifest content script failed to load or execute. */
    contentScriptError?: string;
    /** Detached VM rejections cannot be observed in this runtime. */
    asyncContainmentIncomplete?: string;
    /** The extension closed the synthetic tab without necessarily stating why. */
    tabRemoved?: boolean;
    /** A blocking webRequest handler matched the page but was not dispatched. */
    unreplayedBlockingRequest?: boolean;
    /** A matching declared blocking listener synchronously cancelled the request. */
    webRequestCancelled?: boolean;
    /** The loaded filter's own declarativeNetRequest ruleset, asked directly
     *  whether it blocks this exact page URL (misc/extensionHost's
     *  `matchRequest`): independent of whatever the rendered page ended up
     *  looking like, and of the fifteen-second wait entirely. */
    dnrMatch?: DNRMatchResult;
}

export type FlagSignal =
    | { kind: "redirect"; domain: string; finalHost: string }
    /** The tab landed on one of the vendor's own block pages
     *  (`probeData.json`'s `blockPages`): most filters keep theirs inside
     *  the extension (`chrome-extension://<id>/blocked.html`), whose host is
     *  an extension id no domain list can name. */
    | { kind: "block-page"; page: string; finalUrl: string }
    | { kind: "marker"; marker: string }
    | { kind: "vendor-name"; phrase: string }
    /** GoGuardian only (misc/filterProbe/goguardianCheck.ts): its own
     *  authenticated keyword model matched the route's URL/title/text
     *  directly, bypassing the sandboxed-extension observation this file
     *  otherwise assumes. */
    | { kind: "keyword-match"; keywords: string[] }
    /** The filter's own declarativeNetRequest rules block this URL: no
     *  redirect destination, just a hard block. A `redirect`-action DNR
     *  match is reported as the existing `"redirect"` kind instead (it has a
     *  real destination host to check against `probe.domains`, the same as
     *  a content-script-driven redirect). */
    | { kind: "dnr-block"; matchedRuleId: number }
    | { kind: "web-request-block" }
    /** Generic, vendor-agnostic: the page's own text collapsed to a short
     *  fraction of what was served, with no specific marker or phrase
     *  matched: an in-place block whose exact wording isn't in
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
    /** Why this observation cannot establish a block or a clean read. */
    inconclusive?: string;
    /** Present iff `flagged`. What tripped the detector: carried into the
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

/** A probe that never actually loaded the page proves nothing. */
export function probeFailure(observation: PageObservation): string | undefined {
    if (observation.fetchError) return observation.fetchError;
    if (observation.networkRedirectUrl)
        return `Page fetch redirected to ${observation.networkRedirectUrl}`;
    if (
        observation.status !== undefined &&
        (observation.status === 0 || observation.status >= 500)
    )
        return `HTTP ${observation.status}`;
    return undefined;
}

/**
 * The vendor block page `url` is on, if any. A hosted page, `host/path`,
 * matches that host or any subdomain with a path under it; an extension page,
 * `chrome-extension:file`, matches the runtime ID when known and permits
 * locale folders before the filename.
 */
function blockPageOf(
    url: string,
    probe: VendorProbe,
    extensionId?: string,
): string | undefined {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return undefined;
    }
    return probe.blockPages.find(page => {
        if (page.startsWith("chrome-extension:"))
            return (
                parsed.protocol === "chrome-extension:" &&
                (extensionId === undefined ||
                    parsed.hostname === extensionId) &&
                parsed.pathname.endsWith(
                    `/${page.slice("chrome-extension:".length)}`,
                )
            );
        const slash = page.indexOf("/");
        return (
            hostUnderDomain(
                parsed.hostname.toLowerCase(),
                page.slice(0, slash),
            ) && parsed.pathname.startsWith(page.slice(slash))
        );
    });
}

/** 1. The filter's own declarativeNetRequest rules, asked directly: a match
 *  here needed no rendered page and no wait at all. */
function dnrSignal(
    observation: PageObservation,
    probe: VendorProbe,
): FlagSignal | undefined {
    if (!observation.dnrMatch) return undefined;
    const { action, matchedRuleId, redirectUrl } = observation.dnrMatch;
    if (matchedRuleId === null) return undefined;
    if (action === "redirect" && redirectUrl) {
        const finalHost = hostOf(redirectUrl);
        // Prefer the canonical probe domain when the redirect lands under
        // one, then a known block page (one inside the extension has no
        // domain to block); otherwise the host itself is the finding: a DNR
        // redirect nobody's curated yet, which is exactly the top-ranked
        // case predictFix already has a suggestion for.
        const domain = probe.domains.find(d => hostUnderDomain(finalHost, d));
        if (domain) return { kind: "redirect", domain, finalHost };
        const page = blockPageOf(redirectUrl, probe, observation.extensionId);
        if (page) return { kind: "block-page", page, finalUrl: redirectUrl };
        return { kind: "redirect", domain: finalHost, finalHost };
    }
    if (action === "block") {
        return { kind: "dnr-block", matchedRuleId };
    }
    return undefined;
}

/** 2. Redirected onto a vendor block-page host (content-script/background
 *  driven: chrome.tabs.update or a location.href write). */
function redirectSignal(
    observation: PageObservation,
    probe: VendorProbe,
): FlagSignal | undefined {
    const finalHost = hostOf(observation.finalUrl);
    const domain = probe.domains.find(d => hostUnderDomain(finalHost, d));
    return domain ? { kind: "redirect", domain, finalHost } : undefined;
}

/** 2b. Sent to one of the vendor's own block pages that no vendor domain
 *  covers: one inside its extension, or one on shared hosting. */
function blockPageSignal(
    observation: PageObservation,
    probe: VendorProbe,
): FlagSignal | undefined {
    const page = blockPageOf(
        observation.finalUrl,
        probe,
        observation.extensionId,
    );
    return page
        ? { kind: "block-page", page, finalUrl: observation.finalUrl }
        : undefined;
}

/** 3. A vendor block marker in the page text. */
function markerSignal(
    observation: PageObservation,
    probe: VendorProbe,
): FlagSignal | undefined {
    const haystack = observation.pageText.toLowerCase();
    const original = observation.originalPageText?.toLowerCase();
    const marker = probe.blockMarkers.find(m => {
        const text = m.toLowerCase();
        return haystack.includes(text) && !original?.includes(text);
    });
    return marker === undefined ? undefined : { kind: "marker", marker };
}

function fortiguardRatingFailure(
    observation: PageObservation,
    vendor: string,
): string | undefined {
    if (vendor !== "fortiguard") return undefined;
    const match = observation.dnrMatch;
    if (match?.action === "block" && match.matchedRuleId !== null)
        return undefined;
    const outagePage = "chrome-extension:blocked_page_FGD_down.htm";
    const redirectUrl =
        match?.action === "redirect" && match.matchedRuleId !== null
            ? match.redirectUrl
            : undefined;
    const outageRedirect = [observation.finalUrl, redirectUrl].some(
        url =>
            url &&
            blockPageOf(
                url,
                PROBE_DATA.fortiguard!,
                observation.extensionId,
            ) === outagePage,
    );
    const marker = "the fortiguard url rating service is inaccessible";
    if (
        outageRedirect ||
        (observation.pageText.toLowerCase().includes(marker) &&
            !observation.originalPageText?.toLowerCase().includes(marker))
    )
        return "FortiGuard blocked access while its URL rating service was unavailable";
    return undefined;
}

/** 4. The vendor's name in a blocking phrase. */
function vendorNameSignal(
    observation: PageObservation,
    probe: VendorProbe,
): FlagSignal | undefined {
    const phrase = vendorNamePhrase(observation.pageText, probe);
    const original = observation.originalPageText?.toLowerCase();
    return phrase && !original?.includes(phrase.toLowerCase())
        ? { kind: "vendor-name", phrase }
        : undefined;
}

/**
 * 5. Generic, vendor-agnostic fallback: the page's own text collapsed to a
 * short fraction of what was served, matching no specific marker: an
 * in-place block whose exact wording isn't curated yet (a new release, or a
 * vendor with no distinctive block text at all). Both conditions must hold,
 * not just one: a real block page is both short in absolute terms and a
 * small fraction of a real app shell.
 */
function domReplacedSignal(
    observation: PageObservation,
): FlagSignal | undefined {
    // ponytail: thresholds picked by eyeball against the block pages already
    // in probeData.json, not fit to a corpus: loosen/tighten if this misses
    // a real block or trips on a legitimately terse route.
    const finalLength = observation.pageText.length;
    if (
        observation.originalLength >= 200 &&
        finalLength < observation.originalLength * 0.25 &&
        finalLength < 400
    )
        return {
            kind: "dom-replaced",
            originalLength: observation.originalLength,
            finalLength,
        };
    return undefined;
}

function interclassFailure(
    observation: PageObservation,
    vendor: string,
): string | undefined {
    const match = observation.dnrMatch;
    if (
        vendor !== "interclass" ||
        (match?.action === "block" && match.matchedRuleId !== null)
    )
        return undefined;
    const redirectUrl =
        match?.action === "redirect" && match.matchedRuleId !== null
            ? match.redirectUrl
            : undefined;
    for (const url of [observation.finalUrl, redirectUrl]) {
        if (!url) continue;
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            continue;
        }
        if (
            parsed.protocol !== "chrome-extension:" ||
            (observation.extensionId !== undefined &&
                parsed.hostname !== observation.extensionId) ||
            !parsed.pathname.endsWith("/message-page.html")
        )
            continue;
        const mode = parsed.searchParams.get("mode") ?? "";
        // InterCLASS 6.5 uses this same page for policy blocks and errors.
        // Unknown modes remain inconclusive rather than claiming an allow.
        if (!INTERCLASS_BLOCK_MODES.has(mode))
            return `InterCLASS message-page mode ${mode || "(missing)"} does not confirm a policy block`;
    }
    return undefined;
}

/**
 * The verdict for one observation under one vendor. A vendor missing from
 * `probeData.json` has no calibrated detection signals.
 */
export function detectFlagging(
    observation: PageObservation,
    vendor: string,
): Verdict {
    const base = { vendor, route: observation.route };
    if (!Object.hasOwn(PROBE_DATA, vendor))
        return {
            ...base,
            flagged: false,
            inconclusive: `No probe data for ${vendor}`,
        };
    const probe = PROBE_DATA[vendor];

    // A broken/empty read must never pass as "clean". Checked before any
    // other signal so a marker-shaped string that happens to survive a
    // failed fetch (an empty string can't match anything anyway, but this
    // stays correct even if that ever changes) can't sneak a flag through
    // either.
    const inconclusive =
        probeFailure(observation) ??
        interclassFailure(observation, vendor) ??
        fortiguardRatingFailure(observation, vendor);
    if (inconclusive) return { ...base, flagged: false, inconclusive };

    const signal: FlagSignal | undefined = observation.webRequestCancelled
        ? { kind: "web-request-block" }
        : (dnrSignal(observation, probe) ??
          redirectSignal(observation, probe) ??
          blockPageSignal(observation, probe) ??
          markerSignal(observation, probe) ??
          vendorNameSignal(observation, probe) ??
          domReplacedSignal(observation));

    const incomplete =
        observation.backgroundError ??
        observation.contentScriptError ??
        observation.asyncContainmentIncomplete ??
        (observation.tabRemoved
            ? "Filter closed the observed tab without a policy signal"
            : observation.unreplayedBlockingRequest
              ? "Matching blocking webRequest listener was not replayed"
              : undefined);
    return signal
        ? { ...base, flagged: true, signal }
        : {
              ...base,
              flagged: false,
              ...(incomplete && {
                  inconclusive: incomplete,
              }),
          };
}

export { PROBE_DATA };
