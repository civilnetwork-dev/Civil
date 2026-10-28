import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";

import { getRequestListener } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { start as startChii } from "chii";
import { type Context, Hono, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { compress } from "hono/compress";

import { usePosthogProxy } from "./misc/analytics/posthogProxy";
import {
    createDatabaseMiddleware,
    getBannedDomains,
    getSiteProxyConfig,
    initBannedDomains,
    isUserBanned,
    matchBannedDomain,
    normalizeHostname,
    probeSite,
    recordCompatFeedback,
    redis,
    resolveSessionFromHeaders,
    resolveSessionFromRequest,
    upsertSiteProxyConfig,
} from "./misc/database/index";
import { requireEnv, validateEnv } from "./misc/env";
import { type AppEnv, readJsonBody } from "./misc/http";
import { isPrivateHost } from "./misc/net";
import {
    extractClientIp,
    readViolationCount,
    recordViolation,
    VIOLATION_LIMIT,
} from "./misc/violations";

validateEnv();

const mwModulePrefix = "node_modules/@mercuryworkshop";
const { epoxyPath, libcurlPath, bareTransportPath, scramjetControllerPath } = {
    epoxyPath: resolve(
        import.meta.dirname,
        mwModulePrefix,
        "epoxy-transport/dist",
    ),
    libcurlPath: resolve(
        import.meta.dirname,
        mwModulePrefix,
        "libcurl-transport/dist",
    ),
    bareTransportPath: resolve(
        import.meta.dirname,
        mwModulePrefix,
        "bare-transport/dist",
    ),
    scramjetControllerPath: resolve(
        import.meta.dirname,
        mwModulePrefix,
        "scramjet-controller/dist",
    ),
};

import type { IncomingMessage as Request } from "node:http";
import type { Socket } from "node:net";

import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { createBareServer } from "@tomphttp/bare-server-node";
import { XMLParser } from "fast-xml-parser";
import { blue, yellow } from "picocolors";
import { build } from "vite";
import { type WebSocket as WsSocket, WebSocketServer } from "ws";
import xior from "xior";

import { useBlocksiMiddleware } from "./misc/filters/blocksi/middleware";
import { useFilterBlockerMiddleware } from "./misc/filters/filterBlockerMiddleware";
import { useFortiGuardMiddleware } from "./misc/filters/fortiguard/middleware";
import { useGoGuardianMiddleware } from "./misc/filters/goguardian/middleware";
import { useHaparaMiddleware } from "./misc/filters/hapara/middleware";
import { useIbossMiddleware } from "./misc/filters/iboss/middleware";
// import { useLanSchoolMiddleware } from "./misc/filters/lanschool/air/middleware";
import { useLightspeedMiddleware } from "./misc/filters/lightspeed/middleware";
import { useLinewizeMiddleware } from "./misc/filters/linewize/middleware";
import { useSecurlyMiddleware } from "./misc/filters/securly/middleware";
import { useSharedFilterMiddleware } from "./misc/filters/sharedMiddleware";
import { createGoGuardianKeysRouter } from "./misc/goguardianKeys/api";
import { createIbossGatewaysRouter } from "./misc/ibossGateways/api";
import { createSchoolDistrictsRouter } from "./misc/schoolDistricts/api";
import { setupSchoolDistricts } from "./misc/schoolDistricts/setup";
import {
    closeWispSession,
    feedWispData,
    routeUpgradeCallbacks,
    setGlobalOptions,
} from "./misc/wisp/native/index.js";

if (!existsSync(resolve(import.meta.dirname, "dist"))) {
    console.log(yellow("no build found, building..."));
    build();
}

const app = new Hono<AppEnv>();
const PORT = Number(process.env.PORT ?? 9876);
const bare = createBareServer("/bare/");
const handleWithHono = getRequestListener(app.fetch);
const server = createServer((req, res) => {
    if (req.url?.startsWith("/chii/") || req.url === "/chii") return;
    // better-auth and the violation counters read the client address from
    // these headers, and a direct connection carries neither.
    if (!req.headers["x-forwarded-for"] && !req.headers["x-real-ip"]) {
        req.headers["x-forwarded-for"] = req.socket.remoteAddress ?? "";
    }
    // The Bare server works on the raw Node streams, so it takes its requests
    // before Hono, where nothing can have read their bodies first.
    if (bare.shouldRoute(req)) {
        bare.routeRequest(req, res).catch(console.error);
        return;
    }
    void handleWithHono(req, res);
});
await startChii({
    server,
    basePath: "/chii/",
    domain: process.env.CHII_DOMAIN || `localhost:${PORT}`,
});

const wss = new WebSocketServer({ noServer: true });
const wispWss = new WebSocketServer({ noServer: true });

function pushWispOptions(): void {
    setGlobalOptions(
        JSON.stringify({
            hostname_blacklist: getBannedDomains(),
            allow_tcp_streams: true,
            allow_udp_streams: true,
            allow_direct_ip: true,
            allow_private_ips: false,
            allow_loopback_ips: false,
        }),
    );
}

const GOOGLE_URL =
    "https://clients1.google.com/complete/search?hl=en&output=toolbar&q=";

initBannedDomains()
    .then(pushWispOptions)
    .catch(err => console.error("Failed to load banned domains list:", err));

setupSchoolDistricts().catch(err =>
    console.error("Failed to setup school districts:", err),
);

// Register before compression and body parsing so capture payloads reach
// PostHog unparsed and the response is not re-encoded.
usePosthogProxy(app);

app.use(compress());
// Express's json() parser refused JSON bodies over 100 kB. Handlers now read
// their own bodies, so the same cap applies to every route registered below.
app.use(bodyLimit({ maxSize: 100 * 1024 }));
app.route("/", createDatabaseMiddleware());

useFilterBlockerMiddleware(app);
useSharedFilterMiddleware(app, "/filterCheck");
useSecurlyMiddleware(app);
useGoGuardianMiddleware(app);
useLinewizeMiddleware(app);
// useLanSchoolMiddleware(app);
useFortiGuardMiddleware(app);
useBlocksiMiddleware(app);
useHaparaMiddleware(app);
useLightspeedMiddleware(app);
useIbossMiddleware(app, { securityKey: requireEnv("IBOSS_SECURITY_KEY") });

app.get("/api/ip-location", async c => {
    const raw =
        c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
        c.req.header("x-real-ip") ||
        c.env.incoming.socket.remoteAddress ||
        "";
    const ip = raw.replace(/^::ffff:/, "");
    try {
        const geoip = await import("doc999tor-fast-geoip");
        const info = await geoip.default.lookup(ip);
        if (!info) return c.json({ error: "Location not found" }, 404);
        const [lat, lon] = info.ll as [number, number];
        return c.json({ lat, lon, city: info.city, country: info.country });
    } catch {
        return c.json({ error: "GeoIP lookup failed" }, 500);
    }
});

app.route("/api/school-districts", createSchoolDistrictsRouter());
app.route("/api/goguardian", createGoGuardianKeysRouter());
app.route("/api/iboss", createIbossGatewaysRouter());

app.all("/health/*", c => c.json({ ok: true }));

app.get("/api/ext-proxy", async c => {
    const target = c.req.query("url");
    if (!target) return c.json({ error: "url required" }, 400);

    let current: URL;
    try {
        current = new URL(target);
    } catch {
        return c.json({ error: "invalid url" }, 400);
    }

    // Follow redirects by hand so the SSRF guard is re-applied to every hop:
    // a redirect can downgrade `https:` to `http:` and point at a private host
    // that the initial URL never named. `fetch` would follow it blind.
    const MAX_REDIRECTS = 5;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        if (current.protocol !== "https:") {
            return c.json({ error: "https only" }, 400);
        }
        if (isPrivateHost(current.hostname)) {
            return c.json({ error: "host not allowed" }, 403);
        }

        const response = await fetch(current, {
            redirect: "manual",
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; CivilProxy/1.0)",
            },
        }).catch(() => null);

        if (!response) {
            return c.json({ error: "fetch failed" }, 502);
        }

        const location = response.headers.get("location");
        if (response.status >= 300 && response.status < 400 && location) {
            try {
                current = new URL(location, current);
            } catch {
                return c.json({ error: "bad redirect" }, 502);
            }
            continue;
        }

        const headers = new Headers({ "Cache-Control": "no-store" });
        const contentType = response.headers.get("content-type");
        if (contentType) headers.set("Content-Type", contentType);
        return new Response(response.body, {
            status: response.status,
            headers,
        });
    }

    return c.json({ error: "too many redirects" }, 502);
});

