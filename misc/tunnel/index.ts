/**
 * Public tunnel for a locally-running Civil server.
 *
 * A cloudflared tunnel (via `untun`) already hands out a public
 * `*.trycloudflare.com` URL, but that hostname is trivially blockable — every
 * filter can drop `trycloudflare.com` wholesale. The point of routing through
 * FreeDNS is the hostname: a subdomain of one of afraid.org's shared public
 * domains, CNAME'd at the cloudflare tunnel, on a name no filter has a reason
 * to know. That is the anti-filter angle the whole `Filter-Sources` effort
 * exists to serve.
 *
 * ```ts
 * const tunnel = await openTunnel({
 *   port: 3000,
 *   domain: { name: "mooo.com", id: 1 },   // an afraid.org public domain
 *   captchaCode: await solveCaptchaSomehow(),
 * });
 * console.log(tunnel.url);   // https://<nanoid>.mooo.com
 * // ...serve traffic...
 * await tunnel.close();      // deletes the FreeDNS subdomain, stops cloudflared
 * ```
 *
 * ## Two honest boundaries
 *
 * **The captcha.** FreeDNS gates subdomain *creation* behind one. `openTunnel`
 * takes either a `captchaCode` solved out-of-band or a `solveCaptcha` callback,
 * and retries a rejected guess against a fresh captcha when a solver is present
 * (`captchaAttempts`). `createCaptchaSolver` (misc/tunnel/captchaSolver) is one
 * such callback, a local CRNN — verified reliable (five real FreeDNS
 * submissions, five accepted), but retries still apply on the rare miss.
 *
 * **Which domain.** The `Filter-Sources` TODO's full vision — pick a domain
 * *no tracked filter blocks*, automatically — is now `pickTunnelDomain`
 * (misc/tunnel/pickDomain): it enumerates `FreeDnsClient.getRegistry()`, runs
 * each candidate past the filter reputation checkers (misc/filters/
 * domainReputation), and returns a random survivor. `openTunnel` still takes a
 * `domain` input, so a caller can pin one; the harness picks automatically.
 */

import { customAlphabet } from "nanoid";
import { startTunnel } from "untun";
import { FreeDnsClient, FreeDnsError } from "./freedns";

/** DNS labels are case-insensitive and limited to letters, digits and
 *  hyphens. Leading with a letter keeps the label valid everywhere (a
 *  label may not start with a digit under the stricter hostname rules some
 *  resolvers still apply). */
const firstChar = customAlphabet("abcdefghijklmnopqrstuvwxyz", 1);
const restChars = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 11);

/** A random 12-character DNS-safe label — long enough not to collide or be
 *  guessable, short enough to stay well under the 63-char label limit. */
function randomSubdomain(): string {
    return firstChar() + restChars();
}

export interface OpenTunnelOptions {
    /** Local port the Civil server is listening on. */
    port: number;
    /** The afraid.org public domain to put the subdomain under, and its
     *  registry id (from `FreeDnsClient.getRegistry`). */
    domain: { name: string; id: number | string };
    /** Answer to the FreeDNS creation captcha. Provide this or `solveCaptcha`. */
    captchaCode?: string;
    /** Called with the captcha image when `captchaCode` is not given. An OCR
     *  solver is never perfect, so when this is supplied a rejected captcha is
     *  retried with a fresh one — see `captchaAttempts`. */
    solveCaptcha?: (image: Uint8Array) => Promise<string>;
    /** How many times to solve-and-try the captcha before giving up. Only
     *  applies with `solveCaptcha` (a hand-typed `captchaCode` gets one shot,
     *  since re-typing it is the caller's job). Default 4. */
    captchaAttempts?: number;
    /** Reuse a logged-in client instead of logging in from the environment. */
    client?: FreeDnsClient;
    /** Override the generated subdomain label (mainly for tests). */
    subdomain?: string;
}

export interface Tunnel {
    /** The public URL: `https://<subdomain>.<domain>`. */
    url: string;
    /** The hostname alone. */
    hostname: string;
    /** The `*.trycloudflare.com` host the subdomain points at. */
    origin: string;
    /** Remove the FreeDNS subdomain and stop the cloudflared tunnel. Safe to
     *  call more than once. */
    close(): Promise<void>;
}

