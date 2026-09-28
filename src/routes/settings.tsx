import { Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/web";
import { createFileRoute } from "@tanstack/solid-router";

const SettingsPage = clientOnly(() => import("~/components/SettingsPage.tsx"));

export const Route = createFileRoute("/settings")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <>
            <Title>Settings | Civil Proxy</Title>
            <Meta
                name="description"
                content="Choose how Civil Proxy searches, connects and keeps your history."
            />
            <SettingsPage />
        </>
    );
}