app.get("/api/favicon", async c => {
    const url = c.req.query("url");
    const size = c.req.query("size") ?? "32";
    if (!url) return c.body(null, 400);
    try {
        const parsed = new URL(url);
        if (
            parsed.hostname === "localhost" ||
            parsed.hostname === "127.0.0.1" ||
            parsed.hostname.endsWith(".local")
        ) {
            return c.redirect("/favicon.ico", 301);
        }
    } catch {}
    try {
        const { data, status, headers } = await xior.get<ArrayBuffer>(
            "https://t2.gstatic.com/faviconV2",
            {
                params: {
                    client: "SOCIAL",
                    type: "FAVICON",
                    fallback_opts: ["TYPE", "SIZE", "URL"].join(","),
                    url,
                    size,
                },
                responseType: "arraybuffer",
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; CivilProxy/1.0)",
                },
                validateStatus: () => true,
            },
        );
        if (status !== 200) return c.body(null, 404);
        c.header("Content-Type", headers.get("content-type") ?? "image/png");
        c.header("Cache-Control", "public, max-age=86400, immutable");
        return c.body(data);
    } catch {
        return c.body(null, 404);
    }
});

const _proxyProbesInFlight = new Map<string, Promise<unknown>>();

const FALLBACK_PROXY_DECISION = {
    proxy: "scramjet",
    transport: "epoxy",
    wispVersion: 2,
    score: 0,
    cached: false,
    fallback: true,
};

