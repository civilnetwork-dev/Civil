/**
 * The verdict: did filter vendor `V` flag the proxy?
 *
 * A pure function of what the sandbox observed after loading a proxied route
 * with exactly one filter installed (see sandbox.ts) and the committed
 * `probeData.json`. Kept pure and separate from the harness for the usual
 * reason — it is the part with the real risk of being wrong, and it is the
 * part worth testing exhaustively without a browser, a tunnel or a fifteen-
 * second wait.
 *
 * The two checks are exactly the task's step 3:
 *
 *   1. `location.href` — a filter that blocks redirects the tab to its own
 *      block page, so a final URL whose host sits under one of the vendor's
 *      domains is the clearest possible "flagged".
 *   2. proxy-flagging content — a filter that blocks *in place* (a content
 *      script that rewrites the page or throws up an overlay) leaves its
 *      block-page wording in the DOM. A vendor block marker, or the vendor's
 *      own name in a blocking phrase, appearing in the page text is that.
 *
 * Attribution is not in question: the harness installs one filter at a time,
 * so "flagged" is always "flagged *by the vendor under test*". That is what
 * lets a marker as generic as "Access Denied" count — while only Securly is
 * loaded, Securly is who denied access.
 */

import type { ProbeData, VendorProbe } from "./buildProbeData";
import probeDataJson from "./probeData.json";

const PROBE_DATA = probeDataJson as ProbeData;

/** What the sandbox reports back for one proxied route under one filter. */
export interface PageObservation {
    /** The route that was opened, e.g. "/newtab". */
    route: string;
    /** `window.location.href` after the filter has had its fifteen seconds. */
    finalUrl: string;
    /** `document.body.innerText` (or the served text when there is no DOM). */
    pageText: string;
}

export type FlagSignal =
    | { kind: "redirect"; domain: string; finalHost: string }
    | { kind: "marker"; marker: string }
    | { kind: "vendor-name"; phrase: string }
    /** GoGuardian only (misc/filterProbe/goguardianCheck.ts): its own
     *  authenticated keyword model matched the route's URL/title/text
     *  directly, bypassing the sandboxed-extension observation this file
     *  otherwise assumes. */
    | { kind: "keyword-match"; keywords: string[] };

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

    // 1. Redirected onto a vendor block-page host.
    const finalHost = hostOf(observation.finalUrl);
    for (const domain of probe.domains) {
        if (hostUnderDomain(finalHost, domain))
            return {
                ...base,
                flagged: true,
                signal: { kind: "redirect", domain, finalHost },
            };
    }

    // 2. A vendor block marker in the page text.
    const haystack = observation.pageText.toLowerCase();
    for (const marker of probe.blockMarkers) {
        if (haystack.includes(marker.toLowerCase()))
            return {
                ...base,
                flagged: true,
                signal: { kind: "marker", marker },
            };
    }

    // 3. The vendor's name in a blocking phrase.
    const phrase = vendorNamePhrase(observation.pageText, probe);
    if (phrase)
        return {
            ...base,
            flagged: true,
            signal: { kind: "vendor-name", phrase },
        };

    return { ...base, flagged: false };
}

export { PROBE_DATA };
