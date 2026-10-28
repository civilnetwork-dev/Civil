import type { Context, Hono } from "hono";

import { type AppEnv, readJsonBody } from "../../http";
import { captureFilterCheck } from "../utils/captureFilter";
import { respondFilterError } from "../utils/respondFilterError";
import {
    checkHaparaFilter,
    type HaparaCheckerOptions,
    type HaparaCheckResult,
    type HaparaStudentInput,
} from "./checker";

type HaparaRequest = {
    url: string;
    userId?: string;
    classIds?: string[];
    email?: string;
    apiBaseUrl?: string;
    timeoutMs?: number;
};

function studentFor({
    userId,
    classIds,
    email,
}: HaparaRequest): HaparaStudentInput {
    return userId !== undefined
        ? { kind: "by-id", userId, classIds: classIds ?? [] }
        : { kind: "by-email", email: email! };
}

async function checkHapara(c: Context<AppEnv>) {
    const body = (await readJsonBody(c)) as HaparaRequest;
    const { url, userId, email, apiBaseUrl, timeoutMs } = body;

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

    const checkerOptions: HaparaCheckerOptions = {
        ...(apiBaseUrl !== undefined && { apiBaseUrl }),
        ...(timeoutMs !== undefined && { timeoutMs }),
    };

    const result = await checkHaparaFilter(
        { url, student: studentFor(body) },
        checkerOptions,
    );

    if (result.isErr()) {
        return respondFilterError(c, "hapara", url, result.error);
    }
    return respondHaparaVerdict(c, url, result.value);
}

function respondHaparaVerdict(
    c: Context<AppEnv>,
    url: string,
    value: HaparaCheckResult,
) {
    const { verdict, sessionType, matchedDomain, teacherName } = value;
    const { monitored, stateSource } = value;
    const blocked = verdict === "BLOCKED" || verdict === "LOCKED";
    const statusIsKnown = verdict !== "NO_SESSION";

    captureFilterCheck(c, "hapara", url, {
        verdict,
        sessionType,
        blocked,
        statusIsKnown,
        matchedDomain,
        teacherName,
        monitored,
        stateSource,
    });

    return c.json({
        verdict,
        blocked,
        statusIsKnown,
        sessionType,
        teacherName,
        sessionStart: value.sessionStart,
        sessionEnd: value.sessionEnd,
        matchedDomain,
        blockedDomains: value.blockedDomains,
        allowedDomains: value.allowedDomains,
        allowedLinks: value.allowedLinks,
        monitored,
        invalidCode: value.invalidCode,
        whitelisted: value.whitelisted,
        stateSource,
    });
}

export function useHaparaMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/hapara", checkHapara);
}