type ProxyPayload = {
    proxy: string;
    transport: string;
    wispVersion: number;
    score: number;
};

async function cacheProxyPayload(redisKey: string, payload: ProxyPayload) {
    await redis
        .set(redisKey, JSON.stringify(payload), "EX", 86400)
        .catch(() => {});
}

/** Probes the host once, however many requests ask for it meanwhile. */
function probeOnce(hostname: string, redisKey: string): Promise<unknown> {
    let inflight = _proxyProbesInFlight.get(hostname);
    if (!inflight) {
        inflight = (async () => {
            const decision = await probeSite(`https://${hostname}/`);
            await upsertSiteProxyConfig(hostname, decision).catch(() => {});
            const payload = {
                proxy: decision.proxy,
                transport: decision.transport,
                wispVersion: decision.wispVersion,
                score: decision.score,
            };
            await cacheProxyPayload(redisKey, payload);
            return payload;
        })().finally(() => _proxyProbesInFlight.delete(hostname));
        _proxyProbesInFlight.set(hostname, inflight);
    }
    return inflight;
}

async function bestProxyFor(c: Context<AppEnv>, hostname: string) {
    const redisKey = `siteproxy:${hostname}`;
    const hit = await redis.get(redisKey).catch(() => null);
    if (hit) {
        return c.json({ ...JSON.parse(hit), cached: true });
    }

    const stored = await getSiteProxyConfig(hostname);
    // A row from before UV was removed can still say proxy: "uv" (the
    // proxy column has no DB-level enum, just text) -- treat that the
    // same as no stored decision at all, so it falls through to a fresh
    // probeSite() below and self-heals to "scramjet" via
    // upsertSiteProxyConfig, rather than serving a recommendation for a
    // proxy backend that no longer exists.
    if (stored && stored.proxy === "scramjet") {
        const payload = {
            proxy: stored.proxy,
            transport: stored.transport,
            wispVersion: stored.wispVersion,
            score: stored.score,
        };
        await cacheProxyPayload(redisKey, payload);
        return c.json({ ...payload, cached: true });
    }

    const payload = await probeOnce(hostname, redisKey);
    return c.json({ ...(payload as object), cached: false });
}

