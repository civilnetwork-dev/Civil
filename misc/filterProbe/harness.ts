/**
 * The filter route check, end to end — the task's "main TypeScript file to run
 * all the tests, executed via bun".
 *
 * ```sh
 * FREEDNS_EMAIL=… FREEDNS_PASSWORD=… bun misc/filterProbe/harness.ts
 * ```
 *
 * The base domain is chosen automatically: `pickTunnelDomain` (misc/tunnel/
 * pickDomain) sweeps the FreeDNS registry past the filter reputation checkers
 * and picks a random domain none of them block. Set both `CIVIL_TUNNEL_DOMAIN`
 * and `CIVIL_TUNNEL_DOMAIN_ID` to pin one instead.
 *
 * The FreeDNS subdomain captcha is read by a local OCR model (misc/tunnel/
 * captchaSolver, verified against real FreeDNS submissions) and retried until
 * it lands, so no captcha is typed by hand; `CIVIL_TUNNEL_CAPTCHA` overrides
 * it with a one-shot manual
 * code if ever needed.
 *
 * In order:
 *
 *   1. Brings up Civil's own `docker-compose.yml` stack under Podman —
 *      postgres, redis and the app itself, built from the repo's Dockerfile —
 *      on a free host port, and waits for the app container to report
 *      healthy (dockerStack.ts). Not a bare `bun run.ts`: the compose stack
 *      is what actually provisions the database and Redis this needs, rather
 *      than assuming both already exist on the host.
 *   2. Picks an unblocked FreeDNS base domain, then opens a FreeDNS-fronted
 *      cloudflared tunnel to it (misc/tunnel) — the public URL a filter would
 *      actually see.
 *   3. For every Civil route × every filter *vendor* (one filter at a time, so
 *      filters never conflict), loads the proxy in the sandbox, waits, and asks
 *      `detect.ts` whether the filter flagged it — a broken probe is retried
 *      rather than counted as clean, and a clean read gets one longer-waited
 *      recheck before it's trusted (`probeVendorRoute`, below). When flagged,
 *      `predict.ts` says which Civil source to change.
 *   4. Tears down in reverse the moment it is done: stops the compose stack,
 *      then closes the tunnel — which deletes the FreeDNS subdomain.
 *
 * Every step here needs something no CI job has by default: Podman, FreeDNS
 * credentials, and a cloudflared download. The captcha it solves itself, and
 * the compose stack provisions its own database and Redis rather than needing
 * either already running. So this file is the *live* runner, invoked by hand
 * or by a secrets-gated CI job. The deterministic core it orchestrates — the
 * detection and the prediction — is what the Vitest suite proves on every run,
 * against the committed `probeData.json`, with none of that infrastructure.
 * See `filterProbe.test.ts`.
 */

import { setDefaultResultOrder } from "node:dns";
import { Resolver } from "node:dns/promises";
import { createServer } from "node:net";
import { join } from "node:path";

// A live run against a FreeDNS tunnel hostname found this network's IPv6
// path to Cloudflare's edge outright broken -- a raw TCP connect() failure
// (openssl s_client -6 against a known-good Cloudflare IPv6 address:
// "BIO_connect: Unknown error ... errno=0"), separate from and worse than
// the DNS-propagation and edge-SNI-warmup delays everything else here
// already tolerates. The tunnel hostname resolves to both address families;
// letting fetch() pick IPv6 some fraction of the time turns a network-level
// dead end into an intermittent failure that looks like a fetch problem.
// ipv4first is a safe, generally-correct default here regardless of this
// one network's specifics: nothing this file talks to needs IPv6.
setDefaultResultOrder("ipv4first");

import { classifyDomain } from "../filters/domainReputation";
import {
    createHybridCaptchaSolver,
    FreeDnsClient,
    openTunnel,
    pickTunnelDomain,
    sweepTunnelOrphans,
    type Tunnel,
} from "../tunnel";
import { detectFlagging, type PageObservation, type Verdict } from "./detect";
import { type DockerStackHandle, startDockerStack } from "./dockerStack";
import { checkGoGuardianRoute } from "./goguardianCheck";
import { predictFix, type Suggestion } from "./predict";
import { CIVIL_ROUTES, type CivilRoute } from "./routes";
import { observeRoute } from "./sandbox";
import { VENDOR_PRIMARY_FOLDER, VENDORS } from "./vendors";

interface Result {
    verdict: Verdict;
    suggestions: Suggestion[];
}

interface ObservationError {
    vendor: string;
    route: string;
    message: string;
}

