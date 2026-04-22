import { clientOnly } from "@solidjs/start";
import { createFileRoute } from "@tanstack/solid-router";

const AppsPage = clientOnly(() => import("~/components/AppsPage.tsx"));

export const Route = createFileRoute("/apps")({
    component: RouteComponent,
});

function RouteComponent() {
    return <AppsPage />;
}
