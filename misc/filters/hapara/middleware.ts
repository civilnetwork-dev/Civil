import type { Express } from "express";

import { posthog } from "../posthog";
import { isJsonEnabled } from "../utils/isJsonEnabled";
import {
    checkHaparaFilter,
    type HaparaCheckerOptions,
    type HaparaStudentInput,
} from "./checker";

export function useHaparaMiddleware(app: Express) {
    app.post("/filterCheck/hapara", async (req, res) => {
        if (!isJsonEnabled(app)) {
            const { json } = await import("express");

            app.use(json());
        }

        const { url, userId, classIds, email, apiBaseUrl, timeoutMs } =
            req.body as {
                url: string;
                userId?: string;
                classIds?: string[];
                email?: string;
                apiBaseUrl?: string;
                timeoutMs?: number;
            };

        if (!url) {
            res.status(400).json({ error: "url is required." });
            return;
        }

        if (!userId && !email) {
            res.status(400).json({
                error: "Either userId (with optional classIds) or email is required.",
            });
            return;
        }

        const student: HaparaStudentInput =
            userId !== undefined
                ? { kind: "by-id", userId, classIds: classIds ?? [] }
                : { kind: "by-email", email: email! };

        const checkerOptions: HaparaCheckerOptions = {
            ...(apiBaseUrl !== undefined && { apiBaseUrl }),
            ...(timeoutMs !== undefined && { timeoutMs }),
        };

        const result = await checkHaparaFilter(
            { url, student },
            checkerOptions,
        );

        if (result.isErr()) {
            posthog.capture({
                distinctId: req.ip ?? "unknown",
                event: "filter_error",
                properties: {
                    filter: "hapara",
                    url,
                    errorType: result.error.type,
                    errorMessage: result.error.message,
                },
            });

            const statusCode =
                result.error.type === "INVALID_URL"
                    ? 400
                    : result.error.type === "NETWORK"
                      ? 502
                      : 500;

            res.status(statusCode).send(
                `${result.error.type}: ${result.error.message}`,
            );
            return;
        }

        const {
            verdict,
            sessionType,
            blockedDomains,
            allowedDomains,
            allowedLinks,
            matchedDomain,
            teacherName,
            sessionStart,
            sessionEnd,
            monitored,
            invalidCode,
            whitelisted,
            stateSource,
        } = result.value;

        const blocked = verdict === "BLOCKED" || verdict === "LOCKED";

        posthog.capture({
            distinctId: req.ip ?? "unknown",
            event: "filter_check",
            properties: {
                filter: "hapara",
                url,
                verdict,
                sessionType,
                blocked,
                statusIsKnown: verdict !== "NO_SESSION",
                matchedDomain,
                teacherName,
                monitored,
                stateSource,
            },
        });

        res.json({
            verdict,
            blocked,
            statusIsKnown: verdict !== "NO_SESSION",
            sessionType,
            teacherName,
            sessionStart,
            sessionEnd,
            matchedDomain,
            blockedDomains,
            allowedDomains,
            allowedLinks,
            monitored,
            invalidCode,
            whitelisted,
            stateSource,
        });
    });
}