async function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const srv = createServer();
        srv.on("error", reject);
        srv.listen(0, () => {
            const port = (srv.address() as { port: number }).port;
            srv.close(() => resolve(port));
        });
    });
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** Two independent public resolvers, queried directly — the record's real
 *  state at FreeDNS's own nameservers, with no local negative-cache in the
 *  way (this machine's OS resolver, which `fetch()` uses internally, can
 *  hold a hostname's first failed lookup as a negative result for minutes —
 *  a documented Windows DNS client behavior — which would make retrying
 *  through `fetch()` alone pointless: every retry just replays the same
 *  stale miss regardless of whether the record now exists). One resolver
 *  being slow or briefly unreachable shouldn't read as "record not there". */
/** Consecutive spaced successes `waitForTunnelReady` needs before it calls a
 *  tunnel ready — see its own comment for what a single success misses. Three
 *  five seconds apart: long enough to outlast a stale negative DNS entry,
 *  cheap next to the sweep it gates. */
const READY_CONFIRMATIONS = 3;
const READY_CONFIRM_SPACING_MS = 5_000;

async function hostnameResolvesPublicly(hostname: string): Promise<boolean> {
    for (const servers of [
        ["1.1.1.1", "1.0.0.1"],
        ["8.8.8.8", "8.8.4.4"],
    ]) {
        const resolver = new Resolver();
        resolver.setServers(servers);
        try {
            await resolver.resolveCname(hostname);
            return true;
        } catch {
            try {
                await resolver.resolve4(hostname);
                return true;
            } catch {
                // try the next resolver
            }
        }
    }
    return false;
}

/**
 * A `fetch` that sends exactly the request line and Host header a real
 * client would for the tunnel's custom `hostname`, but connects to and
 * presents `origin` — the tunnel's own native `*.trycloudflare.com` name —
 * for DNS and TLS SNI instead of the CNAME'd custom hostname.
 *
 * Direct evidence (an `openssl s_client` probe straight at a resolved
 * Cloudflare edge IP): connecting with SNI = the custom FreeDNS hostname got
 * a raw TLS alert 40 (`handshake_failure`) with no certificate ever sent —
 * Cloudflare's edge doesn't recognize that SNI as belonging to any zone it
 * manages, because it's a third-party domain that only points here via a
 * CNAME Cloudflare was never told about. `origin` is Cloudflare's own
 * hostname, recognized immediately by every edge node; a Quick Tunnel is
 * 1:1 with its origin, so SNI alone fully determines routing here — the Host
 * header (still the real custom hostname, since only `tls.serverName` is
 * overridden) passes through to Civil's server untouched, and `pageUrl` /
 * `location.href` in the sandbox still reflect the real intended hostname.
 * Confirmed empirically: Bun's `tls.serverName` genuinely controls the
 * ClientHello SNI, not just a cosmetic option (an intentionally-wrong value
 * against a real Cloudflare host reproduced the exact same handshake error).
 *
 * The connection itself is made to `origin`, not to `hostname`: the URL's
 * host is what Bun resolves and connects to, and `*.trycloudflare.com`
 * resolves anywhere, while the FreeDNS record for `hostname` can trail
 * behind on this machine's own resolver — seen live: public resolvers saw it
 * while `getaddrinfo` here returned ENOTFOUND for five straight minutes.
 * The request line still carries the real hostname through an explicit
 * `Host` header, which Bun would otherwise also use for SNI and certificate
 * verification; `tls.serverName` pins both back to `origin` (confirmed:
 * against a real host, a foreign `Host` alone fails with
 * ERR_TLS_CERT_ALTNAME_INVALID, and with `serverName` set the server sees
 * the foreign `Host` and the handshake is clean). Requests to any other
 * host pass through untouched.
 *
 * This only changes what *this harness's own probing* sends — it can't and
 * doesn't change what a real browser does (SNI and DNS both follow the
 * address bar there). It makes the harness's own detection checks reliable;
 * it says nothing about how consistently a real, filtered browser would land
 * on an edge node that accepts the bare CNAME.
 */
function tunnelAwareFetch(origin: string, hostname: string): typeof fetch {
    return ((input: Parameters<typeof fetch>[0], init?: BunFetchRequestInit) => {
        const url = new URL(
            typeof input === "string" || input instanceof URL
                ? input
                : input.url,
        );
        if (url.hostname !== hostname) return fetch(input, init);
        url.hostname = origin;
        const headers = new Headers(
            init?.headers ?? (input instanceof Request ? input.headers : {}),
        );
        headers.set("host", hostname);
        return fetch(url, {
            ...init,
            headers,
            tls: { ...init?.tls, serverName: origin },
        });
    }) as typeof fetch;
}

