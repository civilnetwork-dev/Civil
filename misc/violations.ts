import type { IncomingMessage } from "node:http";
import { redis } from "./database/cache";
import { banUser } from "./database/models/user";

/** Strikes before a ban. */
export const VIOLATION_LIMIT = 5;

/** How long a strike counter lives, in seconds (24h). */
export const VIOLATION_TTL = 86400;

export const userViolationKey = (userId: string) => `wisp:violations:${userId}`;
export const ipViolationKey = (ip: string) => `wisp:violations:ip:${ip}`;

/**
 * Best-effort client IP from proxy headers, falling back to the socket.
 *
 * Only trustworthy when Express is running with `trust proxy` behind a proxy we
 * control — `x-forwarded-for` is client-settable otherwise. It feeds the per-IP
 * strike counter, so a wrong answer here means either a missed strike or a
 * strike attributed to the wrong network.
 *
 * `::ffff:` prefixes are stripped so an IPv4-mapped IPv6 address and the plain
 * IPv4 address produce the same counter key rather than two independent ones.
 */
export function extractClientIp(
    req: Pick<IncomingMessage, "headers"> & {
        socket?: { remoteAddress?: string };
    },
): string | null {
    const xff = req.headers["x-forwarded-for"];
    const first = Array.isArray(xff) ? xff[0] : xff?.split(",")[0];
    const raw = (
        first ??
        (req.headers["x-real-ip"] as string | undefined) ??
        req.socket?.remoteAddress ??
        ""
    ).trim();
    return raw ? raw.replace(/^::ffff:/, "") : null;
}

/**
 * Record a restricted-domain strike. Strikes are counted per-userId AND per-IP
 * so a banned user cannot reset by clearing data and creating a fresh anonymous
 * account: the IP counter survives the wipe (24h window), and the effective
 * strike count is the max of the two. The ban itself stays per-userId (no
 * whole-IP block) to avoid banning an entire school behind one shared NAT.
 *
 * Both properties are load-bearing and pinned by tests/violations.test.ts:
 * dropping the IP counter makes bans trivial to evade, and banning by IP takes
 * out every student on the same network.
 */
export async function recordViolation(
    userId: string,
    ip: string | null,
): Promise<{ violations: number; banned: boolean }> {
    const userKey = userViolationKey(userId);
    const userCount = await redis.incr(userKey);
    await redis.expire(userKey, VIOLATION_TTL);

    let ipCount = 0;
    if (ip) {
        const ipKey = ipViolationKey(ip);
        ipCount = await redis.incr(ipKey);
        await redis.expire(ipKey, VIOLATION_TTL);
    }

    const violations = Math.max(userCount, ipCount);
    let banned = false;
    if (violations >= VIOLATION_LIMIT) {
        await banUser(
            userId,
            "Repeatedly accessed restricted domains via proxy",
        );
        banned = true;
    }
    return { violations, banned };
}

/**
 * Current strike count without incrementing: max of the user and IP counters,
 * matching what `recordViolation` compares against the limit.
 */
export async function readViolationCount(
    userId: string,
    ip: string | null,
): Promise<number> {
    const rawUser = await redis.get(userViolationKey(userId)).catch(() => null);
    const rawIp = ip
        ? await redis.get(ipViolationKey(ip)).catch(() => null)
        : null;
    return Math.max(
        Number.parseInt(rawUser ?? "0", 10) || 0,
        Number.parseInt(rawIp ?? "0", 10) || 0,
    );
}
