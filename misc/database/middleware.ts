import { type Context, Hono } from "hono";

import { type AppEnv, clientIp, readJsonBody } from "../http";
import { auth } from "./auth";
import { matchBannedDomain } from "./bannedDomains";
import { yoga } from "./graphql";
import { getUser, isUserBanned } from "./models/user";
import { recordVisit } from "./models/visit";
import { resolveSessionFromHeaders } from "./session";

/**
 * better-auth answers 415 to a request body that is not JSON, and
 * @hono/node-server gives every POST a body, even an empty one. better-auth's
 * own Node adapter, which served these routes under Express, treats a request
 * with no content type or no content as bodiless, so a bare
 * `fetch(url, { method: "POST" })` like the anonymous sign-in in
 * src/routes/__root.tsx kept working. This keeps that rule.
 */
function dropEmptyBody(request: Request): Request {
    const { headers } = request;
    const length = headers.get("content-length");
    const hasContent =
        length === null ? headers.has("transfer-encoding") : length !== "0";
    if (!request.body || (headers.has("content-type") && hasContent)) {
        return request;
    }
    return new Request(request.url, {
        method: request.method,
        headers,
        signal: request.signal,
    });
}

/**
 * Records a navigation the student asked for in a tab. A restricted site is
 * not recorded: the answer names it instead, so the tab can say why rather
 * than sit on the blank page the service worker's 403 leaves (it sees tab
 * navigations as iframe loads). A restricted site is only ever refused, never
 * held against the student: asking for one any number of times costs nothing.
 */
async function trackVisit(c: Context<AppEnv>) {
    const session = await resolveSessionFromHeaders(c.req.raw.headers);
    if (!session?.user)
        return c.json(
            {
                ok: false,
                userBanned: false,
                banReason: null,
                error: "unauthorized",
            },
            401,
        );

    const userId = (session.user as { id: string }).id;
    if (await isUserBanned(userId)) {
        const user = await getUser(userId);
        return c.json({
            ok: false,
            userBanned: true,
            banReason: user?.banReason ?? null,
        });
    }

    const { url } = await readJsonBody<{ url: string }>(c);
    if (!url)
        return c.json(
            {
                ok: false,
                userBanned: false,
                banReason: null,
                error: "url required",
            },
            400,
        );

    const restricted = matchBannedDomain(url);
    if (restricted)
        return c.json({
            ok: false,
            userBanned: false,
            banReason: null,
            restricted,
        });

    await recordVisit(userId, url, clientIp(c) ?? null);
    return c.json({ ok: true, userBanned: false, banReason: null });
}

export function createDatabaseMiddleware() {
    const router = new Hono<AppEnv>();

    router.all("/api/auth/*", c => auth.handler(dropEmptyBody(c.req.raw)));
    router.post("/api/trackVisit", trackVisit);
    router.all("/graphql", c => yoga.fetch(c.req.raw));

    return router;
}
