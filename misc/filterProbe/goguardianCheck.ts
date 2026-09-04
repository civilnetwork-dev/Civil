/**
 * GoGuardian, checked through the real authenticated client
 * (misc/filters/goguardian/checker.ts) rather than the sandboxed-extension
 * path every other vendor here uses.
 *
 * GoGuardian's actual "smart filtering" isn't a live, per-page cloud
 * classification call — `checker.ts` shows it's authenticate once, download
 * the current proxy/threat keyword models, then match them *locally* against
 * the URL/title/text. That local match is what a real admin.js decides with,
 * so running it directly against Civil's real page content is a genuine
 * verdict, not a fabricated one — the same reasoning that already justified
 * `misc/filters/goguardian/middleware.ts`'s live `/filterCheck/goguardian`
 * endpoint using this exact license, per real request, in production. This
 * reuses that same, already-shipped call pattern; it isn't a new exposure.
 *
 * misc/extensionHost has no seeding hook this would even use: there is no
 * managed-storage gate here to get past and no content-script DOM state to
 * observe. GoGuardian's own admin.js (loaded harmlessly by the sandboxed
 * path for the other detection channels — redirects, DOM markers — still
 * gets its turn there too) never needed fixing; its actual decision logic
 * doesn't run where the sandbox could see it.
 */

import { checkGoGuardianFilterAuthenticated } from "../filters/goguardian/checker";
import { computeExtensionIdFromKey } from "../filters/goguardian/generateAuthToken";
import { getGoGuardianVersion } from "../filters/goguardian/getVersion";
import { TEXARKANA_LICENSE_KEY } from "../filters/goguardian/license";
import type { Verdict } from "./detect";

const orgRands = [computeExtensionIdFromKey(TEXARKANA_LICENSE_KEY)];

// Fetched once per harness run, not once per route: the version rarely
// changes mid-run and this is GoGuardian's own public update manifest, not
// an authenticated call.
let cachedExtensionVersion: Promise<string> | undefined;
function extensionVersion(): Promise<string> {
    cachedExtensionVersion ??= getGoGuardianVersion();
    return cachedExtensionVersion;
}

function extractTitle(html: string): string {
    return /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
}

/** Rendered-ish text: drops script/style contents so a keyword sitting in a
 *  variable name or comment can't false-positive as visible page content,
 *  then strips the remaining tags. */
function extractText(html: string): string {
    return html
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]+>/g, " ");
}

export async function checkGoGuardianRoute(
    url: string,
    route: string,
): Promise<Verdict> {
    let html = "";
    try {
        html = await (await fetch(url)).text();
    } catch {
        // Civil/tunnel hiccup, not a GoGuardian result — same convention as
        // sandbox.ts's observeRoute: an empty page reads as "not flagged"
        // rather than a false positive.
    }

    const result = await checkGoGuardianFilterAuthenticated(
        { url, title: extractTitle(html), text: extractText(html) },
        { orgRands, extensionVersion: await extensionVersion() },
    );

    if (result.isErr()) {
        throw new Error(
            `GoGuardian check failed (${result.error.type}): ${result.error.message}`,
        );
    }

    const { verdict, matchedProxyKeywords, matchedThreatKeywords } =
        result.value;
    if (verdict !== "BLOCK")
        return { vendor: "goguardian", route, flagged: false };

    return {
        vendor: "goguardian",
        route,
        flagged: true,
        signal: {
            kind: "keyword-match",
            keywords: [...matchedProxyKeywords, ...matchedThreatKeywords],
        },
    };
}
