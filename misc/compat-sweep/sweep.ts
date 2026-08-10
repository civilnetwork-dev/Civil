/**
 * Site compatibility sweep.
 *
 * Drives the real Civil UI (URL bar -> Go) for each domain in `sites.ts`, then
 * samples the proxied iframe with the same checks `measureAndReportCompat` uses
 * in src/lib/bestProxy.ts. Reports which sites actually break under the proxy.
 *
 * Talks to Chrome over CDP directly so the repo gains no browser-automation
 * dependency. Requires a Chrome/Chromium binary and a running Civil server.
 *
 *   bun misc/compat-sweep/sweep.ts
 *   bun misc/compat-sweep/sweep.ts --limit 20 --out /tmp/sweep.json
 */

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SITES } from "./sites";

const CIVIL_URL = process.env.CIVIL_URL ?? "http://localhost:9876/";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const DEBUG_PORT = Number(process.env.CDP_PORT ?? 9223);

/** Time budget for one site: navigation, then a settle window for client JS. */
const LOAD_TIMEOUT_MS = 20_000;
const SETTLE_MS = 2_500;

interface SiteResult {
    domain: string;
    /** Origin served a bot challenge instead of the site. */
    challenged: boolean;
    /** Rendered text length; low values mean the page came up blank. */
    bodyLength: number;
    hasTitleTag: boolean;
    /** null when the harness could not sample the frame at all. */
    compat: number | null;
    proxy: string | null;
    checks: Record<string, boolean>;
    consoleErrors: number;
    rewriterErrors: number;
    failedRequests: number;
    finalUrl: string;
    title: string;
    note?: string;
}

// ---------------------------------------------------------------- CDP client

type CdpMessage = {
    id?: number;
    method?: string;
    params?: Record<string, unknown>;
    result?: Record<string, unknown>;
    error?: { message: string };
    sessionId?: string;
};

class Cdp {
    private ws!: WebSocket;
    private nextId = 1;
    private pending = new Map<
        number,
        { resolve: (v: any) => void; reject: (e: Error) => void }
    >();
    private listeners: ((m: CdpMessage) => void)[] = [];
    private closed = false;

    static async connect(wsUrl: string): Promise<Cdp> {
        const c = new Cdp();
        c.ws = new WebSocket(wsUrl);
        await new Promise<void>((resolve, reject) => {
            c.ws.addEventListener("open", () => resolve(), { once: true });
            c.ws.addEventListener(
                "error",
                () => reject(new Error(`cdp connect failed: ${wsUrl}`)),
                { once: true },
            );
        });
        c.ws.addEventListener("message", ev => {
            const msg: CdpMessage = JSON.parse(String(ev.data));
            if (msg.id !== undefined) {
                const p = c.pending.get(msg.id);
                if (p) {
                    c.pending.delete(msg.id);
                    if (msg.error) p.reject(new Error(msg.error.message));
                    else p.resolve(msg.result ?? {});
                }
                return;
            }
            for (const l of c.listeners) l(msg);
        });
        // If Chrome dies mid-sweep every outstanding command would otherwise
        // hang until its own timeout, one after another. Fail them at once so
        // the run ends with a real error instead of stalling.
        const abort = () => {
            for (const [, p] of c.pending) {
                p.reject(new Error("cdp connection closed (chrome died?)"));
            }
            c.pending.clear();
            c.closed = true;
        };
        c.ws.addEventListener("close", abort);
        c.ws.addEventListener("error", abort);
        return c;
    }

    get isClosed(): boolean {
        return this.closed;
    }

    on(fn: (m: CdpMessage) => void): () => void {
        this.listeners.push(fn);
        return () => {
            this.listeners = this.listeners.filter(l => l !== fn);
        };
    }

