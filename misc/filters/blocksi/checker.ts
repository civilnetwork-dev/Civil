import { err, ok, type Result, ResultAsync } from "neverthrow";
import xior, { type XiorError, type XiorInstance } from "xior";

enum BlocksiAction {
    Allow = 0,
    Block = 1,
    Warn = 2,
    Empty = 3,
}

export type UrlListRule = {
    Url: string;
    Action: BlocksiAction | "0" | "1" | "2" | "3";
    Lock?: boolean;
    Name?: string;
};

export type CategoryDefinition = {
    id: number;
    name: string;
    categoryGroup: string;
    action?: BlocksiAction;
};

export type CustomCategory = {
    Name: string;
    Urls: string[];
    Action: BlocksiAction;
};

export type BlocksiCheckerOptions = {
    /**
     * Defaults to https://service1.blocksi.net
     */
    ratingBaseUrl?: string;

    /**
     * Publicly extractable in the extension anyway.
     */
    ratingApiKey?: string;

    /**
     * Override category actions.
     */
    categoryActions?: Partial<Record<number, BlocksiAction>>;

    /**
     * Optional compact Blocksi filter string.
     */
    filterSettingsString?: string;

    /**
     * Category definitions.
     */
    categories?: Record<number, CategoryDefinition>;

    /**
     * Local URL rules.
     */
    exceptionList?: UrlListRule[];
    classList?: UrlListRule[];
    studentList?: UrlListRule[];

    /**
     * Custom categories.
     */
    customCategories?: CustomCategory[];

    timeoutMs?: number;
    retries?: number;
};

export type BlocksiDecision = {
    url: string;
    normalizedUrl: string;
    hostname: string;

    action: BlocksiAction;

    allowed: boolean;
    blocked: boolean;
    warned: boolean;

    categoryId?: number;
    categoryName?: string;
    categoryGroup?: string;

    matchedFilter: string;
    matchedRule?: string;

    filterQueue: string[];

    reason: string;
};

export type BlocksiError =
    | {
          type: "INVALID_URL";
          message: string;
          input: string;
      }
    | {
          type: "RATING_REQUEST_FAILED";
          message: string;
          status?: number;
          cause?: unknown;
      };

const DEFAULT_RATING_BASE_URL = "https://service1.blocksi.net";

/**
 * Extracted from Blocksi extension categories.
 */
