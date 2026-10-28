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

type Header = { name: string; value: string };
type FetchFn = typeof window.fetch;

/** One request's identity, and the URL it currently resolves to. */
type InterceptedRequest = {
    requestId: string;
    url: string;
    method: string;
    timeStamp: number;
};

/** One webRequest event's details for this request, as it stands. */
function requestDetails(
    req: InterceptedRequest,
    extra: Partial<WebRequestDetails>,
): WebRequestDetails {
    return {
        requestId: req.requestId,
        url: req.url,
        method: req.method,
        frameId: 0,
        parentFrameId: -1,
        tabId: -1,
        type: "xmlhttprequest",
        timeStamp: Date.now(),
        ...extra,
    };
}

const blockedByClient = () =>
    new DOMException("net::ERR_BLOCKED_BY_CLIENT", "AbortError");

/**
 * DNR first, then onBeforeRequest, onBeforeSendHeaders and onSendHeaders.
 * Throws as Chrome does for a request any of them cancels; otherwise
 * updates `req.url` and returns the headers to send.
 */
function runRequestStage(
    events: WebRequestEventSet,
    getDNRRules: () => DNRRule[],
    req: InterceptedRequest,
    init: RequestInit | undefined,
): { headers: Header[]; headersRewritten: boolean } {
    const { timeStamp } = req;
    const dnrResult = applyDnrRules(
        req.url,
        req.method,
        _headersFromInit(init),
        getDNRRules(),
    );
    if (dnrResult.blocked) {
        events.onErrorOccurred._dispatch(
            requestDetails(req, {
                timeStamp,
                error: "net::ERR_BLOCKED_BY_CLIENT",
            }),
        );
        throw blockedByClient();
    }
    req.url = dnrResult.redirectUrl ?? req.url;
    let headers = dnrResult.requestHeaders;

    const beforeReq = events.onBeforeRequest._dispatch(
        requestDetails(req, { timeStamp, requestHeaders: headers }),
    );
    if (beforeReq.cancel) throw blockedByClient();
    if (beforeReq.redirectUrl) req.url = beforeReq.redirectUrl;

    const beforeSend = events.onBeforeSendHeaders._dispatch(
        requestDetails(req, { requestHeaders: headers }),
    );
    if (beforeSend.cancel) throw blockedByClient();
    if (beforeSend.requestHeaders) headers = beforeSend.requestHeaders;

    events.onSendHeaders._dispatch(
        requestDetails(req, { requestHeaders: headers }),
    );
    return { headers, headersRewritten: Boolean(beforeSend.requestHeaders) };
}

/** Reports the response's arrival and completion, with any rewritten headers. */
async function finishResponse(
    events: WebRequestEventSet,
    req: InterceptedRequest,
    response: Response,
    modifiedHeaders: Header[] | undefined,
    originalHeaders: Header[],
): Promise<Response> {
    const finalResponse = modifiedHeaders
        ? await _withResponseHeaders(response, modifiedHeaders)
        : response;
    const responseHeaders = modifiedHeaders ?? originalHeaders;
    events.onResponseStarted._dispatch(
        requestDetails(req, {
            statusCode: response.status,
            fromCache: false,
            responseHeaders,
        }),
    );
    events.onCompleted._dispatch(
        requestDetails(req, {
            statusCode: response.status,
            statusLine: `HTTP/1.1 ${response.status} ${response.statusText}`,
            fromCache: false,
            responseHeaders,
        }),
    );
    return finalResponse;
}

/**
 * onHeadersReceived: throws for a cancel, and otherwise returns the redirect
 * to follow (after onBeforeRedirect) or the headers to answer with.
 */
function headersReceivedRedirect(
    events: WebRequestEventSet,
    req: InterceptedRequest,
    response: Response,
): { redirectUrl?: string; responseHeaders?: Header[]; original: Header[] } {
    const original = _headersFromResponse(response);
    const received = events.onHeadersReceived._dispatch(
        requestDetails(req, {
            statusCode: response.status,
            statusLine: `HTTP/1.1 ${response.status} ${response.statusText}`,
            responseHeaders: original,
            fromCache: false,
        }),
    );
    if (received.cancel) throw blockedByClient();
    if (received.redirectUrl) {
        events.onBeforeRedirect._dispatch(
            requestDetails(req, {
                statusCode: response.status,
                redirectUrl: received.redirectUrl,
            }),
        );
    }
    return {
        redirectUrl: received.redirectUrl,
        responseHeaders: received.responseHeaders,
        original,
    };
}

function requestUrlOf(input: RequestInfo | URL): string {
    return typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
}

