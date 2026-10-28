import type { Context, Hono } from "hono";

import { type AppEnv, readJsonBody } from "../../http";
import { captureFilterCheck, captureFilterError } from "../utils/captureFilter";
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
        const { error } = linewizeCheckerResult;
        captureFilterError(c, "linewize", url, error, {
            phase: "checker_init",
        });
        return c.text(
            `Internal Server Error - ${error.type}: ${error.message}`,
            500,
        );
    }

    const checkResult = await linewizeCheckerResult.value.checkUrl({ url });

    if (checkResult.isErr()) {
        const { error } = checkResult;
        captureFilterError(c, "linewize", url, error, { phase: "url_check" });
        return c.text(
            `Internal server error: ${error.type} - ${error.message}`,
            500,
        );
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