const BLOCKSI_CATEGORIES: Record<number, CategoryDefinition> = {
    100: {
        id: 100,
        name: "Malicious Websites",
        categoryGroup: "Security Risk",
    },
    101: {
        id: 101,
        name: "Phishing",
        categoryGroup: "Security Risk",
    },
    102: {
        id: 102,
        name: "Spam URLs",
        categoryGroup: "Security Risk",
    },
    103: {
        id: 103,
        name: "Newly Registered Domain",
        categoryGroup: "Security Risk",
    },
    104: {
        id: 104,
        name: "Newly Observed Domain",
        categoryGroup: "Security Risk",
    },
    105: {
        id: 105,
        name: "Dynamic DNS",
        categoryGroup: "Security Risk",
    },

    200: {
        id: 200,
        name: "Drug Abuse",
        categoryGroup: "Unethical",
    },
    201: {
        id: 201,
        name: "Hacking",
        categoryGroup: "Unethical",
    },
    202: {
        id: 202,
        name: "Illegal or Unethical",
        categoryGroup: "Unethical",
    },
    203: {
        id: 203,
        name: "Discrimination",
        categoryGroup: "Unethical",
    },
    204: {
        id: 204,
        name: "Explicit Violence",
        categoryGroup: "Unethical",
    },
    205: {
        id: 205,
        name: "Extremist Groups",
        categoryGroup: "Unethical",
    },
    206: {
        id: 206,
        name: "Proxy Avoidance",
        categoryGroup: "Unethical",
    },
    207: {
        id: 207,
        name: "Plagiarism",
        categoryGroup: "Unethical",
    },
    208: {
        id: 208,
        name: "Child Abuse",
        categoryGroup: "Unethical",
    },

    300: {
        id: 300,
        name: "Alternative Beliefs",
        categoryGroup: "Adult/Mature Content",
    },
    301: {
        id: 301,
        name: "Abortion",
        categoryGroup: "Adult/Mature Content",
    },
    302: {
        id: 302,
        name: "Adult",
        categoryGroup: "Adult/Mature Content",
    },
    303: {
        id: 303,
        name: "Advocacy Organizations",
        categoryGroup: "Adult/Mature Content",
    },
    304: {
        id: 304,
        name: "Gambling",
        categoryGroup: "Adult/Mature Content",
    },
    305: {
        id: 305,
        name: "Nudity and Risque",
        categoryGroup: "Adult/Mature Content",
    },
    306: {
        id: 306,
        name: "Pornography",
        categoryGroup: "Adult/Mature Content",
    },
    307: {
        id: 307,
        name: "Dating",
        categoryGroup: "Adult/Mature Content",
    },
    308: {
        id: 308,
        name: "Weapons (sales)",
        categoryGroup: "Adult/Mature Content",
    },
    309: {
        id: 309,
        name: "Marijuana",
        categoryGroup: "Adult/Mature Content",
    },
    310: {
        id: 310,
        name: "Sex Education",
        categoryGroup: "Adult/Mature Content",
    },
    311: {
        id: 311,
        name: "Alcohol",
        categoryGroup: "Adult/Mature Content",
    },
    312: {
        id: 312,
        name: "Tobacco",
        categoryGroup: "Adult/Mature Content",
    },

    400: {
        id: 400,
        name: "Freeware and Software Downloads",
        categoryGroup: "Bandwidth Consuming",
    },
    401: {
        id: 401,
        name: "File Sharing and Storage",
        categoryGroup: "Bandwidth Consuming",
    },
    402: {
        id: 402,
        name: "Streaming Media and Download",
        categoryGroup: "Bandwidth Consuming",
    },

    500: {
        id: 500,
        name: "Finance and Banking",
        categoryGroup: "Business",
    },
    501: {
        id: 501,
        name: "Search Engines and Portals",
        categoryGroup: "Business",
    },
    508: {
        id: 508,
        name: "Web Hosting",
        categoryGroup: "Business",
    },
    513: {
        id: 513,
        name: "Web Analytics",
        categoryGroup: "Business",
    },

    600: {
        id: 600,
        name: "Advertising",
        categoryGroup: "Personal",
    },
    602: {
        id: 602,
        name: "Games",
        categoryGroup: "Personal",
    },
    603: {
        id: 603,
        name: "Web-based Email",
        categoryGroup: "Personal",
    },
    604: {
        id: 604,
        name: "Entertainment",
        categoryGroup: "Personal",
    },
    606: {
        id: 606,
        name: "Education",
        categoryGroup: "Personal",
    },
    610: {
        id: 610,
        name: "News and Media",
        categoryGroup: "Personal",
    },
    611: {
        id: 611,
        name: "Social Networking",
        categoryGroup: "Personal",
    },
    615: {
        id: 615,
        name: "Shopping and Auction",
        categoryGroup: "Personal",
    },
    617: {
        id: 617,
        name: "Sports",
        categoryGroup: "Personal",
    },

    700: {
        id: 700,
        name: "Unrated",
        categoryGroup: "Unrated",
    },
};

const DEFAULT_CATEGORY_ACTIONS: Partial<Record<number, BlocksiAction>> = {
    100: BlocksiAction.Block,
    101: BlocksiAction.Block,
    102: BlocksiAction.Block,
    103: BlocksiAction.Warn,
    104: BlocksiAction.Warn,
    105: BlocksiAction.Warn,

    200: BlocksiAction.Block,
    201: BlocksiAction.Block,
    202: BlocksiAction.Block,
    203: BlocksiAction.Block,
    204: BlocksiAction.Block,
    205: BlocksiAction.Block,
    206: BlocksiAction.Block,
    208: BlocksiAction.Block,

    302: BlocksiAction.Block,
    304: BlocksiAction.Block,
    305: BlocksiAction.Block,
    306: BlocksiAction.Block,
    307: BlocksiAction.Block,
    308: BlocksiAction.Block,
    309: BlocksiAction.Block,
    311: BlocksiAction.Block,
    312: BlocksiAction.Block,
};

type BlocksiRatingResponse = {
    Category?: unknown;
    category?: unknown;
    cat?: unknown;
    data?: {
        Category?: unknown;
        category?: unknown;
        cat?: unknown;
    };
};

