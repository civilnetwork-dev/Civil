import { clientOnly } from "@solidjs/start";
import { createFileRoute } from "@tanstack/solid-router";

const BookmarksPage = clientOnly(() => import("~/components/BookmarksPage"));

export const Route = createFileRoute("/bookmarks")({
    component: RouteComponent,
});

function RouteComponent() {
    return <BookmarksPage />;
}
