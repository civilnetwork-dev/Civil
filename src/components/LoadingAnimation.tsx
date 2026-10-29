import { createSignal, For, onSettled } from "solid-js";

import * as s from "~/styles/LoadingAnimation.css";

/**
 * The Doorway on its own 16-unit grid, the cells the favicon draws: the stone,
 * cut into courses, and the door its two slabs open by overlapping.
 *
 * Literals rather than shared exports: `Wordmark` draws the full lockup on a
 * 1729-unit canvas, and this screen needs the mark alone with traffic animated
 * through it. Two consumers, two shapes: the only thing they share is the
 * geometry, and a constant exported for one caller is not reuse.
 */
const MARK_STONE =
    "M2 1H10V4.5H2ZM2 5H10A4 4 0 0 0 6.13 8H2ZM10 5H14V8H10ZM2 8.5H6V11.5H2ZM10 8.5H14V11.5H10ZM2 12H6V15H2ZM10 12H14V15H10Z";
const MARK_DOOR = "M6 15V9A4 4 0 0 1 10 5V15Z";

/**
 * Traffic crossing the door. Three is enough to read as a stream and few
 * enough that the door never shows more than two at once.
 *
 * Their stagger is a literal fraction of the cycle rather than a computed
 * offset: this screen server-side renders, and anything derived at render time
 * risks drawing differently on the server pass than the client one.
 */
const NODES = [0, 1, 2];

/** One pass of a node from behind the left pier to behind the right one. */
const CYCLE_MS = 2400;

function formatResource(url: string): string {
    try {
        const u = new URL(url, window.location.href);
        return u.pathname.split("/").pop() || u.hostname;
    } catch {
        return url;
    }
}

function isExternal(url: string): boolean {
    try {
        return new URL(url, window.location.href).host !== window.location.host;
    } catch {
        return false;
    }
}

const TRACKED = new Set([
    "script",
    "fetch",
    "xmlhttprequest",
    "link",
    "css",
    "beacon",
]);

function observeResources(pushLive: (text: string) => void) {
    if (typeof PerformanceObserver === "undefined") return undefined;
    const perfObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
            const res = entry as PerformanceResourceTiming;
            if (res.initiatorType && !TRACKED.has(res.initiatorType)) {
                continue;
            }
            const verb = isExternal(res.name) ? "Fetching" : "Loading";
            pushLive(`${verb} ${formatResource(res.name)}...`);
        }
    });
    try {
        perfObserver.observe({ type: "resource", buffered: true });
    } catch {}
    return perfObserver;
}

function wrapRegister(
    swContainer: ServiceWorkerContainer,
    pushLive: (text: string) => void,
) {
    const originalRegister = swContainer.register.bind(swContainer);
    try {
        swContainer.register = ((
            scriptURL: string | URL,
            options?: RegistrationOptions,
        ) => {
            pushLive(`Registering ${formatResource(String(scriptURL))}...`);
            return originalRegister(scriptURL, options);
        }) as typeof swContainer.register;
        return () => {
            swContainer.register = originalRegister;
        };
    } catch {}
    return undefined;
}

function watchServiceWorker(pushLive: (text: string) => void) {
    const swContainer =
        typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
    if (!swContainer) return undefined;
    void swContainer.getRegistrations().then(regs => {
        for (const reg of regs) {
            const active = reg.installing ?? reg.waiting ?? reg.active;
            if (active && active.state !== "activated") {
                pushLive(`Registering ${reg.scope}...`);
            }
        }
    });

    const onControllerChange = () => pushLive("Service worker activated...");
    swContainer.addEventListener("controllerchange", onControllerChange);

    const restoreRegister = wrapRegister(swContainer, pushLive);

    return () => {
        swContainer.removeEventListener("controllerchange", onControllerChange);
        restoreRegister?.();
    };
}

/**
 * Everything torn down when this screen goes away, collected as it is set
 * up and released by the function this returns.
 *
 * `onSettled` must **return** its cleanup; calling `onCleanup` inside it
 * throws `CLEANUP_IN_FORBIDDEN_SCOPE` in Solid 2.0, and because the throw
 * happens during the effect run it halts the reactive system for the whole
 * root: "no further updates will be processed". This screen mounts on
 * every cold load, so that was every cold load. It never surfaced because
 * the halt is reported to the console rather than thrown to the caller, and
 * the loader looks identical either way: the artwork was a canvas driving
 * itself, and the status text stops updating on a screen that is about to
 * be replaced anyway.
 */
function useLiveStatus() {
    const [visible, setVisible] = createSignal(true);
    const [liveStatus, setLiveStatus] = createSignal<string | null>(
        "Loading...",
    );

    onSettled(() => {
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

        const perfObserver = observeResources(pushLive);
        const releaseServiceWorker = watchServiceWorker(pushLive);

        return () => {
            aborted = true;
            clearTimeout(liveTimer);
            perfObserver?.disconnect();
            releaseServiceWorker?.();
        };
    });

    return { visible, liveStatus };
}

function LoadingMark() {
    return (
        <svg class={s.loadingMark} viewBox="0 0 16 16" aria-hidden="true">
            <path class={s.loadingMarkDoor} d={MARK_DOOR} />
            <For each={NODES}>
                {i => (
                    <rect
                        class={s.loadingMarkNode}
                        x="2"
                        y="9"
                        width="2.5"
                        height="2"
                        style={{
                            "animation-delay": `${
                                (i * CYCLE_MS) / NODES.length
                            }ms`,
                        }}
                    />
                )}
            </For>
            <path class={s.loadingMarkDepth} d={MARK_STONE} />
            <path class={s.loadingMarkStone} d={MARK_STONE} />
        </svg>
    );
}

export default function LoadingAnimation() {
    const { visible, liveStatus } = useLiveStatus();

    return (
        <div class={s.loadingContainer}>
            {/* The lit door, then the nodes, then the stone over them: the
                stone's own material is what hides the traffic, so it surfaces
                only in the door. Painting the stone before the nodes makes them
                float over the wall and the whole idea disappears. */}
            <LoadingMark />
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
