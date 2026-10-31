import type { Hono } from "hono";

import { type AppEnv, readJsonBody } from "../../http";
import { respondFilterResult } from "../utils/respondFilterError";
import { createBlocksiFilterChecker } from "./checker";

export function useBlocksiMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/blocksi", async c => {
        const { url } = (await readJsonBody(c)) as { url: string };
        const result = await createBlocksiFilterChecker().checkUrl(url);
        return respondFilterResult(c, "blocksi", url, result);
    });
}