/**
 * Waits for the tunnel's FreeDNS record to actually exist, then confirms the
 * tunnel itself answers. Throws a clear, specific failure if a fresh record
 * just never propagates in time, rather than letting the sweep discover that
 * one doomed combo at a time (seen live: 180/180 errored with
 * `getaddrinfo ENOTFOUND` before this check existed).
 *
 * `openTunnel` returns the instant FreeDNS's web form reports success, with
 * no guarantee the record has reached FreeDNS's own advertised nameservers
 * yet — on live runs this has taken minutes (free, shared DNS
 * infrastructure, no propagation SLA). Only once a public resolver
 * (`hostnameResolvesPublicly`) sees the record does this loop touch
 * `fetch()` at all, so the *first* real lookup this process's own resolver
 * ever does for this hostname has a real answer waiting for it instead of
 * seeding its own negative cache. `fetchImpl` should be `tunnelAwareFetch`'d
 * to this tunnel's own origin, so this check reflects what the real
 * per-combo fetches will actually experience rather than the SNI-rejection
 * failure mode they no longer hit. Progress is logged periodically so a
 * multi-minute wait reads as "still waiting", not a hang.
 */
async function waitForTunnelReady(
    url: string,
    timeoutMs = 300_000,
    fetchImpl: typeof fetch = fetch,
): Promise<void> {
    const hostname = new URL(url).hostname;
    const deadline = Date.now() + timeoutMs;
    const start = Date.now();
    let lastLoggedAt = start;
    let everResolvedPublicly = false;
    let lastFetchError = "";
    let consecutive = 0;
    while (Date.now() < deadline) {
        if (await hostnameResolvesPublicly(hostname)) {
            everResolvedPublicly = true;
            try {
                await fetchImpl(url);
                // One success isn't enough. This process's own resolver can
                // still be holding a negative entry from a lookup made before
                // the record propagated (the Windows behavior described on
                // hostnameResolvesPublicly), in which case a single fetch that
                // happens to land looks identical to a tunnel that is actually
                // ready -- and the sweep then errors every combo with
                // ENOTFOUND on a hostname this check just called reachable
                // (seen live). Spaced successes outlast that cached miss;
                // anything short of a clean streak starts over.
                if (++consecutive >= READY_CONFIRMATIONS) return;
                await sleep(READY_CONFIRM_SPACING_MS);
                continue;
            } catch (error) {
                consecutive = 0;
                lastFetchError =
                    error instanceof Error ? error.message : String(error);
            }
        } else {
            consecutive = 0;
        }
        if (Date.now() - lastLoggedAt >= 15_000) {
            lastLoggedAt = Date.now();
            process.stdout.write(
                `  still waiting (${Math.round((Date.now() - start) / 1000)}s) for ${hostname} to propagate\n`,
            );
        }
        await sleep(2_000);
    }
    throw new Error(
        everResolvedPublicly
            ? `tunnel ${url} resolved publicly but never answered within ${timeoutMs}ms: ${lastFetchError}`
            : `tunnel ${url} never propagated to public DNS within ${timeoutMs}ms`,
    );
}

/** A probe that never actually rendered the page — distinct from a filter's
 *  own clean verdict, and must never be reported as one (see detect.ts's own
 *  matching check, which this mirrors so a surviving bad observation can't
 *  slip through as "ok" even if the retry loop below gives up on it). */
function isInfraFailure(observation: PageObservation): string | undefined {
    if (observation.fetchError) return observation.fetchError;
    if (
        observation.status !== undefined &&
        (observation.status === 0 || observation.status >= 500)
    )
        return `HTTP ${observation.status}`;
    return undefined;
}

const INFRA_RETRY_ATTEMPTS = 3;
const INFRA_RETRY_DELAY_MS = 1_000;
/** Extra wait for the clean-result recheck, on top of the configured
 *  `waitMs` — fixed rather than a multiple, so raising CIVIL_FILTER_WAIT_MS
 *  doesn't also blow up the recheck's cost. */
const RECHECK_EXTRA_WAIT_MS = 5_000;

