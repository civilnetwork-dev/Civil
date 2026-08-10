import type { DocumentComponentProps, FetchEvent } from "@solidjs/start/server";
import { createHandler, StartServer } from "@solidjs/start/server";
import { createMemoryHistory } from "@tanstack/solid-router";
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

// StartServer's `document` prop is typed against @solidjs/start's own nested
// solid-js copy's Component/JSX.Element - a different type identity than the
// app's top-level solid-js/@solidjs/web (see src/lib/clientOnly.ts for the
// same boundary on route components). Typing the params explicitly here keeps
// the function body itself fully checked; only the hand-off needs the cast.
function renderDocument({ assets, children, scripts }: DocumentComponentProps) {
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
                {assets}
            </head>
            <body>
                <div id="app">{children}</div>
                {scripts}
            </body>
        </html>
    );
}

// The router is a module singleton, so on the server it carries whatever
// location the previous request left behind. Point it at this request's path
// and let it resolve the match before rendering - otherwise SSR renders a
// different route than the client hydrates, which leaves the server's markup
// stranded in the DOM next to a second, client-rendered copy. `isProxy` above
// reads the same state, so it needs this too.
const routerLoad = async (event: FetchEvent) => {
    const url = new URL(event.request.url);

    router.update({
        history: createMemoryHistory({
            initialEntries: [url.href.replace(url.origin, "")],
        }),
    });

    await router.load();
};

export default createHandler(
    (() => <StartServer document={renderDocument as any} />) as any,
    undefined,
    routerLoad,
);