app.get("/api/best-proxy", async c => {
    const urlParam = c.req.query("url");
    const hostname = urlParam ? normalizeHostname(urlParam) : null;
    if (!hostname) {
        return c.json({ error: "invalid url" }, 400);
    }

    c.header("Cache-Control", "no-store");
    if (isPrivateHost(hostname)) {
        return c.json(FALLBACK_PROXY_DECISION);
    }

    try {
        return await bestProxyFor(c, hostname);
    } catch {
        return c.json(FALLBACK_PROXY_DECISION);
    }
});

app.post("/api/best-proxy", async c => {
    const body = await readJsonBody<{
        url: string;
        proxy: string;
        transport: string;
        compat: number;
        rewriterErrors: number;
    }>(c);
    const hostname = body.url ? normalizeHostname(body.url) : null;
    const proxy = body.proxy;
    const compat = Number(body.compat);
    const rewriterErrors = Number.isFinite(Number(body.rewriterErrors))
        ? Math.max(0, Number(body.rewriterErrors))
        : 0;
    if (!hostname || proxy !== "scramjet" || !Number.isFinite(compat)) {
        return c.json({ error: "bad feedback" }, 400);
    }
    if (isPrivateHost(hostname)) return c.body(null, 204);

    try {
        const transport =
            body.transport === "epoxy" ||
            body.transport === "libcurl" ||
            body.transport === "bare"
                ? body.transport
                : undefined;
        await recordCompatFeedback(
            hostname,
            transport,
            Math.max(0, Math.min(100, compat)),
            rewriterErrors,
        );
        await redis.del(`siteproxy:${hostname}`).catch(() => {});
    } catch {}
    return c.body(null, 204);
});

app.all("/api/check-banned/*", c => {
    const url = c.req.query("url");
    if (!url) return c.json({ banned: false });
    const matched = matchBannedDomain(url);
    return c.json({ banned: matched !== null });
});

app.post("/api/violations", async c => {
    const session = await resolveSessionFromHeaders(c.req.raw.headers);
    if (!session?.user) return c.json({ ok: false }, 401);

    const { violations, banned } = await recordViolation(
        session.user.id,
        extractClientIp(c.env.incoming),
    );

    return c.json({
        ok: true,
        violations,
        banned,
        maxViolations: VIOLATION_LIMIT,
    });
});

app.all("/api/violations/*", async c => {
    const session = await resolveSessionFromHeaders(c.req.raw.headers);

    if (!session?.user) {
        return c.json({
            authenticated: false,
            banned: false,
            violations: 0,
            maxViolations: VIOLATION_LIMIT,
        });
    }

    const user = session.user;
    const violations = await readViolationCount(
        user.id,
        extractClientIp(c.env.incoming),
    );

    return c.json({
        authenticated: true,
        banned: Boolean(user.isBanned),
        banReason: user.banReason ?? null,
        bannedAt: user.bannedAt ?? null,
        violations,
        maxViolations: VIOLATION_LIMIT,
    });
});

/**
 * Serves the files under `root`, with `prefix` stripped from the request path,
 * the way sirv did. @hono/node-server's serveStatic resolves the full request
 * path against its root, and it serves dotfiles, which sirv never did outside
 * `.well-known`.
 */
function staticDir(root: string, prefix = ""): MiddlewareHandler<AppEnv> {
    const serve = serveStatic<AppEnv>({
        root,
        rewriteRequestPath: path => path.slice(prefix.length),
    });
    return (c, next) =>
        /\/\.(?!well-known\/)/.test(c.req.path) ? next() : serve(c, next);
}

const servicePathMaps: Record<string, string> = {
    "/scramjet": scramjetPath,
    "/scramjetController": scramjetControllerPath,
    "/epoxy": epoxyPath,
    "/libcurl": libcurlPath,
    "/bare-transport": bareTransportPath,
    "/baremux": baremuxPath,
    "/baremuxTransport": resolve(
        import.meta.dirname,
        "dist-config/baremux-transport",
    ),
};

Object.entries(servicePathMaps).forEach(([route, path]) => {
    app.use(`${route}/*`, staticDir(path, route));
});

