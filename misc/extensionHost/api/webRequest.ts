import { matchesAnyPattern } from "../../browserApiEmulators/extensions/chrome/shim/matchPattern";
import type {
    ChromeManifest,
    SyntheticTab,
} from "../../browserApiEmulators/extensions/chrome/types";

interface RequestFilter {
    urls: string[];
    types?: string[];
    tabId?: number;
    windowId?: number;
}

interface Registration {
    filter: RequestFilter;
    blocking: boolean;
}

export interface RequestDispatchResult {
    cancelled: boolean;
    redirectUrl?: string;
    incomplete?: string;
}

function requestEvent(listeners: Map<unknown, Registration>) {
    return {
        addListener(
            listener: unknown,
            filter: RequestFilter,
            extraInfoSpec?: string[],
        ) {
            if (
                typeof listener !== "function" ||
                !Array.isArray(filter?.urls) ||
                (filter.types !== undefined && !Array.isArray(filter.types)) ||
                listeners.has(listener)
            )
                return;
            listeners.set(listener, {
                filter,
                blocking:
                    Array.isArray(extraInfoSpec) &&
                    extraInfoSpec.includes("blocking"),
            });
        },
        removeListener(listener: unknown) {
            listeners.delete(listener);
        },
        hasListener(listener: unknown) {
            return listeners.has(listener);
        },
        hasListeners() {
            return listeners.size > 0;
        },
    };
}

function requestFailure(error: unknown): string {
    return `Filter request listener failed: ${error instanceof Error ? error.message : String(error)}`;
}

function readRequestResult(
    reply: unknown,
    result: RequestDispatchResult,
    redirects: Set<string>,
) {
    if (!reply || typeof reply !== "object") return;
    const value = reply as { cancel?: unknown; redirectUrl?: unknown };
    if (value.cancel !== undefined && typeof value.cancel !== "boolean")
        result.incomplete =
            "Filter request listener returned an invalid cancellation";
    if (value.cancel === true) result.cancelled = true;
    if (value.redirectUrl === undefined) return;
    if (typeof value.redirectUrl !== "string")
        throw new Error("Invalid request redirect");
    const redirect = new URL(value.redirectUrl).href;
    redirects.add(redirect);
    if (redirects.size > 1) {
        result.incomplete =
            "Conflicting request redirects require browser arbitration";
        delete result.redirectUrl;
    } else result.redirectUrl = redirect;
}

function dispatchRequests(
    listeners: Map<unknown, Registration>,
    url: string,
    tab: SyntheticTab,
    canBlock: boolean,
): RequestDispatchResult {
    const result: RequestDispatchResult = { cancelled: false };
    const redirects = new Set<string>();
    const details = {
        requestId: "1",
        url,
        method: "GET",
        type: "main_frame",
        frameId: 0,
        parentFrameId: -1,
        tabId: tab.id,
        timeStamp: Date.now(),
    };
    for (const [listener, entry] of listeners) {
        if (
            !matchesMainFrame(entry.filter, url, tab) ||
            (entry.blocking && !canBlock)
        )
            continue;
        try {
            const reply = (listener as (request: typeof details) => unknown)(
                details,
            );
            if (
                reply &&
                typeof (reply as PromiseLike<unknown>).then === "function"
            ) {
                if (entry.blocking)
                    result.incomplete =
                        "Asynchronous blocking request timing requires a managed browser";
                void Promise.resolve(reply).catch(error => {
                    result.incomplete = requestFailure(error);
                });
            } else if (entry.blocking)
                readRequestResult(reply, result, redirects);
        } catch (error) {
            result.incomplete = requestFailure(error);
        }
    }
    return result;
}

function matchesMainFrame(
    filter: RequestFilter,
    url: string,
    tab: SyntheticTab,
): boolean {
    const { tabId = -1, windowId = -1, types, urls } = filter;
    return (
        (tabId === -1 || tabId === tab.id) &&
        (windowId === -1 || windowId === tab.windowId) &&
        (!types?.length || types.includes("main_frame")) &&
        (!urls.length || matchesAnyPattern(urls, url))
    );
}

/** Replay the declared request surface with explicit limits for asynchronous work. */
export function buildWebRequest(manifest: ChromeManifest, tab: SyntheticTab) {
    const listeners = new Map<unknown, Registration>();
    const permissions = manifest.permissions ?? [];
    const canBlock = permissions.includes("webRequestBlocking");
    const hosts =
        manifest.manifest_version === 2
            ? permissions
            : manifest.host_permissions;
    // Chrome ignores the path in host permissions, but not in request filters.
    const hostPatterns = (hosts ?? [])
        .filter(pattern => typeof pattern === "string")
        .map(pattern =>
            pattern.replace(/^([a-z*]+:\/\/[^/]*)(?:\/.*)?$/i, "$1/*"),
        );
    const matching = (url: string) =>
        permissions.includes("webRequest") &&
        matchesAnyPattern(hostPatterns, url);
    return {
        api: { onBeforeRequest: requestEvent(listeners) },
        matchesMainFrame(url: string) {
            return (
                matching(url) &&
                canBlock &&
                [...listeners.values()].some(
                    entry =>
                        entry.blocking &&
                        matchesMainFrame(entry.filter, url, tab),
                )
            );
        },
        dispatchMainFrame(url: string): RequestDispatchResult {
            return matching(url)
                ? dispatchRequests(listeners, url, tab, canBlock)
                : { cancelled: false };
        },
    };
}
