import type { Category } from "./categories";

/** What a filter would do with a page. */
export type FilterStatus = "allowed" | "blocked" | "warned" | "unknown";

/**
 * Every checker's answer, whatever the vendor: the filter check page, the
 * domain-reputation registry and the filter probe all read this one shape.
 * A checker that could not decide says "unknown" rather than guessing
 * "allowed": no data is not a pass.
 */
export interface FilterVerdict {
    status: FilterStatus;
    /** In Civil's one vocabulary (categories.ts), never the vendor's own. */
    categories: Category[];
    /** One plain sentence on why. */
    detail: string;
    /** The vendor's own words that decided it (a keyword, rule or listed
     *  domain). Empty when nothing matched. */
    matched: string[];
}

/** Why a check produced no verdict at all. */
export interface FilterError {
    /** 400 for INVALID_URL, 502 for NETWORK, 500 otherwise
     *  (utils/respondFilterError.ts). */
    type: "INVALID_URL" | "NETWORK" | "PARSE" | "CONFIG";
    message: string;
}

/** Every vendor's own error names, sorted into the four kinds. */
const ERROR_KINDS: Record<string, FilterError["type"]> = {
    INVALID_URL: "INVALID_URL",
    PARSE: "PARSE",
    PARSE_ERROR: "PARSE",
    MANIFEST_PARSE_ERROR: "PARSE",
    BAD_NATIVE_RESPONSE: "PARSE",
    CONFIG: "CONFIG",
    CONFIG_ERROR: "CONFIG",
    INVALID_CONFIG: "CONFIG",
    INVALID_API_SERVER: "CONFIG",
    MISSING_CREDENTIALS: "CONFIG",
    VALIDATION_FAILED: "CONFIG",
    NATIVE_MESSAGING_UNAVAILABLE: "CONFIG",
    EXTENSION_NOT_FOUND: "CONFIG",
};

/** A vendor checker's error in the shared shape. Anything not named above
 *  (NETWORK_ERROR, HTTP_ERROR, TIMEOUT, RATING_REQUEST_FAILED and the rest)
 *  is a failure to reach or hear back from the vendor. */
export function toFilterError(error: {
    type: string;
    message: string;
}): FilterError {
    return {
        type: ERROR_KINDS[error.type] ?? "NETWORK",
        message: error.message,
    };
}
