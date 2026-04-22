import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { start as startChii } from "chii";
import compression from "compression";
import express from "express";

import createRammerhead from "rammerhead";

const transportModulePrefix = "node_modules/@mercuryworkshop";
const { epoxyPath, libcurlPath, baremodulePath } = {
    epoxyPath: resolve(
        import.meta.dirname,
        transportModulePrefix,
        "epoxy-transport/dist",
    ),
    libcurlPath: resolve(
        import.meta.dirname,
        transportModulePrefix,
        "libcurl-transport/dist",
    ),
    baremodulePath: resolve(
        import.meta.dirname,
        transportModulePrefix,
        "bare-as-module3/dist",
    ),
};

import type {
    IncomingMessage as Request,
    ServerResponse as Response,
    Server,
} from "node:http";
import type { Socket } from "node:net";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { logging, server as wisp } from "@mercuryworkshop/wisp-js/server";
import { createBareServer } from "@tomphttp/bare-server-node";
import { XMLParser } from "fast-xml-parser";
import { WebSocketServer } from "ws";
import xior from "xior";

import packageJson from "./package.json" with { type: "json" };

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

    static routeRequest(rammerhead: Server, req: Request, res: Response) {
        rammerhead.emit("request", req, res);
    }

    static routeUpgrade(
        rammerhead: Server,
        req: Request,
        socket: Socket,
        head: any,
    ) {
        rammerhead.emit("upgrade", req, socket, head);
    }
}

import { $ } from "bun";

import { createColors } from "picocolors";

const { yellow, blue } = createColors();

const build = () => $`bunx ${packageJson.scripts.build}`;

if (
    !(
        existsSync(resolve(import.meta.dirname, ".vinxi")) ||
        existsSync(resolve(import.meta.dirname, ".output"))
    )
) {
    console.log(yellow("no build found, building..."));
    build();
}

const app = express();
const server = createServer((req, res) => {
    if (req.url?.startsWith("/chii/") || req.url === "/chii") return;
    app(req, res);
});
await startChii({
    server,
    basePath: "/chii/",
});

const wss = new WebSocketServer({ noServer: true });

const GOOGLE_URL =
    "https://clients1.google.com/complete/search?hl=en&output=toolbar&q=";
const PORT = Number(process.env.PORT) || 9876;

app.use(compression());

const servicePathMaps: Record<string, string> = {
    "/uv": uvPath,
    "/scramjet": scramjetPath,
    "/epoxy": epoxyPath,
    "/libcurl": libcurlPath,
    "/baremod": baremodulePath,
    "/baremux": baremuxPath,
};

Object.entries(servicePathMaps).forEach(([route, path]) => {
    app.use(route, express.static(path));
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
        bare.routeRequest(req, res);
    } else {
        next();
    }
});

const { handler: ssrHandler } = await import("./.output/server/index.mjs");

app.use(express.static(resolve(import.meta.dirname, ".output/public")));
app.use(express.static(resolve(import.meta.dirname, ".output/public/_build")));
app.use(express.static(resolve(import.meta.dirname, "dist")));

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

app.use(ssrHandler);

function shouldRouteWisp(req: Request, endingUrl?: string) {
    return req.url?.endsWith(endingUrl || "/wisp/");
}

logging.set_level(logging.ERROR);

server.on("upgrade", (req: Request, socket: Socket, head) => {
    if (RammerheadRouting.shouldRoute(req)) {
        RammerheadRouting.routeUpgrade(rammerhead, req, socket, head);
    } else if (bare.shouldRoute(req)) {
        bare.routeUpgrade(req, socket, head);
    } else if (shouldRouteWisp(req)) {
        wisp.routeRequest(req, socket, head);
    } else if (req.url?.endsWith("/suggestions")) {
        wss.handleUpgrade(req, socket, head, ws => {
            wss.emit("connection", ws, req);
        });
    } else {
        socket.destroy();
    }
});

server.listen(PORT, () => {
    console.log(blue(`server is running at http://localhost:${PORT}`));
});
