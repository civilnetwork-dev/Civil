import { clientOnly } from "@solidjs/start";
import { createRootRoute, Outlet } from "@tanstack/solid-router";
import { Suspense } from "solid-js";
import { ContextMenuProvider } from "~/components/ContextMenu";

const Devtools = import.meta.env.DEV
    ? clientOnly(() => import("../components/Devtools"))
    : () => null;

export const Route = createRootRoute({
    component: RootComponent,
});

function RootComponent() {
    return (
        <ContextMenuProvider>
            <Suspense>
                <Outlet />
                <Devtools />
            </Suspense>
        </ContextMenuProvider>
    );
}
