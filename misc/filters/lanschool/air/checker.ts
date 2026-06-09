import { err, ok, type Result, ResultAsync } from "neverthrow";
import xior, { type XiorInstance } from "xior";
import { z } from "zod";

const DEFAULT_LSA_CHROME_INSTALLER_URL =
    "https://api-lsa.lenovosoftware.com/0/lsa/lanschool/clientInstaller/chrome";

export type LanSchoolError =
    | { type: "INVALID_URL"; message: string }
    | { type: "INVALID_API_SERVER"; message: string }
    | { type: "VALIDATION_FAILED"; status?: number; message: string }
    | { type: "NATIVE_MESSAGING_UNAVAILABLE"; message: string }
    | { type: "BAD_NATIVE_RESPONSE"; message: string }
    | { type: "NETWORK_ERROR"; message: string };

export type LanSchoolDecision =
    | {
          status: "blocked";
          url: string;
          redirectUrl?: string;
          redirect?: unknown;
          raw: LanSchoolWebLimitReply;
      }
    | { status: "allowed"; url: string; raw: LanSchoolWebLimitReply };

export interface LanSchoolCheckerOptions {
    appId?: string;
    chromeInstallerUrl?: string;
    timeoutMs?: number;
    http?: XiorInstance;
    nativeWebLimit?: (request: LanSchoolWebLimitRequest) => Promise<unknown>;
}

export interface LanSchoolWebLimitRequest {
    message: "WebLimit";
    browser: "chrome";
    body: {
        tabId: string;
        url: string;
    };
}

export interface LanSchoolWebLimitReply {
    message?: "WebLimit";
    tabId: string;
    url: string;
    block: "true" | "false" | boolean;
    redirectUrl?: string;
    redirect?: unknown;
}

const webLimitReplySchema = z.object({
    message: z.literal("WebLimit").optional(),
    tabId: z.string(),
    url: z.string().url(),
    block: z.union([z.literal("true"), z.literal("false"), z.boolean()]),
    redirectUrl: z.string().url().optional(),
    redirect: z.unknown().optional(),
});

export function normalizeHttpUrl(
    input: string,
): Result<string, LanSchoolError> {
    try {
        const url = new URL(input.includes("://") ? input : `https://${input}`);

        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return err({
                type: "INVALID_URL",
                message: "Only HTTP(S) URLs are supported.",
            });
        }

        return ok(url.toString());
    } catch {
        return err({ type: "INVALID_URL", message: `Invalid URL: ${input}` });
    }
}

export function validateLanSchoolHost(
    input: string,
): Result<URL, LanSchoolError> {
    try {
        const url = new URL(input);
        const parts = url.hostname.split(".");

        if (
            url.protocol !== "https:" ||
            parts.length < 2 ||
            parts.at(-2) !== "lenovosoftware" ||
            parts.at(-1) !== "com"
        ) {
            return err({
                type: "INVALID_API_SERVER",
                message:
                    "Expected a HTTPS *.lenovosoftware.com LanSchool endpoint.",
            });
        }

        return ok(url);
    } catch {
        return err({
            type: "INVALID_API_SERVER",
            message: `Invalid LanSchool URL: ${input}`,
        });
    }
}

export function buildValidationUrl(
    appId: string,
    chromeInstallerUrl = DEFAULT_LSA_CHROME_INSTALLER_URL,
): Result<string, LanSchoolError> {
    const endpoint = validateLanSchoolHost(chromeInstallerUrl);
    if (endpoint.isErr()) return err(endpoint.error);

    const base = chromeInstallerUrl.endsWith("/")
        ? chromeInstallerUrl
        : `${chromeInstallerUrl}/`;
    return ok(
        new URL(`${encodeURIComponent(appId)}/validate`, base).toString(),
    );
}

