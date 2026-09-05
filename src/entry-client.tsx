// @refresh reload
import { mount, StartClientTanstack } from "@solidjs/start/client";
import { extensionsSyncExternalKeys } from "~/api/extensions";

extensionsSyncExternalKeys();

window.addEventListener("__civilDebug", (e: Event) => {
    console.log((e as CustomEvent).detail);
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

mount((() => <StartClientTanstack />) as any, document.getElementById("app")!);
