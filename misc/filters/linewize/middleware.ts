import type { Context, Hono } from "hono";

import { type AppEnv, readJsonBody } from "../../http";
import { captureFilterCheck } from "../utils/captureFilter";
import { respondFilterError } from "../utils/respondFilterError";
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

    if (checkResult.isErr()) {
        return respondFilterError(c, "linewize", url, checkResult.error, {
            phase: "url_check",
        });
    }

    const { verdict, categories, raw } = checkResult.value;
    const verdictIsKnown = verdict !== "UNKNOWN";
    captureFilterCheck(c, "linewize", url, {
        blocked: verdict === "BLOCK",
        verdictIsKnown,
        categories,
    });
    return c.json({
        blocked: verdict === "BLOCK",
        verdictIsKnown,
        categories,
        raw,
    });
}

export function useLinewizeMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/linewize", checkLinewize);
}
