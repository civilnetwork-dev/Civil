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
        const script = document.createElement("script");
        script.dataset.cfasync = "false";
        script.src = "https://dcbbwymp1bhlf.cloudfront.net/?wbbcd=1361688";
        document.head.appendChild(script);
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
