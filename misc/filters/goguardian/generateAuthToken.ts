import { createHash } from "node:crypto";
import { err, ok, ResultAsync } from "neverthrow";
import xior, { type XiorError } from "xior";
import { z } from "zod";

export function computeExtensionIdFromKey(manifestKey: string): string {
    const keyBytes = Buffer.from(manifestKey, "base64");
    const digest = createHash("sha256")
        .update(keyBytes)
        .digest("hex")
        .slice(0, 32);
    return Array.from(digest, c =>
        String.fromCharCode(97 + parseInt(c, 16)),
    ).join("");
}

export type GenerateAuthTokenError =
    | { type: "NETWORK"; message: string; status?: number; body?: unknown }
    | { type: "PARSE"; message: string; body?: unknown };

const RegisterResponseSchema = z.object({
    compRandUuid: z.string(),
    orgID: z.number().optional(),
    subAccountId: z.union([z.string(), z.number()]).optional(),
    orgName: z.string().optional(),
});

export function generateGoGuardianAuthToken(options: {
    orgRands: string[];
    extensionVersion: string;
    timeoutMs?: number;
}): ResultAsync<string, GenerateAuthTokenError> {
    const client = xior.create({
        baseURL: "https://extapi.goguardian.com",
        timeout: options.timeoutMs ?? 10_000,
        headers: {
            "Content-Type": "application/json",
            extensionversion: options.extensionVersion,
        },
    });

    return ResultAsync.fromPromise(
        client.post<unknown>("/api/v1/ext/register", {
            orgRands: options.orgRands,
        }),
        error => {
            const e = error as XiorError<unknown>;
            return {
                type: "NETWORK" as const,
                message: e.message,
                status: e.response?.status,
                body: e.response?.data,
            };
        },
    ).andThen(res => {
        const parsed = RegisterResponseSchema.safeParse(res.data);

        return parsed.success
            ? ok(parsed.data.compRandUuid)
            : err({
                  type: "PARSE" as const,
                  message: "Invalid register response.",
                  body: res.data,
              });
    });
}
