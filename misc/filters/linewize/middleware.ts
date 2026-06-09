import type { Express } from "express";
import { isJsonEnabled } from "../utils/isJsonEnabled";
import { createAutoLinewizeFilterChecker as createLinewizeFilterChecker } from "./checker";

export function useLinewizeMiddleware(app: Express) {
    app.post("/filterCheck/linewize", async (req, res) => {
        if (!isJsonEnabled(app)) {
            const { json } = await import("express");

            app.use(json());
        }

        const { url, identity } = req.body as {
            url: string;
            identity: string;
        };

        const linewizeCheckerResult = await createLinewizeFilterChecker({
            identity,
        });

        if (linewizeCheckerResult.isErr()) {
            res.sendStatus(500).send(
                `Internal Server Error - ${linewizeCheckerResult.error.type}: ${linewizeCheckerResult.error.message}`,
            );
        } else {
            const checkResult = await linewizeCheckerResult.value.checkUrl({
                url,
            });

            if (checkResult.isOk()) {
                res.json({
                    blocked: checkResult.value.verdict === "BLOCK",
                    verdictIsKnown: checkResult.value.verdict !== "UNKNOWN",
                    categories: checkResult.value.categories,
                    raw: checkResult.value.raw,
                });
            }
        }
    });
}