/**
 * Open a cloudflared tunnel to `localhost:<port>` and publish it under a
 * random FreeDNS subdomain of `domain`.
 *
 * The order matters for cleanup: the tunnel comes up first (so there is a real
 * host to point at), then the DNS record is created. On any failure after the
 * tunnel starts, it is stopped before the error propagates, so a half-open
 * tunnel is never left running.
 */
export async function openTunnel(options: OpenTunnelOptions): Promise<Tunnel> {
    if (!options.captchaCode && !options.solveCaptcha) {
        throw new Error(
            "openTunnel needs a captchaCode or a solveCaptcha callback: " +
                "FreeDNS gates subdomain creation behind a captcha.",
        );
    }

    const client = options.client ?? new FreeDnsClient();
    if (!options.client) await client.login();

    // The tunnel comes up first, so the captcha is only spent once there is a
    // real host to point the record at — and, with a solver, so a rejected
    // guess can be retried against a fresh captcha without tearing anything
    // down.
    const tunnel = await startTunnel({
        port: options.port,
        acceptCloudflareNotice: true,
    });
    if (!tunnel) {
        throw new Error("Failed to start the cloudflared tunnel.");
    }

    try {
        const publicUrl = await tunnel.getURL();
        // CNAME wants a bare host, not a URL.
        const origin = new URL(publicUrl).host;
        const subdomain = options.subdomain ?? randomSubdomain();

        await createSubdomainWithCaptcha(client, options, {
            recordType: "CNAME",
            subdomain,
            domainId: options.domain.id,
            destination: origin,
        });

        const hostname = `${subdomain}.${options.domain.name}`;
        let closed = false;

        return {
            url: `https://${hostname}`,
            hostname,
            origin,
            async close() {
                if (closed) return;
                closed = true;
                // Delete the DNS record first: it names the tunnel, so a
                // lingering record is worse than a lingering tunnel. Then
                // stop cloudflared regardless of whether that succeeded — a
                // failed delete must not strand the tunnel process.
                try {
                    const record = (await client.getSubdomains()).find(
                        s => s.subdomain === hostname,
                    );
                    if (record) await client.deleteSubdomain(record.id);
                } finally {
                    await tunnel.close();
                }
            },
        };
    } catch (error) {
        await tunnel.close();
        throw error;
    }
}

/**
 * Creates the subdomain, solving the captcha and — because an OCR guess is
 * often wrong — retrying against a fresh one. A hand-typed `captchaCode` gets a
 * single attempt: it can't be re-solved, so a wrong one is the caller's to fix.
 * Only a rejected *captcha* is retried; any other failure propagates at once.
 */
export async function createSubdomainWithCaptcha(
    client: FreeDnsClient,
    options: OpenTunnelOptions,
    record: {
        recordType: "CNAME";
        subdomain: string;
        domainId: number | string;
        destination: string;
    },
): Promise<void> {
    const attempts = options.solveCaptcha
        ? Math.max(1, options.captchaAttempts ?? 4)
        : 1;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        // Solver wins when present, so each retry is a fresh guess; a
        // hand-typed code is the fallback when there is no solver.
        const captchaCode = options.solveCaptcha
            ? await options.solveCaptcha(await client.getCaptcha())
            : options.captchaCode!;

        try {
            await client.createSubdomain({ ...record, captchaCode });
            return;
        } catch (error) {
            // Retry only a captcha rejection, and only when there is a solver
            // to produce a different guess and attempts left to spend. FreeDNS's
            // own error page never says "captcha" — a wrong guess comes back as
            // "The security code was incorrect, please try again." — so both
            // wordings are matched.
            const isCaptcha =
                error instanceof FreeDnsError &&
                /captcha|security code/i.test(error.message);
            if (!isCaptcha || !options.solveCaptcha || attempt === attempts) {
                throw error;
            }
        }
    }
}

export {
    createCaptchaSolver,
    createHybridCaptchaSolver,
} from "./captchaSolver";
export type {
    RecordType,
    Registry,
    RegistryDomain,
    Subdomain,
    SubdomainDetails,
} from "./freedns";
export {
    type PickDomainOptions,
    type PickedDomain,
    pickTunnelDomain,
} from "./pickDomain";
export { FreeDnsClient, FreeDnsError };
