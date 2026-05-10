import { clientOnly } from "@solidjs/start";
import { createRouter as createTanstackSolidRouter } from "@tanstack/solid-router";
import { routeTree } from "./routeTree.gen";

export const router = createTanstackSolidRouter({
    defaultErrorComponent: err => <div>{err.error.stack}</div>,
    defaultNotFoundComponent: clientOnly(
        () => import("~/components/NotFound.tsx"),
    ),
    routeTree,
    defaultPreload: "intent",
    defaultStaleTime: 5000,
    scrollRestoration: true,
});
