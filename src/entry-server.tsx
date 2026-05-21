import { createHandler, StartServer } from "@solidjs/start/server";
import { For } from "solid-js";
import { router } from "./router";

const proxyScripts = [
    "/wasm_dencode.js",
    "/uv/uv.bundle.js",
    "/uv_config.js",
    "/uv/uv.sw.js",
    "/scramjet/scramjet.all.js",
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
                        <meta
                            name="monetag"
                            content="f94d7876b7e462cd4c58ca3c9f3b3c7c"
                        />
                        <link rel="icon" href="/favicon.ico" />
                        {isProxy && <script src="/baremux/index.js" />}
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
