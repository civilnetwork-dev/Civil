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
export const POSTHOG_PROXY_PREFIX = "/api/relay";

/** PostHog capture, flags, session recording, and remote config. */
const INGESTION_HOST = "https://us.i.posthog.com";
/** PostHog static bundles: array.js, recorder, surveys, toolbar. */
const ASSETS_HOST = "https://us-assets.i.posthog.com";

/** Connection-scoped headers that must not cross in either direction. */
const HOP_BY_HOP = ["connection", "keep-alive", "transfer-encoding"];

/** Request headers that must not cross to the upstream connection. */
const REQUEST_STRIP = new Set([
    ...HOP_BY_HOP,
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "upgrade",
    "host",
    "content-length",
]);

/**
 * Response headers that must not be copied back. `fetch` decodes the body, so
 * `content-encoding` and the original `content-length` no longer describe it.
 */
const RESPONSE_STRIP = new Set([
    ...HOP_BY_HOP,
    "content-encoding",
    "content-length",
]);

function flatten(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value.join(", ") : value;
}

function readBody(req: Request): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", chunk => chunks.push(chunk as Buffer));
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
    const clientIp = req.socket?.remoteAddress?.replace(/^::ffff:/, "");
    if (clientIp) {
        headers.set(
            "x-forwarded-for",
            [flatten(req.headers["x-forwarded-for"]), clientIp]
                .filter(Boolean)
                .join(", "),
        );
    }

    return headers;
}

export function createPosthogProxy() {
    return async (req: Request, res: Response): Promise<void> => {
        const path = req.url.split("?")[0];
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
            });

            res.status(response.status);
            response.headers.forEach((value, name) => {
                if (!RESPONSE_STRIP.has(name.toLowerCase())) {
                    res.setHeader(name, value);
                }
            });
            res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
            res.status(502).json({ error: "capture proxy failed" });
        }
    };
}

export function usePosthogProxy(app: Express): void {
    app.use(POSTHOG_PROXY_PREFIX, createPosthogProxy());
}
