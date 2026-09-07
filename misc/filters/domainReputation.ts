/**
 * "Would filter X block this bare domain?" — one uniform verdict per tracked
 * filter, for picking a FreeDNS base domain no filter blocks (see
 * misc/tunnel/pickDomain).
 *
 * ## Where each method comes from
 *
 * Every checker's method is read out of that filter's own extension source (in
 * `~/extensions`), or, where the extension needs a per-deployment identity that
 * isn't in the shipped code, out of real captures of one (Wayback Machine CDX
 * indexes of the vendor's own domains — see the per-checker doc comments for
 * which). None of these invent a domain, key, or endpoint that wasn't observed
 * somewhere real.
 *
 *   - blocksi, fortiguard, cisco, lightspeed — each ships a global rating
 *     service with a usable default key in the extension itself; these reuse
 *     the full `misc/filters/<vendor>/checker.ts` clients.
 *   - iboss — `misc/filters/iboss/checker.ts`'s `performUrlFiltering`, against a
 *     real gateway cluster (`cluster147478-swg.ibosscloud.com`, the most
 *     persistently-recaptured cluster in the wayback index — `CIVIL_REP_IBOSS_HOST`
 *     overrides it) and `IBOSS_SECURITY_KEY` from the environment (already a
 *     required var — see misc/env.ts). No key, no check: this abstains rather
 *     than send an invalid one.
 *   - securly — `misc/filters/securly/{broker,cluster}.ts`'s existing, full
 *     cluster-resolution + broker flow, called with this project's own real
 *     Securly extension id (computed from the installed extension's manifest
 *     key via `computeExtensionIdFromKey`, the same helper goguardian uses —
 *     not copied from any third party). The probing email is a non-institution
 *     placeholder (`CIVIL_REP_SECURLY_EMAIL`): cluster resolution already falls
 *     back to the dominant US cluster for an email it doesn't recognise
 *     (`normalizeClusterUrl`), so nothing about the query needs to resemble a
 *     real district or person.
 *   - linewize — `misc/filters/linewize/checker.ts`'s existing client, pointed
 *     at a real regional verdict server with a real device id captured from the
 *     wayback index (`otorohanga.college.nz`, the most-recaptured — override via
 *     `CIVIL_REP_LINEWIZE_DEVICEID` / `_REGION`).
 *   - lanschool — a second LanSchool deployment shape (Netsweeper-backed, not
 *     the Lenovo Air app `air/checker.ts` already here), in
 *     ./lanschool/netsweeperChecker — a credited port of a technique found in
 *     a third party's checker, not independently re-derived; see that file.
 *   - aristotle — ./aristotle/checker, a WebSocket protocol independently
 *     confirmed against the real extension bundle's own message enums, using
 *     the live `{domain, secret}` pair shipped in that extension's own
 *     `config.json` (a fixed, per-district secret — nothing here is
 *     cryptographically derived; see that file's doc comment).
 *
 * ## Left out, and why
 *
 * Some filters were investigated and deliberately not wired in:
 *
 *   - **interclass** — its own extension bundle hardcodes `getEnv()` to a
 *     static `{ MANAGER_PATH, INSPECTION_PATH }` object, both
 *     `https://wf.interclasscloud.com/` — there is no fallback or alternate
 *     endpoint anywhere in the source. That endpoint 404s (confirmed live).
 *     Nothing else in the extension names a working one.
 *   - **imtlazarus** — its filtering is local block/allow lists plus an
 *     on-device TensorFlow.js NSFW classifier, not a queryable cloud rating.
 *     The only network endpoint found (`/lazarus/api/chrome-screen/…`) is a
 *     screenshot/activity-report sink keyed to a real device's `tokenhash` —
 *     posting to it would inject fabricated monitoring data into a real
 *     school's dashboard, not read a public rating, so it isn't used.
 *   - **contentkeeper** — decompiled (Ghidra, `~/extensions/contentkeeper/
 *     newlib/Release/ckauth_x86_64.nexe`) rather than guessed at. Its message
 *     dispatcher (`FUN_00020400`) answers exactly three commands — `getip`,
 *     `encrypt`, `decrypt` — with no domain/category logic anywhere in the
 *     binary (497 strings recovered; none are a URL or hostname beyond PPAPI
 *     symbol names). Cross-checked against the modern replacement in the same
 *     extension (`ckenc.js`/`serviceWorker.js` — NaCl/PPAPI, which this `.nexe`
 *     needs, was removed from Chrome years ago, so this component is dead code
 *     kept alive by an unrelated JS/WASM successor doing the identical job):
 *     the whole thing is a LAN-only device-identity beacon. It pings
 *     `192.0.2.1`/`192.0.2.2` — RFC 5737 documentation addresses, meaningless
 *     as real routes, transparently intercepted only by an on-premises
 *     ContentKeeper appliance sitting on that LAN — encrypts `{email, device
 *     IP}` into the ping, and tags subsequent requests with the hash the
 *     appliance returns. The actual category filtering happens transparently
 *     at that on-prem appliance, examining real traffic; there is nothing this
 *     extension calls that rates a domain, on-network or off. (One district's
 *     ContentKeeper box happens to expose a public re-categorisation *submission*
 *     form — the endpoint a third-party checker uses — but calling that
 *     repeatedly for FreeDNS candidates would be filing real reclassification
 *     requests into a specific school's admin queue, not reading a rating, so
 *     it isn't used here either.)
 *   - Filters with no bare-domain category to look up at all (goguardian,
 *     hapara, mobileguardian, netsupport, impero, loilo): only decide inside a
 *     live class session or against a per-device MDM policy.
 *
 * Every adapter is failure-tolerant: a throw, a network error or a slow vendor
 * all collapse to UNKNOWN. Selection only ever *removes* a candidate, so the
 * safe default is "don't know → don't remove", and only a definite BLOCK drops
 * a domain.
 */

