import { Meta, Title } from "@solidjs/meta";
import { createFileRoute } from "@tanstack/solid-router";
import { clientOnly } from "~/lib/clientOnly";

const NewTabPage = clientOnly(() => import("~/components/NewTabPage.tsx"));

export const Route = createFileRoute("/newtab")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <>
            <Title>New Tab | Civil Proxy</Title>
            <Meta
                name="description"
                content="Your personalized new tab page powered by Civil Proxy."
            />
            <Meta
                name="keywords"
                content="Unblocking, Proxy, Securly, Iboss, Blocksi, Lightspeed, GoGuardian"
            />
            <NewTabPage />
        </>
    );
}
