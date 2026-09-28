import { createSignal, For, onSettled } from "solid-js";

import * as s from "~/styles/LoadingAnimation.css";

/**
 * The mark's C, on its own 16-unit grid — the same path the favicon draws.
 *
 * A literal rather than a shared export: `Wordmark` draws the full lockup on a
 * 376-unit canvas, and this screen needs the C alone with its node animated.
 * Two consumers, two shapes — the only thing they share is the path string, and
 * a constant exported for one caller is not reuse.
 */
const MARK_C =
    "M14.74 5.28H11.24C10.64 4.16 9.55 3.58 8 3.58C5.49 3.58 4.19 5.08 4.19 8C4.19 10.92 5.49 12.42 8 12.42C9.55 12.42 10.64 11.84 11.24 10.72H14.74C14.07 13.76 12.01 15 8 15C2.96 15 1 13.04 1 8C1 2.96 2.96 1 8 1C12.01 1 14.07 2.24 14.74 5.28Z";

/**
 * Nodes arriving along the route. Three is enough to read as a stream and few
 * enough that none of them collide in the mouth.
 *
 * Their stagger is a literal fraction of the cycle rather than a computed
 * offset: this screen server-side renders, and anything derived at render time
 * risks drawing differently on the server pass than the client one.
 */
const NODES = [0, 1, 2];

/** One pass of a node from outside the mouth to absorbed at the stem. */
const CYCLE_MS = 2400;

export default function LoadingAnimation() {
    const [visible, setVisible] = createSignal(true);
    const [liveStatus, setLiveStatus] = createSignal<string | null>(
        "Loading...",
    );

    const formatResource = (url: string): string => {
        try {
            const u = new URL(url, window.location.href);
            return u.pathname.split("/").pop() || u.hostname;
        } catch {
            return url;
        }
    };

    const isExternal = (url: string): boolean => {
        try {
            return (
                new URL(url, window.location.href).host !== window.location.host
            );
        } catch {
            return false;
        }
    };

    /**
     * Everything torn down when this screen goes away, collected as it is set
     * up and released by the function this returns.
     *
     * `onSettled` must **return** its cleanup; calling `onCleanup` inside it
     * throws `CLEANUP_IN_FORBIDDEN_SCOPE` in Solid 2.0, and because the throw
     * happens during the effect run it halts the reactive system for the whole
     * root — "no further updates will be processed". This screen mounts on
     * every cold load, so that was every cold load. It never surfaced because
     * the halt is reported to the console rather than thrown to the caller, and
     * the loader looks identical either way: the artwork was a canvas driving
     * itself, and the status text stops updating on a screen that is about to
     * be replaced anyway.
     */
    onSettled(() => {
        const teardown: (() => void)[] = [];
        let aborted = false;
        let liveTimer: ReturnType<typeof setTimeout> | undefined;

        const pushLive = (text: string) => {
            // Registration may start during component creation in Solid 2.
            // Report it after that owned scope, without interrupting setup.
            queueMicrotask(() => {
                if (aborted) return;
                setLiveStatus(text);
                setVisible(true);
                clearTimeout(liveTimer);
                liveTimer = setTimeout(() => setLiveStatus(null), 1600);
            });
        };

        const tracked = new Set([
            "script",
            "fetch",
            "xmlhttprequest",
            "link",
            "css",
            "beacon",
        ]);
        let perfObserver: PerformanceObserver | undefined;
        if (typeof PerformanceObserver !== "undefined") {
            perfObserver = new PerformanceObserver(list => {
                for (const entry of list.getEntries()) {
                    const res = entry as PerformanceResourceTiming;
                    if (res.initiatorType && !tracked.has(res.initiatorType)) {
                        continue;
                    }
                    const verb = isExternal(res.name) ? "Fetching" : "Loading";
                    pushLive(`${verb} ${formatResource(res.name)}...`);
                }
            });
            try {
                perfObserver.observe({ type: "resource", buffered: true });
            } catch {}
        }

        let restoreRegister: (() => void) | undefined;
        const swContainer =
            typeof navigator !== "undefined"
                ? navigator.serviceWorker
                : undefined;
        if (swContainer) {
            void swContainer.getRegistrations().then(regs => {
                for (const reg of regs) {
                    const active = reg.installing ?? reg.waiting ?? reg.active;
                    if (active && active.state !== "activated") {
                        pushLive(`Registering ${reg.scope}...`);
                    }
                }
            });

            const onControllerChange = () =>
                pushLive("Service worker activated...");
            swContainer.addEventListener(
                "controllerchange",
                onControllerChange,
            );

            const originalRegister = swContainer.register.bind(swContainer);
            try {
                swContainer.register = ((
                    scriptURL: string | URL,
                    options?: RegistrationOptions,
                ) => {
                    pushLive(
                        `Registering ${formatResource(String(scriptURL))}...`,
                    );
                    return originalRegister(scriptURL, options);
                }) as typeof swContainer.register;
                restoreRegister = () => {
                    swContainer.register = originalRegister;
                };
            } catch {}

            teardown.push(() => {
                swContainer.removeEventListener(
                    "controllerchange",
                    onControllerChange,
                );
                restoreRegister?.();
            });
        }

        return () => {
            aborted = true;
            clearTimeout(liveTimer);
            perfObserver?.disconnect();
            for (const release of teardown) release();
        };
    });

    return (
        <div class={s.loadingContainer}>
            {/* Nodes first, then the C over them: the letter's own material is
                what hides the route, so it surfaces only in the mouth and the
                counter. Reordering these two blocks makes the nodes float over
                the glyph and the whole idea disappears. */}
            <svg class={s.loadingMark} viewBox="0 0 16 16" aria-hidden="true">
                <For each={NODES}>
                    {i => (
                        <rect
                            class={s.loadingMarkNode}
                            x="11.24"
                            y="6.8"
                            width="3.5"
                            height="2.4"
                            style={{
                                "animation-delay": `${
                                    (i * CYCLE_MS) / NODES.length
                                }ms`,
                            }}
                        />
                    )}
                </For>
                <path class={s.loadingMarkDepth} d={MARK_C} />
                <path class={s.loadingMarkC} d={MARK_C} />
            </svg>
            <div class={s.loadingStatusWrapper}>
                <span
                    class={[
                        s.loadingStatus,
                        {
                            [s.loadingStatusShown]: visible(),
                            [s.loadingStatusHidden]: !visible(),
                        },
                    ]}
                >
                    {liveStatus() ?? "Loading..."}
                </span>
            </div>
        </div>
    );
}
