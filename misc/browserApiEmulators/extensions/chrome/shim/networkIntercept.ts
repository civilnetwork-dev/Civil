// Relative, not `$config/`: vite.config.ts bundles this shim with a bare
// rolldown call that resolves no aliases.
import { dnrSubstitution } from "../../../../config/shared/dnrNavMatch";
import type { DNRRule } from "../types";

export interface WebRequestDetails {
    requestId: string;
    url: string;
    method: string;
    frameId: number;
    parentFrameId: number;
    tabId: number;
    type: string;
    timeStamp: number;
    initiator?: string;
    requestHeaders?: { name: string; value: string }[];
    responseHeaders?: { name: string; value: string }[];
    statusCode?: number;
    statusLine?: string;
    fromCache?: boolean;
    redirectUrl?: string;
    error?: string;
}

export type BlockingResponse = {
    cancel?: boolean;
    redirectUrl?: string;
    requestHeaders?: { name: string; value: string }[];
    responseHeaders?: { name: string; value: string }[];
};

type WebRequestFilter = {
    urls?: string[];
    types?: string[];
};

type WebRequestListenerEntry = {
    listener: (details: WebRequestDetails) => BlockingResponse | void;
    filter?: WebRequestFilter;
    extraInfoSpec?: string[];
};

class WebRequestEventImpl {
    private readonly _listeners: WebRequestListenerEntry[] = [];

    addListener(
        listener: (details: WebRequestDetails) => BlockingResponse | void,
        filter?: WebRequestFilter,
        extraInfoSpec?: string[],
    ): void {
        this._listeners.push({ listener, filter, extraInfoSpec });
    }

    removeListener(
        listener: (details: WebRequestDetails) => BlockingResponse | void,
    ): void {
        const idx = this._listeners.findIndex(e => e.listener === listener);
        if (idx !== -1) this._listeners.splice(idx, 1);
    }

    hasListener(
        listener: (details: WebRequestDetails) => BlockingResponse | void,
    ): boolean {
        return this._listeners.some(e => e.listener === listener);
    }

    hasListeners(): boolean {
        return this._listeners.length > 0;
    }

    _dispatch(details: WebRequestDetails): BlockingResponse {
        const result: BlockingResponse = {};
        for (const entry of this._listeners) {
            if (entry.filter && !_matchesFilter(details, entry.filter))
                continue;
            try {
                const resp = entry.listener(details);
                if (resp) {
                    if (resp.cancel) result.cancel = true;
                    if (resp.redirectUrl) result.redirectUrl = resp.redirectUrl;
                    if (resp.requestHeaders)
                        result.requestHeaders = resp.requestHeaders;
                    if (resp.responseHeaders)
                        result.responseHeaders = resp.responseHeaders;
                }
            } catch (e) {
                console.error("[civil-ext-shim] webRequest listener threw:", e);
            }
        }
        return result;
    }
}

function _matchesFilter(
    details: WebRequestDetails,
    filter: WebRequestFilter,
): boolean {
    if (filter.urls && filter.urls.length > 0) {
        const matched = filter.urls.some(pattern =>
            _matchUrlPattern(details.url, pattern),
        );
        if (!matched) return false;
    }
    if (filter.types && filter.types.length > 0) {
        if (!filter.types.includes(details.type)) return false;
    }
    return true;
}

function _matchUrlPattern(url: string, pattern: string): boolean {
    if (pattern === "<all_urls>") return true;

    // Handle DNR-style || anchor (any scheme + optional subdomains)
    if (pattern.startsWith("||")) {
        const rest = pattern.slice(2);
        const sepIdx = rest.indexOf("^");
        const host = sepIdx >= 0 ? rest.slice(0, sepIdx) : rest;
        try {
            const u = new URL(url);
            return u.hostname === host || u.hostname.endsWith(`.${host}`);
        } catch {
            return false;
        }
    }

    // Standard chrome URL match pattern: scheme://host/path
    // Convert to regex
    try {
        // Escape special regex chars except * which becomes .*
        const escaped = pattern
            .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
            .replace(/\\\*/g, ".*");

        // Handle scheme wildcard *://
        const regexStr = `^${escaped}$`;
        return new RegExp(regexStr).test(url);
    } catch {
        return url.includes(pattern);
    }
}

