import { Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { createFileRoute } from "@tanstack/solid-router";
import { onSettled } from "solid-js";

const Browser = clientOnly(() => import("~/components/BrowserChrome.tsx"));

export const Route = createFileRoute("/")({
    component: RouteComponent,
});

function RouteComponent() {
    onSettled(() => {
        if (document.getElementById("__civil_deliciouslip__")) return;

        try {
            for (const k of Object.keys(localStorage)) {
                if (k.startsWith("kad") || k.startsWith("__ipcnt")) {
                    localStorage.removeItem(k);
                }
            }
        } catch {}

        const last = document.scripts[document.scripts.length - 1];
        const s = document.createElement("script") as HTMLScriptElement & {
            settings?: Record<string, unknown>;
        };
        s.id = "__civil_deliciouslip__";
        s.settings = {
            freq: {
                pagelim: 10,
                qty: 6,
                period: 86400,
                distance: 90,
                context: "domain",
                max: 0,
            },
            soundOn: false,
        };
        s.src =
            "https://deliciouslip.com/b/XBVjs.d/G/lH0RYqWCcs/OecmJ9GuVZIUflhkAP/Twczw/OXDOc/1aOlTaMRtuNdzEAr4LNcz/U/5TNgwA";
        s.async = true;
        s.referrerPolicy = "no-referrer-when-downgrade";
        last.parentNode!.insertBefore(s, last);
    });

    return (
        <main>
            <Title>Civil Proxy</Title>
            <Meta
                name="description"
                content="Ditch those useless blocker annoyances with Civil, an open-source and quite original proxy solution. Get your hands on some of the world's most fun and personalized experiences with our built-in apps, games, features, and tooling! It's your web proxy."
            />
            <Meta
                name="keywords"
                content={[
                    "Unblocking",
                    "Proxy",
                    "Quartinal",
                    "Civil Proxy",
                    "Securly",
                    "Lightspeed",
                    "GoGuardian",
                    "Iboss",
                    "IBoss",
                    "Blocksi",
                    "YouShallNotPass",
                    "FortiGuard",
                    "Cisco Umbrella",
                    "School",
                    "Chromebooks",
                    "Unblocked Browser",
                    "Filter Checker",
                ].join(", ")}
            />
            <Meta name="admaven-placement" content="BqjkErjk8" />
            <Browser />
        </main>
    );
}