    send<T = any>(
        method: string,
        params: Record<string, unknown> = {},
        sessionId?: string,
    ): Promise<T> {
        const id = this.nextId++;
        const payload: CdpMessage = { id, method, params };
        if (sessionId) payload.sessionId = sessionId;
        this.ws.send(JSON.stringify(payload));
        return new Promise<T>((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            setTimeout(() => {
                // Must reject whenever the entry was still outstanding; the
                // delete()-and-reject shorthand silently drops the rejection
                // and hangs the sweep forever.
                if (this.pending.delete(id)) {
                    reject(new Error(`cdp timeout: ${method}`));
                }
            }, 30_000);
        });
    }

    close() {
        this.ws.close();
    }
}

// ------------------------------------------------------------ in-page probes

/**
 * Locates the address bar and reports its centre point.
 *
 * A JS .focus() is not enough on its own: proxied pages routinely autofocus
 * their own inputs (DuckDuckGo's search box is the usual culprit), and once
 * keyboard focus is inside the iframe, .focus() in the parent document does
 * not reliably pull it back out. The caller follows up with a real mouse
 * click at these coordinates, which does.
 */
const FOCUS_URLBAR_FN = `() => {
    const box = document.querySelector('input[type="text"]');
    if (!box) return { ok: false, reason: "url bar not found" };
    box.focus();
    box.select?.();
    const r = box.getBoundingClientRect();
    return { ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2 };
}`;

/**
 * Mirrors measureAndReportCompat() in src/lib/bestProxy.ts so sweep scores are
 * directly comparable to what the app records at runtime.
 */
const SAMPLE_FN = `() => {
    const frame = document.querySelector('iframe[title*="Proxied"]');
    const w = frame && frame.contentWindow;
    const d = frame && frame.contentDocument;
    if (!w) return { accessible: false };

    const checks = {};
    checks.windowReachable = !!w;
    checks.documentReachable = !!d;
    checks.loadComplete = d?.readyState === "complete";
    checks.renderedDom = (d?.body?.childElementCount ?? 0) > 0;
    checks.realContent = (d?.body?.innerText ?? "").trim().length > 20;
    checks.titleSet = !!d?.title;

    let href = "";
    try { href = w.location?.href ?? ""; } catch (e) {}
    checks.locationSane = !!href && href !== "about:blank";

    let apis = false;
    try {
        apis = !!(w && "fetch" in w && "localStorage" in w
                    && "history" in w && "URL" in w);
    } catch (e) {}
    checks.platformApis = apis;

    // measureAndReportCompat's checks all pass on a proxy error page, so an
    // outright failure can score 100%. Require the page not to look like one.
    const text = (d?.body?.innerText ?? "").trim();
    const title = (d?.title ?? "").trim();
    const errorish = /^(error|not found|problem loading|can'?t reach|failed|access denied|forbidden|blocked|403|404|5\\d{2} )/i;
    checks.notErrorPage =
        !errorish.test(title) &&
        !/error (code )?\\d{3}/i.test(text.slice(0, 400)) &&
        text.length > 60;

    // Proxy in use is visible in the proxied path segment.
    let proxy = null;
    const m = /\\/~\\/(scramjet|uv)\\//.exec(href) || /\\/(scramjet|uv)\\//.exec(href);
    if (m) proxy = m[1];

    // A bot challenge means the origin refused the proxy's traffic. The page is
    // "healthy" by every structural check, so it has to be detected by content
    // or it scores 100% while showing the user nothing.
    const challenged =
        /^(just a moment|attention required|verifying you are human|checking your browser)/i.test(title) ||
        /cf-browser-verification|cf_chl_|challenge-platform/.test(
            d?.documentElement?.innerHTML?.slice(0, 4000) ?? "");
    checks.notChallenged = !challenged;

    return {
        accessible: true,
        checks,
        challenged,
        proxy,
        finalUrl: href.slice(0, 300),
        title: d?.title ?? "",
        // Raw signal, not a pass/fail: the >20 char realContent threshold is
        // low enough that a page which rendered nothing still clears it, so the
        // actual length is what distinguishes "loaded" from "blank".
        bodyLength: text.length,
        hasTitleTag: !!d?.querySelector("title"),
        consoleErrors: Number(w.__civilConsoleErrors ?? 0),
        rewriterErrors: Number(w.__civilRewriterErrors ?? 0),
        failedRequests: Number(w.__civilFailedRequests ?? 0),
    };
}`;