/** window.fetch with the webRequest lifecycle and DNR rules applied. */
function interceptFetch(
    origFetch: FetchFn,
    events: WebRequestEventSet,
    getDNRRules: () => DNRRule[],
): FetchFn {
    const patchedFetch = async (
        input: RequestInfo | URL,
        init?: RequestInit,
    ): Promise<Response> => {
        const url = requestUrlOf(input);
        const req: InterceptedRequest = {
            requestId: _nextId(),
            url,
            method:
                init?.method ??
                (input instanceof Request ? input.method : "GET"),
            timeStamp: Date.now(),
        };
        const { headers, headersRewritten } = runRequestStage(
            events,
            getDNRRules,
            req,
            init,
        );

        let response: Response;
        try {
            const fetchInput =
                input instanceof Request && (init?.headers || headersRewritten)
                    ? new Request(input, _buildInitWithHeaders(init, headers))
                    : input;
            response = await origFetch(
                req.url !== url ? req.url : fetchInput,
                _buildInitWithHeaders(init, headers),
            );
        } catch (err) {
            events.onErrorOccurred._dispatch(
                requestDetails(req, { error: String(err) }),
            );
            throw err;
        }

        const redirect = headersReceivedRedirect(events, req, response);
        if (redirect.redirectUrl)
            return patchedFetch(redirect.redirectUrl, init);
        return finishResponse(
            events,
            req,
            response,
            redirect.responseHeaders,
            redirect.original,
        );
    };
    return patchedFetch as FetchFn;
}

type XhrRequest = InterceptedRequest & { headers: Header[] };

function parseXhrHeaders(raw: string): Header[] {
    const headers: Header[] = [];
    for (const line of raw.split("\r\n")) {
        const idx = line.indexOf(": ");
        if (idx > 0) {
            headers.push({
                name: line.slice(0, idx),
                value: line.slice(idx + 2),
            });
        }
    }
    return headers;
}

/** DNR and onBeforeRequest for an XHR; false when either blocks it. */
function admitXhr(
    events: WebRequestEventSet,
    getDNRRules: () => DNRRule[],
    req: XhrRequest,
): boolean {
    const blocked = () =>
        events.onErrorOccurred._dispatch(
            requestDetails(req, {
                timeStamp: req.timeStamp,
                error: "net::ERR_BLOCKED_BY_CLIENT",
            }),
        );
    const dnrResult = applyDnrRules(
        req.url,
        req.method,
        req.headers,
        getDNRRules(),
    );
    if (dnrResult.blocked) {
        blocked();
        return false;
    }
    const beforeResp = events.onBeforeRequest._dispatch(
        requestDetails(req, {
            timeStamp: req.timeStamp,
            requestHeaders: dnrResult.requestHeaders,
        }),
    );
    if (beforeResp.cancel) {
        blocked();
        return false;
    }
    return true;
}

function observeXhr(
    xhr: XMLHttpRequest,
    events: WebRequestEventSet,
    req: XhrRequest,
): void {
    xhr.addEventListener("load", () => {
        let responseHeaders: Header[] = [];
        try {
            responseHeaders = parseXhrHeaders(xhr.getAllResponseHeaders());
        } catch {}
        events.onCompleted._dispatch(
            requestDetails(req, {
                statusCode: xhr.status,
                statusLine: `HTTP/1.1 ${xhr.status} ${xhr.statusText}`,
                fromCache: false,
                responseHeaders,
            }),
        );
    });
    xhr.addEventListener("error", () => {
        events.onErrorOccurred._dispatch(
            requestDetails(req, { error: "net::ERR_FAILED" }),
        );
    });
}

/** XMLHttpRequest with the same lifecycle as the patched fetch. */
function interceptXHR(
    OrigXHR: typeof XMLHttpRequest,
    events: WebRequestEventSet,
    getDNRRules: () => DNRRule[],
): typeof XMLHttpRequest {
    return class PatchedXHR extends OrigXHR {
        private _civ: XhrRequest = {
            requestId: "",
            url: "",
            method: "GET",
            timeStamp: 0,
            headers: [],
        };

        open(
            method: string,
            url: string | URL,
            async?: boolean,
            username?: string | null,
            password?: string | null,
        ): void {
            this._civ.method = method;
            this._civ.url = url.toString();
            this._civ.requestId = _nextId();
            super.open(
                method,
                this._civ.url,
                async !== false,
                username,
                password,
            );
        }

        setRequestHeader(name: string, value: string): void {
            this._civ.headers.push({ name, value });
            super.setRequestHeader(name, value);
        }

        send(body?: Document | XMLHttpRequestBodyInit | null): void {
            const req = { ...this._civ, timeStamp: Date.now() };
            if (!admitXhr(events, getDNRRules, req)) {
                this.abort();
                return;
            }
            observeXhr(this, events, req);
            super.send(body);
        }
    };
}

/**
 * Patches this window's fetch and XMLHttpRequest. The third parameter used
 * to route background requests through UV's page-side encoder, which was a
 * no-op in practice: UV only ever set `__uv$config` on the service worker's
 * own `self` (misc/config/service/sw.ts), never on `window`. UV is gone, and
 * requests go out unchanged.
 */
export function installNetworkInterceptor(
    events: WebRequestEventSet,
    getDNRRules: () => DNRRule[],
    _proxyExternalRequests = false,
): void {
    const w = window as unknown as Record<string, unknown>;
    if (w.__civil_net_intercepted) return;
    w.__civil_net_intercepted = true;

    window.fetch = interceptFetch(
        window.fetch.bind(window),
        events,
        getDNRRules,
    );
    window.XMLHttpRequest = interceptXHR(
        window.XMLHttpRequest,
        events,
        getDNRRules,
    );
}