function normalizeUrl(input: string): Result<URL, BlocksiError> {
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
    try {
        const value = /^https?:\/\//i.test(input) ? input : `https://${input}`;

        return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
        return input
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/^www\./, "")
            .split("/")[0]!;
    }
}

function hostMatches(hostname: string, rule: string): boolean {
    const host = normalizeHost(hostname);
    const ruleHost = normalizeHost(rule);

    if (ruleHost === "*") return true;

    const escaped = ruleHost
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*");

    if (new RegExp(`^${escaped}$`, "i").test(host)) {
        return true;
    }

    return host === ruleHost || host.endsWith(`.${ruleHost}`);
}

function urlMatches(url: URL, rule: string): boolean {
    const href = url.href.toLowerCase();
    const cleanRule = rule.toLowerCase();

    return (
        hostMatches(url.hostname, cleanRule) ||
        href === cleanRule ||
        href.includes(cleanRule.replace(/\*/g, ""))
    );
}

function toAction(value: UrlListRule["Action"]): BlocksiAction {
    const parsed = Number(value);

    return parsed === 0 || parsed === 1 || parsed === 2 || parsed === 3
        ? parsed
        : BlocksiAction.Empty;
}

function extractCategoryId(response: BlocksiRatingResponse): number | null {
    const value =
        response.Category ??
        response.category ??
        response.cat ??
        response.data?.Category ??
        response.data?.category ??
        response.data?.cat;

    const parsed = Number(value);

    return Number.isInteger(parsed) ? parsed : null;
}

function createDecision(params: {
    url: URL;
    action: BlocksiAction;
    matchedFilter: string;
    filterQueue: string[];
    reason: string;
    matchedRule?: string;
    categoryId?: number;
    categoryName?: string;
    categoryGroup?: string;
}): BlocksiDecision {
    return {
        url: params.url.href,
        normalizedUrl: params.url.href,
        hostname: params.url.hostname,

        action: params.action,

        allowed: params.action === BlocksiAction.Allow,
        blocked: params.action === BlocksiAction.Block,
        warned: params.action === BlocksiAction.Warn,

        categoryId: params.categoryId,
        categoryName: params.categoryName,
        categoryGroup: params.categoryGroup,

        matchedFilter: params.matchedFilter,
        matchedRule: params.matchedRule,

        filterQueue: params.filterQueue,

        reason: params.reason,
    };
}

class BlocksiFilterChecker {
    private readonly http: XiorInstance;

    private readonly options: Required<
        Pick<BlocksiCheckerOptions, "timeoutMs" | "retries" | "ratingBaseUrl">
    > &
        Omit<BlocksiCheckerOptions, "timeoutMs" | "retries" | "ratingBaseUrl">;

    constructor(options: BlocksiCheckerOptions = {}) {
        this.options = {
            timeoutMs: options.timeoutMs ?? 8_000,
            retries: options.retries ?? 3,
            ratingBaseUrl: options.ratingBaseUrl ?? DEFAULT_RATING_BASE_URL,

            ...options,

            categories: options.categories ?? BLOCKSI_CATEGORIES,

            categoryActions: {
                ...DEFAULT_CATEGORY_ACTIONS,
                ...options.categoryActions,
            },

            exceptionList: options.exceptionList ?? [],
            classList: options.classList ?? [],
            studentList: options.studentList ?? [],
            customCategories: options.customCategories ?? [],
        };

        this.http = xior.create({
            timeout: this.options.timeoutMs,

            headers: {
                "x-api-key":
                    options.ratingApiKey ?? "64NQWtq9QFiaGqiYgikhAzebf",
            },
        });
    }

