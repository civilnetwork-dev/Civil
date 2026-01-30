import type { Socket } from "node:net";
import compression from "compression";
import type { Request, Response } from "express";
import express from "express";
//@ts-expect-error
import createRammerhead from "rammerhead/src/server.js";
import { createBareServer } from "@tomphttp/bare-server-node";
import httpProxy from "http-proxy-middleware";
//@ts-expect-error
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import chalk from "chalk";
import boxen from "boxen";
import isDocker from "is-docker";
import terminalLink from "terminal-link";
import type { ServeStaticOptions } from "serve-static";
import type { RammerheadScopes } from "../rammerhead";
import type { Options as BareServerOptions } from "@tomphttp/bare-server-node/dist/BareServer";
import { localForagePath } from "../localForagePath.js";
import { htermPath } from "hterm-path";
import type { SearchEngines } from "~/comet";
import axios from "axios";
import type { AstroIntegration } from "astro";

const rammerheadScopes = [
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
] as RammerheadScopes;

const rammerheadSession = /^\/[a-z0-9]{32}/;

function shouldRouteRammerhead(req: Request) {
  const url = new URL(req.url, "http://0.0.0.0");
  return (
    rammerheadScopes.includes(url.pathname) ||
    rammerheadSession.test(url.pathname)
  );
}

function routeRammerheadRequest(
  rammerhead: createRammerhead,
  req: Request,
  res: Response,
) {
  rammerhead.emit("request", req, res);
}

function routeRammerheadUpgrade(
  rammerhead: createRammerhead,
  req: Request,
  socket: Socket,
  head: any,
) {
  rammerhead.emit("upgrade", req, socket, head);
}

/**
 * determines whether to route wisp
 * @param req the request to check on
 * @param endingUrl the wisp url (optional)
 */
function shouldRouteWisp(req: Request, endingUrl?: string) {
  return req.url?.endsWith(endingUrl || "/wisp/");
}

interface DevServerOptions {
  reverseProxy?: boolean;
}

export default function createDevServer(
  options: DevServerOptions = {},
): AstroIntegration {
  return {
    name: "custom-dev-server",
    hooks: {
      "astro:server:setup": ({ server }) => {
        const bareOptions = {
          maintainer: {
            email: "prehistorical.dinosaurs@outlook.com",
            website: "https://www.quartinal.com",
          },
        } as BareServerOptions;

        const rammerhead = createRammerhead({
          reverseProxy: options.reverseProxy || false,
        });

        const bare = createBareServer("/bare/", bareOptions);

        const staticOptions = {
          setHeaders: (res, path) => {
            if (path.endsWith(".cjs")) {
              res.setHeader(
                "Content-Type",
                "application/javascript; charset=utf-8",
              );
            }
          },
        } satisfies ServeStaticOptions<Response<any, Record<string, any>>>;

        const app = express();

        app.use(compression());

        app.use(
          "/localforage/",
          express.static(localForagePath, staticOptions),
        );
        app.use("/hterm/", express.static(htermPath, staticOptions));

        const gproxy = httpProxy.createProxyMiddleware({
          target: "https://radon.games/cdn",
          changeOrigin: true,
        });
        app.use("/games/", gproxy);

        app.use("/favicon/", async (req, res) => {
          try {
            const { url, size } = req.query;
            const response = await fetch(
              `https://www.google.com/s2/favicons?domain=${url}&sz=${size ? size : 128}`,
            );
            const buffer = Buffer.from(await response.arrayBuffer());
            res.set("Content-Type", "image/png");
            res.send(buffer);
          } catch {
            res.sendStatus(500);
          }
        });

        app.get("/suggestions/bing/", async (req, res) => {
          try {
            const query = req.query.q;

            if (!query || typeof query !== "string") {
              return res
                .status(400)
                .json({ error: 'Query parameter "q" is required' });
            }

            const BING_API_URL = "https://www.bingapis.com/api/v7/suggestions";
            const APP_ID = "6D0A9B8C5100E9ECC7E11A104ADD76C10219804B";

            const response = await axios.get<SearchEngines.Bing>(BING_API_URL, {
              params: {
                appid: APP_ID,
                q: query,
              },
            });

            const suggestions =
              response.data.suggestionGroups[0]?.searchSuggestions
                .map(suggestion => suggestion.displayText)
                .slice(0, 6);

            res.json(suggestions);
          } catch (_) {
            res.status(500).json({ error: "Failed to fetch suggestions" });
          }
        });

        app.use((req, res, next) => {
          if (bare.shouldRoute(req)) {
            bare.routeRequest(req, res);
          } else if (shouldRouteRammerhead(req)) {
            routeRammerheadRequest(rammerhead, req, res);
          } else next();
        });

        server.middlewares.use(app);

        const httpServer = server.httpServer!;

        httpServer.on("upgrade", (req: Request, socket: Socket, head) => {
          if (bare.shouldRoute(req)) {
            bare.routeUpgrade(req, socket, head);
          } else {
            if (shouldRouteWisp(req)) {
              wisp.routeRequest(req, socket, head);
              wisp.options.hostname_blacklist = [
                /pornhub\.com/,
                /xvideos\.com/,
                /hentaiheaven\.com/,
                /xhamster\.com/,
                /youporn\.com/,
                /men\.com/,
              ];
            } else if (shouldRouteRammerhead(req)) {
              routeRammerheadUpgrade(rammerhead, req, socket, head);
            } else {
              socket.end();
            }
          }
        });
      },
      "astro:server:start": ({ address }) => {
        if (!isDocker()) {
          console.log(
            "\n" +
              chalk.gray(
                "Using Rammerhead with" +
                  (address.port
                    ? " a reverse proxy configuration setup"
                    : "out a reverse proxy configuration setup"),
              ) +
              "\n\n" +
              chalk.whiteBright("Server listening on port ") +
              chalk.green(String(address.port)) +
              "\n\n" +
              boxen(chalk.bold.gray("INFO"), {
                backgroundColor: "blue",
                borderColor: "blueBright",
                width: 12,
                height: 5,
                padding: 1,
                textAlignment: "center",
              }) +
              "\n\n" +
              chalk.blueBright("Framework: Astro " + chalk.bold.yellow(":3")) +
              "\n\n" +
              chalk.hex("#f1f1f1").bold("Credits") +
              "\n\n" +
              terminalLink(
                "mercury workshop",
                "https://github.com/MercuryWorkshop",
              ) +
              "\n" +
              terminalLink(
                "titanium network",
                "https://github.com/titaniumnetwork-dev",
              ) +
              "\n",
          );
        }
      },
    },
  };
}
