// @refresh reload
import { mount, StartClientTanstack } from "@solidjs/start/client";
import { extensionsSyncExternalKeys } from "~/api/extensions";

extensionsSyncExternalKeys();

window.addEventListener("__civilDebug", (e: Event) => {
    console.log((e as CustomEvent).detail);
});

if (window.location.host === "civil.quartinal.me") {
    const { default: posthog } = await import("posthog-js");

    posthog.init("phc_s9hZNR8XnWnFGHTCSJEZv79HL4hiFqCiRrVXKVboAU2f", {
        api_host: "https://sybau-adblockers.quartinal.me",
        defaults: "2026-05-30",
    });
}

mount((() => <StartClientTanstack />) as any, document.getElementById("app")!);
