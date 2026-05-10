// @refresh reload
import { mount, StartClientTanstack } from "@solidjs/start/client";

if (window.location.host === "civil.quartinal.me") {
    const tracker = document.createElement("script");
    tracker.defer = true;
    tracker.src = "https://analytics.quartinal.click/script";
    tracker.setAttribute(
        "data-website-id",
        "ad7085e3-0e42-4335-9f02-bd2fdaf29627",
    );
    tracker.setAttribute("data-domains", window.location.host);
    document.head.appendChild(tracker);

    const recorder = document.createElement("script");
    recorder.defer = true;
    recorder.src = "https://analytics.quartinal.click/recorder.js";
    recorder.setAttribute(
        "data-website-id",
        "ad7085e3-0e42-4335-9f02-bd2fdaf29627",
    );
    recorder.setAttribute("data-sample-rate", "0.1");
    recorder.setAttribute("data-mask-level", "strict");
    recorder.setAttribute("data-max-duration", "300000");
    document.head.appendChild(recorder);

    const { init: initSentry } = await import("@sentry/browser");

    initSentry({
        dsn: "https://48e816cc594a46f095646f7c95f41af5@reporting.quartinal.me/1",
        release: "civil@0.0.0",
        sendDefaultPii: true,
        tracesSampleRate: 0,
    });
}

mount(() => <StartClientTanstack />, document.getElementById("app")!);
