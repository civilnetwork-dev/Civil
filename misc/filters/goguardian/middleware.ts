import type { Context, Hono } from "hono";

import { type AppEnv, readJsonBody } from "../../http";
import { captureFilterCheck, captureFilterError } from "../utils/captureFilter";
import { checkGoGuardianFilterAuthenticated } from "./checker";
import { computeExtensionIdFromKey } from "./generateAuthToken";
import { getGoGuardianVersion } from "./getVersion";

type GoGuardianRequest = {
    authToken?: string;
    orgRands?: string[];
    manifestKey?: string;
    url: string;
};

function authOptionsFor({
    authToken,
    orgRands,
    manifestKey,
}: GoGuardianRequest) {
    const resolvedOrgRands = manifestKey
        ? [computeExtensionIdFromKey(manifestKey)]
        : (orgRands ?? []);
    return authToken ? { authToken } : { orgRands: resolvedOrgRands };
}

async function checkGoGuardian(c: Context<AppEnv>) {
    const body = (await readJsonBody(c)) as GoGuardianRequest;
    const { url } = body;
    const authOptions = authOptionsFor(body);
    const extensionVersion = await getGoGuardianVersion();

    const result = await checkGoGuardianFilterAuthenticated(
        { url },
        { ...authOptions, extensionVersion },
    );

    if (result.isErr()) {
        captureFilterError(c, "goguardian", url, result.error);
        return c.text(`${result.error.type}: ${result.error.message}`, 500);
    }

    const value = result.value;
    const matchedKeywords = [
        ...value.matchedProxyKeywords,
        ...value.matchedThreatKeywords,
    ];
    captureFilterCheck(c, "goguardian", url, {
        blocked: value.verdict !== "BLOCK",
        statusIsKnown: value.verdict !== "UNKNOWN",
        matchedKeywords,
        proxyModelVersion: value.proxyModelVersion,
        threatsModelVersion: value.threatsModelVersion,
    });
    return c.json({
        blocked: value.verdict !== "BLOCK",
        statusIsKnown: value.verdict !== "UNKNOWN",
        proxyModelVersion: value.proxyModelVersion,
        matchedKeywords,
        versionsUsed: {
            threats: value.threatsModelVersion,
            proxies: value.proxyModelVersion,
        },
    });
}

export function useGoGuardianMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/goguardian", checkGoGuardian);
}