// ------------------------------------------------------------------- harness

function scoreOf(
    checks: Record<string, boolean>,
    consoleErrors: number,
    rewriterErrors: number,
    failedRequests: number,
): number {
    const vals = Object.values(checks);
    const passed = vals.filter(Boolean).length;
    const renderCompat = Math.round((passed / vals.length) * 100);
    // Same penalty weighting as bestProxy.ts.
    const penalty = Math.min(
        70,
        rewriterErrors * 8 +
            failedRequests * 5 +
            Math.max(0, consoleErrors - rewriterErrors) * 2,
    );
    return Math.max(0, renderCompat - penalty);
}

/**
 * Sweeps one site in an already-open Civil tab. The tab is reused across sites:
 * creating a fresh target per site forces the service worker to re-bootstrap and
 * the shell fails to come up.
 */
async function sweepSite(
    cdp: Cdp,
    sessionId: string,
    domain: string,
    previousUrl: string,
): Promise<SiteResult> {
    const base: SiteResult = {
        domain,
        challenged: false,
        bodyLength: 0,
        hasTitleTag: false,
        compat: null,
        proxy: null,
        checks: {},
        consoleErrors: 0,
        rewriterErrors: 0,
        failedRequests: 0,
        finalUrl: "",
        title: "",
    };

    try {
        // Return to a clean shell so each site starts from the same state.
        await cdp.send("Page.navigate", { url: CIVIL_URL }, sessionId);
        await waitForCivilReady(cdp, sessionId);

        const focused = await evaluate(cdp, sessionId, FOCUS_URLBAR_FN);
        if (!focused?.ok) {
            return { ...base, note: focused?.reason ?? "url bar not found" };
        }
        await typeAndSubmit(cdp, sessionId, domain, focused);

        await sleep(SETTLE_MS);
        await waitForFrameSettled(cdp, sessionId);

        const s = await evaluate(cdp, sessionId, SAMPLE_FN);
        if (!s?.accessible) {
            return { ...base, note: "proxied frame not accessible" };
        }
        // Guard against a silent no-op: if the frame never left Civil's own
        // newtab route, nothing was actually proxied and a 100% score would be
        // a lie.
        if (!s.finalUrl || /localhost:\d+\/(newtab)?$/.test(s.finalUrl)) {
            return { ...base, note: "frame never navigated (still on newtab)" };
        }
        // Civil restores the previous tab, so a failed navigation leaves the
        // prior site rendered. Scoring that would attribute one site's health
        // to another.
        if (previousUrl && s.finalUrl === previousUrl) {
            return { ...base, note: "frame still showing previous site" };
        }
        // Civil's address bar shows the real (decoded) URL, so it is the one
        // place we can cheaply confirm we landed on the site we asked for
        // rather than a redirect, interstitial, or concatenated URL.
        const shown: string = await evaluate(
            cdp,
            sessionId,
            `() => document.querySelector('input[type="text"]')?.value ?? ""`,
        );
        const registrable = domain.split(".").slice(-2).join(".");
        if (shown && !shown.toLowerCase().includes(registrable)) {
            return {
                ...base,
                finalUrl: s.finalUrl,
                title: s.title,
                note: `landed elsewhere: ${shown.slice(0, 80)}`,
            };
        }

        return {
            domain,
            challenged: !!s.challenged,
            bodyLength: Number(s.bodyLength ?? 0),
            hasTitleTag: !!s.hasTitleTag,
            compat: scoreOf(
                s.checks,
                s.consoleErrors,
                s.rewriterErrors,
                s.failedRequests,
            ),
            proxy: s.proxy,
            checks: s.checks,
            consoleErrors: s.consoleErrors,
            rewriterErrors: s.rewriterErrors,
            failedRequests: s.failedRequests,
            finalUrl: s.finalUrl,
            title: s.title,
        };
    } catch (err) {
        return { ...base, note: `error: ${(err as Error).message}` };
    }
}

