import { Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/web";
import { createFileRoute } from "@tanstack/solid-router";

const SetupPage = clientOnly(() => import("~/components/SetupPage.tsx"));

export const Route = createFileRoute("/setup")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <>
            <Title>Set up Civil | Civil Proxy</Title>
            <Meta
                name="description"
                content="Choose how Civil Proxy searches, connects and remembers, or let it pick for you."
            />
            <SetupPage />
        </>
    );
}
