import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { start as startChii } from "chii";
import compression from "compression";
import express from "express";
import { toNodeHandler } from "h3/node";
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
    resolveSessionFromRequest,
    upsertSiteProxyConfig,
} from "./misc/database/index";
import { requireEnv, validateEnv } from "./misc/env";
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
import sirv from "sirv";
import { build } from "vite";
import { WebSocketServer } from "ws";
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

const app = express();
const PORT = Number(process.env.PORT ?? 9876);
const server = createServer((req, res) => {
    if (req.url?.startsWith("/chii/") || req.url === "/chii") return;
    app(req, res);
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

if (process.env.REVERSE_PROXY) {
    app.set("trust proxy", 1);
}

// Register before compression and body parsing so capture payloads reach
// PostHog unparsed and the response is not re-encoded.
usePosthogProxy(app);

app.use(compression());
app.use(express.json());
app.use((req, _res, next) => {
    if (!req.headers["x-forwarded-for"] && !req.headers["x-real-ip"]) {
        req.headers["x-forwarded-for"] = req.socket.remoteAddress ?? "";
    }
    next();
});
app.use(createDatabaseMiddleware());

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

app.get("/api/ip-location", async (req, res) => {
    const raw =
        (req.headers["x-forwarded-for"] as string | undefined)
            ?.split(",")[0]
            ?.trim() ||
        (req.headers["x-real-ip"] as string | undefined) ||
        req.socket.remoteAddress ||
        "";
    const ip = raw.replace(/^::ffff:/, "");
    try {
        const geoip = await import("doc999tor-fast-geoip");
        const info = await geoip.default.lookup(ip);
        if (!info)
            return void res.status(404).json({ error: "Location not found" });
        const [lat, lon] = info.ll as [number, number];
        res.json({ lat, lon, city: info.city, country: info.country });
    } catch {
        res.status(500).json({ error: "GeoIP lookup failed" });
    }
});

app.use("/api/school-districts", createSchoolDistrictsRouter());
app.use("/api/goguardian", createGoGuardianKeysRouter());
app.use("/api/iboss", createIbossGatewaysRouter());

app.use("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/ext-proxy", async (req, res) => {
    const target = req.query.url as string | undefined;
    if (!target) return void res.status(400).json({ error: "url required" });
    let parsed: URL;
    try {
        parsed = new URL(target);
    } catch {
        return void res.status(400).json({ error: "invalid url" });
    }
    if (parsed.protocol !== "https:") {
        return void res.status(400).json({ error: "https only" });
    }
    if (isPrivateHost(parsed.hostname)) {
        return void res.status(403).json({ error: "host not allowed" });
    }
    try {
        const { data, status, headers } = await xior.get<ArrayBuffer>(target, {
            responseType: "arraybuffer",
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; CivilProxy/1.0)",
            },
            validateStatus: () => true,
        });
        res.status(status);
        const contentType = (headers as unknown as Record<string, string>)?.[
            "content-type"
        ];
        if (contentType) res.set("Content-Type", contentType);
        res.set("Cache-Control", "no-store");
        res.end(Buffer.from(data));
    } catch {
        res.status(502).json({ error: "fetch failed" });
    }
});

app.get("/api/favicon", async (req, res) => {
    const url = req.query.url as string | undefined;
    const size = (req.query.size as string | undefined) ?? "32";
    if (!url) return void res.status(400).end();
    try {
        const parsed = new URL(url);
        if (
            parsed.hostname === "localhost" ||
            parsed.hostname === "127.0.0.1" ||
            parsed.hostname.endsWith(".local")
        ) {
            return void res.redirect(301, "/favicon.ico");
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
        if (status !== 200) return void res.status(404).end();
        res.set(
            "Content-Type",
            (headers as unknown as Record<string, string>)["content-type"] ??
                "image/png",
        );
        res.set("Cache-Control", "public, max-age=86400, immutable");
        res.end(Buffer.from(data));
    } catch {
        res.status(404).end();
    }
});

const _proxyProbesInFlight = new Map<string, Promise<unknown>>();
app.get("/api/best-proxy", async (req, res) => {
    const urlParam = req.query.url as string | undefined;
    const hostname = urlParam ? normalizeHostname(urlParam) : null;
    if (!hostname) {
        return void res.status(400).json({ error: "invalid url" });
    }

    if (isPrivateHost(hostname)) {
        return void res.set("Cache-Control", "no-store").json({
            proxy: "scramjet",
            transport: "epoxy",
            wispVersion: 2,
            score: 0,
            cached: false,
            fallback: true,
        });
    }

    const redisKey = `siteproxy:${hostname}`;
    try {
        const hit = await redis.get(redisKey).catch(() => null);
        if (hit) {
            return void res
                .set("Cache-Control", "no-store")
                .json({ ...JSON.parse(hit), cached: true });
        }

        const stored = await getSiteProxyConfig(hostname);
        if (stored) {
            const payload = {
                proxy: stored.proxy,
                transport: stored.transport,
                wispVersion: stored.wispVersion,
                score: stored.score,
            };
            await redis
                .set(redisKey, JSON.stringify(payload), "EX", 86400)
                .catch(() => {});
            return void res
                .set("Cache-Control", "no-store")
                .json({ ...payload, cached: true });
        }

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
                await redis
                    .set(redisKey, JSON.stringify(payload), "EX", 86400)
                    .catch(() => {});
                return payload;
            })().finally(() => _proxyProbesInFlight.delete(hostname));
            _proxyProbesInFlight.set(hostname, inflight);
        }
        const payload = await inflight;
        return void res
            .set("Cache-Control", "no-store")
            .json({ ...(payload as object), cached: false });
    } catch {
        return void res.set("Cache-Control", "no-store").json({
            proxy: "scramjet",
            transport: "epoxy",
            wispVersion: 2,
            score: 0,
            cached: false,
            fallback: true,
        });
    }
});

