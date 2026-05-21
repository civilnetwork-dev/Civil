import { Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { createFileRoute } from "@tanstack/solid-router";

const ExtensionsPage = clientOnly(
    () => import("~/components/ExtensionsPage.tsx"),
);

export const Route = createFileRoute("/extensions")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <>
            <Title>Extensions | Civil Proxy</Title>
            <Meta
                name="description"
                content="Manage and install extensions to enhance your Civil Proxy experience."
            />
            <ExtensionsPage />
        </>
    );
}