    checkUrl(input: string): ResultAsync<BlocksiDecision, BlocksiError> {
        const parsed = normalizeUrl(input);

        if (parsed.isErr()) {
            return ResultAsync.fromPromise(
                Promise.reject(parsed.error),
                error => error as BlocksiError,
            );
        }

        const url = parsed.value;
        const filterQueue: string[] = [];

        const localDecision = this.checkLocalLists(url, filterQueue);

        if (localDecision) {
            return ResultAsync.fromSafePromise(Promise.resolve(localDecision));
        }

        return this.getRemoteCategory(url.href).map(categoryId => {
            filterQueue.push("Web Filter");

            if (categoryId == null || categoryId < 0) {
                return createDecision({
                    url,
                    action: BlocksiAction.Allow,
                    matchedFilter: "Web Filter",
                    filterQueue,
                    reason: "No category was returned.",
                });
            }

            const category = this.options.categories?.[categoryId];

            const action =
                this.options.categoryActions?.[categoryId] ??
                category?.action ??
                BlocksiAction.Allow;

            return createDecision({
                url,

                action,

                categoryId,

                categoryName: category?.name ?? `Category ${categoryId}`,

                categoryGroup: category?.categoryGroup,

                matchedFilter: "Web Filter",

                filterQueue,

                reason:
                    action === BlocksiAction.Block
                        ? `Blocked by category: ${category?.name ?? categoryId}.`
                        : action === BlocksiAction.Warn
                          ? `Warned by category: ${category?.name ?? categoryId}.`
                          : `Allowed by category: ${category?.name ?? categoryId}.`,
            });
        });
    }

    checkMany(urls: string[]): ResultAsync<BlocksiDecision[], BlocksiError> {
        return ResultAsync.combine(urls.map(url => this.checkUrl(url)));
    }

    getRemoteCategory(url: string): ResultAsync<number | null, BlocksiError> {
        return ResultAsync.fromPromise(
            this.fetchCategoryWithRetries(url),

            cause => {
                const error = cause as XiorError;

                return {
                    type: "RATING_REQUEST_FAILED",
                    message: "Failed to fetch Blocksi URL rating.",
                    status: error?.response?.status,
                    cause,
                };
            },
        );
    }

    private checkLocalLists(
        url: URL,
        filterQueue: string[],
    ): BlocksiDecision | null {
        const checks: Array<{
            name: string;
            rules: UrlListRule[];
        }> = [
            {
                name: "Class session",
                rules: this.options.classList ?? [],
            },

            {
                name: "Exception List",
                rules: this.options.exceptionList ?? [],
            },

            {
                name: "Student List",
                rules: this.options.studentList ?? [],
            },
        ];

        for (const check of checks) {
            filterQueue.push(check.name);

            for (const rule of check.rules) {
                if (!urlMatches(url, rule.Url)) {
                    continue;
                }

                const action = toAction(rule.Action);

                return createDecision({
                    url,

                    action,

                    matchedFilter: check.name,

                    matchedRule: rule.Url,

                    filterQueue,

                    reason:
                        action === BlocksiAction.Block
                            ? `URL matched block rule: ${rule.Url}.`
                            : action === BlocksiAction.Warn
                              ? `URL matched warning rule: ${rule.Url}.`
                              : `URL matched allow rule: ${rule.Url}.`,
                });
            }
        }

        filterQueue.push("Custom Category Filter");

        for (const category of this.options.customCategories ?? []) {
            for (const ruleUrl of category.Urls) {
                if (!urlMatches(url, ruleUrl)) {
                    continue;
                }

                return createDecision({
                    url,

                    action: category.Action,

                    matchedFilter: "Custom Category Filter",

                    matchedRule: ruleUrl,

                    categoryId: 800,

                    categoryName: category.Name,

                    categoryGroup: "Custom",

                    filterQueue,

                    reason: `URL matched custom category "${category.Name}" rule: ${ruleUrl}.`,
                });
            }
        }

        return null;
    }

    private async fetchCategoryWithRetries(
        url: string,
    ): Promise<number | null> {
        let lastError: unknown;

        for (let attempt = 1; attempt <= this.options.retries; attempt++) {
            try {
                const response = await this.http.get<BlocksiRatingResponse>(
                    `${this.options.ratingBaseUrl.replace(/\/$/, "")}/getRating.json`,
                    {
                        params: {
                            url,
                        },
                    },
                );

                return extractCategoryId(response.data);
            } catch (error) {
                lastError = error;

                if (attempt < this.options.retries) {
                    await new Promise(resolve =>
                        setTimeout(resolve, attempt * 500),
                    );
                }
            }
        }

        throw lastError;
    }
}

export function createBlocksiFilterChecker(
    options: BlocksiCheckerOptions = {},
): BlocksiFilterChecker {
    return new BlocksiFilterChecker(options);
}

export function checkBlocksiUrl(
    url: string,
    options: BlocksiCheckerOptions = {},
): ResultAsync<BlocksiDecision, BlocksiError> {
    return createBlocksiFilterChecker(options).checkUrl(url);
}
