import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { start as startChii } from "chii";
import compression from "compression";
import express from "express";
import { toNodeHandler } from "h3/node";
import createRammerhead from "rammerhead";
import {
    auth,
    banUser,
    cached,
    createDatabaseMiddleware,
    getSiteProxyConfig,
    initBannedDomains,
    isUserBanned,
    matchBannedDomain,
    normalizeHostname,
    probeSite,
    recordCompatFeedback,
    redis,
    sessionKey,
    upsertSiteProxyConfig,
} from "./misc/database/index";

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

import type {
    ServerResponse as ExpressResponse,
    IncomingMessage as Request,
    Server,
} from "node:http";
import type { Socket } from "node:net";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { logging, server as wisp } from "@mercuryworkshop/wisp-js/server";
import { createBareServer } from "@tomphttp/bare-server-node";
import { XMLParser } from "fast-xml-parser";
import sirv from "sirv";
import { WebSocketServer } from "ws";
import xior from "xior";
import { createGoGuardianKeysRouter } from "./misc/goguardianKeys/api";
import { createSchoolDistrictsRouter } from "./misc/schoolDistricts/api";
import { setupSchoolDistricts } from "./misc/schoolDistricts/setup";

class RammerheadRouting {
    static #scopes: string[] & { length: 15 } = [
        "/rammerhead.js",
        "/hammerhead.js",
        "/transport-worker.js",
        "/task.js",
        "/iframe-task.js",
        "/worker-hammerhead.js",
        "/messaging",
        "/sessionexists",
        "/deletesession",
        "/newsession",
        "/editsession",
        "/needpassword",
        "/syncLocalStorage",
        "/api/shuffleDict",
        "/mainport",
    ];

    static shouldRoute(req: Request) {
        const url = new URL(req.url!, "http://0.0.0.0");
        return (
            RammerheadRouting.#scopes.includes(url.pathname) ||
            /^\/[a-z0-9]{32}(\/|$)/.test(url.pathname)
        );
    }

    static routeRequest(
        rammerhead: Server,
        req: Request,
        res: ExpressResponse,
    ) {
        rammerhead.emit("request", req, res);
    }

    static routeUpgrade(
        rammerhead: Server,
        req: Request,
        socket: Socket,
        head: Buffer,
    ) {
        rammerhead.emit("upgrade", req, socket, head);
    }
}

import { blue, yellow } from "picocolors";
import { build } from "vite";
import { useBlocksiMiddleware } from "./misc/filters/blocksi/middleware";
import { useFilterBlockerMiddleware } from "./misc/filters/filterBlockerMiddleware";
import { useFortiGuardMiddleware } from "./misc/filters/fortiguard/middleware";
import { useGoGuardianMiddleware } from "./misc/filters/goguardian/middleware";
import { useHaparaMiddleware } from "./misc/filters/hapara/middleware";
// import { useLanSchoolMiddleware } from "./misc/filters/lanschool/air/middleware";
import { useLightspeedMiddleware } from "./misc/filters/lightspeed/middleware";
import { useLinewizeMiddleware } from "./misc/filters/linewize/middleware";
import { useSecurlyMiddleware } from "./misc/filters/securly/middleware";
import { useSharedFilterMiddleware } from "./misc/filters/sharedMiddleware";

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

function buildWispClosePacket(streamId: number): Uint8Array {
    const buf = new Uint8Array(6);
    const view = new DataView(buf.buffer);
    view.setUint8(0, 0x04);
    view.setUint32(1, streamId, true);
    view.setUint8(5, 0x48); // HostBlocked
    return buf;
}

const VIOLATION_LIMIT = 5;
const VIOLATION_TTL = 86400;

