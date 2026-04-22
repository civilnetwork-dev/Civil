import { clientOnly } from "@solidjs/start";
import { createFileRoute } from "@tanstack/solid-router";

const NewTabPage = clientOnly(() => import("~/components/NewTabPage.tsx"));

export const Route = createFileRoute("/newtab")({
    component: RouteComponent,
});

function RouteComponent() {
    return <NewTabPage />;
}
