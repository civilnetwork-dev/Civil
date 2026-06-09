import { toNodeHandler } from "better-auth/node";
import type { Request, Response } from "express";
import { Router } from "express";
import { auth } from "./auth";
import { cached, sessionKey } from "./cache";
import { yoga } from "./graphql";
import { isUserBanned } from "./models/user";
import { recordVisit } from "./models/visit";

async function resolveSession(token: string | undefined) {
    if (!token) return null;
    return cached(
        sessionKey(token),
        () =>
            auth.api.getSession({
                headers: new Headers({
                    cookie: `better-auth.session_token=${token}`,
                    authorization: `Bearer ${token}`,
                }),
            }),
        60,
    ).catch(() => null);
}

function extractToken(req: Request): string | undefined {
    const bearer = req.headers.authorization?.replace("Bearer ", "");
    if (bearer) return bearer;
    return req.headers.cookie
        ?.split(";")
        .find(c => c.trim().startsWith("better-auth.session_token="))
        ?.split("=")[1]
        ?.trim();
}

export function createDatabaseMiddleware() {
    const router = Router();

    router.all("/api/auth/*splat", toNodeHandler(auth.handler));

    router.post("/api/track-visit", async (req: Request, res: Response) => {
        const token = extractToken(req);
        const session = await resolveSession(token);
        if (!session?.user)
            return void res.status(401).json({ error: "unauthorized" });

        const userId = (session.user as { id: string }).id;
        if (await isUserBanned(userId))
            return void res.status(403).json({ error: "banned" });

        const { url } = req.body as { url?: string };
        if (!url) return void res.status(400).json({ error: "url required" });

        await recordVisit(userId, url);
        res.json({ ok: true });
    });

    router.use("/graphql", yoga);

    return router;
}
