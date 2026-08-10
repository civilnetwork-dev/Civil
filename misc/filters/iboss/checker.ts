import { err, ok, type Result, ResultAsync } from "neverthrow";
import xior, { type XiorError, type XiorInstance } from "xior";
import {
    DEFAULT_CLOUD_CATEGORIZATION_SSL_PORT,
    DIRECT_FILTER_INTRINSIC_BYPASS_LIST,
    DIRECT_FILTER_INTRINSIC_DOMAIN_LIST,
    PERFORM_URL_FILTERING_PATH,
} from "./constants";

/**
 * Raw shape of the `performUrlFiltering` JSON response, as consumed by the
 * extension's `Common.updateDnrForUrl` (see `common/ApiCheck.js`).
 */
export type IbossFilteringResponse = {
    /** 0 = allow, non-zero = block. */
    blockUrl?: number;
    /** Where the connector redirects a blocked request (often `restricted.html`). */
    redirectUrl?: string;
    /** Present only on error; when set the connector blocks for 30s. */
    errorCode?: number | string | null;
    errorMessage?: string;
    /** 1 = the user may request an exception for this URL. */
    acceptExceptionRequests?: number;
    /** 1 = the block page should offer "login as a different user". */
    loginAsDifferentUser?: number;
    httpHeaders?: unknown[];
    updateId?: number;
    ruleId?: number;
    /** Some deployments include category metadata. */
    category?: string | number;
    categoryName?: string;
    groupName?: string;
    groupNumber?: number;
};

export type IbossCheckerOptions = {
    gatewayHost: string;

    /**
     * Security key issued to the device at registration
     * (`Settings.SECURITY_KEY`). Required.
     */
    securityKey: string;

    /**
     * Email the device registered with (`userEmail=` in the API endpoint).
     * Required.
     */
    userEmail: string;

    /** SSL port of the categorization API. Defaults to 8026. */
    categorizationPort?: number;

    /**
     * When set, the request is sent as an override request
     * (`overrideRequest=true`) using `overrideSecurityKey`.
     */
    overrideUsername?: string;
    overrideSecurityKey?: string;

    /**
     * Hosts to treat as intrinsically allowed without contacting the cloud.
     * Defaults to the connector's built-in direct-filter lists.
     */
    bypassHosts?: readonly string[];
    bypassDomains?: readonly string[];

    /** Skip the intrinsic bypass lists and always hit the cloud. */
    disableIntrinsicBypass?: boolean;

    /**
     * Override the base URL entirely (mostly for testing/proxying). When set,
     * `gatewayHost` / `categorizationPort` are ignored for the origin.
     */
    baseUrl?: string;

    timeoutMs?: number;
    retries?: number;
};

export type IbossDecision = {
    url: string;
    normalizedUrl: string;
    hostname: string;

    /** Final verdict. */
    blocked: boolean;
    allowed: boolean;

    /** True when the verdict came from a cloud error (fail-closed for 30s). */
    errored: boolean;

    /** Redirect target for a blocked request, if any. */
    redirectUrl?: string;
    /** True when the redirect points at the connector's restricted page. */
    restrictedPage: boolean;

    /** Whether the user may request an exception / login as another user. */
    acceptsExceptionRequest: boolean;
    loginAsDifferentUser: boolean;

    /** Category metadata, when the deployment returns it. */
    category?: string | number;
    categoryName?: string;

    /** Which stage produced the verdict. */
    matchedFilter: "Intrinsic Bypass" | "Cloud Categorization";
    matchedRule?: string;

    reason: string;

    /** Raw upstream payload for callers that need everything. */
    raw?: IbossFilteringResponse;
};

export type IbossError =
    | {
          type: "INVALID_URL";
          message: string;
          input: string;
      }
    | {
          type: "MISSING_CREDENTIALS";
          message: string;
      }
    | {
          type: "FILTER_REQUEST_FAILED";
          message: string;
          status?: number;
          cause?: unknown;
      };

/** Request payload for `requestException`. Mirrors `Gen3Service.UrlExceptionRequest`. */
export type IbossExceptionRequest = {
    blockedUrl: string;
    reasonMessage?: string;
    userEmail?: string;
    overrideUser?: string;
    ipAddress?: string;
};

function normalizeUrl(input: string): Result<URL, IbossError> {
    try {
        const value = /^https?:\/\//i.test(input) ? input : `https://${input}`;

        const url = new URL(value);

        if (!["http:", "https:"].includes(url.protocol)) {
            return err({
                type: "INVALID_URL",
                input,
                message: "Only HTTP(S) URLs are supported.",
            });
        }

        return ok(url);
    } catch {
        return err({
            type: "INVALID_URL",
            input,
            message: "Invalid URL.",
        });
    }
}

function normalizeHost(input: string): string {
    return input.toLowerCase().replace(/^www\./, "");
}

