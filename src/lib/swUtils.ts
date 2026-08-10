import * as BareMux from "@mercuryworkshop/bare-mux";
import { getFilters } from "$config/service/filterDetect";

type FilterCheckResult =
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

function trackFilterInformation(data: FilterCheckResult): void {
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

function readDetectedFilters(): string[] {
    try {
        const raw = localStorage.getItem("detectedFilters");
        return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
        return [];
    }
}

async function checkFiltersNow(): Promise<string[]> {
    try {
        const filters = await getFilters();
        trackFilterInformation({ type: "CHECK_FILTERS_RESULT", filters });
        return filters;
    } catch (error) {
        trackFilterInformation({
            type: "CHECK_FILTERS_ERROR",
            message: error instanceof Error ? error.message : String(error),
        });
        return readDetectedFilters();
    }
}

async function registerSw(): Promise<void> {
    if (!("serviceWorker" in navigator)) {
        console.error(
            "Service workers are not supported, so interception proxies will not work. There is no non-service-worker fallback engine.",
        );
        return;
    }

    try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
            updateViaCache: "none",
        });

        await registration.update();

        await navigator.serviceWorker.ready;
        // Detect installed filters in the page (see checkFiltersNow): the page's
        // fetch sees extensions the already-running SW would miss.
        await checkFiltersNow();
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

export { checkFiltersNow, registerSw, setupBareMux };
