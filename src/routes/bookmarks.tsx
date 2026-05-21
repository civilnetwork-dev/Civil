import { Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { createFileRoute } from "@tanstack/solid-router";

const BookmarksPage = clientOnly(() => import("~/components/BookmarksPage"));

export const Route = createFileRoute("/bookmarks")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <>
            <Title>Bookmarks | Civil Proxy</Title>
            <Meta
                name="description"
                content="Your saved bookmarks in Civil Proxy."
            />
            <BookmarksPage />
        </>
    );
}
