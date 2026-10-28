import type { Context, Hono } from "hono";

import { getLatestIbossGateway } from "../../database/models/ibossGateway";
import { type AppEnv, readJsonBody } from "../../http";
import { captureFilterCheck, captureFilterError } from "../utils/captureFilter";
import { createIbossFilterChecker, type IbossCheckerOptions } from "./checker";

/**
 * District mode: resolves the stored gateway + key by LEA id. Answers with a
 * Response when the district cannot be checked, or the options to check with.
 */
async function withDistrictGateway(
    c: Context<AppEnv>,
    leaId: string,
    options: IbossCheckerOptions,
): Promise<IbossCheckerOptions | Response> {
    const row = await getLatestIbossGateway(leaId);
    if (!row) {
        return c.json(
            {
                statusIsKnown: false,
                error: "No iboss gateway for this district",
            },
            404,
        );
    }

    // Host known, but categorization needs the account key, which
    // auto-detection can't obtain. Surface as "unknown", not an error.
    if (!row.securityKey) {
        return c.json({
            statusIsKnown: false,
            needsSecurityKey: true,
            gatewayHost: row.gatewayHost,
        });
    }

    return {
        ...options,
        gatewayHost: row.gatewayHost,
        categorizationPort: row.categorizationPort,
        securityKey: row.securityKey,
    };
}

async function checkIboss(
    c: Context<AppEnv>,
    url: string,
    options: IbossCheckerOptions,
) {
    if (!options.gatewayHost || !options.securityKey || !options.userEmail) {
        return c.json(
            {
                error: "Missing iboss credentials: provide leaId (with a stored gateway) or gatewayHost + securityKey + userEmail.",
            },
            400,
        );
    }

    const ibossCheckResult =
        await createIbossFilterChecker(options).checkUrl(url);

    if (ibossCheckResult.isErr()) {
        captureFilterError(c, "iboss", url, ibossCheckResult.error);
        return c.json(
            {
                statusIsKnown: false,
                error: ibossCheckResult.error.message,
            },
            502,
        );
    }
    captureFilterCheck(c, "iboss", url, { result: ibossCheckResult.value });
    return c.json({ statusIsKnown: true, ...ibossCheckResult.value });
}

/**
 * Registers `POST /filterCheck/iboss`.
 *
 * Two modes:
 * - District mode: body has `leaId` (+ `url`, `userEmail`). The gateway host and
 *   account security key are loaded from the DB; the key never leaves the server.
 * - Direct mode: body carries `gatewayHost` + `securityKey` (+ `userEmail`), or
 *   they come from `defaults`.
 */
export function useIbossMiddleware(
    app: Hono<AppEnv>,
    defaults?: Partial<IbossCheckerOptions>,
) {
    app.post("/filterCheck/iboss", async c => {
        const body = (await readJsonBody(c)) as Partial<IbossCheckerOptions> & {
            url?: string;
            leaId?: string;
        };

        const { url, leaId, ...bodyOptions } = body;

        if (!url) {
            return c.json({ error: "url required" }, 400);
        }

        let options = {
            ...defaults,
            ...bodyOptions,
        } as IbossCheckerOptions;

        if (leaId && !options.gatewayHost) {
            const resolved = await withDistrictGateway(c, leaId, options);
            if (resolved instanceof Response) return resolved;
            options = resolved;
        }

        return checkIboss(c, url, options);
    });
}