function hostIsListed(
    hostname: string,
    entries: readonly string[],
    matchSubdomains: boolean,
): string | null {
    const host = normalizeHost(hostname);

    for (const entry of entries) {
        const target = normalizeHost(entry);

        if (host === target) return entry;
        if (matchSubdomains && host.endsWith(`.${target}`)) return entry;
    }

    return null;
}

function isRestrictedPage(redirectUrl: string | undefined): boolean {
    if (!redirectUrl) return false;

    return (
        redirectUrl.includes("restricted.html") ||
        redirectUrl.includes("override.html") ||
        redirectUrl.startsWith("chrome-extension://")
    );
}

function createDecision(params: {
    url: URL;
    blocked: boolean;
    errored: boolean;
    matchedFilter: IbossDecision["matchedFilter"];
    reason: string;
    matchedRule?: string;
    response?: IbossFilteringResponse;
}): IbossDecision {
    const response = params.response;

    return {
        url: params.url.href,
        normalizedUrl: params.url.href,
        hostname: params.url.hostname,

        blocked: params.blocked,
        allowed: !params.blocked,
        errored: params.errored,

        redirectUrl: response?.redirectUrl || undefined,
        restrictedPage: isRestrictedPage(response?.redirectUrl),

        acceptsExceptionRequest: (response?.acceptExceptionRequests ?? 0) !== 0,
        loginAsDifferentUser: (response?.loginAsDifferentUser ?? 0) !== 0,

        category: response?.category ?? response?.groupNumber,
        categoryName: response?.categoryName ?? response?.groupName,

        matchedFilter: params.matchedFilter,
        matchedRule: params.matchedRule,

        reason: params.reason,

        raw: response,
    };
}

class IbossFilterChecker {
    private readonly http: XiorInstance;

    private readonly options: Required<
        Pick<
            IbossCheckerOptions,
            | "categorizationPort"
            | "timeoutMs"
            | "retries"
            | "bypassHosts"
            | "bypassDomains"
            | "disableIntrinsicBypass"
        >
    > &
        IbossCheckerOptions;

    constructor(options: IbossCheckerOptions) {
        this.options = {
            categorizationPort:
                options.categorizationPort ??
                DEFAULT_CLOUD_CATEGORIZATION_SSL_PORT,
            timeoutMs: options.timeoutMs ?? 5_000,
            retries: options.retries ?? 2,
            bypassHosts:
                options.bypassHosts ?? DIRECT_FILTER_INTRINSIC_BYPASS_LIST,
            bypassDomains:
                options.bypassDomains ?? DIRECT_FILTER_INTRINSIC_DOMAIN_LIST,
            disableIntrinsicBypass: options.disableIntrinsicBypass ?? false,

            ...options,
        };

        this.http = xior.create({
            timeout: this.options.timeoutMs,
        });
    }

    /** Base `https://host:port` origin for the categorization API. */
    private origin(): string {
        if (this.options.baseUrl) {
            return this.options.baseUrl.replace(/\/$/, "");
        }

        return `https://${this.options.gatewayHost}:${this.options.categorizationPort}`;
    }

    /**
     * Recreates the endpoint the connector caches as `apiModeEndpoint`, then
     * appends `&url=`. See `Gen3Service.registerToCloud` + `ApiCheck.js`.
     */
    private buildEndpoint(url: string): Result<string, IbossError> {
        const {
            securityKey,
            userEmail,
            overrideUsername,
            overrideSecurityKey,
        } = this.options;

        if (!this.options.gatewayHost && !this.options.baseUrl) {
            return err({
                type: "MISSING_CREDENTIALS",
                message: "gatewayHost (or baseUrl) is required.",
            });
        }

        if (!userEmail) {
            return err({
                type: "MISSING_CREDENTIALS",
                message: "userEmail is required.",
            });
        }

        const isOverride = Boolean(overrideUsername);
        const email = isOverride ? overrideUsername! : userEmail;
        const key = isOverride ? overrideSecurityKey : securityKey;

        if (!key) {
            return err({
                type: "MISSING_CREDENTIALS",
                message: isOverride
                    ? "overrideSecurityKey is required for override requests."
                    : "securityKey is required.",
            });
        }

        const endpoint =
            `${this.origin()}${PERFORM_URL_FILTERING_PATH}` +
            `?securityKey=${encodeURIComponent(key)}` +
            `&userEmail=${encodeURIComponent(email)}` +
            `&overrideRequest=${isOverride ? "true" : "false"}` +
            `&url=${encodeURIComponent(url)}`;

        return ok(endpoint);
    }

