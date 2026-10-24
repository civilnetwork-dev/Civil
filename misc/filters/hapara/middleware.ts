import type { Hono } from "hono";

import { type AppEnv, clientIp, readJsonBody } from "../../http";
import { posthog } from "../posthog";
import { respondFilterError } from "../utils/respondFilterError";
import {
    checkHaparaFilter,
    type HaparaCheckerOptions,
    type HaparaStudentInput,
} from "./checker";

export function useHaparaMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/hapara", async c => {
        const { url, userId, classIds, email, apiBaseUrl, timeoutMs } =
            (await readJsonBody(c)) as {
                url: string;
                userId?: string;
                classIds?: string[];
                email?: string;
                apiBaseUrl?: string;
                timeoutMs?: number;
            };

        if (!url) {
            return c.json({ error: "url is required." }, 400);
        }

        if (!userId && !email) {
            return c.json(
                {
                    error: "Either userId (with optional classIds) or email is required.",
                },
                400,
            );
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
            return respondFilterError(c, "hapara", url, result.error);
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
            distinctId: clientIp(c) ?? "unknown",
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

        return c.json({
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