export interface WebRequestEventSet {
    onBeforeRequest: WebRequestEventImpl;
    onBeforeSendHeaders: WebRequestEventImpl;
    onSendHeaders: WebRequestEventImpl;
    onHeadersReceived: WebRequestEventImpl;
    onAuthRequired: WebRequestEventImpl;
    onResponseStarted: WebRequestEventImpl;
    onBeforeRedirect: WebRequestEventImpl;
    onCompleted: WebRequestEventImpl;
    onErrorOccurred: WebRequestEventImpl;
    onActionIgnored: WebRequestEventImpl;
}

export function buildWebRequestEventSet(): WebRequestEventSet {
    return {
        onBeforeRequest: new WebRequestEventImpl(),
        onBeforeSendHeaders: new WebRequestEventImpl(),
        onSendHeaders: new WebRequestEventImpl(),
        onHeadersReceived: new WebRequestEventImpl(),
        onAuthRequired: new WebRequestEventImpl(),
        onResponseStarted: new WebRequestEventImpl(),
        onBeforeRedirect: new WebRequestEventImpl(),
        onCompleted: new WebRequestEventImpl(),
        onErrorOccurred: new WebRequestEventImpl(),
        onActionIgnored: new WebRequestEventImpl(),
    };
}

let _reqIdCounter = 0;
function _nextId(): string {
    return String(++_reqIdCounter);
}

function _headersFromInit(
    init?: RequestInit,
): { name: string; value: string }[] {
    const result: { name: string; value: string }[] = [];
    if (!init?.headers) return result;
    try {
        const h = new Headers(init.headers as HeadersInit);
        h.forEach((value, name) => {
            result.push({ name, value });
        });
    } catch {}
    return result;
}

function _headersFromResponse(
    resp: Response,
): { name: string; value: string }[] {
    const result: { name: string; value: string }[] = [];
    try {
        resp.headers.forEach((value, name) => {
            result.push({ name, value });
        });
    } catch {}
    return result;
}

// DNR URL filter matching
function _dnrUrlMatches(
    url: string,
    condition: Record<string, unknown>,
): boolean {
    const urlFilter = condition.urlFilter as string | undefined;
    const regexFilter = condition.regexFilter as string | undefined;
    const domains = condition.initiatorDomains as string[] | undefined;
    const excludedDomains = condition.excludedInitiatorDomains as
        | string[]
        | undefined;

    let u: URL;
    try {
        u = new URL(url);
    } catch {
        return false;
    }

    if (domains && domains.length > 0) {
        if (
            !domains.some(d => u.hostname === d || u.hostname.endsWith(`.${d}`))
        )
            return false;
    }
    if (excludedDomains && excludedDomains.length > 0) {
        if (
            excludedDomains.some(
                d => u.hostname === d || u.hostname.endsWith(`.${d}`),
            )
        )
            return false;
    }

    if (regexFilter) {
        try {
            const flags = condition.isUrlFilterCaseSensitive ? "" : "i";
            return new RegExp(regexFilter, flags).test(url);
        } catch {
            return false;
        }
    }

    if (urlFilter) {
        return _matchDnrUrlFilter(url, urlFilter);
    }

    return true;
}

