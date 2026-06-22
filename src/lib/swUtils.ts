import * as BareMux from "@mercuryworkshop/bare-mux";

type SwRequestMessage = {
    type: "CHECK_FILTERS";
};

type SwResponseMessage =
    | {
          type: "CHECK_FILTERS_RESULT";
          filters: string[];
      }
    | {
          type: "CHECK_FILTERS_ERROR";
          message: string;
      };

function isProductionHost(): boolean {
    return window.location.host === "civil.quartinal.me";
}

async function waitForServiceWorkerController(
    registration: ServiceWorkerRegistration,
): Promise<ServiceWorker> {
    if (navigator.serviceWorker.controller) {
        return navigator.serviceWorker.controller;
    }

    if (registration.active) {
        return registration.active;
    }

    return new Promise<ServiceWorker>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
            reject(
                new Error("Timed out waiting for service worker controller."),
            );
        }, 5_000);

        navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => {
                window.clearTimeout(timeout);

                const controller = navigator.serviceWorker.controller;
                if (controller) resolve(controller);
                else
                    reject(
                        new Error("Service worker controller was unavailable."),
                    );
            },
            { once: true },
        );
    });
}

function trackFilterInformation(data: SwResponseMessage): void {
    if (data.type === "CHECK_FILTERS_RESULT") {
        if (isProductionHost()) {
            window.posthog?.capture("Filter information", {
                filters: data.filters,
            });
        }

        localStorage.setItem("detectedFilters", JSON.stringify(data.filters));
        window.dispatchEvent(
            new CustomEvent("detectedFiltersUpdated", {
                detail: data.filters,
            }),
        );

        return;
    }

    if (isProductionHost()) {
        window.posthog?.captureException(data.message);
    }

    localStorage.setItem("detectedFilters", JSON.stringify([]));
    window.dispatchEvent(
        new CustomEvent("detectedFiltersUpdated", { detail: [] }),
    );
}

async function requestFilterCheck(
    registration: ServiceWorkerRegistration,
): Promise<void> {
    const worker = await waitForServiceWorkerController(registration);

    const message: SwRequestMessage = {
        type: "CHECK_FILTERS",
    };

    worker.postMessage(message);
}

async function registerSw(): Promise<void> {
    if (!("serviceWorker" in navigator)) {
        console.log(
            "Service workers are not supported, so interception proxies will not work.",
        );
        console.log("Setting proxy to rammerhead.");
        localStorage.setItem("proxy", "rammerhead");
        return;
    }

    try {
        navigator.serviceWorker.addEventListener(
            "message",
            (event: MessageEvent<SwResponseMessage>) => {
                trackFilterInformation(event.data);
            },
        );

        const registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
        });

        registration.onupdatefound = () => {
            registration.update().catch(error => {
                console.error("Service worker update failed:", error);
            });
        };

        await navigator.serviceWorker.ready;
        await requestFilterCheck(registration);
    } catch (error) {
        console.error("Service worker registration failed:", error);
    }
}

async function setupBareMux(): Promise<void> {
    const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
    const bareServerUrl = `${location.origin}/bare/`;

    async function setTransport(): Promise<void> {
        await connection.setTransport("/baremuxTransport/index.mjs", [
            bareServerUrl,
        ]);
    }

    await setTransport();

    const channel = new BroadcastChannel("bare-mux");

    channel.addEventListener("message", async (event: MessageEvent) => {
        if (event.data?.type !== "refreshPort") return;

        try {
            await setTransport();
        } catch (error) {
            console.error("Failed to refresh BareMux transport:", error);
        }
    });
}

export { registerSw, setupBareMux };
