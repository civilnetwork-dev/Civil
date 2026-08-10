import { createCache } from "@stacksjs/ts-cache";
import { err, errAsync, ok, ResultAsync } from "neverthrow";
import UserAgent from "user-agents";
import xior from "xior";
import type { Email } from "./broker";

export const clusterStatuses = {
    ERROR: -2,
    NOTFOUND: -1,
    FOUND: 1,
    AVOID_OS: 2,
    UNKNOWN_SCHOOL: 3,
} as const;

/**
 * Regional Securly filtering clusters, ordered by observed prevalence in
 * captured `/broker` + `/loginsso*` traffic. `useast2-www` is the dominant US
 * cluster; the rest cover other US/EU/UK/CA/APSE regions. Used to normalize the
 * `/crextn/cluster` response into a usable base URL and as a fallback when the
 * response doesn't yield one.
 */
export const SECURLY_FILTER_CLUSTERS = [
    "useast2-www.securly.com",
    "useast-www.securly.com",
    "uswest-master-www.securly.com",
    "useast-master-www.securly.com",
    "ca-www.securly.com",
    "uk-www.securly.com",
    "euwest-www.securly.com",
    "apse-www.securly.com",
] as const;

// The cluster URL returned by `/crextn/cluster` already includes the `/crextn`
// path segment; the broker is then reached at `${clusterUrl}/broker`
// (confirmed in the extension's user_cluster.js + broker.js).
const DEFAULT_CLUSTER_URL = `https://${SECURLY_FILTER_CLUSTERS[0]}/crextn`;

/**
 * Coerce the raw `/crextn/cluster` response into a usable cluster base URL,
 * matching the extension's `fetchClusterUrl` handling:
 *  - the response may carry a trailing `_disableIWF` / `_updateIWF` marker,
 *  - or be the literal status `UNKNOWN_SCHOOL` / `AVOID_OS` / `unknown`,
 *  - otherwise it is a `https://<host>.securly.com/crextn` base URL.
 * The `/crextn` path is preserved; only the origin is normalized to https.
 * Falls back to the dominant regional cluster when nothing usable is present.
 */
export function normalizeClusterUrl(raw: string): string {
    let text = (raw ?? "").trim();

    for (const marker of ["_disableIWF", "_updateIWF"]) {
        const idx = text.lastIndexOf(marker);
        if (idx !== -1) text = text.slice(0, idx).trim();
    }

    if (
        !text ||
        text === "unknown" ||
        text === "UNKNOWN_SCHOOL" ||
        text.startsWith("AVOID_OS")
    ) {
        return DEFAULT_CLUSTER_URL;
    }

    try {
        const url = new URL(text.startsWith("http") ? text : `https://${text}`);
        if (!url.hostname.endsWith(".securly.com")) return DEFAULT_CLUSTER_URL;
        url.protocol = "https:";
        return url.toString().replace(/\/$/, "");
    } catch {
        return DEFAULT_CLUSTER_URL;
    }
}

type ClusterStatus = keyof typeof clusterStatuses;

type ClusterError =
    | { type: "INVALID_EMAIL"; message: string }
    | { type: "CACHE_ERROR"; message: string; cause: unknown }
    | { type: "REQUEST_ERROR"; message: string; cause: unknown };

const clusterCache = createCache();

function isClusterStatus(value: unknown): value is ClusterStatus {
    return typeof value === "string" && value in clusterStatuses;
}

function getDomain(email: Email) {
    const domain = email.split("@").at(-1);

    return domain
        ? ok(domain)
        : err({
              type: "INVALID_EMAIL" as const,
              message: "Invalid email: missing domain",
          });
}

export function getCluster(email: Email): ResultAsync<string, ClusterError> {
    const domainResult = getDomain(email);

    if (domainResult.isErr()) {
        return errAsync(domainResult.error);
    }

    const domain = domainResult.value;

    return ResultAsync.fromPromise(
        clusterCache.get<string>("cluster_response"),
        (cause): ClusterError => ({
            type: "CACHE_ERROR",
            message: "Failed to read cluster cache",
            cause,
        }),
    )
        .andThen(cachedReasonCode => {
            const reasonCode = isClusterStatus(cachedReasonCode)
                ? clusterStatuses[cachedReasonCode]
                : "";

            return ResultAsync.fromPromise(
                xior.get<string>("https://www.securly.com/crextn/cluster", {
                    params: {
                        domain,
                        reasonCode,
                    },
                    headers: {
                        "User-Agent": new UserAgent(/CrOS/).toString(),
                    },
                }),
                (cause): ClusterError => ({
                    type: "REQUEST_ERROR",
                    message: "Failed to fetch cluster response",
                    cause,
                }),
            );
        })
        .andThen(response => {
            const clusterResponse =
                typeof response.data === "string"
                    ? response.data
                    : String(response.data);

            return ResultAsync.fromPromise(
                clusterCache.set("cluster_response", clusterResponse),
                (cause): ClusterError => ({
                    type: "CACHE_ERROR",
                    message: "Failed to write cluster cache",
                    cause,
                }),
            ).map(() => normalizeClusterUrl(clusterResponse));
        });
}
