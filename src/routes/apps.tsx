import { Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { createFileRoute } from "@tanstack/solid-router";

const AppsPage = clientOnly(() => import("~/components/AppsPage.tsx"));

export const Route = createFileRoute("/apps")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <>
            <Title>Apps | Civil Proxy</Title>
            <Meta
                name="description"
                content="Browse Civil's built-in apps and games for a personalized web experience."
            />
            <AppsPage />
        </>
    );
}
