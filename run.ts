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
    initBannedDomains,
    isUserBanned,
    matchBannedDomain,
    redis,
    sessionKey,
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
import { createGoGuardianKeysRouter } from "./misc/goguardian-keys/api";
import { createSchoolDistrictsRouter } from "./misc/school-districts/api";
import { setupSchoolDistricts } from "./misc/school-districts/setup";

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
            /^\/[a-z0-9]{32}/.test(url.pathname)
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
// import { useLanSchoolMiddleware } from "./misc/filters/lanschool/air/middleware";
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

class TrackedWispConnection extends wisp.ServerConnection {
    private _userId: string | null;

    constructor(
        ws: unknown,
        path: string,
        userId: string | null,
        opts?: unknown,
    ) {
        super(ws, path, opts);
        this._userId = userId;
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

        const key = `wisp:violations:${this._userId}`;
        const count = await redis.incr(key);
        await redis.expire(key, 86400);

        if (count >= 5) {
            await banUser(
                this._userId,
                "Repeatedly accessed restricted domains via proxy",
            );
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

app.use("/api/check-banned", (req, res) => {
    const url = req.query.url as string | undefined;
    if (!url) return res.json({ banned: false });
    const matched = matchBannedDomain(url);
    return res.json({ banned: matched !== null });
});

app.use("/api/violations", async (req, res) => {
    const bearer = req.headers.authorization?.replace("Bearer ", "");
    const token =
        bearer ??
        req.headers.cookie
            ?.split(";")
            .find(c => c.trim().startsWith("better-auth.session_token="))
            ?.split("=")[1]
            ?.trim();

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
    const raw = await redis.get(`wisp:violations:${user.id}`).catch(() => null);

    return res.json({
        authenticated: true,
        banned: Boolean(user.isBanned),
        banReason: user.banReason ?? null,
        bannedAt: user.bannedAt ?? null,
        violations: parseInt(raw ?? "0", 10),
        maxViolations: 5,
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

            wispWss.handleUpgrade(req, socket, head, ws => {
                const conn = new TrackedWispConnection(
                    ws,
                    req.url!,
                    userId,
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
