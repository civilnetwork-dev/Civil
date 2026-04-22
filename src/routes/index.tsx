import { clientOnly } from "@solidjs/start";
import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import LoadingAnimation from "~/components/LoadingAnimation";

const Browser = clientOnly(() => import("~/components/BrowserChrome.tsx"));

export const Route = createFileRoute("/")({
    component: RouteComponent,
});

const MIN_DURATION = 2000;
const MAX_DURATION = 5000;
const EXIT_DURATION = 600;

function TimedLoadingAnimation() {
    const [overlayVisible, setOverlayVisible] = createSignal(true);
    const [mounted, setMounted] = createSignal(true);

    onMount(() => {
        let unmountTimeout: ReturnType<typeof setTimeout>;

        const exit = () => {
            clearTimeout(minTimeout);
            clearTimeout(maxTimeout);
            setOverlayVisible(false);
            unmountTimeout = setTimeout(() => setMounted(false), EXIT_DURATION);
        };

        const minTimeout = setTimeout(exit, MIN_DURATION);
        const maxTimeout = setTimeout(exit, MAX_DURATION);

        onCleanup(() => {
            clearTimeout(minTimeout);
            clearTimeout(maxTimeout);
            clearTimeout(unmountTimeout);
        });
    });

    return (
        <Show when={mounted()}>
            <div
                style={{
                    opacity: overlayVisible() ? "1" : "0",
                    transition: `opacity ${EXIT_DURATION}ms cubic-bezier(0.86, 0, 0.07, 1)`,
                }}
            >
                <LoadingAnimation />
            </div>
        </Show>
    );
}

function RouteComponent() {
    onMount(async () => {
        await import("~/lib/initializeAnalytics.ts");
    });

    return (
        <>
            <TimedLoadingAnimation />
            <main>
                <Browser />
            </main>
        </>
    );
}
