import type { DnrNavRule } from "./dnrNavRules";

/*
 * How the service worker matches a navigation against a stored redirect rule
 * (dnrNavRules.ts), and how a rule's substitution becomes a URL.
 */

function hostMatchesAny(hostname: string, domains: string[]): boolean {
    return domains.some(
        domain => hostname === domain || hostname.endsWith(`.${domain}`),
    );
}

/** Whether a rule's condition admits a main-frame GET navigation to `url`,
 *  which is `originalUrl` parsed. Filters test the unparsed string. */
export function navConditionMatches(
    cond: DnrNavRule["condition"],
    url: URL,
    originalUrl: string,
): boolean {
    if (cond?.resourceTypes && !cond.resourceTypes.includes("main_frame")) {
        return false;
    }
    if (
        cond?.requestMethods &&
        !cond.requestMethods.some(method => method.toLowerCase() === "get")
    ) {
        return false;
    }
    if (
        cond?.requestDomains &&
        !hostMatchesAny(url.hostname, cond.requestDomains)
    ) {
        return false;
    }
    if (
        cond?.excludedRequestDomains &&
        hostMatchesAny(url.hostname, cond.excludedRequestDomains)
    ) {
        return false;
    }

    // Match URL against condition. A regexFilter wins over a urlFilter even
    // when it does not compile.
    const pattern = cond?.regexFilter
        ? cond.regexFilter
        : cond?.urlFilter
          ? // Simple glob: * = wildcard, treat as substring match for common patterns
            cond.urlFilter
                .replace(/[.+?^${}()[\]\\]/g, "\\$&")
                .replace(/\*/g, ".*")
          : null;
    if (!pattern) return false;
    try {
        return new RegExp(pattern, "i").test(originalUrl);
    } catch {
        return false; // invalid pattern
    }
}

/** A DNR `regexSubstitution`, which writes `\0` for the whole match and
 *  `\1`–`\9` for capture groups, in the `$&`/`$1` form String.replace takes. */
export function dnrSubstitution(substitution: string): string {
    return substitution.replace(/\\0/g, "$$&").replace(/\\([1-9])/g, "$$$1");
}

/** The URL a matching redirect rule sends the navigation to, if it names one.
 *  An extension path resolves under `origin`'s `/civil-ext/`. */
export function navRedirectTarget(
    rule: DnrNavRule,
    extId: string,
    originalUrl: string,
    origin: string,
): string | null {
    const redirect = rule.action?.redirect;
    const regexFilter = rule.condition?.regexFilter;
    if (redirect?.url && typeof redirect.url === "string") {
        return redirect.url;
    }
    if (redirect?.regexSubstitution && regexFilter) {
        try {
            const flags = rule.condition?.isUrlFilterCaseSensitive ? "" : "i";
            return originalUrl.replace(
                new RegExp(regexFilter, flags),
                dnrSubstitution(redirect.regexSubstitution as string),
            );
        } catch {
            return null;
        }
    }
    if (redirect?.extensionPath && typeof redirect.extensionPath === "string") {
        // Extension-relative path, possibly with placeholders
        const path = redirect.extensionPath
            .replace(/^\//, "")
            .replace(
                /\[\[SPEC_URL\]\]|%SPEC_URL%/g,
                encodeURIComponent(originalUrl),
            )
            .replace(/\[\[URL\]\]|%URL%/g, encodeURIComponent(originalUrl));
        return `${origin}/civil-ext/${extId}/${path}`;
    }
    return null;
}
