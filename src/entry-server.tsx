import { renderToStream } from "@solidjs/web";
import { createMemoryHistory } from "@tanstack/solid-router";
import manifest from "virtual:solid-manifest";

import App from "./app";
import Document from "./Document";
import { createRouter } from "./router";

/**
 * Each request renders with its own router, pointed at its own path and
 * resolved before rendering, so the server renders the route the client will
 * hydrate (see router.tsx for why one shared router could not). Document is
 * handed the same path to decide whether to ship the proxy scripts.
 *
 * `/src/entry-client.tsx` is the authored-entry convention: the plugin's
 * handler rewrites that path to the hashed client entry in a production
 * build.
 */
export async function render(request: Request) {
    const url = new URL(request.url);

    const router = createRouter(
        createMemoryHistory({
            initialEntries: [url.href.replace(url.origin, "")],
        }),
    );

    await router.load();

    return renderToStream(
        () => (
            <Document
                pathname={router.state.location.pathname}
                scripts={
                    <script type="module" async src="/src/entry-client.tsx" />
                }
            >
                <App router={router} />
            </Document>
        ),
        { manifest },
    );
}
