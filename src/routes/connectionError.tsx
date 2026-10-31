import { Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/web";
import { createFileRoute } from "@tanstack/solid-router";

const ConnectionErrorPage = clientOnly(
    () => import("~/components/ConnectionErrorPage"),
);

export const Route = createFileRoute("/connectionError")({
    validateSearch: (search: Record<string, unknown>) => ({
        url: typeof search.url === "string" ? search.url : "",
        used: typeof search.used === "string" ? search.used : "",
    }),
    component: RouteComponent,
});

function RouteComponent() {
    const { url, used } = Route.useSearch()();
    return (
        <>
            <Title>Can't connect | Civil Proxy</Title>
            <Meta
                name="description"
                content="Civil's proxy couldn't deliver this page."
            />
            <ConnectionErrorPage url={url} used={used} />
        </>
    );
}
