import { createSignal, onSettled, Show } from "solid-js";

import * as s from "~/styles/NotFound.css";

const PROXY_PREFIXES = ["/~/scramjet/"];

const RETRY_KEY = "__civil_proxy_retry";
const RETRY_TIME_KEY = "__civil_proxy_retry_t";
const MAX_RETRIES = 5;

function proxyRetryCount(): number {
    try {
        const now = Date.now();
        const last = Number(sessionStorage.getItem(RETRY_TIME_KEY) ?? 0);
        if (now - last > 10_000) return 0;
        return Number(sessionStorage.getItem(RETRY_KEY) ?? 0);
    } catch {
        return 0;
    }
}

function shouldSelfHeal(): boolean {
    if (typeof window === "undefined") return false;
    const path = window.location.pathname;
    if (!PROXY_PREFIXES.some(p => path.startsWith(p))) return false;
    return proxyRetryCount() < MAX_RETRIES;
}

async function selfHeal(): Promise<void> {
    try {
        const now = Date.now();
        sessionStorage.setItem(RETRY_KEY, String(proxyRetryCount() + 1));
        sessionStorage.setItem(RETRY_TIME_KEY, String(now));

        if ("serviceWorker" in navigator) {
            await navigator.serviceWorker.register("/sw.js", {
                scope: "/",
                updateViaCache: "none",
            });
            await navigator.serviceWorker.ready;
            if (!navigator.serviceWorker.controller) {
                await new Promise<void>(resolve => {
                    navigator.serviceWorker.addEventListener(
                        "controllerchange",
                        () => resolve(),
                        { once: true },
                    );
                    setTimeout(resolve, 2000);
                });
            }
        }
    } catch {}
    setTimeout(() => window.location.reload(), 300);
}

export default function NotFound() {
    const [healing] = createSignal(shouldSelfHeal());

    onSettled(() => {
        if (healing()) void selfHeal();
    });

    return (
        <Show
            when={!healing()}
            fallback={
                <div class={s.notFoundRoot}>
                    <main class={s.notFoundContent}>
                        <p class={s.notFoundSubtitle}>Reconnecting…</p>
                    </main>
                </div>
            }
        >
            <div class={s.notFoundRoot}>
                <main class={s.notFoundContent}>
                    <h1 class={s.notFoundTitle}>404</h1>
                    <p class={s.notFoundSubtitle}>Page not found.</p>
                    <a class={s.notFoundHomeLink} href="/">
                        Back to home
                    </a>
                </main>
            </div>
        </Show>
    );
}