export function validateLanSchoolApp(
    appId: string,
    options: Pick<
        LanSchoolCheckerOptions,
        "chromeInstallerUrl" | "timeoutMs" | "http"
    > = {},
): ResultAsync<true, LanSchoolError> {
    const validationUrl = buildValidationUrl(appId, options.chromeInstallerUrl);
    if (validationUrl.isErr()) {
        return ResultAsync.fromSafePromise(
            Promise.resolve(err(validationUrl.error)),
        ).andThen(x => x);
    }

    const http =
        options.http ??
        xior.create({
            timeout: options.timeoutMs ?? 8_000,
            headers: { "content-type": "application/json" },
        });

    return ResultAsync.fromPromise(
        http.get(validationUrl.value),
        (error): LanSchoolError => ({
            type: "NETWORK_ERROR",
            message: error instanceof Error ? error.message : String(error),
        }),
    ).andThen(response => {
        if (response.status >= 200 && response.status < 300)
            return ok(true as const);

        return err({
            type: "VALIDATION_FAILED" as const,
            status: response.status,
            message: `LanSchool app validation failed with HTTP ${response.status}.`,
        });
    });
}

export function buildWebLimitRequest(
    inputUrl: string,
    tabId = "0:0",
): Result<LanSchoolWebLimitRequest, LanSchoolError> {
    const normalized = normalizeHttpUrl(inputUrl);
    if (normalized.isErr()) return err(normalized.error);

    return ok({
        message: "WebLimit",
        browser: "chrome",
        body: {
            tabId,
            url: normalized.value.slice(0, 1023),
        },
    });
}

export function parseWebLimitReply(
    raw: unknown,
): Result<LanSchoolWebLimitReply, LanSchoolError> {
    const parsed = webLimitReplySchema.safeParse(raw);

    if (!parsed.success) {
        return err({
            type: "BAD_NATIVE_RESPONSE",
            message: parsed.error.issues.map(issue => issue.message).join("; "),
        });
    }

    return ok(parsed.data);
}

export function decisionFromWebLimitReply(
    raw: unknown,
): Result<LanSchoolDecision, LanSchoolError> {
    const reply = parseWebLimitReply(raw);
    if (reply.isErr()) return err(reply.error);

    const blocked = reply.value.block === true || reply.value.block === "true";

    return ok(
        blocked
            ? {
                  status: "blocked",
                  url: reply.value.url,
                  redirectUrl: reply.value.redirectUrl,
                  redirect: reply.value.redirect,
                  raw: reply.value,
              }
            : {
                  status: "allowed",
                  url: reply.value.url,
                  raw: reply.value,
              },
    );
}

export function checkLanSchoolUrl(
    url: string,
    options: LanSchoolCheckerOptions = {},
): ResultAsync<LanSchoolDecision, LanSchoolError> {
    if (!options.nativeWebLimit) {
        return ResultAsync.fromSafePromise(
            Promise.resolve(
                err({
                    type: "NATIVE_MESSAGING_UNAVAILABLE",
                    message:
                        "LanSchool URL filtering is handled through the local native messaging host. Provide nativeWebLimit to check real decisions.",
                } satisfies LanSchoolError),
            ),
        ).andThen(x => x);
    }

    const request = buildWebLimitRequest(url);
    if (request.isErr()) {
        return ResultAsync.fromSafePromise(
            Promise.resolve(err(request.error)),
        ).andThen(x => x);
    }

    return ResultAsync.fromPromise(
        options.nativeWebLimit(request.value),
        (error): LanSchoolError => ({
            type: "NATIVE_MESSAGING_UNAVAILABLE",
            message: error instanceof Error ? error.message : String(error),
        }),
    ).andThen(decisionFromWebLimitReply);
}

export function createLanSchoolChecker(options: LanSchoolCheckerOptions = {}) {
    return {
        buildValidationUrl: (appId = options.appId) => {
            if (!appId)
                return err({
                    type: "VALIDATION_FAILED",
                    message: "appId is required.",
                });
            return buildValidationUrl(appId, options.chromeInstallerUrl);
        },

        validateApp: (appId = options.appId) => {
            if (!appId) {
                return ResultAsync.fromSafePromise(
                    Promise.resolve(
                        err({
                            type: "VALIDATION_FAILED",
                            message: "appId is required.",
                        } satisfies LanSchoolError),
                    ),
                ).andThen(x => x);
            }

            return validateLanSchoolApp(appId, options);
        },

        checkUrl: (url: string) => checkLanSchoolUrl(url, options),

        normalizeHttpUrl,
        buildWebLimitRequest,
        parseWebLimitReply,
        decisionFromWebLimitReply,
    };
}
