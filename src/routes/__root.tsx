import { clientOnly } from "@solidjs/web";
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
import { getSetting } from "~/lib/settings";

// Opt-in (VITE_ROUTER_DEVTOOLS=1) rather than on for every dev session: the
// devtools bundle ships its own copy of Solid's DOM runtime, whose delegated
// document listener re-runs every `$$click` handler in this app. One click on
// "New tab" opened two tabs, and nothing in production ever would.
const Devtools =
    import.meta.env.DEV && import.meta.env.VITE_ROUTER_DEVTOOLS
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

/** An anonymous session, so the proxy can record visits and honour an
 *  administrator's ban per account. */
async function ensureSession(): Promise<void> {
    try {
        const sessionRes = await fetch("/api/auth/get-session");
        const session = await sessionRes.json();
        if (!session) {
            await fetch("/api/auth/sign-in/anonymous", {
                method: "POST",
            });
        }
    } catch {}
}

async function reportDistrict(lat: number, lon: number): Promise<void> {
    const distRes = await fetch(
        `/api/schoolDistricts/nearest?lat=${lat}&lon=${lon}`,
    );
    if (!distRes.ok) return;
    const { leaId, name, distanceKm } = (await distRes.json()) as {
        leaId: string;
        name: string;
        distanceKm: number;
    };

    localStorage.setItem("civil:district:lat", lat.toFixed(2));
    localStorage.setItem("civil:district:lon", lon.toFixed(2));

    if (window.location.host === "civil.quartinal.me") {
        window.posthog?.capture("school_district_detected", {
            lea_id: leaId,
            district_name: name,
            distance_km: Math.round(distanceKm),
            $set: {
                school_district_lea_id: leaId,
                school_district_name: name,
            },
        });
    }
}

/** Looks up the school district once per rough location, for analytics. */
async function detectDistrict(): Promise<void> {
    try {
        const locRes = await fetch("/api/ipLocation");
        if (!locRes.ok) return;
        const { lat, lon } = (await locRes.json()) as {
            lat: number;
            lon: number;
        };

        const storedLat = localStorage.getItem("civil:district:lat");
        const storedLon = localStorage.getItem("civil:district:lon");
        if (storedLat === lat.toFixed(2) && storedLon === lon.toFixed(2))
            return;

        await reportDistrict(lat, lon);
    } catch {}
}

function RootComponent() {
    createEffect(
        () => undefined,
        () => {
            void ensureSession();
        },
    );

    onSettled(() => {
        // The district lookup exists only to feed analytics, so it goes
        // when the user turns analytics off.
        if (!getSetting("analytics")) return;
        void detectDistrict();
    });

    return (
        // @solidjs/meta 1.x has no provider - the head registry is ambient.
        <ContextMenuProvider>
            <RouterLoadingAnimation />
            <Loading>
                <Outlet />
                <Devtools />
            </Loading>
        </ContextMenuProvider>
    );
}
