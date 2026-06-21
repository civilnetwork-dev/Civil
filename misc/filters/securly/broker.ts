import { XMLParser } from "fast-xml-parser";
import { err, ok, type Result, ResultAsync } from "neverthrow";
import xior from "xior";
import { type clusterStatuses, getCluster } from "./cluster";

export type Email = `${string}@${string}.${string}`;
export type Semver = `${number}.${number}.${number}`;
export type Hostname = `${string}.${string}`;

export type UserStatus = 1 | -1;
export type ClusterStatus =
    (typeof clusterStatuses)[keyof typeof clusterStatuses];

export interface BrokerRequestInput {
    useremail: Email;
    host: Hostname;
    extensionId: string;

    lat?: number;
    lng?: number;

    reason?: "crextn";
    msg?: string;
    url?: string;
}

export interface BrokerParams {
    useremail: Email;
    reason: "crextn";
    host: Hostname;
    url: string;
    msg: string;
    ver: Semver;
    cu: string;
    uf: UserStatus;
    cf: ClusterStatus;
    lat?: number;
    lng?: number;
}

interface SecurlyExtensionManifest {
    gupdate: {
        app: Array<{
            appid: string;
            updatecheck?: {
                version?: Semver;
            };
        }>;
    };
}

export type BrokerDecision =
    | "ALLOW"
    | "DENY"
    | "PAUSE"
    | "ERROR"
    | "FAILED_OPEN"
    | "UNKNOWN";

export interface BrokerResponse {
    kind?: "standard" | "failed_open";
    raw?: string;
    fields?: readonly string[];
    mode?: string;
    value?: string;

    decision?: Exclude<BrokerDecision, "FAILED_OPEN">;

    policyId?: string;
    categoryId?: string;
    keyword?: string;

    extra1?: string;
    extra2?: string;
    extra3?: string;

    checkIframes?: boolean;
    checkIframesRaw?: string;

    categoryFlags?: bigint;
    basegene?: bigint;

    hasCategoryBit36?: boolean;
    hasBasegeneBit0?: boolean;

    cacheable?: boolean;
}

export type BrokerError =
    | {
          type: "CLUSTER_ERROR";
          message: string;
          cause: unknown;
      }
    | {
          type: "MANIFEST_FETCH_ERROR";
          message: string;
          cause: unknown;
      }
    | {
          type: "MANIFEST_PARSE_ERROR";
          message: string;
          cause: unknown;
      }
    | {
          type: "EXTENSION_NOT_FOUND";
          message: string;
          extensionId: string;
      }
    | {
          type: "BROKER_FETCH_ERROR";
          message: string;
          cause: unknown;
      };

const UPDATE_MANIFEST_URL =
    "https://crextnaut.securly.com/subscribers/defaultfrommanifest@securly.com/update-manifest.xml";

const DEFAULT_BROKER_ERROR_RESPONSE = "ERROR:-1:-1:-1:-1:-1:-1";

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
});

function getField(
    fields: readonly string[],
    index: number,
    fallback = "-1",
): string {
    const value = fields[index];

    return value === undefined || value.length === 0 ? fallback : value;
}

function parseUnsignedBigInt(value: string): bigint | undefined {
    if (!/^\d+$/.test(value)) {
        return undefined;
    }

    try {
        return BigInt(value);
    } catch {
        return undefined;
    }
}

function hasBit(value: bigint | undefined, bit: number): boolean {
    return value !== undefined && (value & (1n << BigInt(bit))) !== 0n;
}

function toBrokerDecision(value: string): BrokerResponse["decision"] {
    switch (value) {
        case "ALLOW":
        case "DENY":
        case "PAUSE":
        case "ERROR":
            return value;

        default:
            return "UNKNOWN";
    }
}

