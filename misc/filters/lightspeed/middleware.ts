import type { Hono } from "hono";

import { type AppEnv, readJsonBody } from "../../http";
import { respondFilterResult } from "../utils/respondFilterError";
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

        return respondFilterResult(c, "lightspeed", url, result);
    });
}
