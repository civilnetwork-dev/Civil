import { clientOnly } from "@solidjs/start";
import { createFileRoute } from "@tanstack/solid-router";

const BanInfoPage = clientOnly(() => import("~/components/BanInfoPage"));

export const Route = createFileRoute("/baninfo")({
    component: RouteComponent,
});

function RouteComponent() {
    return <BanInfoPage />;
}
