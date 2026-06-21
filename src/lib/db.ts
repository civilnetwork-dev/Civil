"use server";

import { getWebRequest } from "@solidjs/start/http";
import { auth } from "../../misc/database/auth";
import { cached, sessionKey } from "../../misc/database/cache";
import { getUser } from "../../misc/database/models/user";
import { recordVisit } from "../../misc/database/models/visit";

function extractTokenFromHeaders(headers: Headers): string | undefined {
    const bearer = headers.get("authorization")?.replace("Bearer ", "");
    if (bearer) return bearer;
    const cookie = headers.get("cookie") ?? "";
    return cookie
        .split(";")
        .find(c => c.trim().startsWith("better-auth.session_token="))
        ?.split("=")[1]
        ?.trim();
}

async function getSessionFromRequest() {
    const request = getWebRequest();
    if (!request) return null;
    const { headers } = request;
    const token = extractTokenFromHeaders(headers);

    return cached(
        sessionKey(token ?? "anonymous"),
        () => auth.api.getSession({ headers }),
        60,
    ).catch(() => null);
}

function extractIp(): string | null {
    try {
        const req = getWebRequest();
        return (
            req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            req?.headers.get("x-real-ip") ??
            null
        );
    } catch {
        return null;
    }
}

export async function trackVisit(url: string): Promise<{
    ok: boolean;
    userBanned: boolean;
    banReason: string | null;
    error?: string;
}> {
    const session = await getSessionFromRequest();
    if (!session?.user) {
        return {
            ok: false,
            userBanned: false,
            banReason: null,
            error: "no session",
        };
    }

    const userId = (session.user as { id: string }).id;
    const user = await getUser(userId);

    if (!user) {
        return {
            ok: false,
            userBanned: false,
            banReason: null,
            error: "user not found",
        };
    }
    if (user.isBanned) {
        return { ok: false, userBanned: true, banReason: user.banReason };
    }

    await recordVisit(userId, url, extractIp());
    return { ok: true, userBanned: false, banReason: null };
}