    private intrinsicBypass(url: URL): IbossDecision | null {
        if (this.options.disableIntrinsicBypass) return null;

        const byHost = hostIsListed(
            url.hostname,
            this.options.bypassHosts,
            false,
        );

        if (byHost) {
            return createDecision({
                url,
                blocked: false,
                errored: false,
                matchedFilter: "Intrinsic Bypass",
                matchedRule: byHost,
                reason: `Host is on the intrinsic direct-filter bypass list (${byHost}).`,
            });
        }

        const byDomain = hostIsListed(
            url.hostname,
            this.options.bypassDomains,
            true,
        );

        if (byDomain) {
            return createDecision({
                url,
                blocked: false,
                errored: false,
                matchedFilter: "Intrinsic Bypass",
                matchedRule: byDomain,
                reason: `Domain is on the intrinsic direct-filter allow list (${byDomain}).`,
            });
        }

        return null;
    }

    checkUrl(input: string): ResultAsync<IbossDecision, IbossError> {
        const parsed = normalizeUrl(input);

        if (parsed.isErr()) {
            return errResult(parsed.error);
        }

        const url = parsed.value;

        const bypass = this.intrinsicBypass(url);

        if (bypass) {
            return ResultAsync.fromSafePromise(Promise.resolve(bypass));
        }

        const endpoint = this.buildEndpoint(url.href);

        if (endpoint.isErr()) {
            return errResult(endpoint.error);
        }

        return this.fetchFiltering(endpoint.value).map(response => {
            // The connector treats an errorCode as a hard block for 30s.
            if (response.errorCode != null) {
                return createDecision({
                    url,
                    blocked: true,
                    errored: true,
                    matchedFilter: "Cloud Categorization",
                    reason: `Cloud returned errorCode ${response.errorCode}${
                        response.errorMessage
                            ? `: ${response.errorMessage}`
                            : ""
                    }; treated as blocked.`,
                    response,
                });
            }

            const blocked = (response.blockUrl ?? 0) !== 0;

            return createDecision({
                url,
                blocked,
                errored: false,
                matchedFilter: "Cloud Categorization",
                reason: blocked
                    ? `Blocked by iboss cloud${
                          response.categoryName
                              ? ` (category: ${response.categoryName})`
                              : ""
                      }.`
                    : "Allowed by iboss cloud.",
                response,
            });
        });
    }

    checkMany(urls: string[]): ResultAsync<IbossDecision[], IbossError> {
        return ResultAsync.combine(urls.map(url => this.checkUrl(url)));
    }

    /**
     * Submit a URL-exception request, mirroring `Gen3Service.requestUrlException`.
     * Posts to `/json/mobileClient/requestUrlException` on the gateway.
     */
    requestException(
        request: IbossExceptionRequest,
    ): ResultAsync<boolean, IbossError> {
        const key = this.options.overrideUsername
            ? this.options.overrideSecurityKey
            : this.options.securityKey;

        if (!key) {
            return errResult({
                type: "MISSING_CREDENTIALS",
                message: "securityKey is required to request an exception.",
            });
        }

        const body = {
            blockedUrl: request.blockedUrl,
            reasonMessage: request.reasonMessage ?? "",
            userEmail: request.userEmail ?? this.options.userEmail,
            overrideUser: request.overrideUser ?? this.options.overrideUsername,
            ipAddress: request.ipAddress,
            securityKey: key,
        };

        return ResultAsync.fromPromise(
            this.http
                .post(
                    `${this.origin()}/json/mobileClient/requestUrlException`,
                    body,
                )
                .then(() => true),
            cause => toRequestError(cause, "Failed to submit URL exception."),
        );
    }

    private fetchFiltering(
        endpoint: string,
    ): ResultAsync<IbossFilteringResponse, IbossError> {
        return ResultAsync.fromPromise(this.fetchWithRetries(endpoint), cause =>
            toRequestError(cause, "Failed to reach the iboss cloud filter."),
        );
    }

    private async fetchWithRetries(
        endpoint: string,
    ): Promise<IbossFilteringResponse> {
        let lastError: unknown;

        for (let attempt = 1; attempt <= this.options.retries; attempt++) {
            try {
                const response =
                    await this.http.get<IbossFilteringResponse>(endpoint);

                return response.data;
            } catch (error) {
                lastError = error;

                if (attempt < this.options.retries) {
                    await new Promise(resolve =>
                        setTimeout(resolve, attempt * 400),
                    );
                }
            }
        }

        throw lastError;
    }
}

function errResult<T>(error: IbossError): ResultAsync<T, IbossError> {
    return ResultAsync.fromPromise(
        Promise.reject(error),
        cause => cause as IbossError,
    );
}

function toRequestError(cause: unknown, message: string): IbossError {
    const error = cause as XiorError;

    return {
        type: "FILTER_REQUEST_FAILED",
        message,
        status: error?.response?.status,
        cause,
    };
}

export function createIbossFilterChecker(
    options: IbossCheckerOptions,
): IbossFilterChecker {
    return new IbossFilterChecker(options);
}

export function checkIbossUrl(
    url: string,
    options: IbossCheckerOptions,
): ResultAsync<IbossDecision, IbossError> {
    return createIbossFilterChecker(options).checkUrl(url);
}

export { IbossFilterChecker };
