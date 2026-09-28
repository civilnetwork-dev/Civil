// @refresh reload
import { hydrate } from "@solidjs/web";

import { extensionsSyncExternalKeys } from "~/api/extensions";
import { onLsChange } from "~/lib/reactiveStorage";
import { getSetting, needsSetup, SETTINGS } from "~/lib/settings";

import App from "./app";
import Document from "./Document";
import { createRouter } from "./router";

// A first-time visitor opening the browser goes through setup first. Sent
// before hydration, so the browser never starts behind it (registering the
// service worker, opening a tab, saving a session that would mark the
// visitor as returning).
if (window.location.pathname === "/" && window.top === window && needsSetup()) {
    window.location.replace("/setup");
    await new Promise(() => {});
}

// Every document (each internal page is its own, inside a tab's frame) takes
// the motion preference from the root element; global.css.ts does the rest.
const applyMotion = () => {
    document.documentElement.dataset.motion = getSetting("motion");
};
applyMotion();
onLsChange(SETTINGS.motion.key, applyMotion);

extensionsSyncExternalKeys();

window.addEventListener("__civilDebug", (e: Event) => {
    console.log((e as CustomEvent).detail);
});

// A tab left open across a deploy still holds the old chunk hashes; the first
// lazy route, script, or stylesheet it asks for is gone and the page dies
// with a blank pane. Vite reports a stale JS chunk as `vite:preloadError`,
// but a stale CSS preload instead throws "Unable to preload CSS for ..."
// directly — no dedicated event, seen live and unhandled on /ban (session
// replay: a stale chunk hash from BanPage's own last deploy). Both mean the
// same thing, so both reload; the timestamp keeps a persistently failing
// chunk from reloading in a loop.
function reloadForStaleChunk(): void {
    const key = "civil:preload-reload-at";
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
}

function isStaleCssPreload(message: string | undefined): boolean {
    return message?.startsWith("Unable to preload CSS for ") ?? false;
}

window.addEventListener("vite:preloadError", e => {
    e.preventDefault();
    reloadForStaleChunk();
});

// Vite's CSS preload failure isn't a `vite:preloadError` — it's a plain
// thrown error from the injected `<link>`'s own handler, so it has to be
// caught generically. Only the exact known message triggers a reload; any
// other error is left alone to propagate and be reported as normal.
window.addEventListener("error", e => {
    if (!isStaleCssPreload(e.message)) return;
    e.preventDefault();
    reloadForStaleChunk();
});
window.addEventListener("unhandledrejection", e => {
    const message = e.reason instanceof Error ? e.reason.message : undefined;
    if (!isStaleCssPreload(message)) return;
    e.preventDefault();
    reloadForStaleChunk();
});

/**
 * PostHog runs only while the analytics setting allows it. Settings lives in
 * a tab's frame, so a change arrives here as a storage event: turning
 * analytics off opts this document's PostHog out at once (PostHog's own
 * opt-out, which also stops session recording), and turning it back on opts
 * in again or starts it. A document that opens with analytics off never
 * downloads PostHog at all.
 */
let analyticsStarted = false;

async function applyAnalytics(): Promise<void> {
    if (!getSetting("analytics") && !analyticsStarted) return;
    const { default: posthog } = await import("posthog-js");
    if (!getSetting("analytics")) {
        posthog.opt_out_capturing();
        return;
    }
    if (!analyticsStarted) {
        analyticsStarted = true;
        startPostHog(posthog);
    }
    // An opt-out persists in PostHog's own storage across visits.
    if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing();
}

function startPostHog(posthog: typeof import("posthog-js").default): void {
    // Capture goes through a same-origin path this app proxies to PostHog, so
    // ad blockers cannot tell it from any other app request. The path must
    // match POSTHOG_PROXY_PREFIX in misc/analytics/posthogProxy.ts. ui_host
    // keeps toolbar and links pointing at the real PostHog UI.
    posthog.init("phc_s9hZNR8XnWnFGHTCSJEZv79HL4hiFqCiRrVXKVboAU2f", {
        api_host: `${window.location.origin}/api/relay`,
        ui_host: "https://us.posthog.com",
        defaults: "2026-05-30",
        // Two exception classes seen in production error tracking are real
        // but not actionable, and this is where to drop them rather than
        // silently swallowing them earlier (autocapture still sees and
        // handles them normally; only the *report* is skipped):
        //  - epoxy's own WASM runtime (src/lib/transport.ts's failover
        //    order) throws this the instant a stale closure fires
        //    after the transport has already died and been rotated away
        //    from. The user-facing side of that is already handled by that
        //    same rotation's retry/fallback UI (the load watchdog in
        //    src/lib/useIframeManager.ts); re-reporting the WASM's own
        //    internal panic on top of that is just noise.
        //  - PostHog's own session-replay recorder (rrweb) walks into the
        //    sandboxed Scramjet proxy frame and gets the exact SecurityError
        //    a real cross-origin frame would throw — an intentional
        //    boundary the proxy's whole design depends on, not a bug.
        before_send: event => {
            if (event?.event !== "$exception") return event;
            const values = event.properties.$exception_values;
            const isKnownBenign =
                Array.isArray(values) &&
                values.some(
                    v =>
                        typeof v === "string" &&
                        (v.includes(
                            "closure invoked recursively or after being dropped",
                        ) ||
                            v.includes("from accessing a cross-origin frame")),
                );
            return isKnownBenign ? null : event;
        },
    });
}

if (window.location.host === "civil.quartinal.me") {
    await applyAnalytics();
    onLsChange(SETTINGS.analytics.key, () => void applyAnalytics());
}

// The entry is an async module, so a cached copy can run while the server's
// stream is still arriving. Hydration walks the whole document (Document ends
// in the emboss `<svg>`), and against a half-parsed one it reads `firstChild`
// of a node that isn't there yet: the page throws and a tab's frame stays
// empty. Wait for the parser only; DOMContentLoaded would also wait on the
// deferred proxy scripts.
if (document.readyState === "loading") {
    await new Promise(resolve =>
        document.addEventListener("readystatechange", resolve, { once: true }),
    );
}

const router = createRouter();

hydrate(
    () => (
        <Document pathname={router.state.location.pathname}>
            <App router={router} />
        </Document>
    ),
    document,
);
