/** cn<id>-vnsg<id>.ibosscloud.com and the gov/test/staging origins. */
const GATEWAY_HOST_RE =
    /\b((?:cn-?\d+-vnsg\d+|[a-z0-9-]+)\.iboss(?:cloud|gov|test)?(?:-staging)?\.com)\b/i;

/** Hosts that are iboss infrastructure but never a filtering gateway. */
const NON_GATEWAY_HOSTS = new Set([
    "www.iboss.com",
    "iboss.com",
    "accounts.iboss.com",
    "ibossrepo.com",
    "myiboss.net",
]);

export type DetectedIbossGateway = {
    host: string;
    /** Port observed in the timing entry, else the categorization default. */
    port: number;
};

function extractGatewayFromUrl(rawUrl: string): DetectedIbossGateway | null {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return null;
    }

    const host = parsed.hostname.toLowerCase();
    if (NON_GATEWAY_HOSTS.has(host)) return null;
    if (!GATEWAY_HOST_RE.test(host)) return null;

    const port = parsed.port ? Number(parsed.port) : 8026;
    return { host, port: Number.isFinite(port) && port > 0 ? port : 8026 };
}

/** Scan already-recorded Resource/Navigation Timing entries. */
function scanPerformanceEntries(): DetectedIbossGateway | null {
    if (typeof performance === "undefined") return null;

    const entries: PerformanceEntry[] = [
        ...(performance.getEntriesByType?.("resource") ?? []),
        ...(performance.getEntriesByType?.("navigation") ?? []),
    ];

    for (const entry of entries) {
        const found = extractGatewayFromUrl(entry.name);
        if (found) return found;
    }

    return null;
}

/**
 * Load candidate URLs in hidden iframes to provoke a block-page redirect, then
 * rescan timing. Only meaningful when the district uses cloud block pages.
 */
async function activeProbe(
    probeUrls: string[],
    timeoutMs: number,
): Promise<DetectedIbossGateway | null> {
    if (typeof document === "undefined" || probeUrls.length === 0) return null;

    const frames: HTMLIFrameElement[] = [];

    for (const url of probeUrls) {
        const frame = document.createElement("iframe");
        frame.setAttribute("aria-hidden", "true");
        frame.style.cssText =
            "position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;border:0;";
        frame.src = url;
        document.body.appendChild(frame);
        frames.push(frame);
    }

    try {
        const deadline = Date.now() + timeoutMs;
        // Poll timing while frames resolve/redirect.
        while (Date.now() < deadline) {
            const found = scanPerformanceEntries();
            if (found) return found;
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        return scanPerformanceEntries();
    } finally {
        for (const frame of frames) frame.remove();
    }
}

/**
 * Known-good gateway hosts to fall back on when both passive scanning and the
 * contribution toast fail to yield a host. Raced by latency; fastest wins.
 */
export const FALLBACK_IBOSS_GATEWAYS: DetectedIbossGateway[] = [
    { host: "cn-864969941-vnsg13022.ibosscloud.com", port: 8026 },
    { host: "cn1759617341-vnsg10840.ibosscloud.com", port: 8026 },
];

/** Measure ms until a connection to host:port settles; null if unreachable. */
async function timeGateway(
    host: string,
    port: number,
    timeoutMs: number,
): Promise<number | null> {
    if (typeof fetch === "undefined") return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start =
        typeof performance !== "undefined" ? performance.now() : Date.now();

    try {
        // no-cors: we can't read the response, but a reachable host resolves
        // (opaque) while an unreachable one rejects. We only need the timing.
        await fetch(`https://${host}:${port}/`, {
            mode: "no-cors",
            cache: "no-store",
            credentials: "omit",
            signal: controller.signal,
        });
        const end =
            typeof performance !== "undefined" ? performance.now() : Date.now();
        return end - start;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Race candidate gateways and return the one that responds quickest. Used as a
 * last resort when neither scanning nor the toast produced a host.
 */
export async function raceIbossGateways(
    candidates: DetectedIbossGateway[] = FALLBACK_IBOSS_GATEWAYS,
    timeoutMs = 4_000,
): Promise<DetectedIbossGateway | null> {
    const timed = await Promise.all(
        candidates.map(async candidate => ({
            candidate,
            ms: await timeGateway(candidate.host, candidate.port, timeoutMs),
        })),
    );

    const reachable = timed
        .filter(
            (r): r is { candidate: DetectedIbossGateway; ms: number } =>
                r.ms !== null,
        )
        .sort((a, b) => a.ms - b.ms);

    return reachable[0]?.candidate ?? null;
}

export type DetectIbossGatewayOptions = {
    /**
     * URLs to load in hidden iframes to provoke a block redirect. Supply
     * commonly-filtered test targets for the district. Empty = passive only.
     */
    probeUrls?: string[];
    /** Active-probe timeout. Default 3000ms. */
    timeoutMs?: number;
};

/**
 * Returns the district gateway host if it can be observed, else null.
 * Passive scan first; active iframe probe only if `probeUrls` are provided.
 */
export async function detectIbossGateway(
    options: DetectIbossGatewayOptions = {},
): Promise<DetectedIbossGateway | null> {
    const passive = scanPerformanceEntries();
    if (passive) return passive;

    if (options.probeUrls && options.probeUrls.length > 0) {
        return activeProbe(options.probeUrls, options.timeoutMs ?? 3_000);
    }

    return null;
}
