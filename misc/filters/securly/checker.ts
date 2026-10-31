import type { ResultAsync } from "neverthrow";

import { toCategories } from "../categories";
import {
    type FilterError,
    type FilterStatus,
    type FilterVerdict,
    toFilterError,
} from "../verdict";
import {
    type BrokerDecision,
    type BrokerRequestInput,
    type BrokerResponse,
    checkStatus,
} from "./broker";
import { CATEGORY_BIT_NAMES, decodeSecurlyCategoryId } from "./categories";

/**
 * The broker's decisions. SS, YT and GM still load the page (forced
 * SafeSearch, restricted YouTube, Google mode), and UNKNOWN is the broker not
 * recognising the school, so it decided nothing.
 */
const ANSWERS: Record<
    Exclude<BrokerDecision, "FAILED_OPEN">,
    [FilterStatus, string]
> = {
    ALLOW: ["allowed", "Securly allows it"],
    SS: ["allowed", "Securly allows it with SafeSearch forced on"],
    YT: ["allowed", "Securly allows it with YouTube restricted"],
    GM: ["allowed", "Securly allows it in Google mode"],
    DENY: ["blocked", "Securly blocks it"],
    PAUSE: ["warned", "Securly paused this student's browsing"],
    ERROR: ["unknown", "Securly's broker answered with an error"],
    UNKNOWN: ["unknown", "Securly doesn't recognise this school's email"],
};

function toVerdict(response: BrokerResponse): FilterVerdict {
    if (response.kind === "failed_open")
        return {
            status: "unknown",
            categories: [],
            detail: "Securly's broker failed open, so it decided nothing.",
            matched: [],
        };

    const [status, detail] = ANSWERS[response.decision ?? "UNKNOWN"];
    // Only category bits: the rest of the mask are flags (cacheability and
    // shared classifier bits), not something a page is about.
    const { bits } = decodeSecurlyCategoryId(response.categoryId ?? "-1");
    const keyword = response.keyword === "-1" ? undefined : response.keyword;
    return {
        status,
        categories: toCategories(bits.map(bit => CATEGORY_BIT_NAMES[bit])),
        detail: `${detail}.`,
        matched: keyword ? [keyword] : [],
    };
}

/** Asks Securly's broker about `input.host` as the student `input.useremail`. */
export function checkSecurlyFilter(
    input: BrokerRequestInput,
): ResultAsync<FilterVerdict, FilterError> {
    return checkStatus(input).map(toVerdict).mapErr(toFilterError);
}