/** Delivers the URL as trusted input, then Enter, via the Input domain. */
async function typeAndSubmit(
    cdp: Cdp,
    sessionId: string,
    text: string,
    point?: { x: number; y: number },
): Promise<void> {
    // Select-all then overwrite. A JS .select() does not survive into
    // Input.insertText, so the selection has to be made with real key events or
    // the new text is appended to whatever the restored tab left behind.
    if (point) {
        for (const type of ["mousePressed", "mouseReleased"]) {
            await cdp.send(
                "Input.dispatchMouseEvent",
                {
                    type,
                    x: point.x,
                    y: point.y,
                    button: "left",
                    clickCount: 1,
                },
                sessionId,
            );
        }
    }
    for (const type of ["keyDown", "keyUp"]) {
        await cdp.send(
            "Input.dispatchKeyEvent",
            {
                type,
                key: "a",
                code: "KeyA",
                windowsVirtualKeyCode: 65,
                nativeVirtualKeyCode: 65,
                modifiers: 2, // Ctrl
            },
            sessionId,
        );
    }
    await cdp.send("Input.insertText", { text }, sessionId);
    // Fail loudly rather than navigating to a concatenated garbage URL.
    const actual = await evaluate(
        cdp,
        sessionId,
        `() => document.querySelector('input[type="text"]')?.value ?? ""`,
    );
    if (actual !== text) {
        throw new Error(`url bar not cleared (got ${JSON.stringify(actual)})`);
    }
    await sleep(150);
    for (const type of ["keyDown", "keyUp"]) {
        await cdp.send(
            "Input.dispatchKeyEvent",
            {
                type,
                key: "Enter",
                code: "Enter",
                windowsVirtualKeyCode: 13,
                nativeVirtualKeyCode: 13,
                text: type === "keyDown" ? "\r" : undefined,
            },
            sessionId,
        );
    }
}

async function evaluate(
    cdp: Cdp,
    sessionId: string,
    fnText: string,
    args: unknown[] = [],
): Promise<any> {
    const expression = `(${fnText})(${args.map(a => JSON.stringify(a)).join(",")})`;
    const res = await cdp.send<{
        result: { value?: unknown };
        exceptionDetails?: { text: string };
    }>(
        "Runtime.evaluate",
        { expression, returnByValue: true, awaitPromise: true },
        sessionId,
    );
    if (res.exceptionDetails) return null;
    return res.result?.value ?? null;
}

async function waitForCivilReady(cdp: Cdp, sessionId: string): Promise<void> {
    const deadline = Date.now() + LOAD_TIMEOUT_MS;
    while (Date.now() < deadline) {
        // Match on the input itself, not its placeholder: Civil restores the
        // previous tab on reload, which clears the placeholder.
        const ready = await evaluate(
            cdp,
            sessionId,
            `() => !!document.querySelector('input[type="text"]')`,
        );
        if (ready) {
            // Service worker registration is what makes the proxy usable.
            await sleep(600);
            return;
        }
        await sleep(250);
    }
    throw new Error("civil shell did not become ready");
}