function _matchDnrUrlFilter(url: string, filter: string): boolean {
    // || = domain anchor (any scheme, any subdomain)
    // | at start = left anchor, | at end = right anchor
    // ^ = separator (non-alphanumeric, non _ - . %)
    // * = wildcard

    let pattern = filter;
    let leftAnchor = false;
    let rightAnchor = false;
    let domainAnchor = false;

    if (pattern.startsWith("||")) {
        domainAnchor = true;
        pattern = pattern.slice(2);
    } else if (pattern.startsWith("|")) {
        leftAnchor = true;
        pattern = pattern.slice(1);
    }

    if (pattern.endsWith("|")) {
        rightAnchor = true;
        pattern = pattern.slice(0, -1);
    }

    // Escape every regex metacharacter except the two DNR wildcards, then
    // translate those: * is any run of characters, ^ a separator (anything
    // but a letter, digit, _, -, . or %) or the end of the URL. Escaping ^
    // first, as this once did, left `\[^…]` behind, so no filter using ^
    // ever matched.
    const regexBody = pattern
        .replace(/[.+?${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\^/g, "(?:[^a-zA-Z0-9_.%-]|$)");

    let regexStr: string;
    if (domainAnchor) {
        regexStr = `^https?://(.*\\.)?${regexBody}`;
    } else if (leftAnchor) {
        regexStr = `^${regexBody}`;
    } else {
        regexStr = regexBody;
    }

    if (rightAnchor) {
        regexStr += "$";
    }

    try {
        return new RegExp(regexStr, "i").test(url);
    } catch {
        return url.includes(filter);
    }
}

type HeaderPair = { name: string; value: string };
type HeaderMod = { header: string; operation: string; value?: string };

/** Whether a rule's condition covers this XHR or fetch request. */
function _ruleMatchesRequest(
    cond: Record<string, unknown>,
    url: string,
    method: string,
): boolean {
    // Check resource type
    const resourceTypes = cond.resourceTypes as string[] | undefined;
    const excludedResourceTypes = cond.excludedResourceTypes as
        | string[]
        | undefined;
    if (resourceTypes && !resourceTypes.includes("xmlhttprequest")) {
        return false;
    }
    if (excludedResourceTypes?.includes("xmlhttprequest")) return false;

    // Check request method
    const requestMethods = cond.requestMethods as string[] | undefined;
    if (requestMethods && !requestMethods.includes(method.toLowerCase())) {
        return false;
    }

    return _dnrUrlMatches(url, cond);
}

/**
 * What a redirect action does to `url`. An action naming no target lets
 * evaluation move on to the next rule (`stop: false`). One whose target
 * cannot be applied still ends evaluation, without a redirect.
 */
function _redirectFor(
    redirect: Record<string, unknown> | undefined,
    cond: Record<string, unknown>,
    url: string,
): { stop: boolean; url?: string } {
    if (redirect?.url) return { stop: true, url: redirect.url as string };
    if (redirect?.transform) {
        // Apply URL transform
        try {
            const t = redirect.transform as Record<string, unknown>;
            const u = new URL(url);
            if (t.scheme) u.protocol = `${t.scheme}:`;
            if (t.host) u.hostname = t.host as string;
            if (t.path) u.pathname = t.path as string;
            if (t.query) u.search = t.query as string;
            if (t.port) u.port = t.port as string;
            return { stop: true, url: u.toString() };
        } catch {
            return { stop: true };
        }
    }
    if (redirect?.regexSubstitution) {
        if (!cond.regexFilter) return { stop: true };
        try {
            const flags = cond.isUrlFilterCaseSensitive ? "" : "i";
            return {
                stop: true,
                url: url.replace(
                    new RegExp(cond.regexFilter as string, flags),
                    dnrSubstitution(redirect.regexSubstitution as string),
                ),
            };
        } catch {
            return { stop: true };
        }
    }
    return { stop: false };
}

/** The https: form of an http: URL; undefined for any other URL. */
function _upgradedUrl(url: string): string | undefined {
    try {
        const u = new URL(url);
        if (u.protocol !== "http:") return undefined;
        u.protocol = "https:";
        return u.toString();
    } catch {
        return undefined;
    }
}

/** Applies a modifyHeaders action's request-header operations in order. */
function _modifyHeaders(
    headers: HeaderPair[],
    mods: HeaderMod[] = [],
): HeaderPair[] {
    let result = headers;
    for (const mod of mods) {
        if (mod.operation === "set") {
            const existing = result.findIndex(
                h => h.name.toLowerCase() === mod.header.toLowerCase(),
            );
            const header = { name: mod.header, value: mod.value ?? "" };
            if (existing >= 0) result[existing] = header;
            else result.push(header);
        } else if (mod.operation === "remove") {
            result = result.filter(
                h => h.name.toLowerCase() !== mod.header.toLowerCase(),
            );
        } else if (mod.operation === "append") {
            result.push({ name: mod.header, value: mod.value ?? "" });
        }
    }
    return result;
}

export function applyDnrRules(
    url: string,
    method: string,
    requestHeaders: HeaderPair[],
    rules: DNRRule[],
): {
    blocked: boolean;
    redirectUrl?: string;
    requestHeaders: HeaderPair[];
} {
    // Sort rules by priority descending
    const sorted = rules.toSorted(
        (a, b) => (b.priority ?? 1) - (a.priority ?? 1),
    );

    // The first matching rule that blocks, allows or redirects decides;
    // header changes accumulate until then.
    let headers = [...requestHeaders];
    const decide = (blocked: boolean, redirectUrl?: string) => ({
        blocked,
        redirectUrl,
        requestHeaders: headers,
    });

    for (const rule of sorted) {
        const cond = rule.condition as Record<string, unknown>;
        if (!_ruleMatchesRequest(cond, url, method)) continue;

        const action = rule.action as Record<string, unknown>;
        switch (action.type) {
            case "block":
                return decide(true);
            case "allow":
            case "allowAllRequests":
                return decide(false);
            case "redirect": {
                const redirect = _redirectFor(
                    action.redirect as Record<string, unknown> | undefined,
                    cond,
                    url,
                );
                if (redirect.stop) return decide(false, redirect.url);
                break;
            }
            case "upgradeScheme":
                return decide(false, _upgradedUrl(url));
            case "modifyHeaders":
                headers = _modifyHeaders(
                    headers,
                    action.requestHeaders as HeaderMod[] | undefined,
                );
                break;
        }
    }

    return decide(false);
}

/** `response` with its headers replaced, as an onHeadersReceived listener
 *  rewrote them. */
async function _withResponseHeaders(
    response: Response,
    headers: { name: string; value: string }[],
): Promise<Response> {
    const newHdrs = new Headers();
    for (const h of headers) {
        try {
            newHdrs.set(h.name, h.value);
        } catch {}
    }
    const body = await response.arrayBuffer();
    return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHdrs,
    });
}

