// @refresh reload

import type { FetchEvent } from "@solidjs/start/server";
import { createHandler, StartServer } from "@solidjs/start/server";
import { createMemoryHistory } from "@tanstack/solid-router";
import { For } from "solid-js";
import { router } from "./router";

const routerLoad = async (event: FetchEvent) => {
    const url = new URL(event.request.url);
    const path = url.href.replace(url.origin, "");

    router.update({
        history: createMemoryHistory({
            initialEntries: [path],
        }),
    });

    await router.load();
};

const proxyScripts = [
    "/wasm_dencode.js",
    "/uv/uv.bundle.js",
    "/uv_config.js",
    "/uv/uv.sw.js",
    "/scramjet/scramjet.all.js",
    "/scramjet_init.js",
];

export default createHandler(
    () => (
        <StartServer
            document={({ assets, children, scripts }) => {
                const isProxy = ["/", "/newtab"].includes(
                    router.state.location.pathname,
                );

                return (
                    <html lang="en">
                        <head>
                            <title>Civil Proxy</title>
                            <meta charset="utf-8" />
                            <meta
                                name="viewport"
                                content="width=device-width, initial-scale=1"
                            />
                            <meta
                                name="description"
                                content="Ditch those useless blocker annoyances with Civil, an open-source and quite original proxy solution. Get your hands on some of the world's most fun and personalized experiences with our built-in apps, games, features, and tooling! It's your web proxy."
                            />
                            <meta
                                name="keywords"
                                content="Unblocking, Proxy, Securly, Iboss, Blocksi, Litespeed, GoGuardian"
                            />
                            <link rel="icon" href="/favicon.ico" />
                            {isProxy && <script src="/baremux/index.js" />}
                            {isProxy && (
                                <For each={proxyScripts}>
                                    {path => <script defer src={path} />}
                                </For>
                            )}
                            {assets}
                        </head>
                        <body>
                            <div id="app">{children}</div>
                            {scripts}
                        </body>
                    </html>
                );
            }}
        />
    ),
    undefined,
    routerLoad,
);