function parseBrokerResponse(input: string | null | undefined): BrokerResponse {
    const raw = input?.trim() || DEFAULT_BROKER_ERROR_RESPONSE;

    const fields = raw.split(":");

    if (raw.startsWith("FAILED_OPEN:")) {
        return {
            kind: "failed_open",
            raw,
            fields,
            mode: getField(fields, 1, ""),
            value: getField(fields, 2, ""),
        };
    }

    const categoryId = getField(fields, 2);

    const categoryFlags = parseUnsignedBigInt(categoryId);

    const basegene = parseUnsignedBigInt(getField(fields, 8, ""));

    const decision = toBrokerDecision(getField(fields, 0, "UNKNOWN"));

    const hasCategoryBit36 = hasBit(categoryFlags, 36);

    const hasBasegeneBit0 = hasBit(basegene, 0);

    return {
        kind: "standard",
        raw,
        fields,

        decision,

        policyId: getField(fields, 1),
        categoryId,
        keyword: getField(fields, 3),

        extra1: getField(fields, 4),
        extra2: getField(fields, 5),
        extra3: getField(fields, 6),

        checkIframesRaw: getField(fields, 7, "0"),
        checkIframes: getField(fields, 7, "0") === "1",

        categoryFlags,
        basegene,

        hasCategoryBit36,
        hasBasegeneBit0,

        cacheable:
            decision !== "DENY" &&
            decision !== "PAUSE" &&
            !raw.includes("REFWL") &&
            (!raw.includes("WL_URL") || hasBasegeneBit0) &&
            !hasCategoryBit36,
    };
}

function getExtensionVersion(
    extensionId: string,
): ResultAsync<Semver, BrokerError> {
    return ResultAsync.fromPromise(
        xior.get<string>(UPDATE_MANIFEST_URL, {
            responseType: "text",
        }),
        (cause): BrokerError => ({
            type: "MANIFEST_FETCH_ERROR",
            message: "Failed to fetch update manifest.",
            cause,
        }),
    ).andThen((response): Result<Semver, BrokerError> => {
        try {
            const parsed = xmlParser.parse(
                response.data,
            ) as SecurlyExtensionManifest;

            const app = parsed.gupdate.app.find(
                extension => extension.appid === extensionId,
            );

            const version = app?.updatecheck?.version;

            if (!version) {
                return err({
                    type: "EXTENSION_NOT_FOUND",
                    message: `No extension version found for ${extensionId}`,
                    extensionId,
                } satisfies BrokerError);
            }

            return ok(version);
        } catch (cause) {
            return err({
                type: "MANIFEST_PARSE_ERROR",
                message: "Failed to parse update manifest.",
                cause,
            } satisfies BrokerError);
        }
    });
}

function buildBrokerParams(
    input: BrokerRequestInput,
    clusterUrl: string,
    extensionVersion: Semver,
): BrokerParams {
    return {
        useremail: input.useremail,
        reason: input.reason ?? "crextn",
        host: input.host,

        url: input.url ?? btoa(`https://${input.host}`),

        msg: input.msg ?? "",

        ver: extensionVersion,

        cu: clusterUrl,

        uf: 1,
        cf: 1,

        lat: input.lat,
        lng: input.lng,
    };
}

export function checkStatus(
    input: BrokerRequestInput,
): ResultAsync<BrokerResponse, BrokerError> {
    return getCluster(input.useremail)
        .mapErr(
            (cause): BrokerError => ({
                type: "CLUSTER_ERROR",
                message: "Failed to resolve cluster.",
                cause,
            }),
        )
        .andThen(clusterUrl =>
            getExtensionVersion(input.extensionId).andThen(extensionVersion => {
                const params = buildBrokerParams(
                    input,
                    clusterUrl,
                    extensionVersion,
                );

                return ResultAsync.fromPromise(
                    xior.get<string>(`${clusterUrl}/broker`, {
                        responseType: "text",
                        params,
                    }),
                    (cause): BrokerError => ({
                        type: "BROKER_FETCH_ERROR",
                        message: "Failed to fetch broker response.",
                        cause,
                    }),
                ).map(response => parseBrokerResponse(response.data));
            }),
        );
}
