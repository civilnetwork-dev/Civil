import type { Express, Request, Response } from "express";

/**
 * First-party path that browser analytics talk to instead of PostHog directly.
 * The site runs behind content filters and ad blockers by default, so a
 * request to a known PostHog host is dropped before it leaves the browser. A
 * same-origin path is served by this app, so a blocker cannot tell it apart
 * from any other app request.
 *
 * This value must match `api_host` in `src/entry-client.tsx`.
 */
const POSTHOG_PROXY_PREFIX = "/api/relay";

/** PostHog capture, flags, session recording, and remote config. */
const INGESTION_HOST = "https://us.i.posthog.com";
/** PostHog static bundles: array.js, recorder, surveys, toolbar. */
const ASSETS_HOST = "https://us-assets.i.posthog.com";

/**
 * Path prefixes this relay actually forwards. Anything else 404s here rather
 * than being relayed to PostHog: `${upstream}${req.url}` forwards `req.url`
 * verbatim, so without an allowlist this endpoint is an open relay to any
 * path on either PostHog host, not just the ingestion/asset surface
 * `posthog-js` actually uses. Verified against the installed posthog-js
 * (1.410.4) bundle itself, not assumed: `analyticsDefaultEndpoint` is
 * literally `/e/`, and the only other api_host-relative paths in it are
 * `/flags/?v=2` and `/array/<token>/config`. Session replay batches through
 * `/e/` too (as `$snapshot` events) in this version — there is no separate
 * `/s/`.
 */
const ALLOWED_PREFIXES = [
    "/e/", // capture, including session-replay $snapshot batches
    "/flags/", // feature flags
    "/array/", // remote config
    "/static/", // recorder, surveys, toolbar bundles
];

/** Connection-scoped headers that must not cross in either direction. */
const HOP_BY_HOP = ["connection", "keep-alive", "transfer-encoding"];

/**
 * Request headers that must not cross to the upstream connection.
 *
 * `cookie` and `authorization` carry the visitor's auth session
 * (`better-auth.session_token`) and any other same-origin credentials. The
 * browser sends them to this first-party path, but PostHog has no use for
 * them and they must never leave this origin.
 */
const REQUEST_STRIP = new Set([
    ...HOP_BY_HOP,
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "upgrade",
    "host",
    "content-length",
    "cookie",
    "authorization",
]);

/**
 * Response headers that must not be copied back. `fetch` decodes the body, so
 * `content-encoding` and the original `content-length` no longer describe it.
 *
 * `set-cookie` is stripped for the same reason `cookie`/`authorization` are
 * stripped on the way out: this is a same-origin path on Civil's own domain,
 * so a cookie PostHog sets here would be set *for Civil's origin*, not
 * PostHog's. Nothing upstream should be able to write to this origin's
 * cookie jar.
 */
const RESPONSE_STRIP = new Set([
    ...HOP_BY_HOP,
    "content-encoding",
    "content-length",
    "set-cookie",
]);

/** A batched `$snapshot` (session replay) request is the largest legitimate
 *  payload this ever forwards; PostHog's own capture endpoint rejects
 *  anything bigger anyway. Bounding it here means a hostile client can't make
 *  this process buffer an unbounded body into memory before the upstream
 *  ever gets a say. */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

function flatten(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value.join(", ") : value;
}

function readBody(req: Request): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let total = 0;
        req.on("data", (chunk: Buffer) => {
            total += chunk.length;
            if (total > MAX_BODY_BYTES) {
                req.destroy();
                reject(new Error("body too large"));
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
    });
}

function buildForwardHeaders(req: Request): Headers {
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
        const flat = flatten(value);
        if (flat === undefined || REQUEST_STRIP.has(name.toLowerCase())) {
            continue;
        }
        headers.set(name, flat);
    }

    // Keep the visitor's IP in the chain so PostHog can still geolocate the
    // event; without it every proxied event reports this server's location.
    // `req.ip`, not `req.socket.remoteAddress`: run.ts sets `trust proxy: 1`,
    // so the socket's peer is the one trusted reverse-proxy hop in front of
    // this process, not the visitor -- forwarding it would geolocate every
    // event to wherever that hop runs. `req.ip` is Express's own resolution
    // of the real client through that trusted hop, with the trust-proxy
    // split already applied -- unlike the raw incoming `x-forwarded-for`
    // header, it can't carry extra entries a client prepended themselves, so
    // it replaces that header rather than extending it.
    if (req.ip) headers.set("x-forwarded-for", req.ip);

    return headers;
}

/** How long to wait on PostHog before giving up. A stalled upstream must not
 *  hold this connection (and, via `readBody`'s buffered body, its memory)
 *  open indefinitely. */
const UPSTREAM_TIMEOUT_MS = 10_000;

export function createPosthogProxy() {
    return async (req: Request, res: Response): Promise<void> => {
        const path = req.url.split("?")[0] ?? "";
        if (!ALLOWED_PREFIXES.some(prefix => path.startsWith(prefix))) {
            res.status(404).end();
            return;
        }
        const upstream = path.startsWith("/static/")
            ? ASSETS_HOST
            : INGESTION_HOST;
        const hasBody = req.method !== "GET" && req.method !== "HEAD";

        try {
            const body = hasBody
                ? ((await readBody(req)) as unknown as BodyInit)
                : undefined;
            const response = await fetch(`${upstream}${req.url}`, {
                method: req.method,
                headers: buildForwardHeaders(req),
                body,
                redirect: "manual",
                signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
            });

            res.status(response.status);
            response.headers.forEach((value, name) => {
                if (!RESPONSE_STRIP.has(name.toLowerCase())) {
                    res.setHeader(name, value);
                }
            });
            res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
            const tooLarge =
                error instanceof Error && error.message === "body too large";
            res.status(tooLarge ? 413 : 502).json({
                error: tooLarge ? "payload too large" : "capture proxy failed",
            });
        }
    };
}

export function usePosthogProxy(app: Express): void {
    app.use(POSTHOG_PROXY_PREFIX, createPosthogProxy());
}
