import { decode, encode } from "@msgpack/msgpack";
import Redis from "ioredis";

export const redis = new Redis(process.env.REDIS_URL!, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 2,
});

export async function cached<T>(
    key: string,
    fn: () => Promise<T>,
    ttl = 300,
    tags: string[] = [],
): Promise<T> {
    try {
        const hit = await redis.getBuffer(key);
        if (hit) return decode(hit) as T;
    } catch {
        return fn();
    }

    const value = await fn();

    try {
        const buf = Buffer.from(encode(value));
        await redis.set(key, buf, "EX", ttl);

        for (const tag of tags) {
            await redis.sadd(`tag:${tag}`, key);
        }
    } catch {}

    return value;
}

export async function invalidate(...keys: string[]) {
    if (keys.length) await redis.del(...keys);
}

export async function invalidateTag(tag: string) {
    const keys = await redis.smembers(`tag:${tag}`);
    if (keys.length) await redis.del(...keys);
    await redis.del(`tag:${tag}`);
}

export const sessionKey = (token: string) => `session:${token}`;
export const userKey = (id: string) => `user:${id}`;
export const bannedKey = (id: string) => `banned:${id}`;
