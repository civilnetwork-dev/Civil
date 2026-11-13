/**
 * GoGuardian, checked through the real authenticated client
 * (misc/filters/goguardian/checker.ts) rather than the sandboxed-extension
 * path every other vendor here uses.
 *
 * The authenticated checker downloads legacy keyword models and scores the
 * page locally. A hit gives the probe a keyword signal. Enforcement depends
 * on school policy and is evaluated separately by the extension.
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

/** The diagnostic page fetch, retried a couple of times before giving up. A
 *  transient tunnel hiccup must not be laundered into a false "not flagged"
 *  verdict by matching the keyword model against empty title/text: that was
 *  the previous behavior, and it's indistinguishable from a real clean read
 *  in the report. Exhausting retries throws instead, which the harness's
 *  existing per-combo try/catch already turns into a reported error rather
 *  than a fabricated verdict. */
async function fetchPageWithRetry(
    url: string,
    doFetch: typeof fetch,
    attempts = 3,
): Promise<string> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await (await doFetch(url)).text();
        } catch (error) {
            lastError = error;
            if (attempt < attempts)
                await new Promise(resolve =>
                    setTimeout(resolve, 300 * attempt),
                );
        }
    }
    throw new Error(
        `could not fetch ${url} after ${attempts} attempts: ${
            lastError instanceof Error ? lastError.message : String(lastError)
        }`,
    );
}

export async function checkGoGuardianRoute(
    url: string,
    route: string,
    /** Defaults to global `fetch`; a test or caller injects a stub/wrapper:
     *  see sandbox.ts's identical `fetchImpl` for why. */
    fetchImpl: typeof fetch = fetch,
): Promise<Verdict> {
    const html = await fetchPageWithRetry(url, fetchImpl);

    const result = await checkGoGuardianFilterAuthenticated(
        { url, title: extractTitle(html), text: extractText(html) },
        { orgRands, extensionVersion: await extensionVersion() },
    );

    if (result.isErr()) {
        throw new Error(
            `GoGuardian check failed (${result.error.type}): ${result.error.message}`,
        );
    }

    const { matched } = result.value;
    if (!matched.length) return { vendor: "goguardian", route, flagged: false };

    return {
        vendor: "goguardian",
        route,
        flagged: true,
        signal: { kind: "keyword-match", keywords: matched },
    };
}
