import type { SettingKey, SettingValue } from "~/lib/settings";

/**
 * What first-run setup picks for anything the visitor skips, and why, from
 * what the browser says about this device and network. Every pick carries a
 * sentence the summary shows, so nothing is chosen silently.
 *
 * Filters and location are never part of this: Civil already detects both on
 * its own (swUtils.ts and the root route).
 */

export interface SetupPick<K extends SettingKey> {
    value: SettingValue<K>;
    reason: string;
}

export type SetupPicks = { [K in SettingKey]?: SetupPick<K> };

/** Everything the picks depend on, so a test can describe a device. */
export interface SetupEnv {
    userAgent: string;
    brave: boolean;
    /** Do Not Track or Global Privacy Control is on. */
    privacySignal: boolean;
    saveData: boolean;
    effectiveType?: string;
    cores?: number;
    memoryGb?: number;
    reducedMotion: boolean;
    viewportHeight: number;
    /** Bytes this origin may store, when the browser says. */
    quota?: number;
    webSocketWorks: () => Promise<boolean>;
}

type NavigatorExtras = Navigator & {
    brave?: unknown;
    globalPrivacyControl?: boolean;
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
};

const WISP_URL = () =>
    `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/wisp/`;

/**
 * Opens and closes one socket to Civil's own Wisp endpoint. Filters that
 * block WebSockets make Epoxy and libcurl fail, and Bare is the method that
 * still works without one.
 */
function webSocketWorks(timeoutMs = 3000): Promise<boolean> {
    return new Promise(resolve => {
        let socket: WebSocket;
        try {
            socket = new WebSocket(WISP_URL());
        } catch {
            resolve(false);
            return;
        }
        const done = (ok: boolean) => {
            clearTimeout(timer);
            socket.onopen = socket.onerror = socket.onclose = null;
            try {
                socket.close();
            } catch {}
            resolve(ok);
        };
        const timer = setTimeout(() => done(false), timeoutMs);
        socket.onopen = () => done(true);
        socket.onerror = () => done(false);
        socket.onclose = () => done(false);
    });
}

export async function readSetupEnv(): Promise<SetupEnv> {
    const nav = navigator as NavigatorExtras;
    const estimate = await navigator.storage
        ?.estimate?.()
        .catch(() => undefined);
    return {
        userAgent: nav.userAgent,
        brave: Boolean(nav.brave),
        privacySignal:
            nav.doNotTrack === "1" || nav.globalPrivacyControl === true,
        saveData: Boolean(nav.connection?.saveData),
        effectiveType: nav.connection?.effectiveType,
        cores: nav.hardwareConcurrency || undefined,
        memoryGb: nav.deviceMemory,
        reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)")
            .matches,
        viewportHeight: window.innerHeight,
        quota: estimate?.quota,
        webSocketWorks,
    };
}

const GB = 1024 ** 3;

export async function pickSetupDefaults(env: SetupEnv): Promise<SetupPicks> {
    const slow =
        env.saveData ||
        ["slow-2g", "2g", "3g"].includes(env.effectiveType ?? "");
    const light =
        (env.cores !== undefined && env.cores <= 2) ||
        (env.memoryGb !== undefined && env.memoryGb <= 2) ||
        env.saveData;
    const cramped = env.quota !== undefined && env.quota < GB;
    const sockets = await env.webSocketWorks();

    return {
        search: env.brave
            ? {
                  value: "brave",
                  reason: "You use Brave, so Brave Search matches what you're used to.",
              }
            : /\bEdg\//.test(env.userAgent)
              ? {
                    value: "bing",
                    reason: "You use Microsoft Edge, which searches with Bing.",
                }
              : env.privacySignal
                ? {
                      value: "ddg",
                      reason: "Your browser asks sites not to track you, and DuckDuckGo doesn't.",
                  }
                : {
                      value: "google",
                      reason: "The search engine most people know.",
                  },
        suggestLive: env.saveData
            ? {
                  value: false,
                  reason: "Your browser is saving data, so suggestions stay off.",
              }
            : { value: true, reason: "Suggestions help you search faster." },
        transportAuto: {
            value: true,
            reason: "Civil tests each new site and uses what works best.",
        },
        transport: sockets
            ? {
                  value: "epoxy",
                  reason: "This network allows WebSockets, so Civil starts with Epoxy, the fastest method.",
              }
            : {
                  value: "bare",
                  reason: "Civil couldn't open a WebSocket on this network, so it starts with Bare, which doesn't need one.",
              },
        wispVersion: {
            value: "2",
            reason: "Wisp version 2 handles the most sites, with the least delay.",
        },
        navTimeout: slow
            ? {
                  value: 30,
                  reason: "Your connection looks slow, so pages get 30 seconds to load.",
              }
            : {
                  value: 15,
                  reason: "Fifteen seconds is plenty on your connection.",
              },
        historyEnabled: {
            value: true,
            reason: "History lets you find a page again.",
        },
        historyLocation: {
            value: "auto",
            reason: "Civil keeps history wherever there's room and it runs fastest on this device.",
        },
        historyFormat: cramped
            ? {
                  value: "compressed",
                  reason: "This browser has little storage to spare, so history is compressed.",
              }
            : {
                  value: "json",
                  reason: "There's plenty of storage, so history stays in the quickest format.",
              },
        historyDays: cramped
            ? {
                  value: 30,
                  reason: "Storage is tight, so history keeps the last 30 days.",
              }
            : {
                  value: 90,
                  reason: "History keeps the last 90 days, like most browsers.",
              },
        historyWhenFull: {
            value: "trim",
            reason: "If space ever runs out, the oldest pages go first.",
        },
        startup: {
            value: "restore",
            reason: "Your tabs come back when you return.",
        },
        bookmarksBar:
            env.viewportHeight < 700
                ? {
                      value: "newtab",
                      reason: "Your screen is short, so the bookmarks bar only shows on new tabs.",
                  }
                : {
                      value: "always",
                      reason: "There's room on your screen for the bookmarks bar.",
                  },
        motion: env.reducedMotion
            ? { value: "reduce", reason: "Your device asks for less motion." }
            : light
              ? {
                    value: "reduce",
                    reason: "This looks like a lighter device, so animations stay off to keep Civil quick.",
                }
              : {
                    value: "system",
                    reason: "Animations follow your device's setting.",
                },
        compatReports: {
            value: true,
            reason: "Reports help Civil pick the best method for everyone.",
        },
        filterDetect: {
            value: true,
            reason: "Civil checks for filters so it can warn you about them.",
        },
        analytics: {
            value: true,
            reason: "Usage analytics help Civil find and fix problems.",
        },
    };
}
