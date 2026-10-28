import type { Hono } from "hono";

import { type AppEnv, readJsonBody } from "../../http";
import { captureFilterCheck } from "../utils/captureFilter";
import { respondFilterError } from "../utils/respondFilterError";
import {
    checkLightspeedFilter,
    type LightspeedCheckerOptions,
} from "./checker";

export function useLightspeedMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/lightspeed", async c => {
        const { url, blockedCategories, apiBaseUrl, timeoutMs } =
            (await readJsonBody(c)) as {
                url?: string;
                blockedCategories?: string[];
                apiBaseUrl?: string;
                timeoutMs?: number;
            };

        if (!url) {
            return c.json({ error: "url is required." }, 400);
        }

        const options: LightspeedCheckerOptions = {
            ...(apiBaseUrl !== undefined && { apiBaseUrl }),
            ...(timeoutMs !== undefined && { timeoutMs }),
        };

        const result = await checkLightspeedFilter(
            {
                url,
                ...(Array.isArray(blockedCategories) && { blockedCategories }),
            },
            options,
        );

        if (result.isErr()) {
            return respondFilterError(c, "lightspeed", url, result.error);
        }

        const {
            verdict,
            blocked,
            categories,
            matchedCategory,
            reason,
            hostname,
        } = result.value;

        captureFilterCheck(c, "lightspeed", url, {
            verdict,
            blocked,
            statusIsKnown: verdict !== "UNKNOWN",
            matchedCategory,
            categories,
        });

        return c.json({
            verdict,
            blocked,
            statusIsKnown: verdict !== "UNKNOWN",
            categories,
            matchedCategory,
            reason,
            hostname,
        });
    });
}
