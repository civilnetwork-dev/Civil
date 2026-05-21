import { Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { createFileRoute } from "@tanstack/solid-router";

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
