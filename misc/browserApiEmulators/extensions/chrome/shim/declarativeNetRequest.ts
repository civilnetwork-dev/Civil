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

export function buildDNRAPI(extId?: string) {
    const _dynamicRules = new Map<number, DNRRule>();
    const _sessionRules = new Map<number, DNRRule>();
    const _enabledRulesets = new Set<string>();
    let _onRulesChangedCb: (() => void) | undefined;

    const onRuleMatchedDebug = new CivilEvent<(info: unknown) => void>();

    function _persistNavigationRedirects(): void {
        if (!extId || typeof navigator === "undefined") return;

        const rules = getDNRRules().filter(rule =>
            isNavRedirectRule(rule as DnrNavRule),
        );

        void (async () => {
            try {
                const root = await navigator.storage.getDirectory();
                const dir = await root.getDirectoryHandle(DNR_NAV_DIR, {
                    create: true,
                });
                const handle = await dir.getFileHandle(
                    `${extId}.runtime.json`,
                    { create: true },
                );
                const writable = await handle.createWritable();
                await writable.write(
                    JSON.stringify({
                        extensionId: extId,
                        rules,
                    }),
                );
                await writable.close();
            } catch (error) {
                console.warn(
                    "[civil-ext-shim] failed to persist DNR navigation rules:",
                    error,
                );
            }
        })();
    }

    function _notifyRulesChanged(): void {
        _persistNavigationRedirects();
        if (_onRulesChangedCb) {
            try {
                _onRulesChangedCb();
            } catch {}
        }
    }

    function getDNRRules(): DNRRule[] {
        return [..._dynamicRules.values(), ..._sessionRules.values()];
    }

    type RuleUpdate = { addRules?: DNRRule[]; removeRuleIds?: number[] };
    type RuleFilter = { ruleIds?: number[] };

    function updateRules(
        rules: Map<number, DNRRule>,
        options: RuleUpdate,
        cb?: () => void,
    ): Promise<void> {
        return dual(() => {
            for (const id of options.removeRuleIds ?? []) rules.delete(id);
            for (const rule of options.addRules ?? []) rules.set(rule.id, rule);
            _notifyRulesChanged();
            return Promise.resolve();
        }, cb);
    }

    /** `filter` is optional, so a callback may arrive in its place. */
    function getRules(
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

    function updateDynamicRules(
        options: RuleUpdate,
        cb?: () => void,
    ): Promise<void> {
        return updateRules(_dynamicRules, options, cb);
    }

    function getDynamicRules(
        filter?: RuleFilter,
        cb?: (rules: DNRRule[]) => void,
    ): Promise<DNRRule[]> {
        return getRules(_dynamicRules, filter, cb);
    }

    function updateSessionRules(
        options: RuleUpdate,
        cb?: () => void,
    ): Promise<void> {
        return updateRules(_sessionRules, options, cb);
    }

    function getSessionRules(
        filter?: RuleFilter,
        cb?: (rules: DNRRule[]) => void,
    ): Promise<DNRRule[]> {
        return getRules(_sessionRules, filter, cb);
    }

    function updateEnabledRulesets(
        options: { enableRulesetIds?: string[]; disableRulesetIds?: string[] },
        cb?: () => void,
    ): Promise<void> {
        return dual(() => {
            for (const id of options.disableRulesetIds ?? [])
                _enabledRulesets.delete(id);
            for (const id of options.enableRulesetIds ?? [])
                _enabledRulesets.add(id);
            _notifyRulesChanged();
            return Promise.resolve();
        }, cb);
    }

    function getEnabledRulesets(
        cb?: (rulesetIds: string[]) => void,
    ): Promise<string[]> {
        return dual(() => Promise.resolve([..._enabledRulesets]), cb);
    }

    function getAvailableStaticRuleCount(
        cb?: (count: number) => void,
    ): Promise<number> {
        return resolved(30_000, cb);
    }

    function getMatchedRules(
        filter?: unknown,
        cb?: (details: { rulesMatchedInfo: unknown[] }) => void,
    ): Promise<{ rulesMatchedInfo: unknown[] }> {
        if (typeof filter === "function") {
            cb = filter as unknown as typeof cb;
            filter = undefined;
        }
        return resolved({ rulesMatchedInfo: [] }, cb);
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

    function setExtensionActionOptions(
        _options: {
            displayActionCountAsBadgeText?: boolean;
            tabUpdate?: unknown;
        },
        cb?: () => void,
    ): Promise<void> {
        return resolved(undefined, cb);
    }

    function testMatchOutcome(
        _request: unknown,
        options?: unknown,
        cb?: (result: { matchedRules: unknown[] }) => void,
    ): Promise<{ matchedRules: unknown[] }> {
        if (typeof options === "function") {
            cb = options as unknown as typeof cb;
            options = undefined;
        }
        return resolved({ matchedRules: [] }, cb);
    }

    return {
        updateDynamicRules,
        getDynamicRules,
        updateSessionRules,
        getSessionRules,
        updateEnabledRulesets,
        getEnabledRulesets,
        getAvailableStaticRuleCount,
        getMatchedRules,
        isRegexSupported,
        setExtensionActionOptions,
        testMatchOutcome,
        onRuleMatchedDebug,
        /** Returns the current union of all dynamic + session rules */
        _getAllRules: getDNRRules,
        /** Register a callback to be called when rules change */
        _onRulesChanged(cb: () => void): void {
            _onRulesChangedCb = cb;
        },
        GUARANTEED_MINIMUM_STATIC_RULES: 30_000,
        MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES: 5_000,
        MAX_NUMBER_OF_REGEX_RULES: 1_000,
        MAX_NUMBER_OF_STATIC_RULESETS: 100,
        MAX_NUMBER_OF_ENABLED_STATIC_RULESETS: 50,
    };
}
