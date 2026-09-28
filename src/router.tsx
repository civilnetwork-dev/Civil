import { clientOnly } from "@solidjs/web";
import {
    createRouter as createTanstackSolidRouter,
    type RouterHistory,
} from "@tanstack/solid-router";

import { routeTree } from "./routeTree.gen";

const NotFound = clientOnly(() => import("~/components/NotFound.tsx"));

/**
 * A router for one render. The server builds one per request, on that
 * request's URL: requests overlap (restoring a session loads every tab's page
 * at once), and one shared router was re-pointed by the next request while
 * this one awaited `load()`, so it rendered the other request's route. The
 * client builds one, on the browser's history.
 */
export function createRouter(history?: RouterHistory) {
    return createTanstackSolidRouter({
        history,
        defaultErrorComponent: err => <div>{err.error.stack}</div>,
        defaultNotFoundComponent: NotFound,
        routeTree,
        defaultPreload: "intent",
        defaultStaleTime: 5000,
        scrollRestoration: true,
    });
}
