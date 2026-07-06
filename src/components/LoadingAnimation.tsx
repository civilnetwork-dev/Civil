import { DotLottie } from "@lottiefiles/dotlottie-web";
import { createSignal, onCleanup, onSettled } from "solid-js";
import * as s from "~/styles/LoadingAnimation.css";

interface LoadingAnimationProps {
    iframed?: boolean;
}

export default function LoadingAnimation(_props: LoadingAnimationProps) {
    const [visible, setVisible] = createSignal(true);
    const [liveStatus, setLiveStatus] = createSignal<string | null>(
        "Loading...",
    );
    let containerRef: HTMLDivElement | undefined;

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

    onSettled(() => {
        if (!containerRef) return;

        const anim = new DotLottie({
            autoplay: true,
            loop: true,
            canvas: document.createElement("canvas"),
            src: "/assets/civil-loading.lottie",
        });
        containerRef.appendChild(anim.canvas as Node);

        let aborted = false;
        let liveTimer: ReturnType<typeof setTimeout> | undefined;

        const pushLive = (text: string) => {
            if (aborted) return;
            setLiveStatus(text);
            setVisible(true);
            clearTimeout(liveTimer);
            liveTimer = setTimeout(() => setLiveStatus(null), 1600);
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

            onCleanup(() => {
                swContainer.removeEventListener(
                    "controllerchange",
                    onControllerChange,
                );
                restoreRegister?.();
            });
        }

        onCleanup(() => {
            aborted = true;
            clearTimeout(liveTimer);
            perfObserver?.disconnect();
            anim.destroy();
        });
    });

    return (
        <div class={s.loadingContainer}>
            <div class={s.loadingLottie} ref={containerRef} />
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