/**
 * One route×vendor check, made rigorous two ways beyond the original
 * single-shot `detectFlagging(await observeRoute(...), vendor)`:
 *
 *   - A broken probe (tunnel hiccup, Civil error) is retried rather than
 *     silently counted as "not flagged" — sandbox.ts already retries its own
 *     page fetch once; this is the outer retry for when the whole
 *     content-script pass needs to run again.
 *   - A *clean* read gets a second look with a longer wait before it's
 *     trusted: `BlocksiCore Failed to initialize, retrying...` (seen live, on
 *     an actual probe run) shows a filter's content script can still be
 *     mid-startup at the fifteen-second mark. A flagged read is trusted
 *     immediately either way — confirming a block needs no extra scrutiny;
 *     clearing one does.
 *
 * GoGuardian bypasses all of this (as it always has): it's a single
 * authenticated API call, not a timing-sensitive render, and its own fetch
 * now retries and throws internally (goguardianCheck.ts) rather than
 * silently returning a fabricated "not flagged".
 */
async function probeVendorRoute(
    vendor: string,
    folder: string,
    route: CivilRoute,
    ctx: {
        bundleRoot: string;
        tunnelUrl: string;
        tunnelOrigin: string;
        waitMs: number;
    },
): Promise<Verdict> {
    // tunnelAwareFetch, not plain fetch: see its own doc comment.
    // Everything that actually hits the tunnel over the network goes
    // through it, or the retries built to survive a stuck edge session
    // would just be racing the exact SNI-rejection they exist to route
    // around.
    const fetchImpl = tunnelAwareFetch(
        ctx.tunnelOrigin,
        new URL(ctx.tunnelUrl).hostname,
    );

    if (vendor === "goguardian") {
        const url = route.proxyTarget
            ? `${ctx.tunnelUrl.replace(/\/$/, "")}${route.path}${encodeURIComponent(route.proxyTarget)}`
            : `${ctx.tunnelUrl.replace(/\/$/, "")}${route.path}`;
        return checkGoGuardianRoute(url, route.path, fetchImpl);
    }

    const options = {
        extensionDir: join(ctx.bundleRoot, folder),
        baseUrl: ctx.tunnelUrl,
        route: route.path,
        proxyTarget: route.proxyTarget,
        fetchImpl,
    };

    let observation: PageObservation | undefined;
    let infraError: string | undefined;
    for (let attempt = 1; attempt <= INFRA_RETRY_ATTEMPTS; attempt++) {
        observation = await observeRoute({ ...options, waitMs: ctx.waitMs });
        infraError = isInfraFailure(observation);
        if (!infraError) break;
        if (attempt < INFRA_RETRY_ATTEMPTS)
            await sleep(INFRA_RETRY_DELAY_MS * attempt);
    }
    if (infraError)
        throw new Error(
            `probe never reached a real page after ${INFRA_RETRY_ATTEMPTS} attempts: ${infraError}`,
        );

    const first = detectFlagging(observation!, vendor);
    if (first.flagged) return first;

    // Clean so far — recheck once with a longer wait before trusting it. A
    // flaky recheck (its own infra hiccup) doesn't undo an otherwise-good
    // first read; it just means this particular recheck carries no signal.
    const recheck = await observeRoute({
        ...options,
        waitMs: ctx.waitMs + RECHECK_EXTRA_WAIT_MS,
    });
    if (isInfraFailure(recheck)) return first;
    const second = detectFlagging(recheck, vendor);
    return second.flagged ? second : first;
}

