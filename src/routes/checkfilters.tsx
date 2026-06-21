import { Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/checkfilters")({
    component: RouteComponent,
});

const FilterCheckPage = clientOnly(
    () => import("~/components/FilterCheckPage"),
);

function RouteComponent() {
    return (
        <>
            <Title>Filter Check | Civil Proxy</Title>
            <Meta
                name="description"
                content="Test whether a URL is blocked by your school's web filter."
            />
            <FilterCheckPage />
        </>
    );
}
