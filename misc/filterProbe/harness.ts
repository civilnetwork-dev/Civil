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
 *      `detect.ts` whether the filter flagged it. When one did, `predict.ts`
 *      says which Civil source to change.
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

import { createServer } from "node:net";
import { join } from "node:path";
import {
    createHybridCaptchaSolver,
    FreeDnsClient,
    openTunnel,
    pickTunnelDomain,
    type Tunnel,
} from "../tunnel";
import { detectFlagging, type Verdict } from "./detect";
import { type DockerStackHandle, startDockerStack } from "./dockerStack";
import { checkGoGuardianRoute } from "./goguardianCheck";
import { predictFix, type Suggestion } from "./predict";
import { CIVIL_ROUTES } from "./routes";
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

        process.stdout.write("opening tunnel…\n");
        tunnel = await openTunnel({
            port,
            domain,
            client,
            captchaCode,
            solveCaptcha,
            captchaAttempts: 5,
        });
        process.stdout.write(`tunnel up: ${tunnel.url}\n`);

        for (const route of CIVIL_ROUTES) {
            for (const vendor of VENDORS) {
                const folder = VENDOR_PRIMARY_FOLDER[vendor];
                if (!folder) continue;
                // One vendor's real-world bundle throwing (its own bug, not
                // ours) must not void every other vendor's result — this is a
                // sweep, and a partial one is still the point of it. Isolated
                // per iteration rather than only hardening the sandbox itself:
                // 28 independent, messy third-party bundles will keep finding
                // new ways to throw.
                try {
                    // GoGuardian's real decision logic (misc/filterProbe/
                    // goguardianCheck.ts) is an authenticated keyword match,
                    // not something the sandboxed extension bundle can be
                    // observed deciding — bypasses observeRoute entirely.
                    const verdict =
                        vendor === "goguardian"
                            ? await checkGoGuardianRoute(
                                  route.proxyTarget
                                      ? `${tunnel.url.replace(/\/$/, "")}${route.path}${encodeURIComponent(route.proxyTarget)}`
                                      : `${tunnel.url.replace(/\/$/, "")}${route.path}`,
                                  route.path,
                              )
                            : detectFlagging(
                                  await observeRoute({
                                      extensionDir: join(bundleRoot, folder),
                                      baseUrl: tunnel.url,
                                      route: route.path,
                                      proxyTarget: route.proxyTarget,
                                      waitMs,
                                  }),
                                  vendor,
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
