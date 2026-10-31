/**
 * LanSchool's cloud filtering, over the Netsweeper node it forwards to: for
 * the domain-reputation registry (misc/filters/domainReputation).
 *
 * This is deliberately separate from `air/checker.ts`: that module is the
 * *Lenovo LanSchool Air* app, which only decides through a local native-
 * messaging host (`nativeWebLimit`): there is no remote call it can make on
 * its own. This module is the other LanSchool deployment shape, the one that
 * forwards straight to a Netsweeper categorisation node, and needs no local
 * host to answer.
 *
 * The technique, the base64 payload shape and the specific `coopacademies`
 * node, is ported from shayderrr's `idk` (github.com/shayderrr/idk,
 * `filters/lanschool.js`); credit to that author for finding it. It is not
 * independently re-derived here: `~/extensions/lanschoolStudent` is the Lenovo
 * Air app (the other deployment), and the wayback captures for LanSchool's own
 * domain didn't surface this node, so shayderrr's finding is the source.
 */

import { ResultAsync } from "neverthrow";

import { toHost } from "../utils/vendorInput";
import type { FilterError, FilterVerdict } from "../verdict";

const DEFAULT_NODE = "https://filter.coopacademiescloud.netsweeper.com:3431/";
const TIMEOUT_MS = 10_000;

/** Netsweeper's reply: "ALLOW…", or a block page URL carrying `&cat=<id>`.
 *  Civil has no table of Netsweeper's category ids, so none is named. */
function toVerdict(reply: string): FilterVerdict {
    if (reply.startsWith("ALLOW"))
        return {
            status: "allowed",
            categories: [],
            detail: "LanSchool's Netsweeper node allows it.",
            matched: [],
        };
    const category = /&cat=([^&\s]+)/.exec(reply)?.[1];
    return category === undefined
        ? {
              status: "unknown",
              categories: [],
              detail: "LanSchool's Netsweeper node gave no verdict.",
              matched: [],
          }
        : {
              status: "blocked",
              categories: [],
              detail: `LanSchool's Netsweeper node blocks it as category ${category}.`,
              matched: [],
          };
}

async function askNode(url: string): Promise<string> {
    const node = process.env.CIVIL_REP_LANSCHOOL_URL || DEFAULT_NODE;
    // The exact payload shayderrr's checker sends: a fixed "policy" prefix and
    // trailer around the target URL, base64-encoded onto the path.
    const payload = Buffer.from(
        `001 https://${toHost(url)} - - - - 3372822944`,
    ).toString("base64");

    const res = await fetch(node + payload, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Netsweeper node answered ${res.status}`);
    return res.text();
}

export function checkLanSchoolNetsweeperFilter(
    url: string,
): ResultAsync<FilterVerdict, FilterError> {
    return ResultAsync.fromPromise(askNode(url), (error): FilterError => ({
        type: "NETWORK",
        message: error instanceof Error ? error.message : String(error),
    })).map(toVerdict);
}
