import type { Express } from "express";
import { posthog } from "../posthog";
import { isJsonEnabled } from "../utils/isJsonEnabled";
import { checkGoGuardianFilterAuthenticated } from "./checker";
import { computeExtensionIdFromKey } from "./generateAuthToken";
import { getGoGuardianVersion } from "./getVersion";

export function useGoGuardianMiddleware(app: Express) {
    app.post("/filterCheck/goguardian", async (req, res) => {
        if (!isJsonEnabled(app)) {
            const { json } = await import("express");

            app.use(json());
        }

        const { authToken, orgRands, manifestKey, url } = req.body as {
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
                distinctId: req.ip ?? "unknown",
                event: "filter_error",
                properties: {
                    filter: "goguardian",
                    url,
                    errorType: result.error.type,
                    errorMessage: result.error.message,
                },
            });
            res.status(500).send(
                `${result.error.type}: ${result.error.message}`,
            );
        } else {
            const matchedKeywords = [
                ...result.value.matchedProxyKeywords,
                ...result.value.matchedThreatKeywords,
            ];
            posthog.capture({
                distinctId: req.ip ?? "unknown",
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
            res.json({
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
