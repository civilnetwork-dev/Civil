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

        const rules = getDNRRules().filter(rule => {
            if (rule.action?.type !== "redirect") return false;
            const resourceTypes = rule.condition?.resourceTypes as
                | string[]
                | undefined;
            return (
                !resourceTypes ||
                resourceTypes.includes("main_frame") ||
                resourceTypes.includes("sub_frame")
            );
        });

        void (async () => {
            try {
                const root = await navigator.storage.getDirectory();
                const dir = await root.getDirectoryHandle("_civil_dnr_nav", {
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

    function updateDynamicRules(
        options: {
            addRules?: DNRRule[];
            removeRuleIds?: number[];
        },
        cb?: () => void,
    ): Promise<void> {
        return dual(() => {
            for (const id of options.removeRuleIds ?? [])
                _dynamicRules.delete(id);
            for (const rule of options.addRules ?? [])
                _dynamicRules.set(rule.id, rule);
            _notifyRulesChanged();
            return Promise.resolve();
        }, cb);
    }

    function getDynamicRules(
        filter?: { ruleIds?: number[] },
        cb?: (rules: DNRRule[]) => void,
    ): Promise<DNRRule[]> {
        if (typeof filter === "function") {
            cb = filter as unknown as (rules: DNRRule[]) => void;
            filter = undefined;
        }
        return dual(() => {
            const all = [..._dynamicRules.values()];
            const result = filter?.ruleIds
                ? all.filter(r => filter!.ruleIds!.includes(r.id))
                : all;
            return Promise.resolve(result);
        }, cb);
    }

    function updateSessionRules(
        options: { addRules?: DNRRule[]; removeRuleIds?: number[] },
        cb?: () => void,
    ): Promise<void> {
        return dual(() => {
            for (const id of options.removeRuleIds ?? [])
                _sessionRules.delete(id);
            for (const rule of options.addRules ?? [])
                _sessionRules.set(rule.id, rule);
            _notifyRulesChanged();
            return Promise.resolve();
        }, cb);
    }

    function getSessionRules(
        filter?: { ruleIds?: number[] },
        cb?: (rules: DNRRule[]) => void,
    ): Promise<DNRRule[]> {
        if (typeof filter === "function") {
            cb = filter as unknown as (rules: DNRRule[]) => void;
            filter = undefined;
        }
        return dual(() => {
            const all = [..._sessionRules.values()];
            const result = filter?.ruleIds
                ? all.filter(r => filter!.ruleIds!.includes(r.id))
                : all;
            return Promise.resolve(result);
        }, cb);
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
