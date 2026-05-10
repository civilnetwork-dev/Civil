import { clientOnly } from "@solidjs/start";
import { createFileRoute } from "@tanstack/solid-router";

const BanPage = clientOnly(() => import("~/components/BanPage"));

export const Route = createFileRoute("/ban")({
    validateSearch: (search: Record<string, unknown>) => ({
        reason: typeof search.reason === "string" ? search.reason : "",
    }),
    component: RouteComponent,
});

function RouteComponent() {
    const { reason } = Route.useSearch()();
    return <BanPage banReason={reason} />;
}