// Nitro names each Vite service entry after the file the environment built.
// The SSR environment's entry is @solidjs/vite-plugin's `virtual:solid-ssr-handler`,
// which emits as `server`; its default export is the Fetchable
// `{ fetch(request) }` that the catch-all route below hands each request to.
const { default: ssrHandler } =
    (await import("./dist/nitro/vite/services/ssr/server.js")) as {
        default: { fetch(request: globalThis.Request): Promise<Response> };
    };

app.use(staticDir(resolve(import.meta.dirname, "dist/client")));
app.use(staticDir(resolve(import.meta.dirname, "dist/client/_build")));
app.use(staticDir(resolve(import.meta.dirname, "dist-config")));

// A hashed chunk that no longer exists after a deploy must fail as a 404, not
// fall through to the SSR handler and come back as an HTML page. Session replay
// shows the alternative: `Uncaught SyntaxError: Unexpected token '<'` and
// `Unable to preload CSS` in every tab that was open across the deploy.
app.all("/_build/*", c => c.body(null, 404));

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
});

wss.on("connection", ws => {
    ws.on("message", async (message: Buffer) => {
        try {
            const { q } = JSON.parse(message.toString());
            const url = `${GOOGLE_URL}${encodeURIComponent(q)}`;

            const { data } = await xior.get(url, { responseType: "text" });
            const json = parser.parse(data);
            const raw = json.toplevel.CompleteSuggestion;
            const list = Array.isArray(raw) ? raw : [raw];
            const suggestions = list.map((s: any) => s.suggestion.data);

            ws.send(JSON.stringify({ q: message.toString(), suggestions }));
        } catch (err: any) {
            ws.send(JSON.stringify({ error: err.message }));
        }
    });
});

app.all("*", c => ssrHandler.fetch(c.req.raw));

function shouldRouteWisp(req: Request) {
    return req.url?.endsWith("/wisp/");
}

function toBuffer(data: Buffer | ArrayBuffer | Buffer[]): Buffer {
    return Buffer.isBuffer(data)
        ? data
        : Array.isArray(data)
          ? Buffer.concat(data)
          : Buffer.from(data as ArrayBuffer);
}

/** Strikes the user for a blocked host, and drops the socket if that bans them. */
function reportWispViolation(
    ws: WsSocket,
    userId: string | null,
    clientIp: string | null,
) {
    if (!userId) return;
    void recordViolation(userId, clientIp)
        .then(({ banned }) => {
            if (banned) {
                try {
                    ws.close(1008, "Banned for accessing restricted content");
                } catch {}
            }
        })
        .catch(() => {});
}

async function upgradeWisp(req: Request, socket: Socket, head: Buffer) {
    const session = await resolveSessionFromRequest(req);
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

    if (userId && (await isUserBanned(userId))) {
        socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
    }

    const wispVersion = req.headers["sec-websocket-protocol"] ? 2 : 1;
    const clientIp = extractClientIp(req);

    wispWss.handleUpgrade(req, socket, head, ws => {
        const sessionId = routeUpgradeCallbacks(
            Buffer.alloc(0),
            clientIp ?? "",
            req.socket?.remotePort ?? 0,
            req.url ?? "/wisp/",
            wispVersion,
            "{}",
            data => {
                try {
                    ws.send(data);
                } catch {}
            },
            () => {
                try {
                    ws.close();
                } catch {}
            },
            () => reportWispViolation(ws, userId, clientIp),
        );

        ws.on("message", data =>
            feedWispData(sessionId, toBuffer(data as Buffer)),
        );
        ws.on("close", () => closeWispSession(sessionId));
    });
}

server.on("upgrade", async (req: Request, socket: Socket, head: Buffer) => {
    try {
        if (bare.shouldRoute(req)) {
            bare.routeUpgrade(req, socket, head).catch(console.error);
        } else if (shouldRouteWisp(req)) {
            await upgradeWisp(req, socket, head);
        } else if (req.url?.endsWith("/suggestions")) {
            wss.handleUpgrade(req, socket, head, ws => {
                wss.emit("connection", ws, req);
            });
        }
    } catch (err) {
        console.error("WebSocket upgrade error:", err);
        socket.destroy();
    }
});

server.listen(PORT, () => {
    console.log(blue(`server is running at http://localhost:${PORT}`));
});