import { checkAristotleDomain } from "./aristotle/checker";
import { checkBlocksiUrl } from "./blocksi/checker";
import { createCiscoSecurityChecker } from "./cisco/security/checker";
import { createFortiGuardChecker } from "./fortiguard/checker";
import { createIbossFilterChecker } from "./iboss/checker";
import { checkLanSchoolNetsweeperDomain } from "./lanschool/netsweeperChecker";
import { checkLightspeedFilter } from "./lightspeed/checker";
import { createLinewizeFilterChecker } from "./linewize/checker";
import { checkStatus } from "./securly/broker";

export type DomainVerdict = "BLOCK" | "ALLOW" | "UNKNOWN";

export interface VendorDomainChecker {
    vendor: string;
    /** Never rejects: any failure resolves to UNKNOWN. */
    check(domain: string): Promise<DomainVerdict>;
}

/** A checker can hang on a wedged vendor host; cap it and call that UNKNOWN. */
const CHECK_TIMEOUT_MS = 12_000;

function withTimeout(work: Promise<DomainVerdict>): Promise<DomainVerdict> {
    return new Promise(resolve => {
        const timer = setTimeout(() => resolve("UNKNOWN"), CHECK_TIMEOUT_MS);
        work.then(
            v => {
                clearTimeout(timer);
                resolve(v);
            },
            () => {
                clearTimeout(timer);
                resolve("UNKNOWN");
            },
        );
    });
}

const toHost = (domain: string): string =>
    domain
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .trim();

const env = (name: string, fallback: string): string =>
    process.env[name] || fallback;

// fortiguard, cisco and iboss each provision/cache state on construction, so
// build one and share it across every domain — and lazily, so importing this
// module (as the offline tests do) touches no network.
let fortiChecker: ReturnType<typeof createFortiGuardChecker> | undefined;
let ciscoChecker: ReturnType<typeof createCiscoSecurityChecker> | undefined;
let ibossChecker: ReturnType<typeof createIbossFilterChecker> | undefined;

/**
 * Securly's real Chrome extension id, computed from the installed extension's
 * own `manifest.json` `key` (`~/extensions/securly/manifest.json`) via
 * `computeExtensionIdFromKey` (misc/filters/goguardian/generateAuthToken) —
 * the same derivation goguardian already needs, applied here to avoid trusting
 * a third party's copy of this id.
 */
const SECURLY_EXTENSION_ID = "iheobagjkfklnlikgihanlhcddjoihkg";

/** vendor → its domain-reputation lookup. */
const ACTIVE_CHECKERS: Record<
    string,
    (domain: string) => Promise<DomainVerdict>
