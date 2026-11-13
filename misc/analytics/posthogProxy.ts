import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { type AppEnv, clientIp } from "../http";

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
 * than being relayed to PostHog: the relay forwards the rest of the request
 * path verbatim, so without an allowlist this endpoint is an open relay to any
 * path on either PostHog host, not just the ingestion/asset surface
 * `posthog-js` actually uses. Verified against the installed posthog-js
 * (1.440.0) bundle and this project's remote config, not assumed. The SDK's
 * default capture path is `/e/`, but the remote config
 * (`/array/<token>/config`) moves capture to `analytics.endpoint`
 * (`/i/v0/e/`) and session replay to `sessionRecording.endpoint` (`/s/`).
 * While only `/e/` was allowed, both 404ed here in production and the events
 * and recordings were lost. `/s/`, `/e/` and `/i/` are the prefixes the SDK's
 * own request router treats as ingestion. Its `/api/` paths (surveys, product
 * tours, web experiments, conversations) stay blocked: all are off for this
 * project, so allow the one that gets switched on.
 */
const ALLOWED_PREFIXES = [
    "/e/", // capture, the SDK default
    "/i/", // capture at /i/v0/e/ (remote config), logs, metrics
    "/s/", // session replay (remote config)
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

/**
 * Statuses whose response must not carry a body. `new Response()` throws when
 * given one alongside a body, even an empty buffer, and PostHog's asset CDN
 * answers a browser's conditional request for a cached bundle with 304.
 */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

/** A batched `$snapshot` (session replay) request is the largest legitimate
 *  payload this ever forwards; PostHog's own capture endpoint rejects
 *  anything bigger anyway. Bounding it here means a hostile client can't make
 *  this process buffer an unbounded body into memory before the upstream
 *  ever gets a say. */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

function buildForwardHeaders(c: Context<AppEnv>): Headers {
    const headers = new Headers();
    c.req.raw.headers.forEach((value, name) => {
        if (!REQUEST_STRIP.has(name.toLowerCase())) headers.set(name, value);
    });

    // Keep the visitor's IP in the chain so PostHog can still geolocate the
    // event; without it every proxied event reports this server's location.
    // `clientIp`, not the socket's peer: behind `REVERSE_PROXY` that peer is
    // the one trusted reverse-proxy hop in front of this process, not the
    // visitor: forwarding it would geolocate every event to wherever that
    // hop runs. `clientIp` resolves the real client through that trusted hop,
    // the way Express's `req.ip` did under `trust proxy: 1`: unlike the raw
    // incoming `x-forwarded-for` header, it can't carry extra entries a client
    // prepended themselves, so it replaces that header rather than extending
    // it.
    const ip = clientIp(c);
    if (ip) headers.set("x-forwarded-for", ip);

    return headers;
}

/** How long to wait on PostHog before giving up. A stalled upstream must not
 *  hold this connection (and, via the buffered request body, its memory)
 *  open indefinitely. */
const UPSTREAM_TIMEOUT_MS = 10_000;

async function relay(c: Context<AppEnv>): Promise<Response> {
    const url = new URL(c.req.url);
    const path = url.pathname.slice(POSTHOG_PROXY_PREFIX.length);
    if (!ALLOWED_PREFIXES.some(prefix => path.startsWith(prefix))) {
        return c.body(null, 404);
    }
    const upstream = path.startsWith("/static/") ? ASSETS_HOST : INGESTION_HOST;
    const hasBody = c.req.method !== "GET" && c.req.method !== "HEAD";

    try {
        const response = await fetch(`${upstream}${path}${url.search}`, {
            method: c.req.method,
            headers: buildForwardHeaders(c),
            body: hasBody ? await c.req.arrayBuffer() : undefined,
            redirect: "manual",
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });

        const headers = new Headers();
        response.headers.forEach((value, name) => {
            if (!RESPONSE_STRIP.has(name.toLowerCase())) {
                headers.set(name, value);
            }
        });
        const body = NULL_BODY_STATUSES.has(response.status)
            ? null
            : await response.arrayBuffer();
        return new Response(body, { status: response.status, headers });
    } catch {
        return c.json({ error: "capture proxy failed" }, 502);
    }
}

export function usePosthogProxy(app: Hono<AppEnv>): void {
    app.all(
        `${POSTHOG_PROXY_PREFIX}/*`,
        bodyLimit({
            maxSize: MAX_BODY_BYTES,
            onError: c => c.json({ error: "payload too large" }, 413),
        }),
        relay,
    );
}