async function main(): Promise<number> {
    const bundleRoot =
        process.env.CIVIL_FILTER_BUNDLES ??
        join(process.env.HOME ?? process.env.USERPROFILE ?? ".", "extensions");
    const civilDir = join(import.meta.dirname, "..", "..");
    const waitMs = Number(process.env.CIVIL_FILTER_WAIT_MS ?? 15_000);

    // The OCR model (misc/tunnel/captchaSolver) is verified reliable against
    // FreeDNS's actual captcha font — most attempts should resolve on the
    // first guess — but still falls back to pausing and asking here in the
    // terminal if it runs out of tries. `CIVIL_TUNNEL_CAPTCHA` still
    // overrides both for a one-shot manual solve when set.
    const captchaCode = process.env.CIVIL_TUNNEL_CAPTCHA;
    const solveCaptcha = captchaCode ? undefined : createHybridCaptchaSolver();

    const port = await freePort();
    let server: DockerStackHandle | undefined;
    let tunnel: Tunnel | undefined;
    const results: Result[] = [];
    const errors: ObservationError[] = [];

    try {
        process.stdout.write(`starting docker-compose stack on :${port}\n`);
        server = await startDockerStack(port);

        // One logged-in client for both picking the domain and opening the
        // tunnel, so we authenticate to FreeDNS once.
        const client = new FreeDnsClient();
        await client.login();

        // A prior run killed before teardown leaks its FreeDNS subdomain, and
        // the account quota is small — reclaim any such orphan before creating
        // this run's, so a few interrupted runs can't wedge every later one
        // behind "no more subdomain capacity".
        const swept = await sweepTunnelOrphans(client);
        if (swept > 0)
            process.stdout.write(
                `swept ${swept} leftover tunnel subdomain${swept === 1 ? "" : "s"} from prior runs\n`,
            );

        // CIVIL_TUNNEL_DOMAIN is now an optional pin: set it *and* its id to
        // force a domain; otherwise auto-pick one no filter blocks. This is the
        // slow step — it sweeps the FreeDNS registry past the reputation
        // checkers — so it runs after the server is already coming up.
        const pinnedName = process.env.CIVIL_TUNNEL_DOMAIN;
        const pinnedId = process.env.CIVIL_TUNNEL_DOMAIN_ID;
        const domain =
            pinnedName && pinnedId
                ? { name: pinnedName, id: pinnedId }
                : await pickTunnelDomain({ client });
        process.stdout.write(`using domain: ${domain.name}\n`);

        // openTunnel returns the instant the FreeDNS CNAME record is
        // created, with no guarantee any resolver -- including this
        // process's own -- already sees it. This wait's own fetches go
        // through tunnelAwareFetch (see its doc comment), which routes
        // around the other confirmed delay -- Cloudflare's edge not
        // recognizing the CNAME'd hostname's SNI on some fraction of edge
        // nodes -- so what's left to wait out here is genuinely just DNS
        // propagation. A fresh session (new anycast route, new random label)
        // is still attempted on a timeout as defense in depth against
        // whatever this doesn't explain; each abandoned attempt is torn down
        // before the next opens, so a few slow warm-ups don't leave a trail
        // of orphaned subdomains.
        const MAX_TUNNEL_ATTEMPTS = 3;
        // Long enough to actually outlast FreeDNS propagation, which has taken
        // minutes on live runs. A fresh session can't speed that up -- it mints
        // a new random label, restarting propagation from zero -- so timing out
        // early here traded a record that was about to land for one that starts
        // over. Retries stay for the failure a new session does fix: a tunnel
        // that resolves but never answers.
        const TUNNEL_WARMUP_TIMEOUT_MS = 300_000;
        for (let attempt = 1; attempt <= MAX_TUNNEL_ATTEMPTS; attempt++) {
            process.stdout.write(
                `opening tunnel (attempt ${attempt}/${MAX_TUNNEL_ATTEMPTS})…\n`,
            );
            const candidate = await openTunnel({
                port,
                domain,
                client,
                captchaCode,
                solveCaptcha,
                captchaAttempts: 5,
            });
            process.stdout.write(`tunnel up: ${candidate.url}\n`);

            process.stdout.write("waiting for the tunnel to warm up…\n");
            try {
                await waitForTunnelReady(
                    candidate.url,
                    TUNNEL_WARMUP_TIMEOUT_MS,
                    tunnelAwareFetch(
                        candidate.origin,
                        new URL(candidate.url).hostname,
                    ),
                );
                process.stdout.write("tunnel is reachable\n");
                tunnel = candidate;
                break;
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                // Torn down before the next attempt opens, so a few failed
                // warm-ups don't leave a trail of orphaned subdomains. A
                // fresh session also gets a brand-new random label, which is
                // the one thing that does help when the previous hostname is
                // stuck in a resolver's negative cache.
                await candidate.close();
                process.stdout.write(
                    `tunnel not confirmed reachable (${message})${attempt < MAX_TUNNEL_ATTEMPTS ? " — opening a fresh session" : ""}\n`,
                );
            }
        }
        // Sweeping a tunnel that never confirmed reachable produces 180
        // identical transport errors and no filter signal at all, so this
        // stops instead: the run is worth nothing past here, and the
        // ~45 minutes it would spend proving that are better not spent.
        if (!tunnel)
            throw new Error(
                `no tunnel confirmed reachable after ${MAX_TUNNEL_ATTEMPTS} attempts`,
            );

        // The picker vets the *base* domain; this is the same question asked
        // of the hostname actually being served, by every vendor with a
        // rating API, so a vendor that blocks the domain itself reports
        // FLAGGED on every route rather than the "ok" a sandbox that never
        // consults the vendor's cloud would give. Seen live: Securly rates
        // meatballmanor.com as a proxy, and a sweep on it read all-clear.
        const tunnelHost = new URL(tunnel.url).hostname;
        const ratedBlocked = new Set(
            (await classifyDomain(tunnelHost)).by,
        );
        if (ratedBlocked.size > 0)
            process.stdout.write(
                `${tunnelHost} is rated blocked by: ${[...ratedBlocked].join(", ")}\n`,
            );

        for (const route of CIVIL_ROUTES) {
            for (const vendor of VENDORS) {
                const folder = VENDOR_PRIMARY_FOLDER[vendor];
                if (!folder) continue;
                if (ratedBlocked.has(vendor)) {
                    const verdict: Verdict = {
                        vendor,
                        route: route.path,
                        flagged: true,
                        signal: { kind: "domain-rating", hostname: tunnelHost },
                    };
                    results.push({
                        verdict,
                        suggestions: predictFix(verdict, civilDir),
                    });
                    process.stdout.write(`FLAGGED  ${vendor} @ ${route.path}\n`);
                    continue;
                }
                // One vendor's real-world bundle throwing (its own bug, not
                // ours) must not void every other vendor's result — this is a
                // sweep, and a partial one is still the point of it. Isolated
                // per iteration rather than only hardening the sandbox itself:
                // 28 independent, messy third-party bundles will keep finding
                // new ways to throw.
                try {
                    const verdict = await probeVendorRoute(
                        vendor,
                        folder,
                        route,
                        {
                            bundleRoot,
                            tunnelUrl: tunnel.url,
                            tunnelOrigin: tunnel.origin,
                            waitMs,
                        },
                    );
                    results.push({
                        verdict,
                        suggestions: verdict.flagged
                            ? predictFix(verdict, civilDir)
                            : [],
                    });
                    process.stdout.write(
                        `${verdict.flagged ? "FLAGGED " : "ok      "} ${vendor} @ ${route.path}\n`,
                    );
                } catch (error) {
                    const message =
                        error instanceof Error ? error.message : String(error);
                    errors.push({ vendor, route: route.path, message });
                    process.stdout.write(
                        `error    ${vendor} @ ${route.path} — ${message}\n`,
                    );
                }
            }
        }
    } finally {
        // Reverse order, best-effort: a failure tearing one down must not
        // strand the other. The tunnel close is what deletes the FreeDNS
        // subdomain.
        try {
            await tunnel?.close();
        } finally {
            await server?.stop();
        }
    }

    report(results, errors);
    return results.some(r => r.verdict.flagged) || errors.length > 0 ? 1 : 0;
}

