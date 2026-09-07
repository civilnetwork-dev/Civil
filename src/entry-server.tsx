import { renderToStream } from "@solidjs/web";
import { createMemoryHistory } from "@tanstack/solid-router";
import manifest from "virtual:solid-manifest";

import App from "./app";
import Document from "./Document";
import { router } from "./router";

/**
 * The router is a module singleton, so on the server it carries whatever
 * location the previous request left behind. Point it at this request's path
 * and let it resolve the match before rendering - otherwise SSR renders a
 * different route than the client hydrates, which leaves the server's markup
 * stranded in the DOM next to a second, client-rendered copy. Document reads
 * the same state to decide whether to ship the proxy scripts, so it needs
 * this too.
 *
 * `/src/entry-client.tsx` is the authored-entry convention: the plugin's
 * handler rewrites that path to the hashed client entry in a production
 * build.
 */
export async function render(request: Request) {
    const url = new URL(request.url);

    router.update({
        history: createMemoryHistory({
            initialEntries: [url.href.replace(url.origin, "")],
        }),
    });

    await router.load();

    return renderToStream(
        () => (
            <Document
                scripts={
                    <script type="module" async src="/src/entry-client.tsx" />
                }
            >
                <App />
            </Document>
        ),
        { manifest },
    );
}
