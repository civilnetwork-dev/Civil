import { MetaProvider } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import {
    createRootRoute,
    Outlet,
    useRouterState,
} from "@tanstack/solid-router";
import {
    createEffect,
    createSignal,
    createTrackedEffect,
    Loading,
    onSettled,
    Show,
} from "solid-js";
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
    createEffect(
        () => undefined,
        () => {
            void (async () => {
                try {
                    const sessionRes = await fetch("/api/auth/get-session");
                    const session = await sessionRes.json();
                    if (!session) {
                        await fetch("/api/auth/sign-in/anonymous", {
                            method: "POST",
                        });
                    }
                } catch {}
            })();
        },
    );

    onSettled(() => {
        void (async () => {
            try {
                const locRes = await fetch("/api/ip-location");
                if (!locRes.ok) return;
                const { lat, lon } = (await locRes.json()) as {
                    lat: number;
                    lon: number;
                };

                const latKey = lat.toFixed(2);
                const lonKey = lon.toFixed(2);

                const storedLat = localStorage.getItem("civil:district:lat");
                const storedLon = localStorage.getItem("civil:district:lon");
                if (storedLat === latKey && storedLon === lonKey) return;

                const distRes = await fetch(
                    `/api/school-districts/nearest?lat=${lat}&lon=${lon}`,
                );
                if (!distRes.ok) return;
                const { leaId, name, distanceKm } = (await distRes.json()) as {
                    leaId: string;
                    name: string;
                    distanceKm: number;
                };

                localStorage.setItem("civil:district:lat", latKey);
                localStorage.setItem("civil:district:lon", lonKey);

                if (window.location.host === "civil.quartinal.me") {
                    const { default: posthog } = await import("posthog-js");
                    posthog.capture("school_district_detected", {
                        lea_id: leaId,
                        district_name: name,
                        distance_km: Math.round(distanceKm),
                        $set: {
                            school_district_lea_id: leaId,
                            school_district_name: name,
                        },
                    });
                }
            } catch {}
        })();
    });

    return (
        <MetaProvider>
            <ContextMenuProvider>
                <RouterLoadingAnimation />
                <Loading>
                    <Outlet />
                    <Devtools />
                </Loading>
            </ContextMenuProvider>
        </MetaProvider>
    );
}
