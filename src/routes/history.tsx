import { Meta, Title } from "@solidjs/meta";
import { createFileRoute } from "@tanstack/solid-router";
import { clientOnly } from "~/lib/clientOnly";

const HistoryPage = clientOnly(() => import("~/components/HistoryPage.tsx"));

export const Route = createFileRoute("/history")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <>
            <Title>History | Civil Proxy</Title>
            <Meta
                name="description"
                content="View your browsing history in Civil Proxy."
            />
            <HistoryPage />
        </>
    );
}
