// @refresh reload
import { mount, StartClientTanstack } from "@solidjs/start/client";

if (window.location.host === "civil.quartinal.me") {
    const { default: posthog } = await import("posthog-js");

    posthog.init("phc_s9hZNR8XnWnFGHTCSJEZv79HL4hiFqCiRrVXKVboAU2f", {
        api_host: "https://us.i.posthog.com",
        defaults: "2026-05-30",
    });
}

mount(() => <StartClientTanstack />, document.getElementById("app")!);