function report(results: Result[], errors: ObservationError[]): void {
    const flagged = results.filter(r => r.verdict.flagged);
    process.stdout.write(
        `\n=== ${flagged.length} of ${results.length + errors.length} route×filter combinations flagged` +
            (errors.length > 0 ? `, ${errors.length} errored` : "") +
            ` ===\n`,
    );
    for (const { verdict, suggestions } of flagged) {
        process.stdout.write(
            `\n${verdict.vendor} flagged ${verdict.route} — ${describeSignal(verdict)}\n`,
        );
        for (const s of suggestions.slice(0, 3))
            process.stdout.write(
                `  → ${s.file}${s.line ? `:${s.line}` : ""} — ${s.reason}\n`,
            );
    }
    for (const { vendor, route, message } of errors) {
        process.stdout.write(`\n${vendor} errored on ${route} — ${message}\n`);
    }
}

function describeSignal(verdict: Verdict): string {
    const s = verdict.signal;
    if (!s) return "flagged";
    if (s.kind === "redirect") return `redirected to ${s.finalHost}`;
    if (s.kind === "marker") return `block marker "${s.marker}"`;
    if (s.kind === "keyword-match")
        return `keyword match: ${s.keywords.join(", ")}`;
    if (s.kind === "dnr-block")
        return `blocked by its own declarativeNetRequest rule #${s.matchedRuleId}`;
    if (s.kind === "dom-replaced")
        return `page replaced in place (${s.originalLength} chars -> ${s.finalLength} chars)`;
    if (s.kind === "domain-rating")
        return `rates the domain ${s.hostname} itself as blocked`;
    return `named itself: "${s.phrase}"`;
}

main().then(
    code => process.exit(code),
    error => {
        process.stderr.write(
            `${error instanceof Error ? error.message : error}\n`,
        );
        process.exit(2);
    },
);
