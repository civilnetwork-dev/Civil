import { Meta, Title } from "@solidjs/meta";
import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/about")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <main>
            <Title>About | Civil Proxy</Title>
            <Meta
                name="description"
                content="Learn about Civil Proxy — an open-source web proxy built for speed, privacy, and freedom."
            />
            <h1>This isn't finished yet. It will be soon!</h1>
        </main>
    );
}
