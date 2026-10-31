import type { Hono } from "hono";

import { type AppEnv, readJsonBody } from "../../http";
import { respondFilterResult } from "../utils/respondFilterError";
import { createFortiGuardChecker } from "./checker";

export function useFortiGuardMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/fortiguard", async c => {
        const { url } = (await readJsonBody(c)) as { url: string };
        const result = await createFortiGuardChecker().checkUrl(url);
        return respondFilterResult(c, "fortiguard", url, result);
    });
}