function extractClientIp(req: Request): string | null {
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
 */
async function recordViolation(
    userId: string,
    ip: string | null,
): Promise<{ violations: number; banned: boolean }> {
    const userKey = `wisp:violations:${userId}`;
    const userCount = await redis.incr(userKey);
    await redis.expire(userKey, VIOLATION_TTL);

    let ipCount = 0;
    if (ip) {
        const ipKey = `wisp:violations:ip:${ip}`;
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

class TrackedWispConnection extends wisp.ServerConnection {
    private _userId: string | null;
    private _ip: string | null;

    constructor(
        ws: unknown,
        path: string,
        userId: string | null,
        ip: string | null,
        opts?: unknown,
    ) {
        super(ws, path, opts);
        this._userId = userId;
        this._ip = ip;
    }

    override create_stream(
        streamId: number,
        type: number,
        hostname: string,
        port: number,
    ) {
        if (matchBannedDomain(`https://${hostname}`)) {
            this._handleBannedDomain(streamId).catch(console.error);
            return;
        }
        super.create_stream(streamId, type, hostname, port);
    }

    private async _handleBannedDomain(streamId: number) {
        this.ws.ws.send(buildWispClosePacket(streamId));

        if (!this._userId) return;

        const { banned } = await recordViolation(this._userId, this._ip);
        if (banned) {
            this.ws.close(1008, "Banned for accessing restricted content");
        }
    }
}

const GOOGLE_URL =
    "https://clients1.google.com/complete/search?hl=en&output=toolbar&q=";

initBannedDomains().catch(err =>
    console.error("Failed to load banned domains list:", err),
);

setupSchoolDistricts().catch(err =>
    console.error("Failed to setup school districts:", err),
);

if (process.env.REVERSE_PROXY) {
    app.set("trust proxy", 1);
}
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

app.use("/health", (_req, res) => res.json({ ok: true }));

function isPrivateHost(hostname: string): boolean {
    const h = hostname.toLowerCase();
    if (
        h === "localhost" ||
        h === "127.0.0.1" ||
        h === "::1" ||
        h.endsWith(".local") ||
        h.endsWith(".internal")
    ) {
        return true;
    }
    return (
        /^10\./.test(h) ||
        /^192\.168\./.test(h) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
        /^169\.254\./.test(h) ||
        /^127\./.test(h) ||
        /^0\./.test(h) ||
        /^fc00:/i.test(h) ||
        /^fe80:/i.test(h)
    );
}

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

function extractSessionToken(req: Request): string | undefined {
    const bearer = req.headers.authorization?.replace("Bearer ", "");
    return (
        bearer ??
        req.headers.cookie
            ?.split(";")
            .find(c => c.trim().startsWith("better-auth.session_token="))
            ?.split("=")[1]
            ?.trim()
    );
}

app.post("/api/violations", async (req, res) => {
    const token = extractSessionToken(req);
    if (!token) return void res.status(401).json({ ok: false });

    const session = await auth.api
        .getSession({
            headers: new Headers({
                cookie: `better-auth.session_token=${token}`,
                authorization: `Bearer ${token}`,
            }),
        })
        .catch(() => null);
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
    const token = extractSessionToken(req);

    if (!token) {
        return res.json({
            authenticated: false,
            banned: false,
            violations: 0,
            maxViolations: 5,
        });
    }

    const session = await auth.api
        .getSession({
            headers: new Headers({
                cookie: `better-auth.session_token=${token}`,
                authorization: `Bearer ${token}`,
            }),
        })
        .catch(() => null);

    if (!session?.user) {
        return res.json({
            authenticated: false,
            banned: false,
            violations: 0,
            maxViolations: 5,
        });
    }

    const user = session.user;
    const rawUser = await redis
        .get(`wisp:violations:${user.id}`)
        .catch(() => null);
    const ip = extractClientIp(req);
    const rawIp = ip
        ? await redis.get(`wisp:violations:ip:${ip}`).catch(() => null)
        : null;
    const violations = Math.max(
        parseInt(rawUser ?? "0", 10),
        parseInt(rawIp ?? "0", 10),
    );

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

const rammerheadReverseProxy = Boolean(process.env.REVERSE_PROXY) || false;

process.removeAllListeners("uncaughtException");

const rammerhead = createRammerhead({
    reverseProxy: rammerheadReverseProxy,
});

const bare = createBareServer("/bare/");

app.use((req, res, next) => {
    if (RammerheadRouting.shouldRoute(req)) {
        RammerheadRouting.routeRequest(rammerhead, req, res);
    } else if (bare.shouldRoute(req)) {
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

app.use(toNodeHandler(ssrHandler));

function shouldRouteWisp(req: Request) {
    return req.url?.endsWith("/wisp/");
}

logging.set_level(logging.ERROR);

server.on("upgrade", async (req: Request, socket: Socket, head: Buffer) => {
    try {
        if (RammerheadRouting.shouldRoute(req)) {
            RammerheadRouting.routeUpgrade(rammerhead, req, socket, head);
        } else if (bare.shouldRoute(req)) {
            bare.routeUpgrade(req, socket, head).catch(console.error);
        } else if (shouldRouteWisp(req)) {
            const token =
                req.headers.authorization?.replace("Bearer ", "") ||
                req.headers.cookie
                    ?.split(";")
                    .find(c =>
                        c.trim().startsWith("better-auth.session_token="),
                    )
                    ?.split("=")[1]
                    ?.trim();
            const session = token
                ? await cached(
                      sessionKey(token),
                      () =>
                          auth.api.getSession({
                              headers: new Headers({
                                  cookie: `better-auth.session_token=${token}`,
                                  authorization: `Bearer ${token}`,
                              }),
                          }),
                      60,
                  ).catch(() => null)
                : null;
            const userId =
                (session?.user as { id?: string } | undefined)?.id ?? null;

            if (userId && (await isUserBanned(userId))) {
                socket.write(
                    "HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n",
                );
                socket.destroy();
                return;
            }

            const connOpts = {
                wisp_version:
                    req.headers["sec-websocket-protocol"] &&
                    wisp.options.wisp_version === 2
                        ? 2
                        : 1,
            };

            const clientIp = extractClientIp(req);

            wispWss.handleUpgrade(req, socket, head, ws => {
                const conn = new TrackedWispConnection(
                    ws,
                    req.url!,
                    userId,
                    clientIp,
                    connOpts,
                );
                conn.setup()
                    .then(() => conn.run())
                    .catch(console.error);
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
