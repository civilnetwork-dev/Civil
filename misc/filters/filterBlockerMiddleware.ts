import type { Express, RequestHandler } from "express";
import { posthog } from "./posthog";

type Domain = `${string}.${string}`;

const domainsToBlock: readonly Domain[] = [
    "securly.com",
    "securly.io",
    "goguardian.com",
    "lenovosoftware.com",
    "linewize.net",
    "blocksi.net",
    "lightspeedsystems.com",
    "fortinet.net",
    "fortiguard.net",
];

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
