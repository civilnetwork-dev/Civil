import { lsSetJSON } from "~/lib/reactiveStorage";
import {
    getSetting,
    isTransport,
    normalizeHost,
    setSetting,
    TRANSPORTS,
    type TransportName,
} from "~/lib/settings";

/**
 * Which transport a proxied navigation uses, decided in one place.
 *
 * In order: a method picked on the connection error page for this frame's
 * next load, a per-site rule, the method a timed-out load failed over to this
 * session, and the user's default method.
 *
 * The failover pick lives here, in memory, rather than only in the stored
 * default. The watchdog used to rotate just the stored `transport` key, which
 * nothing reads until the next page load, so its automatic retry went out on
 * the very transport that had just failed.
 */

const SOURCES = ["retry", "site", "failover", "default"] as const;
export type TransportSource = (typeof SOURCES)[number];

export interface TransportChoice {
    host: string;
    transport: TransportName;
    source: TransportSource;
    at: number;
}

const LAST_KEY = "civil:transport-last";

let failover: TransportName | null = null;
const oneShot = new WeakMap<object, TransportName>();
const used = new WeakMap<
    object,
    { transport: TransportName; source: TransportSource }
>();

const siteRule = (host: string | null) =>
    host ? getSetting("transportSites")[host] : undefined;

/**
 * The key scramjetInit builds a transport under. Only Epoxy has a choice of
 * Wisp version: libcurl bundles a version 1 client and Bare doesn't use Wisp.
 * "epoxy" is the version 1 client Civil always had; "epoxy@2" asks for
 * version 2.
 */
export function transportKey(transport: TransportName): string {
    if (transport !== "epoxy") return transport;
    return getSetting("wispVersion") === "2" ? "epoxy@2" : "epoxy";
}

export function resolveTransport(frame: object, term: string): TransportName {
    const host = normalizeHost(term);
    const once = oneShot.get(frame);
    oneShot.delete(frame);
    const rule = siteRule(host);

    const [transport, source]: [TransportName, TransportSource] = once
        ? [once, "retry"]
        : rule
          ? [rule, "site"]
          : failover
            ? [failover, "failover"]
            : [getSetting("transport"), "default"];

    used.set(frame, { transport, source });
    if (host) {
        try {
            lsSetJSON(LAST_KEY, { host, transport, source, at: Date.now() });
        } catch {}
    }
    return transport;
}

/**
 * After `frame`'s load timed out: the next method to fail over to, or null
 * when the user turned failover off, pinned or hand-picked the method that
 * failed, or there is no method left.
 */
export function rotateFrom(frame: object): TransportName | null {
    if (!getSetting("transportFailover")) return null;
    const last = used.get(frame);
    if (!last || last.source === "site" || last.source === "retry") return null;
    const next = TRANSPORTS[TRANSPORTS.indexOf(last.transport) + 1];
    if (!next) return null;
    failover = next;
    if (getSetting("transportRemember")) setSetting("transport", next);
    return next;
}

/** Use `transport` for `frame`'s next load, whatever the rules say. */
export function retryWith(frame: object, transport: TransportName): void {
    oneShot.set(frame, transport);
}

export function usedTransport(frame: object): TransportName | undefined {
    return used.get(frame)?.transport;
}

/** The most recent decision, for the settings page to show. */
export function lastTransportChoice(): TransportChoice | null {
    try {
        const c = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null");
        if (
            c &&
            typeof c.host === "string" &&
            isTransport(c.transport) &&
            SOURCES.includes(c.source) &&
            Number.isFinite(c.at)
        )
            return c as TransportChoice;
    } catch {}
    return null;
}
