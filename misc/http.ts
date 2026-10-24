import type { HttpBindings } from "@hono/node-server";
import type { Context } from "hono";

/**
 * Hono environment for every route run.ts serves. @hono/node-server passes the
 * Node request and response as bindings, which is how a handler reaches the
 * socket's peer address.
 */
export type AppEnv = { Bindings: HttpBindings };

/**
 * The visitor's address, resolved the way Express resolved `req.ip` with
 * `trust proxy: 1`. Without `REVERSE_PROXY` it is the socket's peer. Behind the
 * one reverse-proxy hop `REVERSE_PROXY` declares, it is the last
 * `x-forwarded-for` entry: that hop appended it, while every entry before it
 * came from the client and can be forged.
 */
export function clientIp(c: Context<AppEnv>): string | undefined {
    const peer = c.env.incoming.socket.remoteAddress;
    if (!process.env.REVERSE_PROXY) return peer;
    const forwarded = c.req.header("x-forwarded-for")?.split(",").at(-1);
    return forwarded?.trim() || peer;
}

/**
 * The request's JSON body, or `{}` when it is missing or malformed. Handlers
 * validate the fields they need and answer 400 themselves, as they did when
 * Express's `json()` parser supplied `req.body`.
 */
export async function readJsonBody<T extends object>(
    c: Context,
): Promise<Partial<T>> {
    try {
        const body: unknown = await c.req.json();
        return body !== null && typeof body === "object"
            ? (body as Partial<T>)
            : {};
    } catch {
        return {};
    }
}
