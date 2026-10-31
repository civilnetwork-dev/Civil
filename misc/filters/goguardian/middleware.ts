import type { Context, Hono } from "hono";

import { type AppEnv, readJsonBody } from "../../http";
import { respondFilterResult } from "../utils/respondFilterError";
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

    return respondFilterResult(c, "goguardian", url, result);
}

export function useGoGuardianMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/goguardian", checkGoGuardian);
}
