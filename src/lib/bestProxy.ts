import { isProbablyUrl } from "~/lib/browserHelpers";

export interface BestProxy {
    proxy: "scramjet";
    transport: "epoxy" | "libcurl" | "bare";
    wispVersion: 1 | 2;
    score?: number;
    cached?: boolean;
}

// Fired around a first-visit probe so UI can show a brief "finding best proxy"
// hint. `detail.pending` is true when a probe is running, false when done.
const BEST_PROXY_EVENT = "civil:best-proxy";

function emit(pending: boolean, host?: string): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent(BEST_PROXY_EVENT, { detail: { pending, host } }),
    );
}

function toProbeUrl(term: string): string | null {
    if (!isProbablyUrl(term)) return null; // search query, not a site
    try {
        return new URL(
            /^[a-z][\w+.-]*:\/\//i.test(term) ? term : `https://${term}`,
        ).href;
    } catch {
        return null;
    }
}

export async function fetchBestProxy(
    term: string,
    timeoutMs = 1500,
): Promise<BestProxy | null> {
    const probeUrl = toProbeUrl(term);
    if (!probeUrl) return null;

    let host: string | undefined;
    try {
        host = new URL(probeUrl).hostname;
    } catch {}

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    emit(true, host);
    try {
        const res = await fetch(
            `/api/best-proxy?url=${encodeURIComponent(probeUrl)}`,
            { signal: controller.signal },
        );
        if (!res.ok) return null;
        const data = (await res.json()) as BestProxy;
        // A pre-removal cache/DB row can still say "uv" (misc/database/
        // models/siteProxy.ts's proxy column has no DB-level enum); the
        // server already self-heals that case instead of serving it, but
        // guard here too rather than trust that unconditionally.
        if (data.proxy !== "scramjet") return null;
        return data;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
        emit(false, host);
    }
}

function waitFrameLoad(
    frame: HTMLIFrameElement,
    timeoutMs: number,
): Promise<void> {
    return new Promise<void>(resolve => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            frame.removeEventListener("load", finish);
            resolve();
        };
        const timer = setTimeout(finish, timeoutMs);
        frame.addEventListener("load", finish, { once: true });
    });
}

type ProbedWindow = Window & {
    __civilConsoleErrors?: number;
    __civilRewriterErrors?: number;
    __civilFailedRequests?: number;
};

type CompatSample = {
    checks: boolean[];
    consoleErrors: number;
    rewriterErrors: number;
    failedRequests: number;
};

/**
 * Does the page look rendered: reachable, loaded, titled, with real text?
 * Throws for a frame it can't read, which sampleFrame treats as no verdict.
 */
function renderChecks(w: ProbedWindow | null, d: Document | null): boolean[] {
    const href = w?.location?.href ?? "";
    const apis = !!(
        w &&
        "fetch" in w &&
        "localStorage" in w &&
        "history" in w &&
        "URL" in w
    );
    return [
        !!w, // window reachable
        !!d, // document reachable
        d?.readyState === "complete", // finished loading
        (d?.body?.childElementCount ?? 0) > 0, // rendered DOM
        (d?.body?.innerText ?? "").trim().length > 20, // real content
        !!d?.title, // title set (page identity survived rewrite)
        !!href && href !== "about:blank", // location not garbled/blank
        apis, // core platform APIs present under the proxy
    ];
}

/**
 * Every render check passes on a proxy error page or a bot challenge — both
 * render a complete, titled document with real text — so an outright
 * failure would otherwise score 100%. Both have to be caught by content.
 */
function contentChecks(d: Document | null): boolean[] {
    const text = (d?.body?.innerText ?? "").trim();
    const title = (d?.title ?? "").trim();
    return [
        !/^(error|not found|problem loading|can'?t reach|failed|access denied|forbidden|blocked|403|404|5\d{2} )/i.test(
            title,
        ) &&
            !/error (code )?\d{3}/i.test(text.slice(0, 400)) &&
            text.length > 60, // not a proxy error page
        !/^(just a moment|attention required|verifying you are human|checking your browser)/i.test(
            title,
        ) &&
            !/cf-browser-verification|cf_chl_|challenge-platform/.test(
                d?.documentElement?.innerHTML?.slice(0, 4000) ?? "",
            ), // origin served the site, not a bot challenge
    ];
}

/** What the loaded frame shows, or null when it can't be read. */
function sampleFrame(frame: HTMLIFrameElement): CompatSample | null {
    try {
        const w = frame.contentWindow as ProbedWindow | null;
        const d = frame.contentDocument;
        // Touch location first; a genuinely cross-origin-locked frame throws
        // here and we bail out rather than report a false failure.
        void w?.location?.href;
        return {
            // Error counts installed at document_start by the SW error counter.
            consoleErrors: Number(w?.__civilConsoleErrors ?? 0),
            rewriterErrors: Number(w?.__civilRewriterErrors ?? 0),
            failedRequests: Number(w?.__civilFailedRequests ?? 0),
            checks: [...renderChecks(w, d), ...contentChecks(d)],
        };
    } catch {
        return null;
    }
}

/**
 * Base compat from render/platform checks, then penalize proxy errors so the
 * finder prefers the proxy with the fewest rewriter errors AND fewest failed
 * (non-OK) requests on load. Rewriter-tagged errors + failed requests weigh
 * more than generic console errors.
 */
function compatScore(sample: CompatSample): number {
    const { checks, rewriterErrors, failedRequests, consoleErrors } = sample;
    const passed = checks.filter(Boolean).length;
    const renderCompat = Math.round((passed / checks.length) * 100);
    const penalty = Math.min(
        70,
        rewriterErrors * 8 +
            failedRequests * 5 +
            Math.max(0, consoleErrors - rewriterErrors) * 2,
    );
    return Math.max(0, renderCompat - penalty);
}

export async function measureAndReportCompat(
    frame: HTMLIFrameElement,
    term: string,
    transport: string | undefined,
): Promise<void> {
    const probeUrl = toProbeUrl(term);
    if (!probeUrl) return;

    await waitFrameLoad(frame, 8000);
    // Let client-side JS render before sampling.
    await new Promise(r => setTimeout(r, 1200));

    const sample = sampleFrame(frame);
    if (!sample) return;
    const { consoleErrors, rewriterErrors, failedRequests } = sample;

    try {
        await fetch("/api/best-proxy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                url: probeUrl,
                proxy: "scramjet",
                transport,
                compat: compatScore(sample),
                consoleErrors,
                rewriterErrors,
                failedRequests,
            }),
            keepalive: true,
        });
    } catch {}
}
