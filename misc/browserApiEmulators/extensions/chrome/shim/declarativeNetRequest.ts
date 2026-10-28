// Relative, not `$config/`: vite.config.ts bundles this shim with a bare
// rolldown call that resolves no aliases.
import {
    DNR_NAV_DIR,
    type DnrNavRule,
    isNavRedirectRule,
} from "../../../../config/shared/dnrNavRules";
import type { DNRRule } from "../types";
import { CivilEvent } from "./event";
import { dual, resolved } from "./util";

type RuleUpdate = { addRules?: DNRRule[]; removeRuleIds?: number[] };
type RuleFilter = { ruleIds?: number[] };

/** Writes the navigation redirects where the service worker reads them. */
function persistNavigationRedirects(extId: string, all: DNRRule[]): void {
    if (typeof navigator === "undefined") return;

    const rules = all.filter(rule => isNavRedirectRule(rule as DnrNavRule));

    void (async () => {
        try {
            const root = await navigator.storage.getDirectory();
            const dir = await root.getDirectoryHandle(DNR_NAV_DIR, {
                create: true,
            });
            const handle = await dir.getFileHandle(`${extId}.runtime.json`, {
                create: true,
            });
            const writable = await handle.createWritable();
            await writable.write(JSON.stringify({ extensionId: extId, rules }));
            await writable.close();
        } catch (error) {
            console.warn(
                "[civil-ext-shim] failed to persist DNR navigation rules:",
                error,
            );
        }
    })();
}

/** The dynamic and session rules, and the enabled static rulesets. */
class DnrRuleStore {
    readonly dynamic = new Map<number, DNRRule>();
    readonly session = new Map<number, DNRRule>();
    readonly enabledRulesets = new Set<string>();
    onRulesChanged: (() => void) | undefined;

    constructor(private readonly extId?: string) {}

    all(): DNRRule[] {
        return [...this.dynamic.values(), ...this.session.values()];
    }

    notifyChanged(): void {
        if (this.extId) persistNavigationRedirects(this.extId, this.all());
        if (this.onRulesChanged) {
            try {
                this.onRulesChanged();
            } catch {}
        }
    }

    update(
        rules: Map<number, DNRRule>,
        options: RuleUpdate,
        cb?: () => void,
    ): Promise<void> {
        return dual(() => {
            for (const id of options.removeRuleIds ?? []) rules.delete(id);
            for (const rule of options.addRules ?? []) rules.set(rule.id, rule);
            this.notifyChanged();
            return Promise.resolve();
        }, cb);
    }

    /** `filter` is optional, so a callback may arrive in its place. */
    get(
        rules: Map<number, DNRRule>,
        filter?: RuleFilter,
        cb?: (rules: DNRRule[]) => void,
    ): Promise<DNRRule[]> {
        if (typeof filter === "function") {
            cb = filter as unknown as (rules: DNRRule[]) => void;
            filter = undefined;
        }
        const ruleIds = filter?.ruleIds;
        return dual(() => {
            const all = [...rules.values()];
            return Promise.resolve(
                ruleIds ? all.filter(r => ruleIds.includes(r.id)) : all,
            );
        }, cb);
    }

    updateRulesets(
        options: { enableRulesetIds?: string[]; disableRulesetIds?: string[] },
        cb?: () => void,
    ): Promise<void> {
        return dual(() => {
            for (const id of options.disableRulesetIds ?? [])
                this.enabledRulesets.delete(id);
            for (const id of options.enableRulesetIds ?? [])
                this.enabledRulesets.add(id);
            this.notifyChanged();
            return Promise.resolve();
        }, cb);
    }
}

function isRegexSupported(
    regexOptions: {
        regex: string;
        isCaseSensitive?: boolean;
        requireCapturing?: boolean;
    },
    cb?: (result: { isSupported: boolean; reason?: string }) => void,
): Promise<{ isSupported: boolean; reason?: string }> {
    let isSupported = true;
    let reason: string | undefined;
    try {
        void new RegExp(
            regexOptions.regex,
            regexOptions.isCaseSensitive ? undefined : "i",
        );
    } catch {
        isSupported = false;
        reason = "syntaxError";
    }
    return resolved({ isSupported, reason }, cb);
}

/** The methods that report on rules this shim never matches requests with. */
function reportingMethods() {
    return {
        getAvailableStaticRuleCount: (
            cb?: (count: number) => void,
        ): Promise<number> => resolved(30_000, cb),
        getMatchedRules: (
            filter?: unknown,
            cb?: (details: { rulesMatchedInfo: unknown[] }) => void,
        ): Promise<{ rulesMatchedInfo: unknown[] }> => {
            if (typeof filter === "function") cb = filter as typeof cb;
            return resolved({ rulesMatchedInfo: [] }, cb);
        },
        isRegexSupported,
        setExtensionActionOptions: (
            _options: {
                displayActionCountAsBadgeText?: boolean;
                tabUpdate?: unknown;
            },
            cb?: () => void,
        ): Promise<void> => resolved(undefined, cb),
        testMatchOutcome: (
            _request: unknown,
            options?: unknown,
            cb?: (result: { matchedRules: unknown[] }) => void,
        ): Promise<{ matchedRules: unknown[] }> => {
            if (typeof options === "function") cb = options as typeof cb;
            return resolved({ matchedRules: [] }, cb);
        },
    };
}

export function buildDNRAPI(extId?: string) {
    const store = new DnrRuleStore(extId);
    return {
        updateDynamicRules: (options: RuleUpdate, cb?: () => void) =>
            store.update(store.dynamic, options, cb),
        getDynamicRules: (filter?: RuleFilter, cb?: (r: DNRRule[]) => void) =>
            store.get(store.dynamic, filter, cb),
        updateSessionRules: (options: RuleUpdate, cb?: () => void) =>
            store.update(store.session, options, cb),
        getSessionRules: (filter?: RuleFilter, cb?: (r: DNRRule[]) => void) =>
            store.get(store.session, filter, cb),
        updateEnabledRulesets: store.updateRulesets.bind(store),
        getEnabledRulesets: (
            cb?: (rulesetIds: string[]) => void,
        ): Promise<string[]> =>
            dual(() => Promise.resolve([...store.enabledRulesets]), cb),
        ...reportingMethods(),
        onRuleMatchedDebug: new CivilEvent<(info: unknown) => void>(),
        /** Returns the current union of all dynamic + session rules */
        _getAllRules: () => store.all(),
        /** Register a callback to be called when rules change */
        _onRulesChanged(cb: () => void): void {
            store.onRulesChanged = cb;
        },
        GUARANTEED_MINIMUM_STATIC_RULES: 30_000,
        MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES: 5_000,
        MAX_NUMBER_OF_REGEX_RULES: 1_000,
        MAX_NUMBER_OF_STATIC_RULESETS: 100,
        MAX_NUMBER_OF_ENABLED_STATIC_RULESETS: 50,
    };
}