app.post("/api/best-proxy", async (req, res) => {
    const body = req.body as {
        url?: string;
        proxy?: string;
        transport?: string;
        compat?: number;
        rewriterErrors?: number;
    };
    const hostname = body?.url ? normalizeHostname(body.url) : null;
    const proxy = body?.proxy;
    const compat = Number(body?.compat);
    const rewriterErrors = Number.isFinite(Number(body?.rewriterErrors))
        ? Math.max(0, Number(body.rewriterErrors))
        : 0;
    if (
        !hostname ||
        (proxy !== "scramjet" && proxy !== "uv") ||
        !Number.isFinite(compat)
    ) {
        return void res.status(400).json({ error: "bad feedback" });
    }
    if (isPrivateHost(hostname)) return void res.status(204).end();

    try {
        const transport =
            body.transport === "epoxy" ||
            body.transport === "libcurl" ||
            body.transport === "bare"
                ? body.transport
                : undefined;
        await recordCompatFeedback(
            hostname,
            proxy,
            transport,
            Math.max(0, Math.min(100, compat)),
            rewriterErrors,
        );
        await redis.del(`siteproxy:${hostname}`).catch(() => {});
    } catch {}
    return void res.status(204).end();
});

app.use("/api/check-banned", (req, res) => {
    const url = req.query.url as string | undefined;
    if (!url) return res.json({ banned: false });
    const matched = matchBannedDomain(url);
    return res.json({ banned: matched !== null });
});

app.post("/api/violations", async (req, res) => {
    const session = await resolveSessionFromRequest(req);
    if (!session?.user) return void res.status(401).json({ ok: false });

    const { violations, banned } = await recordViolation(
        session.user.id,
        extractClientIp(req),
    );

    res.json({
        ok: true,
        violations,
        banned,
        maxViolations: VIOLATION_LIMIT,
    });
});

app.use("/api/violations", async (req, res) => {
    const session = await resolveSessionFromRequest(req);

    if (!session?.user) {
        return res.json({
            authenticated: false,
            banned: false,
            violations: 0,
            maxViolations: VIOLATION_LIMIT,
        });
    }

    const user = session.user;
    const violations = await readViolationCount(user.id, extractClientIp(req));

    return res.json({
        authenticated: true,
        banned: Boolean(user.isBanned),
        banReason: user.banReason ?? null,
        bannedAt: user.bannedAt ?? null,
        violations,
        maxViolations: VIOLATION_LIMIT,
    });
});

const servicePathMaps: Record<string, string> = {
    "/uv": uvPath,
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
    app.use(route, sirv(path));
});

process.removeAllListeners("uncaughtException");

const bare = createBareServer("/bare/");

app.use((req, res, next) => {
    if (bare.shouldRoute(req)) {
        bare.routeRequest(req, res).catch(console.error);
    } else {
        next();
    }
});

const { default: ssrHandler } = await import(
    "dist/nitro/vite/services/ssr/index.js"
);

app.use(sirv(resolve(import.meta.dirname, "dist/client")));
app.use(sirv(resolve(import.meta.dirname, "dist/client/_build")));
app.use(sirv(resolve(import.meta.dirname, "dist-config")));

// A hashed chunk that no longer exists after a deploy must fail as a 404, not
// fall through to the SSR handler and come back as an HTML page. Session replay
// shows the alternative: `Uncaught SyntaxError: Unexpected token '<'` and
// `Unable to preload CSS` in every tab that was open across the deploy.
app.use("/_build", (_req, res) => void res.status(404).end());

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

app.use(
    toNodeHandler(ssrHandler as unknown as Parameters<typeof toNodeHandler>[0]),
);

function shouldRouteWisp(req: Request) {
    return req.url?.endsWith("/wisp/");
}

server.on("upgrade", async (req: Request, socket: Socket, head: Buffer) => {
    try {
        if (bare.shouldRoute(req)) {
            bare.routeUpgrade(req, socket, head).catch(console.error);
        } else if (shouldRouteWisp(req)) {
            const session = await resolveSessionFromRequest(req);
            const userId =
                (session?.user as { id?: string } | undefined)?.id ?? null;

            if (userId && (await isUserBanned(userId))) {
                socket.write(
                    "HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n",
                );
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
                    () => {
                        if (!userId) return;
                        void recordViolation(userId, clientIp)
                            .then(({ banned }) => {
                                if (banned) {
                                    try {
                                        ws.close(
                                            1008,
                                            "Banned for accessing restricted content",
                                        );
                                    } catch {}
                                }
                            })
                            .catch(() => {});
                    },
                );

                ws.on("message", data => {
                    const buf = Buffer.isBuffer(data)
                        ? data
                        : Array.isArray(data)
                          ? Buffer.concat(data)
                          : Buffer.from(data as ArrayBuffer);
                    feedWispData(sessionId, buf);
                });
                ws.on("close", () => closeWispSession(sessionId));
            });
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
