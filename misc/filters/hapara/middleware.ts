import type { Context, Hono } from "hono";

import { type AppEnv, readJsonBody } from "../../http";
import { respondFilterResult } from "../utils/respondFilterError";
import {
    checkHaparaFilter,
    type HaparaCheckerOptions,
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
    return respondFilterResult(c, "hapara", url, result);
}

export function useHaparaMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/hapara", checkHapara);
}