> = {
    async blocksi(domain) {
        const r = await checkBlocksiUrl(domain);
        return r.isOk() ? (r.value.blocked ? "BLOCK" : "ALLOW") : "UNKNOWN";
    },
    async fortiguard(domain) {
        fortiChecker ??= createFortiGuardChecker();
        const r = await fortiChecker.checkUrl(domain);
        return r.isOk() ? (r.value.blocked ? "BLOCK" : "ALLOW") : "UNKNOWN";
    },
    async cisco(domain) {
        ciscoChecker ??= createCiscoSecurityChecker();
        const r = await ciscoChecker.checkUrl(domain);
        return r.isOk()
            ? r.value.verdict === "POLICY_BLOCK"
                ? "BLOCK"
                : "ALLOW"
            : "UNKNOWN";
    },
    async lightspeed(domain) {
        const r = await checkLightspeedFilter({ url: domain });
        return r.isOk() ? (r.value.blocked ? "BLOCK" : "ALLOW") : "UNKNOWN";
    },
    async iboss(domain) {
        const securityKey = process.env.IBOSS_SECURITY_KEY;
        if (!securityKey) return "UNKNOWN";
        ibossChecker ??= createIbossFilterChecker({
            gatewayHost: env(
                "CIVIL_REP_IBOSS_HOST",
                "cluster147478-swg.ibosscloud.com",
            ),
            securityKey,
            userEmail: env("CIVIL_REP_IBOSS_USER_EMAIL", "device@civil.local"),
        });
        const r = await ibossChecker.checkUrl(domain);
        return r.isOk() ? (r.value.blocked ? "BLOCK" : "ALLOW") : "UNKNOWN";
    },
    async securly(domain) {
        const r = await checkStatus({
            useremail: env(
                "CIVIL_REP_SECURLY_EMAIL",
                "probe@civil.invalid",
            ) as `${string}@${string}.${string}`,
            host: toHost(domain) as `${string}.${string}`,
            extensionId: SECURLY_EXTENSION_ID,
        });
        if (r.isErr()) return "UNKNOWN";
        if (r.value.decision === "DENY") return "BLOCK";
        if (r.value.decision === "ALLOW") return "ALLOW";
        return "UNKNOWN";
    },
    async linewize(domain) {
        const region = env("CIVIL_REP_LINEWIZE_REGION", "syd-1");
        const deviceId = env(
            "CIVIL_REP_LINEWIZE_DEVICEID",
            "otorohanga.college.nz",
        );
        const checker = createLinewizeFilterChecker({
            verdictServerUrl: `https://mvgateway.${region}.linewize.net`,
            identity: "null",
            deviceId,
        });
        const r = await checker.checkUrl({ url: `https://${toHost(domain)}` });
        return r.isOk() ? (r.value.blocked ? "BLOCK" : "ALLOW") : "UNKNOWN";
    },
    lanschool: checkLanSchoolNetsweeperDomain,
    aristotle: checkAristotleDomain,
};

/** The filters that can gate base-domain selection. */
export const APPLICABLE_VENDORS: string[] =
    Object.keys(ACTIVE_CHECKERS).toSorted();

/** One entry per reputation-capable filter. */
export const DOMAIN_CHECKERS: VendorDomainChecker[] = Object.entries(
    ACTIVE_CHECKERS,
).map(([vendor, check]) => ({
    vendor,
    check: (domain: string) => withTimeout(check(domain)),
}));

export interface Classification {
    domain: string;
    blocked: boolean;
    /** Vendors that returned BLOCK. */
    by: string[];
}

/**
 * Run a domain past every filter. `blocked` is true if any filter blocked it;
 * `by` names them. Checkers run in parallel — each already caps its own time,
 * and a rejecting checker is treated as UNKNOWN, never a block.
 */
export async function classifyDomain(
    domain: string,
    checkers: VendorDomainChecker[] = DOMAIN_CHECKERS,
): Promise<Classification> {
    const verdicts = await Promise.all(
        checkers.map(async c => {
            try {
                return { vendor: c.vendor, verdict: await c.check(domain) };
            } catch {
                return {
                    vendor: c.vendor,
                    verdict: "UNKNOWN" as DomainVerdict,
                };
            }
        }),
    );
    const by = verdicts.filter(v => v.verdict === "BLOCK").map(v => v.vendor);
    return { domain, blocked: by.length > 0, by };
}
