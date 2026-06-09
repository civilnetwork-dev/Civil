import { createHandler, StartServer } from "@solidjs/start/server";
import { For } from "solid-js";
import { router } from "./router";

const proxyScripts = [
    "/wasm_dencode.js",
    "/baremux/index.js",
    "/uv/uv.bundle.js",
    "/uv_config.js",
    "/uv/uv.sw.js",
    "/scramjet/scramjet.js",
    "/scramjetController/controller.api.js",
    "/scramjet_init.js",
];

export default createHandler(() => (
    <StartServer
        document={({ assets, children, scripts }) => {
            const isProxy = ["/", "/newtab"].includes(
                router.state.location.pathname,
            );
            return (
                <html lang="en">
                    <head>
                        <meta charset="utf-8" />
                        <meta
                            name="viewport"
                            content="width=device-width, initial-scale=1"
                        />
                        <link rel="icon" href="/favicon.ico" />
                        {isProxy && (
                            <For each={proxyScripts}>
                                {path => <script defer src={path()} />}
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
));
