import { createFileRoute } from "@tanstack/solid-router";
import BanPage from "~/components/BanPage";

export const Route = createFileRoute("/ban")({
    validateSearch: (search: Record<string, unknown>) => ({
        reason: typeof search.reason === "string" ? search.reason : "",
    }),
    component: RouteComponent,
});

function RouteComponent() {
    const search = Route.useSearch();
    return <BanPage banReason={search().reason} />;
}
