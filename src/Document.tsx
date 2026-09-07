import { HydrationScript, type JSX } from "@solidjs/web";
import { For } from "solid-js";

import { router } from "./router";

/**
 * Proxy runtime scripts. Only the two routes that actually host a proxied
 * frame pay for them; every other route would download the transports and
 * never open a connection.
 */
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

/**
 * The whole document is what gets hydrated, so both entries render this same
 * tree - the server through `renderToStream`, the client through `hydrate`.
 * Anything that exists on only one side goes through `props.scripts`, a
 * trailing slot in `<head>`: the client passes nothing, and because the slot
 * is last it shifts no positional hydration claim ahead of it.
 *
 * `<!DOCTYPE html>` is prepended by the plugin's handler, not rendered here.
 */
export default function Document(props: {
    children?: JSX.Element;
    scripts?: JSX.Element;
}) {
    const isProxy = ["/", "/newtab"].includes(router.state.location.pathname);

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
                    <For each={proxyScripts} keyed={false}>
                        {path => <script defer src={path()} />}
                    </For>
                )}
                <HydrationScript />
                {props.scripts}
            </head>
            <body>
                <div id="app">{props.children}</div>
            </body>
        </html>
    );
}
