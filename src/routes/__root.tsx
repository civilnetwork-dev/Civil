import { clientOnly } from "@solidjs/start";
import {
    createRootRoute,
    Outlet,
    useRouterState,
} from "@tanstack/solid-router";
import { createSignal, createTrackedEffect, Loading, Show } from "solid-js";
import { ContextMenuProvider } from "~/components/ContextMenu";
import LoadingAnimation from "~/components/LoadingAnimation";

const Devtools = import.meta.env.DEV
    ? clientOnly(() => import("~/components/Devtools"))
    : () => null;

export const Route = createRootRoute({
    component: RootComponent,
});

const EXIT_DURATION = 600;

function RouterLoadingAnimation() {
    const isPending = useRouterState({ select: s => s.status === "pending" });

    const [mounted, setMounted] = createSignal(false);

    createTrackedEffect(() => {
        const pending = isPending();

        if (!pending) {
            const t = setTimeout(() => setMounted(false), EXIT_DURATION);
            return () => clearTimeout(t);
        }

        setMounted(true);
    });

    return (
        <Show when={mounted()}>
            <LoadingAnimation />
        </Show>
    );
}

function RootComponent() {
    return (
        <ContextMenuProvider>
            <RouterLoadingAnimation />
            <Loading>
                <Outlet />
                <Devtools />
            </Loading>
        </ContextMenuProvider>
    );
}
