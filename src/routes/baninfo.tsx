import { Meta, Title } from "@solidjs/meta";
import { createFileRoute } from "@tanstack/solid-router";
import { clientOnly } from "~/lib/clientOnly";

const BanInfoPage = clientOnly(() => import("~/components/BanInfoPage"));

export const Route = createFileRoute("/baninfo")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <>
            <Title>Ban Information | Civil Proxy</Title>
            <Meta
                name="description"
                content="Information about restrictions and ban policies on Civil Proxy."
            />
            <BanInfoPage />
        </>
    );
}
