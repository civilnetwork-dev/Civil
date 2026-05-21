import { Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { createFileRoute } from "@tanstack/solid-router";

const Browser = clientOnly(() => import("~/components/BrowserChrome.tsx"));

export const Route = createFileRoute("/")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <main>
            <Title>Civil Proxy</Title>
            <Meta
                name="description"
                content="Ditch those useless blocker annoyances with Civil, an open-source and quite original proxy solution. Get your hands on some of the world's most fun and personalized experiences with our built-in apps, games, features, and tooling! It's your web proxy."
            />
            <Meta
                name="keywords"
                content="Unblocking, Proxy, Securly, Iboss, Blocksi, Lightspeed, GoGuardian"
            />
            <Browser />
        </main>
    );
}