/** Polls until the proxied frame stops changing, or the budget runs out. */
async function waitForFrameSettled(cdp: Cdp, sessionId: string): Promise<void> {
    const deadline = Date.now() + LOAD_TIMEOUT_MS;
    let lastLen = -1;
    let stable = 0;
    while (Date.now() < deadline) {
        const len = await evaluate(
            cdp,
            sessionId,
            `() => {
                const f = document.querySelector('iframe[title*="Proxied"]');
                try { return f?.contentDocument?.body?.innerText?.length ?? -1; }
                catch (e) { return -2; }
            }`,
        );
        if (len === lastLen && len > 0) {
            if (++stable >= 2) return;
        } else {
            stable = 0;
        }
        lastLen = len;
        await sleep(700);
    }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Sites to visit before recycling the tab to release renderer memory. */
const RECYCLE_EVERY = 15;

interface Session {
    cdp: Cdp;
    sessionId: string;
    /** Closes and reopens the tab, dropping accumulated renderer memory. */
    recycle: () => Promise<void>;
    dispose: () => Promise<void>;
}

async function launchBrowser(): Promise<Session> {
    const profile = await mkdtemp(join(tmpdir(), "civil-sweep-"));
    const chrome = spawn(
        CHROME,
        [
            "--headless=new",
            `--remote-debugging-port=${DEBUG_PORT}`,
            `--user-data-dir=${profile}`,
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-gpu",
            "--window-size=1280,900",
            // Keeps renderer memory down on a loaded machine. None of the
            // checks look at pixels, so dropping images costs nothing here.
            "--blink-settings=imagesEnabled=false",
            "--disable-dev-shm-usage",
            "--renderer-process-limit=2",
            // Civil is served over plain http on localhost in dev; the proxy
            // needs a service worker, which localhost already counts as secure.
            "about:blank",
        ],
        { stdio: "ignore" },
    );

    const cdp = await Cdp.connect(await waitForDebugger());

    let targetId = "";
    let sessionId = "";
    const openTab = async () => {
        ({ targetId } = await cdp.send<{ targetId: string }>(
            "Target.createTarget",
            { url: CIVIL_URL },
        ));
        ({ sessionId } = await cdp.send<{ sessionId: string }>(
            "Target.attachToTarget",
            { targetId, flatten: true },
        ));
        await cdp.send("Page.enable", {}, sessionId);
        await cdp.send("Runtime.enable", {}, sessionId);
    };
    await openTab();

    const session: Session = {
        get cdp() {
            return cdp;
        },
        get sessionId() {
            return sessionId;
        },
        recycle: async () => {
            const old = targetId;
            await openTab();
            await cdp
                .send("Target.closeTarget", { targetId: old })
                .catch(() => {});
        },
        dispose: async () => {
            cdp.close();
            chrome.kill();
            await rm(profile, { recursive: true, force: true }).catch(() => {});
            // Give the port time to free before any relaunch binds it.
            await sleep(1200);
        },
    };
    return session;
}

async function main() {
    const args = process.argv.slice(2);
    const limitArg = args.indexOf("--limit");
    const outArg = args.indexOf("--out");
    const limit =
        limitArg >= 0 ? Number(args[limitArg + 1]) : Number.POSITIVE_INFINITY;
    const outPath =
        outArg >= 0 ? args[outArg + 1] : "misc/compat-sweep/results.json";

    const sites = SITES.slice(0, limit);
    console.log(`sweeping ${sites.length} sites against ${CIVIL_URL}\n`);

    // Resume: a memory-starved machine may need several passes to get through
    // the list, so keep anything a previous run already sampled.
    let results: SiteResult[] = [];
    try {
        const prior = JSON.parse(
            await readFile(outPath, "utf8"),
        ) as SiteResult[];
        results = prior.filter(x => x.compat !== null);
    } catch {}
    const done = new Set(results.map(x => x.domain));
    if (done.size)
        console.log(`resuming: ${done.size} sites already sampled\n`);

    let session = await launchBrowser();

    try {
        let previousUrl = "";
        let consecutiveFailures = 0;
        for (const [i, domain] of sites.entries()) {
            if (done.has(domain)) continue; // already recorded by a prior run
            // Heavy media sites accumulate renderer memory, and on a loaded
            // machine Chrome gets OOM-killed part way through a long sweep.
            // Recycle the tab periodically, and relaunch outright if it died,
            // so one crash costs a single site rather than the whole run.
            // Under memory pressure Chrome degrades without ever closing the
            // CDP socket: navigations just start timing out. Recycling a tab
            // does not reclaim that, so relaunch the whole process on a fixed
            // cadence and whenever failures start clustering.
            if (
                session.cdp.isClosed ||
                consecutiveFailures >= 2 ||
                (i > 0 && i % RECYCLE_EVERY === 0)
            ) {
                const why = session.cdp.isClosed
                    ? "chrome died"
                    : consecutiveFailures >= 2
                      ? `${consecutiveFailures} failures in a row`
                      : `${RECYCLE_EVERY} sites`;
                console.error(`  relaunching browser (${why})`);
                await session.dispose();
                session = await launchBrowser();
                previousUrl = "";
                consecutiveFailures = 0;
            }

            const { cdp, sessionId } = session;
            let r = await sweepSite(cdp, sessionId, domain, previousUrl);
            // If the browser died mid-site, bring it back and take one more
            // pass at this domain before recording a failure.
            if (r.compat === null && cdp.isClosed) {
                await session.dispose();
                session = await launchBrowser();
                previousUrl = "";
                r = await sweepSite(session.cdp, session.sessionId, domain, "");
            }
            // A stalled navigation strands the previous site in the frame and
            // would otherwise cascade across every following domain. One retry
            // clears it.
            // Any unsampled result is worth one more attempt: focus theft by
            // the previous site is the usual cause and it clears on retry.
            if (r.compat === null && !session.cdp.isClosed) {
                r = await sweepSite(
                    session.cdp,
                    session.sessionId,
                    domain,
                    previousUrl,
                );
            }
            if (r.finalUrl) previousUrl = r.finalUrl;
            consecutiveFailures =
                r.compat === null ? consecutiveFailures + 1 : 0;
            results.push(r);
            // Persist after every site: a browser crash 90 sites in should not
            // throw away the whole run.
            await writeFile(outPath, JSON.stringify(results, null, 2));
            const status =
                r.compat === null
                    ? `FAIL  ${r.note ?? ""}`
                    : `${String(r.compat).padStart(3)}%  ${r.proxy ?? "?"}` +
                      (r.challenged ? "  CHALLENGED" : "") +
                      (r.rewriterErrors ? `  rw:${r.rewriterErrors}` : "") +
                      (r.failedRequests ? `  net:${r.failedRequests}` : "");
            console.log(
                `[${String(i + 1).padStart(3)}/${sites.length}] ${domain.padEnd(24)} ${status}`,
            );
        }
    } finally {
        await session.dispose();
    }

    await writeFile(outPath, JSON.stringify(results, null, 2));

    const scored = results.filter(r => r.compat !== null);
    const broken = scored.filter(r => (r.compat ?? 0) < 60);
    const dead = results.filter(r => r.compat === null);
    console.log(`\n--- summary ---`);
    console.log(`sampled : ${scored.length}/${results.length}`);
    if (scored.length) {
        const avg =
            scored.reduce((a, r) => a + (r.compat ?? 0), 0) / scored.length;
        console.log(`avg compat: ${avg.toFixed(1)}%`);
    }
    console.log(`broken (<60%): ${broken.length}`);
    for (const r of broken) console.log(`  ${r.domain}  ${r.compat}%`);
    console.log(`unsampled: ${dead.length}`);
    for (const r of dead) console.log(`  ${r.domain}  ${r.note ?? ""}`);
    console.log(`\nwrote ${outPath}`);
}

async function waitForDebugger(): Promise<string> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(
                `http://127.0.0.1:${DEBUG_PORT}/json/version`,
            );
            const json = (await res.json()) as {
                webSocketDebuggerUrl: string;
            };
            if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
        } catch {}
        await sleep(300);
    }
    throw new Error("chrome devtools endpoint never came up");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
