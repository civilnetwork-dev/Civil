import { clientOnly } from "@solidjs/start";
import { createFileRoute } from "@tanstack/solid-router";

const ExtensionsPage = clientOnly(
    () => import("~/components/ExtensionsPage.tsx"),
);

export const Route = createFileRoute("/extensions")({
    component: RouteComponent,
});

function RouteComponent() {
    return <ExtensionsPage />;
}
