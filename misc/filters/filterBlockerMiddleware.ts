import type { Express, RequestHandler } from "express";
import { posthog } from "./posthog";

type Domain = `${string}.${string}`;

/**
 * The registrable domains each tracked filter vendor phones home to —
 * telemetry, policy fetch, classification, licensing. Blocking them at the
 * proxy is what keeps a filter extension from reporting the session or
 * pulling down a fresh block-list mid-flight.
 *
 * Grouped by *vendor*, not by extension id: several vendors ship two or three
 * extensions (Cisco's Security/Umbrella, Lightspeed's Filter/Insight,
 * Securly's core/Classroom) that share the same backend, and the filter route
 * test suite reads this same map keyed by vendor — see
 * `misc/filterProbe/probe.ts`, which reuses it as one half of "did a filter
 * flag us". Keeping one source of truth is why it's exported.
 *
 * Every domain here was read out of the vendor's own shipped bundle under
 * `~/extensions` (host permissions, hardcoded config, telemetry endpoints),
 * except ContentKeeper — its authenticator is a NaCl `.nexe` that configures
 * its endpoint per district and carries no hardcoded host, so its public
 * corporate domain stands in. Shared infrastructure a vendor merely rents
 * (S3, Azure Websites, Twilio, appspot) is deliberately left out: blocking it
 * would break unrelated sites without stopping the filter, which fails over
 * to its own domains anyway. Matching is by suffix (see
 * `hostnameMatchesBlockedDomain`), so the registrable domain covers every
 * subdomain under it.
 */
export const filterVendorDomains = {
    aristotle: ["aristotleinsight.com"],
    blocksi: ["blocksi.net", "appcontext.app"],
    cisco: [
        "opendns.com",
        "opendnstest.com",
        "checkumbrella.com",
        "internetbadguys.com",
    ],
    contentkeeper: ["contentkeeper.com"],
    fortiguard: ["fortinet.net", "fortiguard.net"],
    goguardian: ["goguardian.com"],
    hapara: ["hapara.com"],
    iboss: [
        "ibosscloud.com",
        "ibossgov.com",
        "myiboss.net",
        "ibosstest.com",
        "iboss.com",
    ],
    impero: ["imperosoftware.com"],
    imtlazarus: ["imtlazarus.com"],
    interclass: ["interclasscloud.com"],
    lanschool: ["lenovosoftware.com", "lanschool.com", "stone-ware.com"],
    lightspeed: [
        "lightspeedsystems.com",
        "lsfilter.com",
        "catchon.com",
        "lsclassroom.com",
        "lsrelayaccess.com",
        "lsaccess.me",
        "lsurl.me",
    ],
    linewize: ["linewize.net", "linewize.com", "familyzone.com"],
    loilo: ["loilonote.app", "loilo.tv"],
    mobileguardian: ["mobileguardian.com"],
    netsupport: ["classroom.cloud", "netsupportsoftware.com"],
    securly: ["securly.com", "securly.io"],
} as const satisfies Record<string, readonly Domain[]>;

/** Every vendor domain, flattened — the middleware's default blocklist. */
const domainsToBlock: readonly Domain[] =
    Object.values(filterVendorDomains).flat();

function normalizeHostname(hostname: string): string {
    return hostname
        .toLowerCase()
        .trim()
        .replace(/\.$/, "")
        .replace(/:\d+$/, "");
}

function hostnameMatchesBlockedDomain(
    hostname: string,
    blockedDomain: Domain,
): boolean {
    const normalizedHostname = normalizeHostname(hostname);
    const normalizedBlockedDomain = normalizeHostname(blockedDomain);

    return (
        normalizedHostname === normalizedBlockedDomain ||
        normalizedHostname.endsWith(`.${normalizedBlockedDomain}`)
    );
}

function isBlockedHostname(
    hostname: string,
    blockedDomains: readonly Domain[],
): boolean {
    return blockedDomains.some(domain =>
        hostnameMatchesBlockedDomain(hostname, domain),
    );
}

export function createFilterBlockerMiddleware(options?: {
    domains?: readonly Domain[];
    trustProxyHostHeader?: boolean;
}): RequestHandler {
    const domains = options?.domains ?? domainsToBlock;

    return (req, res, next) => {
        const rawHost =
            options?.trustProxyHostHeader === true
                ? req.headers["x-forwarded-host"]?.toString()
                : req.headers.host;

        if (!rawHost) {
            next();
            return;
        }

        const hostname = normalizeHostname(rawHost);

        if (isBlockedHostname(hostname, domains)) {
            posthog.capture({
                distinctId: req.ip ?? "unknown",
                event: "filter_hostname_blocked",
                properties: { hostname },
            });
            res.status(403).json({
                blocked: true,
                reason: "Requested hostname matches a blocked domain.",
                hostname,
            });
            return;
        }

        next();
    };
}

export function useFilterBlockerMiddleware(app: Express): void {
    app.use(createFilterBlockerMiddleware());
}
