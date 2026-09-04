/**
 * LanSchool's cloud filtering, over the Netsweeper node it forwards to — for
 * the domain-reputation registry (misc/filters/domainReputation).
 *
 * This is deliberately separate from `air/checker.ts`: that module is the
 * *Lenovo LanSchool Air* app, which only decides through a local native-
 * messaging host (`nativeWebLimit`) — there is no remote call it can make on
 * its own. This module is the other LanSchool deployment shape, the one that
 * forwards straight to a Netsweeper categorisation node, and needs no local
 * host to answer.
 *
 * The technique — the base64 payload shape and the specific `coopacademies`
 * node — is ported from shayderrr's `idk` (github.com/shayderrr/idk,
 * `filters/lanschool.js`); credit to that author for finding it. It is not
 * independently re-derived here: `~/extensions/lanschoolStudent` is the Lenovo
 * Air app (the other deployment), and the wayback captures for LanSchool's own
 * domain didn't surface this node, so shayderrr's finding is the source.
 */

import type { DomainVerdict } from "../domainReputation";

const DEFAULT_NODE = "https://filter.coopacademiescloud.netsweeper.com:3431/";
const TIMEOUT_MS = 10_000;

const toHost = (domain: string): string =>
    domain
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .trim();

export async function checkLanSchoolNetsweeperDomain(
    domain: string,
): Promise<DomainVerdict> {
    const node = process.env.CIVIL_REP_LANSCHOOL_URL || DEFAULT_NODE;
    // The exact payload shayderrr's checker sends: a fixed "policy" prefix and
    // trailer around the target URL, base64-encoded onto the path.
    const payload = Buffer.from(
        `001 https://${toHost(domain)} - - - - 3372822944`,
    ).toString("base64");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const res = await fetch(node + payload, { signal: controller.signal });
        if (!res.ok) return "UNKNOWN";
        const text = await res.text();

        if (text.startsWith("ALLOW")) return "ALLOW";
        // A block redirects into a `...&cat=<id>` categorisation URL.
        return text.includes("&cat=") ? "BLOCK" : "UNKNOWN";
    } catch {
        return "UNKNOWN";
    } finally {
        clearTimeout(timer);
    }
}
