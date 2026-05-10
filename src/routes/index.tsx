import { clientOnly } from "@solidjs/start";
import { createFileRoute } from "@tanstack/solid-router";

const Browser = clientOnly(() => import("~/components/BrowserChrome.tsx"));

export const Route = createFileRoute("/")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <main>
            <Browser />
        </main>
    );
}
