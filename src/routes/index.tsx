import { Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/web";
import { createFileRoute } from "@tanstack/solid-router";
import { onSettled } from "solid-js";

const Browser = clientOnly(() => import("~/components/BrowserChrome.tsx"));

export const Route = createFileRoute("/")({
    component: RouteComponent,
});

function RouteComponent() {
    onSettled(() => {
        // Preview the app without loading production advertising in development.
        if (import.meta.env.DEV) return;
        const ippScript = document.createElement("script");
        const nativeScript = document.createElement("script");

        ippScript.async = true;
        ippScript.src =
            "https://ss.mrmnd.com/static/5b2c8f79-d86d-4662-97a4-d489f053bf3e.js";

        document.head.appendChild(ippScript);

        nativeScript.async = true;
        nativeScript.src = "https://ss.mrmnd.com/native.js";

        return () => {
            ippScript.remove();
            nativeScript.remove();
        };
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
            <Browser />
        </main>
    );
}
