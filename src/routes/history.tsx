import { clientOnly } from "@solidjs/start";
import { createFileRoute } from "@tanstack/solid-router";

const HistoryPage = clientOnly(() => import("~/components/HistoryPage.tsx"));

export const Route = createFileRoute("/history")({
    component: RouteComponent,
});

function RouteComponent() {
    return <HistoryPage />;
}
