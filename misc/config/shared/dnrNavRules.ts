/**
 * Extensions' declarativeNetRequest redirect rules for navigations, kept in
 * OPFS so the service worker can apply them to main-frame requests (this is how
 * Tampermonkey sends a `*.user.js` URL to its install page). Two writers fill
 * the directory: src/api/extensionRuntime.ts stores a manifest's static
 * rulesets as `<extId>.json` (a bare rule array), and the chrome shim stores
 * dynamic and session rules as `<extId>.runtime.json`
 * (`{ extensionId, rules }`). misc/config/service/sw.ts reads both.
 */
export const DNR_NAV_DIR = "_civil_dnr_nav";

/** The parts of a declarativeNetRequest rule a navigation redirect uses. */
export interface DnrNavRule {
    action?: {
        type?: string;
        redirect?: {
            url?: unknown;
            regexSubstitution?: unknown;
            extensionPath?: unknown;
        };
    };
    condition?: {
        resourceTypes?: string[];
        requestMethods?: string[];
        requestDomains?: string[];
        excludedRequestDomains?: string[];
        urlFilter?: string;
        regexFilter?: string;
        isUrlFilterCaseSensitive?: boolean;
    };
}

/** Whether a rule redirects a top-level or frame navigation, so the service
 *  worker needs a copy of it. */
export function isNavRedirectRule(rule: DnrNavRule): boolean {
    if (rule.action?.type !== "redirect") return false;
    const resourceTypes = rule.condition?.resourceTypes;
    return (
        !resourceTypes ||
        resourceTypes.includes("main_frame") ||
        resourceTypes.includes("sub_frame")
    );
}
