import type { Hono } from "hono";

import { type AppEnv, clientIp, readJsonBody } from "../../http";
import { posthog } from "../posthog";
import { checkGoGuardianFilterAuthenticated } from "./checker";
import { computeExtensionIdFromKey } from "./generateAuthToken";
import { getGoGuardianVersion } from "./getVersion";

export function useGoGuardianMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/goguardian", async c => {
        const { authToken, orgRands, manifestKey, url } = (await readJsonBody(
            c,
        )) as {
            authToken?: string;
            orgRands?: string[];
            manifestKey?: string;
            url: string;
        };

        const resolvedOrgRands = manifestKey
            ? [computeExtensionIdFromKey(manifestKey)]
            : (orgRands ?? []);

        const authOptions = authToken
            ? { authToken }
            : { orgRands: resolvedOrgRands };

        const extensionVersion = await getGoGuardianVersion();

        const result = await checkGoGuardianFilterAuthenticated(
            { url },
            { ...authOptions, extensionVersion },
        );

        if (result.isErr()) {
            posthog.capture({
                distinctId: clientIp(c) ?? "unknown",
                event: "filter_error",
                properties: {
                    filter: "goguardian",
                    url,
                    errorType: result.error.type,
                    errorMessage: result.error.message,
                },
            });
            return c.text(`${result.error.type}: ${result.error.message}`, 500);
        } else {
            const matchedKeywords = [
                ...result.value.matchedProxyKeywords,
                ...result.value.matchedThreatKeywords,
            ];
            posthog.capture({
                distinctId: clientIp(c) ?? "unknown",
                event: "filter_check",
                properties: {
                    filter: "goguardian",
                    url,
                    blocked: result.value.verdict !== "BLOCK",
                    statusIsKnown: result.value.verdict !== "UNKNOWN",
                    matchedKeywords,
                    proxyModelVersion: result.value.proxyModelVersion,
                    threatsModelVersion: result.value.threatsModelVersion,
                },
            });
            return c.json({
                blocked: result.value.verdict !== "BLOCK",
                statusIsKnown: result.value.verdict !== "UNKNOWN",
                proxyModelVersion: result.value.proxyModelVersion,
                matchedKeywords,
                versionsUsed: {
                    threats: result.value.threatsModelVersion,
                    proxies: result.value.proxyModelVersion,
                },
            });
        }
    });
}
