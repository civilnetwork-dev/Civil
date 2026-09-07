// @refresh reload
import { hydrate } from "@solidjs/web";

import { extensionsSyncExternalKeys } from "~/api/extensions";

import App from "./app";
import Document from "./Document";

extensionsSyncExternalKeys();

window.addEventListener("__civilDebug", (e: Event) => {
    console.log((e as CustomEvent).detail);
});

// A tab left open across a deploy still holds the old chunk hashes; the first
// lazy route or stylesheet it asks for is gone and the page dies with a
// blank pane. Vite reports that as `vite:preloadError`. Reloading picks up
// the new manifest; the timestamp keeps a persistently failing chunk from
// reloading in a loop.
window.addEventListener("vite:preloadError", e => {
    const key = "civil:preload-reload-at";
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(key, String(Date.now()));
    e.preventDefault();
    window.location.reload();
});

if (window.location.host === "civil.quartinal.me") {
    const { default: posthog } = await import("posthog-js");

    // Capture goes through a same-origin path this app proxies to PostHog, so
    // ad blockers cannot tell it from any other app request. The path must
    // match POSTHOG_PROXY_PREFIX in misc/analytics/posthogProxy.ts. ui_host
    // keeps toolbar and links pointing at the real PostHog UI.
    posthog.init("phc_s9hZNR8XnWnFGHTCSJEZv79HL4hiFqCiRrVXKVboAU2f", {
        api_host: `${window.location.origin}/api/relay`,
        ui_host: "https://us.posthog.com",
        defaults: "2026-05-30",
    });
}

hydrate(
    () => (
        <Document>
            <App />
        </Document>
    ),
    document,
);
