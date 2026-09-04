/**
 * chrome.declarativeNetRequest, plus the matcher that answers the question
 * this whole host exists for: does this extension's ruleset block this URL.
 *
 * Implements the documented DNR `urlFilter` grammar and the spec's rule
 * resolution order (https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest):
 * highest `priority` wins; at equal priority, allow/allowAllRequests beats
 * block beats upgradeScheme beats redirect beats modifyHeaders.
 *
 * ponytail: `requestDomains`/`excludedRequestDomains` and `tabIds` conditions
 * are not implemented — no vendor bundle inspected while building this used
 * them, and both need real per-request context (tab identity, resolved
 * request domain vs initiator) this synthetic host doesn't carry yet. Add
 * when a vendor ruleset actually needs them.
 */

import type { DNRRuleset, ExtensionState } from "../state";
import type { DNRMatchResult } from "../types";
import { crossRealm } from "./clone";

const ACTION_RANK: Record<DNRRuleset["action"]["type"], number> = {
    allow: 0,
    allowAllRequests: 0,
    block: 1,
    upgradeScheme: 2,
    redirect: 3,
    modifyHeaders: 4,
};

/** Compiles a DNR `urlFilter` pattern into a RegExp per the documented grammar. */
export function compileUrlFilter(
    filter: string,
    caseSensitive: boolean,
): RegExp {
    let pattern = filter;
    let anchorStart: "url" | "domain" | null = null;
    let anchorEnd = false;

    if (pattern.startsWith("||")) {
        anchorStart = "domain";
        pattern = pattern.slice(2);
    } else if (pattern.startsWith("|")) {
        anchorStart = "url";
        pattern = pattern.slice(1);
    }
    if (pattern.endsWith("|") && !pattern.endsWith("\\|")) {
        anchorEnd = true;
        pattern = pattern.slice(0, -1);
    }

    // Separator: end of URL, or any char that isn't alnum/_/-/./%.
    const SEP = "(?:[^A-Za-z0-9_.%-]|$)";
    let body = "";
    for (const ch of pattern) {
        if (ch === "*") body += ".*";
        else if (ch === "^") body += SEP;
        else body += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    let source: string;
    if (anchorStart === "domain") {
        // Matches right after `scheme://`, or right after `scheme://sub.` for
        // any number of subdomain labels — i.e. anchored to a domain-label
        // boundary, not just anywhere inside the host.
        source = `^[a-z-]+://([a-z0-9-]+\\.)*${body}`;
    } else if (anchorStart === "url") {
        source = `^${body}`;
    } else {
        source = body;
    }
    if (anchorEnd) source += "$";

    return new RegExp(source, caseSensitive ? "" : "i");
}

function conditionMatches(
    rule: DNRRuleset,
    url: string,
    opts: { resourceType?: string; initiator?: string; method?: string },
): boolean {
    const c = rule.condition;

    if (
        c.resourceTypes &&
        (!opts.resourceType || !c.resourceTypes.includes(opts.resourceType))
    )
        return false;
    if (
        c.excludedResourceTypes &&
        opts.resourceType &&
        c.excludedResourceTypes.includes(opts.resourceType)
    )
        return false;
    if (
        c.requestMethods &&
        (!opts.method || !c.requestMethods.includes(opts.method.toLowerCase()))
    )
        return false;

    if (c.initiatorDomains || c.excludedInitiatorDomains) {
        const initiatorHost = opts.initiator
            ? safeHostname(opts.initiator)
            : null;
        if (
            c.initiatorDomains &&
            (!initiatorHost ||
                !domainListIncludes(c.initiatorDomains, initiatorHost))
        )
            return false;
        if (
            c.excludedInitiatorDomains &&
            initiatorHost &&
            domainListIncludes(c.excludedInitiatorDomains, initiatorHost)
        )
            return false;
    }

    if (c.regexFilter) {
        const re = new RegExp(
            c.regexFilter,
            c.isUrlFilterCaseSensitive === false ? "i" : "",
        );
        if (!re.test(url)) return false;
    }
    if (c.urlFilter) {
        const re = compileUrlFilter(
            c.urlFilter,
            c.isUrlFilterCaseSensitive ?? false,
        );
        if (!re.test(url)) return false;
    }
    return true;
}

function safeHostname(url: string): string | null {
    try {
        return new URL(url).hostname;
    } catch {
        return null;
    }
}

/** True if `host` equals one of `domains`, or is a subdomain of one. */
function domainListIncludes(domains: string[], host: string): boolean {
    return domains.some(d => host === d || host.endsWith(`.${d}`));
}

export function matchUrl(
    state: ExtensionState,
    url: string,
    opts: { resourceType?: string; initiator?: string; method?: string } = {},
): DNRMatchResult {
    const candidates = [
        ...state.dynamicRules.values(),
        ...state.sessionRules.values(),
    ].filter(rule => conditionMatches(rule, url, opts));
    if (candidates.length === 0) return { action: "none", matchedRuleId: null };

    candidates.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return ACTION_RANK[a.action.type] - ACTION_RANK[b.action.type];
    });
    const winner = candidates[0]!;

    if (
        winner.action.type === "allow" ||
        winner.action.type === "allowAllRequests"
    ) {
        return { action: "allow", matchedRuleId: winner.id };
    }
    if (winner.action.type === "redirect") {
        return {
            action: "redirect",
            matchedRuleId: winner.id,
            redirectUrl: winner.action.redirect?.url,
        };
    }
    if (
        winner.action.type === "block" ||
        winner.action.type === "upgradeScheme"
    ) {
        return { action: "block", matchedRuleId: winner.id };
    }
    // modifyHeaders doesn't block or allow on its own.
    return { action: "none", matchedRuleId: null };
}

export function buildDeclarativeNetRequest(state: ExtensionState) {
    function apply(
        target: Map<number, DNRRuleset>,
        options: {
            removeRuleIds?: number[];
            addRules?: DNRRuleset[];
        },
    ): void {
        for (const id of options.removeRuleIds ?? []) target.delete(id);
        for (const rule of options.addRules ?? []) {
            if (target.has(rule.id)) {
                throw new Error(`Rule with id ${rule.id} already exists`);
            }
            target.set(rule.id, crossRealm(rule));
        }
    }

    return {
        updateDynamicRules: async (options: {
            removeRuleIds?: number[];
            addRules?: DNRRuleset[];
        }) => apply(state.dynamicRules, options),
        updateSessionRules: async (options: {
            removeRuleIds?: number[];
            addRules?: DNRRuleset[];
        }) => apply(state.sessionRules, options),
        getDynamicRules: async () => [...state.dynamicRules.values()],
        getSessionRules: async () => [...state.sessionRules.values()],
        MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES: 30_000,
    };
}
