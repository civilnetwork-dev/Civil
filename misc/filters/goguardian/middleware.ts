import type { Express } from "express";
import { isJsonEnabled } from "../utils/isJsonEnabled";
import { checkGoGuardianFilterAuthenticated } from "./checker";
import { getGoGuardianVersion } from "./getVersion";

export function useGoGuardianMiddleware(app: Express) {
    app.post("/filterCheck/goguardian", async (req, res) => {
        if (!isJsonEnabled(app)) {
            const { json } = await import("express");

            app.use(json());
        }

        const { authToken, url } = req.body as {
            authToken: string;
            url: string;
        };

        const extensionVersion = await getGoGuardianVersion();

        const result = await checkGoGuardianFilterAuthenticated(
            { url },
            { authToken, extensionVersion },
        );

        if (result.isErr()) {
            res.status(500).send(
                `${result.error.type}: ${result.error.message}`,
            );
        } else {
            res.json({
                blocked: result.value.verdict !== "BLOCK",
                statusIsKnown: result.value.verdict !== "UNKNOWN",
                proxyModelVersion: result.value.proxyModelVersion,
                matchedKeywords: [
                    ...result.value.matchedProxyKeywords,
                    ...result.value.matchedThreatKeywords,
                ],
                versionsUsed: {
                    threats: result.value.threatsModelVersion,
                    proxies: result.value.proxyModelVersion,
                },
            });
        }
    });
}
