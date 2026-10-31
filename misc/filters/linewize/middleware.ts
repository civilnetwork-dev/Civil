import type { Context, Hono } from "hono";

import { type AppEnv, readJsonBody } from "../../http";
import {
    respondFilterError,
    respondFilterResult,
} from "../utils/respondFilterError";
import { createAutoLinewizeFilterChecker as createLinewizeFilterChecker } from "./checker";

async function checkLinewize(c: Context<AppEnv>) {
    const { url, identity } = (await readJsonBody(c)) as {
        url: string;
        identity: string;
    };

    const linewizeCheckerResult = await createLinewizeFilterChecker({
        identity,
    });

    if (linewizeCheckerResult.isErr()) {
        return respondFilterError(
            c,
            "linewize",
            url,
            linewizeCheckerResult.error,
            { phase: "checker_init" },
        );
    }

    const checkResult = await linewizeCheckerResult.value.checkUrl({ url });
    return respondFilterResult(c, "linewize", url, checkResult, {
        phase: "url_check",
    });
}

export function useLinewizeMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/linewize", checkLinewize);
}