function _buildInitWithHeaders(
    init: RequestInit | undefined,
    headers: { name: string; value: string }[],
): RequestInit {
    const newHeaders = new Headers();
    for (const h of headers) {
        try {
            newHeaders.set(h.name, h.value);
        } catch {}
    }
    return { ...init, headers: newHeaders };
}

export function installNetworkInterceptor(
    events: WebRequestEventSet,
    getDNRRules: () => DNRRule[],
    _proxyExternalRequests = false,
): void {
    const w = window as unknown as Record<string, unknown>;
    if (w.__civil_net_intercepted) return;
    w.__civil_net_intercepted = true;

    const _origFetch = window.fetch.bind(window);
    const _OrigXHR = window.XMLHttpRequest;

    // This used to read `window.top.__uv$config` (UV's page-side prefix and
    // encoder) and rewrite the URL through it when the caller (a background
    // context, via installNetworkInterceptor's now-unused third parameter)
    // opted in. That was already a no-op in practice before UV was removed:
    // UV only ever set `__uv$config` on the *service worker's* own `self`
    // (misc/config/service/sw.ts), a different global than `window` -- a
    // page-context `window.top.__uv$config` read was never going to find
    // anything there. Passes the URL through unchanged, same outcome as
    // that dead lookup always produced.
    const toNetworkUrl = (url: string): string => url;

    const fetchViaXHR = (
        url: string,
        method: string,
        headers: { name: string; value: string }[],
        init?: RequestInit,
    ): Promise<Response> =>
        new Promise((resolve, reject) => {
            const xhr = new _OrigXHR();
            xhr.open(method, url, true);
            for (const header of headers) {
                try {
                    xhr.setRequestHeader(header.name, header.value);
                } catch {}
            }
            xhr.onload = () => {
                const responseHeaders = new Headers();
                for (const line of xhr.getAllResponseHeaders().split("\r\n")) {
                    const separator = line.indexOf(":");
                    if (separator <= 0) continue;
                    try {
                        responseHeaders.append(
                            line.slice(0, separator).trim(),
                            line.slice(separator + 1).trim(),
                        );
                    } catch {}
                }
                resolve(
                    new Response(xhr.responseText, {
                        status: xhr.status,
                        statusText: xhr.statusText,
                        headers: responseHeaders,
                    }),
                );
            };
            xhr.onerror = () => reject(new TypeError("Failed to fetch"));
            xhr.onabort = () =>
                reject(
                    new DOMException("The operation was aborted", "AbortError"),
                );
            init?.signal?.addEventListener("abort", () => xhr.abort(), {
                once: true,
            });
            xhr.send((init?.body as XMLHttpRequestBodyInit | null) ?? null);
        });

    // Patch fetch
    const _patchedFetch = async (
        input: RequestInfo | URL,
        init?: RequestInit,
    ): Promise<Response> => {
        const url =
            typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.toString()
                  : (input as Request).url;
        const method =
            init?.method ?? (input instanceof Request ? input.method : "GET");
        const requestId = _nextId();
        const timeStamp = Date.now();
        let reqHeaders = _headersFromInit(init);
        let finalUrl = url;

        /** One webRequest event's details for this request, as it stands. */
        const details = (extra: Partial<WebRequestDetails>) => ({
            requestId,
            url: finalUrl,
            method,
            frameId: 0,
            parentFrameId: -1,
            tabId: -1,
            type: "xmlhttprequest",
            timeStamp: Date.now(),
            ...extra,
        });
        const blockedByClient = () =>
            new DOMException("net::ERR_BLOCKED_BY_CLIENT", "AbortError");

        // Apply DNR rules first
        const dnrResult = applyDnrRules(url, method, reqHeaders, getDNRRules());
        if (dnrResult.blocked) {
            events.onErrorOccurred._dispatch(
                details({ timeStamp, error: "net::ERR_BLOCKED_BY_CLIENT" }),
            );
            throw blockedByClient();
        }

        finalUrl = dnrResult.redirectUrl ?? url;
        reqHeaders = dnrResult.requestHeaders;

        // onBeforeRequest
        const beforeReqResp = events.onBeforeRequest._dispatch(
            details({ timeStamp, requestHeaders: reqHeaders }),
        );
        if (beforeReqResp.cancel) throw blockedByClient();
        if (beforeReqResp.redirectUrl) {
            finalUrl = beforeReqResp.redirectUrl;
        }

        // onBeforeSendHeaders
        const beforeSendResp = events.onBeforeSendHeaders._dispatch(
            details({ requestHeaders: reqHeaders }),
        );
        if (beforeSendResp.cancel) throw blockedByClient();
        if (beforeSendResp.requestHeaders) {
            reqHeaders = beforeSendResp.requestHeaders;
        }

        // onSendHeaders
        events.onSendHeaders._dispatch(details({ requestHeaders: reqHeaders }));

        let response: Response;
        try {
            const networkUrl = toNetworkUrl(finalUrl);
            const fetchInput =
                input instanceof Request &&
                (init?.headers || beforeSendResp.requestHeaders)
                    ? new Request(
                          input,
                          _buildInitWithHeaders(init, reqHeaders),
                      )
                    : input;
            response =
                networkUrl !== finalUrl
                    ? await fetchViaXHR(networkUrl, method, reqHeaders, init)
                    : await _origFetch(
                          finalUrl !== url ? finalUrl : fetchInput,
                          reqHeaders !== _headersFromInit(init)
                              ? _buildInitWithHeaders(init, reqHeaders)
                              : init,
                      );
        } catch (err) {
            events.onErrorOccurred._dispatch(details({ error: String(err) }));
            throw err;
        }

        const respHeaders = _headersFromResponse(response);
        const statusLine = `HTTP/1.1 ${response.status} ${response.statusText}`;

        // onHeadersReceived
        const headersReceivedResp = events.onHeadersReceived._dispatch(
            details({
                statusCode: response.status,
                statusLine,
                responseHeaders: respHeaders,
                fromCache: false,
            }),
        );
        if (headersReceivedResp.cancel) throw blockedByClient();
        if (headersReceivedResp.redirectUrl) {
            // follow redirect
            events.onBeforeRedirect._dispatch(
                details({
                    statusCode: response.status,
                    redirectUrl: headersReceivedResp.redirectUrl,
                }),
            );
            return _patchedFetch(headersReceivedResp.redirectUrl, init);
        }

        // Build potentially modified response
        const modifiedRespHeaders = headersReceivedResp.responseHeaders;
        const finalResponse = modifiedRespHeaders
            ? await _withResponseHeaders(response, modifiedRespHeaders)
            : response;
        const responseHeaders = modifiedRespHeaders ?? respHeaders;

        // onResponseStarted
        events.onResponseStarted._dispatch(
            details({
                statusCode: response.status,
                fromCache: false,
                responseHeaders,
            }),
        );

        // onCompleted
        events.onCompleted._dispatch(
            details({
                statusCode: response.status,
                statusLine,
                fromCache: false,
                responseHeaders,
            }),
        );

        return finalResponse;
    };

    window.fetch = _patchedFetch as typeof window.fetch;

    // Patch XMLHttpRequest
    class PatchedXHR extends _OrigXHR {
        private _civMethod = "GET";
        private _civUrl = "";
        private _civReqId = "";
        private _civHeaders: { name: string; value: string }[] = [];

        open(
            method: string,
            url: string | URL,
            async?: boolean,
            username?: string | null,
            password?: string | null,
        ): void {
            this._civMethod = method;
            this._civUrl = url.toString();
            this._civReqId = _nextId();
            super.open(
                method,
                toNetworkUrl(this._civUrl),
                async !== false,
                username,
                password,
            );
        }

        setRequestHeader(name: string, value: string): void {
            this._civHeaders.push({ name, value });
            super.setRequestHeader(name, value);
        }

        send(body?: Document | XMLHttpRequestBodyInit | null): void {
            const url = this._civUrl;
            const method = this._civMethod;
            const requestId = this._civReqId;
            const timeStamp = Date.now();

            // Apply DNR rules
            const dnrResult = applyDnrRules(
                url,
                method,
                this._civHeaders,
                getDNRRules(),
            );
            if (dnrResult.blocked) {
                events.onErrorOccurred._dispatch({
                    requestId,
                    url,
                    method,
                    frameId: 0,
                    parentFrameId: -1,
                    tabId: -1,
                    type: "xmlhttprequest",
                    timeStamp,
                    error: "net::ERR_BLOCKED_BY_CLIENT",
                });
                this.abort();
                return;
            }

            // onBeforeRequest
            const beforeResp = events.onBeforeRequest._dispatch({
                requestId,
                url,
                method,
                frameId: 0,
                parentFrameId: -1,
                tabId: -1,
                type: "xmlhttprequest",
                timeStamp,
                requestHeaders: dnrResult.requestHeaders,
            });
            if (beforeResp.cancel) {
                events.onErrorOccurred._dispatch({
                    requestId,
                    url,
                    method,
                    frameId: 0,
                    parentFrameId: -1,
                    tabId: -1,
                    type: "xmlhttprequest",
                    timeStamp,
                    error: "net::ERR_BLOCKED_BY_CLIENT",
                });
                this.abort();
                return;
            }

            this.addEventListener("load", () => {
                const respHeaders: { name: string; value: string }[] = [];
                try {
                    const raw = this.getAllResponseHeaders();
                    for (const line of raw.split("\r\n")) {
                        const idx = line.indexOf(": ");
                        if (idx > 0) {
                            respHeaders.push({
                                name: line.slice(0, idx),
                                value: line.slice(idx + 2),
                            });
                        }
                    }
                } catch {}
                events.onCompleted._dispatch({
                    requestId,
                    url,
                    method,
                    frameId: 0,
                    parentFrameId: -1,
                    tabId: -1,
                    type: "xmlhttprequest",
                    timeStamp: Date.now(),
                    statusCode: this.status,
                    statusLine: `HTTP/1.1 ${this.status} ${this.statusText}`,
                    fromCache: false,
                    responseHeaders: respHeaders,
                });
            });

            this.addEventListener("error", () => {
                events.onErrorOccurred._dispatch({
                    requestId,
                    url,
                    method,
                    frameId: 0,
                    parentFrameId: -1,
                    tabId: -1,
                    type: "xmlhttprequest",
                    timeStamp: Date.now(),
                    error: "net::ERR_FAILED",
                });
            });

            super.send(body);
        }
    }

    window.XMLHttpRequest = PatchedXHR as unknown as typeof XMLHttpRequest;
}
