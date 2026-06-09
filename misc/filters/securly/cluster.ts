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
            ).map(() => clusterResponse);
        });
}
